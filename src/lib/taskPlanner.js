/** ADHD 支线任务阶段 */
export const STEP_PHASE = {
  DISCONNECT: "disconnect",
  PREPARE: "prepare",
  CORE: "core",
};

export const STEP_PHASE_LABEL = {
  disconnect: "环境断开",
  prepare: "物理准备",
  core: "核心行动",
};

const MIN_STEP_MINUTES = 1;
const MAX_STEP_MINUTES = 5;

const DEFAULT_DAILY_TASKS = [
  {
    id: "task-demo-1",
    title: "示例任务",
    priority: "medium",
    urgency: 5,
    priorityScore: 50,
    steps: [
      { label: "写下任务目标", minutes: 2 },
      { label: "完成最小一步", minutes: 3 },
      { label: "记录完成结果", minutes: 2 },
    ],
  },
];

const URGENCY_RULES = [
  { pattern: /今天|今晚|马上|立即|紧急|urgent|asap|截止|deadline|必须/i, urgency: 9, priority: 9 },
  { pattern: /明天|本周|这周/i, urgency: 7, priority: 7 },
  { pattern: /下周|之后|有空|顺便/i, urgency: 4, priority: 4 },
];

const PRIORITY_RULES = [
  { pattern: /提交|答辩|考试|面试|交付|发布|上线|客户/i, priority: 9 },
  { pattern: /论文|报告|作业|项目|老板|课程/i, priority: 7 },
  { pattern: /整理|备份|清理|阅读|运动|健身/i, priority: 5 },
];

/** 单动作任务关键词 - 这类任务不需要复杂拆解 */
const SIMPLE_TASK_KEYWORDS = [
  /洗衣服|洗碗|晾衣服|拖地|扫地/i,
  /倒垃圾|扔垃圾|丢垃圾/i,
  /浇水|喂猫|遛狗/i,
  /刷牙|洗脸|洗澡|洗头/i,
  /喝咖啡|喝水|吃早饭|吃午饭|吃晚饭/i,
  /开空调|关灯|锁门/i,
  /买.*奶茶|买.*咖啡|买.*早餐/i,
];

const ACTION_START_PATTERN = /^(打开|关掉|关闭|拿出|放到|放进|走到|点击|新建|复制|粘贴|输入|写下|读完|标记|找到|翻到|备好|换上|坐下|保存|提交|发送|拍照|清理|归位|按下|选择|启动|运行|朗读|检查|记录|退出|只保留|穿鞋|下楼|出门|前往|走去|到达|挑选|购买|买|付款|带回|返回|回家|收起|晾好|删掉|补充|测试|练习|完成)/;
const VAGUE_STEP_PATTERN = /^(写|准备|整理|学习|研究|思考|处理|推进|继续|完成|做|弄|搞|优化|修改|看|阅读)(?!下|完|到|开|出|好)/;


function extractPurchaseItem(title) {
  const text = String(title || "");
  const known = text.match(/早餐|早饭|午餐|午饭|晚餐|晚饭|咖啡|奶茶|水果|药|菜|零食|饮料|面包|水/);
  if (known) return known[0];
  const match = text.match(/买(.+?)(?:$|[，。；,;]|然后|再|顺便|回来|回家)/);
  if (!match) return "东西";
  let item = match[1]
    .replace(/^(一份|一个|一杯|一些|点|附近的|楼下的|便利店的|超市的|商店的)/, "")
    .replace(/(回来|回家|带回家)$/g, "")
    .trim();
  return item || "东西";
}

function getPurchaseDestination(title, item) {
  const text = String(title || "");
  if (/便利店/.test(text)) return "便利店";
  if (/超市/.test(text)) return "超市";
  if (/商店|小店/.test(text)) return "商店";
  if (/咖啡店/.test(text)) return "咖啡店";
  if (/药店/.test(text)) return "药店";
  if (/菜市场|市场/.test(text)) return "菜市场";
  if (/早餐|早饭|咖啡|奶茶|面包|零食|饮料/.test(item)) return "附近商店";
  return "目的地";
}

