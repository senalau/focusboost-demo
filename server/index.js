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

const TASK_PLANNER_PROMPT = `你是 FocusBoost 的 ADHD 友好任务拆解 AI。用户会用中文说一整段话，里面可能包含一个或多个真实待办。你的任务是：先从用户的话里提炼出「几个主线任务」，再把每个主线任务拆成符合现实行动顺序的「支线任务」。

核心原则：支线任务不是抽象建议，也不是工具操作，而是用户在现实中真的会做的连续动作。

## 1. 主线任务提炼规则
- 从用户原文中提炼真实任务，禁止编造。
- 如果用户一句话里有多个独立目标，要拆成多个 tasks。
  - 例如「下楼买早餐，然后回来写产品定位」应拆成「买早餐」和「写产品定位」。
- 如果用户描述的是一个连续行动路线，不要拆成多个主线任务。
  - 例如「下楼买早餐」只能是一个主线任务：「买早餐」。
  - 不要把「下楼」「买早餐」「回家」拆成三个主线任务，它们应该是同一个任务的支线步骤。
- title 必须是提炼后的待办标题，不要原封不动复制用户长句。
- title 保留任务对象和结果，去掉口头禅、情绪、解释、时间废话。
- title 建议 3-12 个字。

## 2. 支线任务拆解规则
- steps 必须按真实行动顺序排列。
- 每个 step 要跟任务本身强相关，不能出现泛化废话。
- 不要拆得太细，通常 3-5 步即可；非常简单的任务 2-3 步即可。
- 每条 step 建议 4-14 个字。
- 每条 step 只做一件清楚的事。
- 每条 step 预估 1-5 分钟。
- 禁止出现这些无意义/工具型表达：
  - 打开相关工具
  - 打开对应文档/工具
  - 准备资料
  - 整理思路
  - 完成第一个动作
  - 继续下一步
  - 开始工作
  - 做一点
  - 处理一下
- 不要为了摄像头/浏览器验证写「打开工具」。MVP 不涉及浏览器行为验证。

## 3. 关键示例

用户：我想下楼买早餐
输出：
title: 买早餐
steps:
- 穿鞋下楼
- 前往便利店
- 挑选并购买早餐
- 回家

用户：下楼买杯咖啡
输出：
title: 买咖啡
steps:
- 穿鞋下楼
- 前往附近商店
- 挑选并购买咖啡
- 回家

用户：我要洗衣服
输出：
title: 洗衣服
steps:
- 收起脏衣服
- 放进洗衣机
- 按下开始键
- 晾好衣服

用户：我想把 FocusBoost 的产品定位改清楚一点
输出：
title: 修改产品定位
steps:
- 写下目标用户
- 写下核心痛点
- 写一句产品定义
- 删掉多余表述
- 保存最终版本

用户：我要准备明天的汇报
输出：
title: 准备明天汇报
steps:
- 列出汇报重点
- 检查页面顺序
- 补充核心结论
- 练习开场 30 秒

用户：我今天要下楼买早餐，然后改一下 AI 拆解逻辑
输出两个 tasks：
1. title: 买早餐
steps: 穿鞋下楼 / 前往便利店 / 挑选并购买早餐 / 回家
2. title: 修改 AI 拆解逻辑
steps: 找到拆解规则 / 删掉泛化步骤 / 补充行动流示例 / 测试两个任务

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
