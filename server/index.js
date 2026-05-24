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
const hasOpenAIKey = () =>
  Boolean(
    process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== "replace-with-server-side-key"
  );

const TASK_PLANNER_PROMPT = `你是 FocusBoost 的 ADHD 友好任务拆解 AI。用户会用中文说一整句话，里面可能包含一个或多个真实待办。你的任务是：先提炼 1-3 个「主线任务」，再把每个主线任务拆成 3-5 个「支线任务」。

你的拆解目标：让 ADHD 用户一眼知道“下一步具体做什么”，但不要拆得像机器人指令一样过细。

## 一、主线任务提炼规则
1. 从用户原话里提炼真实待办，不要编造任务。
2. 如果一句话里有多个独立目标，拆成多个 tasks。
   例如：「下楼买早餐，然后回来改产品定位」=>「买早餐」「修改产品定位」。
3. 如果用户描述的是一个连续行动路线，只能作为一个主线任务。
   例如：「下楼买早餐」=> 主线任务是「买早餐」，不要拆成「下楼」「买早餐」「回家」三个主线任务。
4. title 要短，保留目标和结果，去掉“我想/我要/今天/等下/有点/帮我”等口语。
5. title 建议 3-12 个字。

## 二、支线任务拆解规则
1. 支线任务必须是现实中会发生的行动阶段，按真实顺序排列。
2. 支线任务不能太细，每一步应该是一个小阶段，不是微动作。
3. 每个支线任务必须和主线任务强相关，不要泛化。
4. 每个支线任务标题建议 2-12 个中文字符，最多 16 个字。
5. 每个支线任务只写动作本身，不要写解释。
6. 每个支线任务的 minutes 建议 2-10 分钟，简单任务可 1-5 分钟。

## 三、绝对禁止的支线任务表达
禁止输出以下句式或类似句式：
- 完成……的最小一步
- 完成……
- 开始……
- 继续……
- 推进……
- 处理一下……
- 准备……
- 整理思路
- 打开相关工具
- 打开对应文档
- 确认要做什么
- 做一点
- 先动起来

如果你想写「完成挑选早餐的最小一步」，必须改成「挑选早餐」。
如果你想写「完成回家的最小一步」，必须改成「回家」。
如果你想写「完成修改文案的最小一步」，必须改成「改写文案」。

## 四、好例子
用户输入：我想下楼买早餐
输出：
{
  "tasks": [
    {
      "title": "买早餐",
      "priority": "medium",
      "urgency": 5,
      "priorityScore": 60,
      "steps": [
        { "label": "穿鞋下楼", "minutes": 2 },
        { "label": "前往附近商店", "minutes": 5 },
        { "label": "挑选并购买早餐", "minutes": 8 },
        { "label": "回家", "minutes": 5 }
      ]
    }
  ]
}

用户输入：我要改一下产品定位文案
输出：
{
  "tasks": [
    {
      "title": "修改产品定位",
      "priority": "high",
      "urgency": 7,
      "priorityScore": 78,
      "steps": [
        { "label": "找出原文", "minutes": 3 },
        { "label": "明确目标用户", "minutes": 5 },
        { "label": "改写核心句子", "minutes": 8 },
        { "label": "删掉多余表述", "minutes": 5 },
        { "label": "保存最终版本", "minutes": 2 }
      ]
    }
  ]
}

用户输入：我要洗衣服
输出：
{
  "tasks": [
    {
      "title": "洗衣服",
      "priority": "medium",
      "urgency": 5,
      "priorityScore": 55,
      "steps": [
        { "label": "收起脏衣服", "minutes": 3 },
        { "label": "放进洗衣机", "minutes": 3 },
        { "label": "按下开始键", "minutes": 1 },
        { "label": "晾好衣服", "minutes": 5 }
      ]
    }
  ]
}

用户输入：我今天要下楼买早餐，然后改一下 AI 拆解逻辑
输出：
{
  "tasks": [
    {
      "title": "买早餐",
      "priority": "medium",
      "urgency": 5,
      "priorityScore": 60,
      "steps": [
        { "label": "穿鞋下楼", "minutes": 2 },
        { "label": "前往附近商店", "minutes": 5 },
        { "label": "挑选并购买早餐", "minutes": 8 },
        { "label": "回家", "minutes": 5 }
      ]
    },
    {
      "title": "修改 AI 拆解逻辑",
      "priority": "high",
      "urgency": 7,
      "priorityScore": 80,
      "steps": [
        { "label": "找到提示词", "minutes": 3 },
        { "label": "删掉泛化表达", "minutes": 5 },
        { "label": "补充行动示例", "minutes": 6 },
        { "label": "测试拆解结果", "minutes": 5 }
      ]
    }
  ]
}

## 五、输出要求
只返回 JSON，不要解释，不要 markdown。
JSON 必须符合：
{
  "tasks": [
    {
      "title": "主线任务标题",
      "priority": "high|medium|low",
      "urgency": 1,
      "priorityScore": 50,
      "steps": [
        { "label": "支线任务标题", "minutes": 3 }
      ]
    }
  ]
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanStepLabel(label = "") {
  let text = String(label || "").trim();

  text = text
    .replace(/^完成(.+?)的最小一步$/, "$1")
    .replace(/^完成(.+?)$/, "$1")
    .replace(/^开始(.+?)$/, "$1")
    .replace(/^继续(.+?)$/, "$1")
    .replace(/^推进(.+?)$/, "$1")
    .replace(/^处理一下(.+?)$/, "$1")
    .replace(/^处理(.+?)$/, "$1")
    .replace(/^准备(.+?)$/, "$1")
    .replace(/^先(.+?)$/, "$1")
    .replace(/^(打开相关工具|打开对应文档|打开对应工具|整理思路|确认要做什么|做一点|先动起来)$/, "")
    .replace(/的最小一步$/, "")
    .trim();

  return text || "做下一步";
}

function normalizeTasks(rawTasks) {
  if (!Array.isArray(rawTasks)) return [];

  return rawTasks
    .map((task, index) => {
      const title =
        String(task?.title || `任务 ${index + 1}`)
          .trim()
          .slice(0, 24) || `任务 ${index + 1}`;

      const steps = Array.isArray(task?.steps) ? task.steps : [];

      const normalizedSteps = steps
        .map((step) => ({
          label: cleanStepLabel(step?.label),
          minutes: clampNumber(step?.minutes, 1, 15, 3),
        }))
        .filter(
          (step) =>
            step.label &&
            !["打开相关工具", "整理思路", "确认要做什么"].includes(step.label)
        )
        .slice(0, 6);

      return {
        title,
        priority: ["high", "medium", "low"].includes(task?.priority)
          ? task.priority
          : "medium",
        urgency: clampNumber(task?.urgency, 1, 10, 5),
        priorityScore: clampNumber(task?.priorityScore, 0, 100, 60),
        steps: normalizedSteps.length
          ? normalizedSteps
          : [{ label: "做下一步", minutes: 3 }],
      };
    })
    .filter((task) => task.title && task.steps.length)
    .slice(0, 3);
}

/** AI 任务拆解：API Key 只保存在后端环境变量中 */
app.post("/api/tasks/plan", async (req, res) => {
  const input = String(req.body?.input || "").trim();

  if (!input) {
    return res.status(400).json({ error: "input required" });
  }

  if (!hasOpenAIKey()) {
    return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  }

  try {
    const response = await fetch(
      `${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: TASK_PLANNER_PROMPT },
            { role: "user", content: input },
          ],
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({
        error: detail || "AI request failed",
      });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: "AI returned empty content" });
    }

    const parsed = JSON.parse(content);

    res.json({
      tasks: normalizeTasks(parsed.tasks),
      source: "openai",
      model: OPENAI_MODEL,
    });
  } catch (error) {
    console.error("task plan failed", error);
    res.status(500).json({ error: "task plan failed" });
  }
});