function purchaseStepsFor(title) {
  const item = extractPurchaseItem(title);
  const destination = getPurchaseDestination(title, item);
  const firstStep = /网购|线上|网上/.test(title) ? "确认购买内容" : "穿鞋下楼";
  const placeStep = destination === "目的地" ? "前往购买地点" : `前往${destination}`;
  const buyStep = item === "东西" ? "挑选并完成购买" : `挑选并购买${item}`;
  return [
    { label: firstStep, minutes: 2 },
    { label: placeStep, minutes: 3 },
    { label: buyStep, minutes: 4 },
    { label: "回家", minutes: 3 },
  ];
}

const TASK_CONTEXTS = [
  {
    test: (t) => /买|下楼.*买|楼下.*买|出去.*买|去.*买/.test(t),
    simple: false,
    steps: (title) => purchaseStepsFor(title),
  },
  {
    test: (t) => /取|寄|送/.test(t),
    simple: false,
    steps: (title) => [
      { label: /下楼|楼下|出门|出去/.test(title) ? "穿鞋下楼" : "穿鞋出门", minutes: 2 },
      { label: /快递/.test(title) ? "前往快递点" : "前往目的地", minutes: 3 },
      { label: /寄/.test(title) ? "完成寄件" : /送/.test(title) ? "送到指定地点" : "取回物品", minutes: 4 },
      { label: "回家", minutes: 3 },
    ],
  },
  {
    test: (t) => /写|撰写|起草|论文|报告|周报|文案|邮件/.test(t),
    simple: false,
    steps: () => [
      { label: `写下标题`, minutes: 2 },
      { label: `列出 3 个要点`, minutes: 4 },
      { label: `写第一句话`, minutes: 3 },
      { label: `补充一个例子`, minutes: 4 },
      { label: `改短一段话`, minutes: 3 },
    ],
  },
  {
    test: (t) => /洗衣服|洗衣|晾衣服/.test(t),
    simple: false,
    steps: () => [
      { label: `收起脏衣服`, minutes: 2 },
      { label: `放进洗衣机`, minutes: 2 },
      { label: `按下开始键`, minutes: 1 },
      { label: `晾好衣服`, minutes: 4 },
    ],
  },
  {
    test: (t) => /读|阅读|复习|背诵|预习/.test(t),
    simple: false,
    steps: () => [
      { label: `翻到目标章节`, minutes: 2 },
      { label: `读完第一段`, minutes: 4 },
      { label: `圈出关键词`, minutes: 3 },
      { label: `读完下一页`, minutes: 5 },
      { label: `写下 1 个要点`, minutes: 2 },
    ],
  },
  {
    test: (t) => /AI 拆解|ai 拆解|拆解逻辑|拆解规则|提示词|prompt/i.test(t),
    simple: false,
    steps: () => [
      { label: `找到拆解规则`, minutes: 2 },
      { label: `删掉泛化步骤`, minutes: 3 },
      { label: `补充行动流示例`, minutes: 4 },
      { label: `测试两个任务`, minutes: 4 },
    ],
  },
  {
    test: (t) => /代码|编程|开发|debug|修bug|部署/i.test(t),
    simple: false,
    steps: () => [
      { label: `找到要改的文件`, minutes: 2 },
      { label: `定位问题代码`, minutes: 3 },
      { label: `改一处最小逻辑`, minutes: 5 },
      { label: `运行本地检查`, minutes: 4 },
      { label: `记录下一步修改`, minutes: 2 },
    ],
  },
  {
    test: (t) => /健身|运动|跑步|瑜伽|训练/.test(t),
    simple: false,
    steps: () => [
      { label: `换上运动服/鞋`, minutes: 2 },
      { label: `热身 3 分钟`, minutes: 3 },
      { label: `完成主要训练动作`, minutes: 5 },
      { label: `拉伸放松`, minutes: 3 },
    ],
  },
  {
    test: (t) => /打扫|清洁|收纳|整理|家务/.test(t),
    simple: false,
    steps: () => [
      { label: `选定第一个小区域`, minutes: 1 },
      { label: `清走 3 件物品`, minutes: 4 },
      { label: `把物品放回原位`, minutes: 5 },
      { label: `检查完成情况`, minutes: 3 },
    ],
  },
  {
    test: (t) => /会议|汇报|演示|答辩|面试/.test(t),
    simple: false,
    steps: () => [
      { label: `列出汇报重点`, minutes: 3 },
      { label: `检查页面顺序`, minutes: 2 },
      { label: `补充核心结论`, minutes: 4 },
      { label: `练习开场 30 秒`, minutes: 3 },
    ],
  },
  {
    test: (t) => /学|练习|刷题|备考/.test(t),
    simple: false,
    steps: () => [
      { label: `翻到目标题号`, minutes: 2 },
      { label: `写下已知条件`, minutes: 3 },
      { label: `完成第一题第一步`, minutes: 5 },
      { label: `对答案并标错因`, minutes: 3 },
    ],
  },
]

