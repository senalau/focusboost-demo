import express from "express";
import cors from "cors";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile() {
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(serverDir, ".env"),
    resolve(serverDir, "..", ".env"),
  ];
  const envPath = candidates.find((path) => existsSync(path));
  if (!envPath) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 8787;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const hasOpenAIKey = () => Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "replace-with-server-side-key");

const TASK_PLANNER_PROMPT = `你是 FocusBoost 的 ADHD 友好任务拆解 AI。用户会用中文描述一个或多个待办（可能来自语音转写）。

你的目标：先把用户的话提炼成清晰的「主线任务」，再围绕任务本身拆成简洁、具体、低压力的「支线任务」。

## 1. 主线任务提炼规则
- 从用户原文中提炼真实任务，禁止编造。
- title 必须是总结后的主线任务，不要原封不动复制用户长句。
- title 保留任务对象和结果，去掉口头禅、情绪、解释、时间废话。
- title 要像待办清单标题，建议 4-12 个字。
- 如果用户说的是「我要把明天汇报的产品定位改一下」，title 应为「修改产品定位」或「准备明天汇报」。
- 如果用户说的是「我要写一份关于 FocusBoost 的介绍」，title 应为「写 FocusBoost 介绍」。

## 2. 支线任务拆解规则
- steps 必须服务于这个主线任务本身，不要出现泛化步骤。
- 禁止出现这些无意义/工具型表达：
  - 打开相关工具
  - 打开对应文档/工具
  - 完成第一个动作
  - 继续下一步
  - 开始工作
  - 准备资料
  - 整理思路
- 不要为了摄像头/浏览器验证而写「打开工具」。MVP 不涉及浏览器行为验证。
- 支线任务要像用户真的下一步要做的事，跟任务对象强相关。
- 每条支线任务尽量短，建议 6-14 个字。
- 每条支线任务只做一件事。
- 每条支线任务 1-5 分钟。
- 复杂任务 3-6 步即可；简单任务 1-3 步即可。

## 3. 不同任务类型示例

用户：我要写 FocusBoost 的产品定位
输出：
title: 写产品定位
steps:
- 写下目标用户
- 写下核心痛点
- 写一句产品定义
- 改短这句话
- 保存最终版本

用户：我要改一下 AI 拆解逻辑
输出：
title: 修改 AI 拆解逻辑
steps:
- 找到拆解提示词
- 删掉泛化步骤
- 补充主线提炼规则
- 写两个测试任务
- 保存并重新发布

用户：我要准备明天的汇报
输出：
title: 准备明天汇报
steps:
- 列出汇报重点
- 检查第一页标题
- 补充核心结论
- 练习开场 30 秒
- 记录一个风险问题

用户：洗衣服
输出：
title: 洗衣服
steps:
- 收起脏衣服
- 放进洗衣机
- 按下开始键

## 4. 输出 JSON（仅 JSON，无 markdown）
{
  "tasks": [{
    "title": "提炼后的主线任务",
    "priority": "high|medium|low",
    "urgency": 1-10,
    "priorityScore": 0-100,
    "steps": [{ "label": "具体支线任务", "minutes": 3 }]
  }]
}`

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "focusboost-ai-api",
    openaiKeyConfigured: hasOpenAIKey(),
    model: OPENAI_MODEL,
  });
});

/** AI 任务拆解：OpenAI Key 只保存在后端环境变量中 */
app.post("/api/tasks/plan", async (req, res) => {
  const input = String(req.body?.input || "").trim();
  if (!input) return res.status(400).json({ error: "input required" });
  if (!hasOpenAIKey()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });

  try {
    const response = await fetch(`${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TASK_PLANNER_PROMPT },
          { role: "user", content: input },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: detail || "AI request failed" });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: "AI returned empty content" });

    const parsed = JSON.parse(content);
    res.json({ tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [], source: "openai", model: OPENAI_MODEL });
  } catch (error) {
    console.error("task plan failed", error);
    res.status(500).json({ error: "task plan failed" });
  }
});

/** 支线任务超时鼓励语：同样由后端托管 OpenAI Key */
app.post("/api/fragments/overdue-message", async (req, res) => {
  const stepLabel = String(req.body?.stepLabel || "").trim();
  if (!stepLabel) return res.status(400).json({ error: "stepLabel required" });
  if (!hasOpenAIKey()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });

  try {
    const response = await fetch(`${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.9,
        max_tokens: 40,
        messages: [
          {
            role: "system",
            content: "你是 FocusBoost 的 ADHD 友好游戏化行动教练。用户正在做一个支线任务但超过预估时间。请生成一句 24 字以内的温和行动提醒，目标是让用户立刻做一个很小的下一步。不要复述或改写用户的任务内容，不要说“你超时了”，不要批评。句子必须包含一个具体行动动词，例如打开、点击、写下、拿起、放到、读一行、做30秒。可以轻微游戏化，例如 Boss 血条、过一格、回合。仅输出一句话。",
          },
          { role: "user", content: stepLabel },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: detail || "AI request failed" });
    }

    const payload = await response.json();
    const message = payload?.choices?.[0]?.message?.content?.trim();
    if (!message) return res.status(502).json({ error: "AI returned empty content" });

    res.json({ message, source: "openai", model: OPENAI_MODEL });
  } catch (error) {
    console.error("overdue message failed", error);
    res.status(500).json({ error: "overdue message failed" });
  }
});

app.listen(PORT, () => {
  console.log(`FocusBoost AI API: http://localhost:${PORT}`);
});