/** 支线任务超时鼓励语：同样由后端托管 API Key */
app.post("/api/fragments/overdue-message", async (req, res) => {
  const stepLabel = String(req.body?.stepLabel || "").trim();

  if (!stepLabel) {
    return res.status(400).json({ error: "stepLabel required" });
  }

  if (!hasOpenAIKey()) {
    return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  }

  try {
    const response = await fetch(
      `${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 1,
          max_tokens: 40,
          messages: [
            {
              role: "system",
              content:
                "你是 FocusBoost 的 ADHD 友好游戏化行动教练。用户正在做一个支线任务但超过预估时间。请生成一句 24 字以内的温和行动提醒，目标是让用户立刻做一个很小的下一步。不要复述或改写用户的任务内容，不要说“你超时了”，不要批评。句子必须包含一个具体行动动词，例如打开、点击、写下、拿起、放到、读一行、做30秒。可以轻微游戏化，例如 Boss 血条、过一格、回合。仅输出一句话。",
            },
            { role: "user", content: stepLabel },
          ],
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({
        error: detail || "AI request failed",
      });
    }

    const payload = await response.json();
    const message = payload?.choices?.[0]?.message?.content?.trim();

    if (!message) {
      return res.status(502).json({ error: "AI returned empty content" });
    }

    res.json({
      message,
      source: "openai",
      model: OPENAI_MODEL,
    });
  } catch (error) {
    console.error("overdue message failed", error);
    res.status(500).json({ error: "overdue message failed" });
  }
});

app.listen(PORT, () => {
  console.log(`FocusBoost AI API: http://localhost:${PORT}`);
});