const SYSTEM_PROMPT = `你是 FocusBoost 的 ADHD 友好任务拆解 AI。用户会用中文说一整段话，里面可能包含一个或多个真实待办。你的任务是：先从用户的话里提炼出「几个主线任务」，再把每个主线任务拆成符合现实行动顺序的「支线任务」。

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
}`;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 检查是否是单动作简单任务 */
function isSimpleTask(title) {
  return SIMPLE_TASK_KEYWORDS.some(pattern => pattern.test(title));
}

export function shortTitle(title, max = 14) {
  const t = String(title).trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** 提炼任务标题：去除冗余措辞，保留核心语义 */
function summarizeTitle(text) {
  let t = text.trim();
  // 先去除开头时间词（紧急度已由 URGENCY_RULES 捕获），避免遮挡后面的语气词
  t = t.replace(/^(今晚|今天|今早|明早|今天下午)\s*/g, "");
  // 去除开头的时间期限表达
  t = t.replace(/^\d{1,2}点(前|之前|半)?\s*/g, "");
  // 去除口头禅/语气词前缀，保留任务对象
  t = t.replace(/^(我今天要|我今天想|我今天需要|今天要|今天想|今天需要|我想要|我想|我要|我需要|我得|需要|帮我|请帮我|麻烦帮我|还要|也要|还得|得去|要去|需要去|去一下|赶紧|赶快|先|记得|要)\s*/g, "");
  // 规范化：下去买 → 下楼买
  t = t.replace(/下去买/g, "下楼买");
  // 去掉时间修饰和名词之间的 "的"：明天早上的早餐 → 明天早上早餐
  t = t.replace(/(早上|下午|晚上|中午|上午|傍晚|明天|今天|后天)(的)/g, "$1");
  // 去除重复名词：买早餐明天早上的早餐 → 买明天早上早餐
  t = t.replace(/(早餐|午餐|晚餐|午饭|晚饭|奶茶|咖啡|水果)(.+?)\1/g, "$2$1");
  // 连续行动路线提炼成结果型任务标题：下楼买早餐 → 买早餐
  t = t.replace(/^(下楼|楼下|出去|出门|去|前往|到附近|到楼下)买(.+)$/g, "买$2");
  t = t.replace(/^去(.+?)(买|取|寄|送)(.+)$/g, "$2$3");
  t = t.replace(/买(一杯|杯|一个|个|一份|份|一点|点|一些)/g, "买");
  return t.trim();
}

function parseRawItems(input) {
  const normalized = input
    .replace(/\r\n/g, "\n")
    .replace(/(\d+)[.、)\]](?=\s)/g, "\n")
    .trim();

  const parts = normalized
    .split(/[\n，,；;、]|(?:以及|还有|另外|然后|再|并且|还要|和(?=[写读学做买洗打整出下回看发送准备完处修交]))(?=\S)/)
    .map((part) =>
      summarizeTitle(
        part
          .replace(/^(我今天要|我今天想|我今天需要|今天要|今天想|今天需要|今天|本周|今日|明天|我要|我需要|我得|希望|计划|去做|做一下)\s*/i, "")
          .replace(/^[：:\-–—]\s*/, "")
          .trim()
      )
    )
    .filter((part) => part.length >= 2);

  if (parts.length > 0) return parts;
  const colonParts = normalized.split(/[：:]/).map((s) => s.trim()).filter((s) => s.length >= 2);
  if (colonParts.length > 1) return colonParts.slice(1);
  return normalized ? [normalized] : [];
}

