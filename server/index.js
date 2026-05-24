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

const TASK_PLANNER_PROMPT = `你是 FocusBoost 的 ADHD 友好任务规划 AI。用户用中文描述待办（可能来自语音转写）。

## 第一步：识别与排序
1. 从用户原文提取所有独立任务，禁止编造。
2. 结合用户表述与常识，为每项判断：
   - priority: high | medium | low（重要程度）
   - urgency: 1-10（紧急程度）
   - priorityScore: 0-100（综合分，用于排序，越高越先做）
3. tasks 数组必须按 priorityScore 降序排列。

## 第二步：判断任务复杂度
**单动作简单任务**（不需要复杂拆解）：
- 日常生活小动作：洗衣服、洗碗、晾衣服、拖地、扫地、倒垃圾
- 个人习惯：刷牙、洗脸、洗澡、洗头、喝水、喝咖啡
- 简单购物：买奶茶、买咖啡、买早餐
- 宠物照料：浇水、喂猫、遛狗
- 一键操作：开空调、关灯、锁门

**多步骤复杂任务**（需要完整拆解）：写作、阅读、编程、学习、会议等。

## 第三步：ADHD 支线任务拆解

### A. 单动作简单任务（精简版）
仅1步，步骤标签即任务本身，不需要额外拆解。
示例「洗衣服」：洗衣服（3min）

### B. 多步骤复杂任务（完整版）
按实际流程拆解，每步提供明确的起始动作，降低认知负荷。
根据任务内容智能推断场景，例如「下楼买明天早上早餐」→ 第一步应为「穿鞋并下楼去超市/便利店」。
示例「写论文」：关闭无关标签页→打开 Word 软件或写作文档→写下第一句标题→写下引言第一句话→补上 3 个要点→保存文档

### 通用要求
- 每步 1-5 分钟
- 每步必须是单一、可执行、可被摄像头/浏览器行为验证的动作
- 每步必须以动作动词开头，例如：打开、关闭、拿出、放到、点击、输入、写下、读完、标记、找到、翻到、备好、保存、提交、发送、拍照
- 避免「开始工作」「执行任务」等模糊描述
- 禁止主题型/结果型步骤，例如「写报告引言」「准备资料」「整理思路」「学习数学」「继续写」「优化代码」
- 提供明确的起始动作（第一个动作要具体）
- 步骤标签不要重复主任务名称，只需描述动作本身
  错误示例：「完成洗衣服」「继续洗衣服下一步」
  正确示例：「把衣服放进洗衣机」「按开始键」
- 写作类任务必须拆到物理启动动作，不要输出「写报告引言」。例如用户说「写报告引言」，支线任务应包含「打开 Word 软件或写作文档」「写下第一句标题」「写下引言第一句话」

## 输出 JSON（仅 JSON，无 markdown）
{
  "tasks": [{
    "title": "简短任务名",
    "priority": "high|medium|low",
    "urgency": 1-10,
    "priorityScore": 0-100,
    "steps": [{ "label": "具体动作", "minutes": 3 }]
  }]
}`;

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