function scoreItem(text) {
  let urgency = 5;
  let priority = 5;

  for (const rule of URGENCY_RULES) {
    if (rule.pattern.test(text)) {
      urgency = Math.max(urgency, rule.urgency);
      priority = Math.max(priority, rule.priority ?? priority);
    }
  }
  for (const rule of PRIORITY_RULES) {
    if (rule.pattern.test(text)) {
      priority = Math.max(priority, rule.priority);
    }
  }

  const priorityScore = Math.round(urgency * 6 + priority * 4);
  const priorityLabel = priorityScore >= 80 ? "high" : priorityScore >= 55 ? "medium" : "low";

  return { urgency, priority: priorityLabel, priorityScore };
}

function actionizeStepLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return "写下任务的第一步";
  if (/^完成「.+」关键一步$/.test(raw) || /^明确「.+」结果$/.test(raw)) return raw;
  if (ACTION_START_PATTERN.test(raw) && !VAGUE_STEP_PATTERN.test(raw)) return raw;

  if (/引言|开头|报告|论文|周报|文案|邮件|写/.test(raw)) {
    if (/引言|开头/.test(raw)) return "写下引言第一句话";
    if (/标题/.test(raw)) return "写下第一句标题";
    return "写下第一句标题";
  }
  if (/资料|文献|阅读|看/.test(raw)) return "读完第一段并圈关键词";
  if (/代码|bug|开发|编程|优化|修改/.test(raw)) return "找到要修改的文件";
  if (/整理|收纳|清理/.test(raw)) return "选定桌面左上角并清走 3 件物品";
  if (/学习|复习|刷题|练习/.test(raw)) return "写下第一题第一步";
  if (/准备|思路|计划/.test(raw)) return "拿出纸笔并写下 1 个最小动作";
  if (/提交|发送/.test(raw)) return "检查内容并点击确认";
  return `完成「${shortTitle(raw, 10)}」的最小一步`;
}

function toStep(label, minutes) {
  return {
    id: uid("step"),
    label: actionizeStepLabel(label),
    minutes: clamp(Math.round(minutes), MIN_STEP_MINUTES, MAX_STEP_MINUTES),
  };
}

/** 超过 5 分钟的步骤拆成多条 1-5 分钟支线任务 */
function expandStepDuration(step) {
  const rawMinutes = Number(step.minutes) || MAX_STEP_MINUTES;
  if (rawMinutes <= MAX_STEP_MINUTES) {
    return [toStep(step.label, rawMinutes)];
  }

  const chunks = [];
  let remaining = rawMinutes;
  let index = 1;
  while (remaining > 0) {
    const chunkMin = Math.min(MAX_STEP_MINUTES, remaining);
    const suffix = index > 1 ? `（续 ${index}）` : "";
    chunks.push(toStep(`${step.label}${suffix}`, chunkMin));
    remaining -= chunkMin;
    index += 1;
  }
  return chunks;
}

function normalizePhase(phase) {
  if (phase === STEP_PHASE.DISCONNECT || phase === "disconnect") return STEP_PHASE.DISCONNECT;
  if (phase === STEP_PHASE.PREPARE || phase === "prepare") return STEP_PHASE.PREPARE;
  return STEP_PHASE.CORE;
}

function normalizeStepsList(steps) {
  const expanded = (steps || []).flatMap((step, stepIndex) =>
    expandStepDuration({
      id: step.id || uid(`step-${stepIndex}`),
      label: step.label || step.title || "支线任务",
      minutes: step.minutes,
    })
  );

  return expanded;
}

function buildAdhdStepsForTask(title) {
  const ctx = TASK_CONTEXTS.find((c) => c.test(title));
  const short = shortTitle(title);
  const isSimple = isSimpleTask(title);

  // 匹配到任务类型模板（优先于简单任务判断）
  if (ctx) {
    return normalizeStepsList(ctx.steps(title));
  }

  // 简单任务仅1步，步骤标签即任务本身
  if (isSimple) {
    return normalizeStepsList([{ label: short, minutes: 3 }]);
  }

  // 默认模板：保持跟任务本身相关，不生成“打开工具”类步骤
  return normalizeStepsList([
    { label: `明确「${short}」结果`, minutes: 2 },
    { label: `完成「${short}」关键一步`, minutes: 5 },
    { label: `检查「${short}」结果`, minutes: 3 },
  ]);
}

function ensureAdhdStructure(steps, taskTitle) {
  let list = normalizeStepsList(steps);

  // 如果步骤为空，提供默认拆解
  if (!list || list.length === 0) {
    list = buildAdhdStepsForTask(taskTitle);
  }

  return list;
}

function normalizeTask(task, index, total) {
  const title = String(task.title || `任务 ${index + 1}`).trim();
  const steps = ensureAdhdStructure(task.steps, title);
  const totalMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);
  const priorityScore = clamp(Number(task.priorityScore) || 50, 0, 100);
  const urgency = clamp(Number(task.urgency) || 5, 1, 10);

  let priority = task.priority;
  if (!["high", "medium", "low"].includes(priority)) {
    priority = priorityScore >= 80 ? "high" : priorityScore >= 55 ? "medium" : "low";
  }

  return {
    id: task.id || uid(`task-${index}`),
    title,
    subtitle: `Task ${index + 1} / ${total}`,
    totalMinutes,
    priority,
    urgency,
    priorityScore,
    steps,
  };
}

function normalizePlan(rawTasks) {
  const list = Array.isArray(rawTasks) ? rawTasks : [];
  const sorted = [...list].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  return sorted.map((task, index) => normalizeTask(task, index, sorted.length));
}

function planTasksLocally(input) {
  const items = parseRawItems(input);
  const source = items.length > 0 ? items : [input.trim()];

  const scored = source.map((title) => ({ title, ...scoreItem(title) }));
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  const tasks = scored.map((item, index) => {
    const steps = buildAdhdStepsForTask(item.title);
    return normalizeTask(
      {
        id: uid(`task-${index}`),
        title: item.title,
        priority: item.priority,
        urgency: item.urgency,
        priorityScore: item.priorityScore,
        steps,
      },
      index,
      scored.length
    );
  });

  return {
    tasks,
    source: "local",
  };
}

function getFocusBoostApiBase() {
  return (import.meta.env?.VITE_FOCUSBOOST_API_BASE || "").replace(/\/$/, "");
}

async function planTasksWithBackend(input) {
  const response = await fetch(`${getFocusBoostApiBase()}/api/tasks/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `后端 AI 拆解失败 (${response.status})`);
  }

  const payload = await response.json();
  const tasks = normalizePlan(payload.tasks);

  if (tasks.length === 0) throw new Error("AI 未生成任务");

  return {
    tasks,
    source: payload.source || "openai",
  };
}

export async function planTasksFromInput(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("请先输入或语音说出任务内容");
  }

  try {
    const aiPlan = await planTasksWithBackend(trimmed);
    if (aiPlan) return aiPlan;
  } catch (error) {
    console.warn("[taskPlanner] backend AI failed, using local planner:", error);
  }

  return planTasksLocally(trimmed);
}

export function getDefaultDailyTasks() {
  return normalizePlan(DEFAULT_DAILY_TASKS);
}

export function getCurrentStep(task, stepIndex) {
  if (!task?.steps?.length) return null;
  return task.steps[clamp(stepIndex, 0, task.steps.length - 1)];
}

export function formatPriorityLabel(priority) {
  if (priority === "high") return "高优先";
  if (priority === "low") return "低优先";
  return "中优先";
}

export function formatUrgencyLabel(urgency) {
  if (urgency >= 8) return "紧急";
  if (urgency >= 5) return "一般";
  return "可延后";
}

export function formatStepPhaseLabel(phase) {
  return STEP_PHASE_LABEL[phase] || STEP_PHASE_LABEL.core;
}

export function getPlannerModeLabel(source) {
  if (source === "openai") return "AI 排序 + ADHD 拆解";
  return "本地排序 + ADHD 拆解";
}
