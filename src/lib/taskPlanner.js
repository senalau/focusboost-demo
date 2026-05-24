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
      { label: "打开电脑", minutes: 2 },
      { label: "打开对应文档/工具", minutes: 3 },
      { label: "完成第一个最小动作", minutes: 4 },
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

const ACTION_START_PATTERN = /^(打开|关掉|关闭|拿出|放到|放进|走到|点击|新建|复制|粘贴|输入|写下|读完|标记|找到|翻到|备好|换上|坐下|保存|提交|发送|拍照|清理|归位|按下|选择|启动|运行|朗读|检查|记录|退出|只保留)/;
const VAGUE_STEP_PATTERN = /^(写|准备|整理|学习|研究|思考|处理|推进|继续|完成|做|弄|搞|优化|修改|看|阅读)(?!下|完|到|开|出|好)/;

const TASK_CONTEXTS = [
  {
    test: (t) => /买|取|寄|送|外出|下楼|出去/.test(t),
    simple: false,
    steps: () => [
      { label: `出门/下楼`, minutes: 2 },
      { label: `走到目的地`, minutes: 3 },
      { label: `挑选/取物品`, minutes: 3 },
      { label: `付款/确认`, minutes: 2 },
      { label: `返回`, minutes: 3 },
    ],
  },
  {
    test: (t) => /写|撰写|起草|论文|报告|周报|文案|邮件/.test(t),
    simple: false,
    steps: () => [
      { label: `手机静音扣桌上`, minutes: 2 },
      { label: `关闭社交与无关标签页`, minutes: 2 },
      { label: `打开 Word 软件或写作文档`, minutes: 2 },
      { label: `写下第一句标题`, minutes: 2 },
      { label: `写下引言第一句话`, minutes: 4 },
      { label: `补上 3 个要点`, minutes: 5 },
      { label: `读完这一小段并标记错字`, minutes: 3 },
      { label: `保存文档`, minutes: 1 },
    ],
  },
  {
    test: (t) => /读|阅读|复习|背诵|预习/.test(t),
    simple: false,
    steps: () => [
      { label: `手机静音，计时器备好`, minutes: 2 },
      { label: `清空桌面只留阅读材料`, minutes: 2 },
      { label: `翻到起始页/章节`, minutes: 2 },
      { label: `读完第一段并圈出关键词`, minutes: 5 },
      { label: `标记重点内容`, minutes: 3 },
      { label: `读完下一页并画一条线`, minutes: 5 },
      { label: `写下今天阅读的要点`, minutes: 2 },
    ],
  },
  {
    test: (t) => /代码|编程|开发|debug|修bug|部署/i.test(t),
    simple: false,
    steps: () => [
      { label: `手机静音，退出聊天工具`, minutes: 2 },
      { label: `只保留 IDE 与必要文档`, minutes: 2 },
      { label: `打开项目仓库/分支`, minutes: 2 },
      { label: `找到要改的文件位置`, minutes: 2 },
      { label: `写下一行最小逻辑`, minutes: 5 },
      { label: `运行本地检查或单测`, minutes: 4 },
      { label: `记下下一步要改什么`, minutes: 2 },
    ],
  },
  {
    test: (t) => /健身|运动|跑步|瑜伽|训练/.test(t),
    simple: false,
    steps: () => [
      { label: `手机静音或开专注模式`, minutes: 2 },
      { label: `换上运动服/鞋`, minutes: 2 },
      { label: `热身 3 分钟`, minutes: 3 },
      { label: `完成主要训练动作`, minutes: 5 },
      { label: `拉伸放松`, minutes: 3 },
      { label: `记录完成情况`, minutes: 2 },
    ],
  },
  {
    test: (t) => /打扫|清洁|收纳|整理|家务/.test(t),
    simple: false,
    steps: () => [
      { label: `手机静音`, minutes: 1 },
      { label: `选定第一个小区域`, minutes: 1 },
      { label: `清理桌面左上角区域`, minutes: 4 },
      { label: `把 5 件物品放回原位`, minutes: 5 },
      { label: `检查完成情况`, minutes: 3 },
      { label: `拍照记录成果`, minutes: 2 },
    ],
  },
  {
    test: (t) => /会议|汇报|演示|答辩|面试/.test(t),
    simple: false,
    steps: () => [
      { label: `手机静音`, minutes: 1 },
      { label: `关闭无关通知`, minutes: 1 },
      { label: `打开提纲/幻灯片`, minutes: 2 },
      { label: `准备一杯水，坐直`, minutes: 2 },
      { label: `朗读开场 30 秒`, minutes: 3 },
      { label: `演练最关键的一页/一段`, minutes: 5 },
      { label: `写下 1 个可能被问的问题`, minutes: 3 },
    ],
  },
  {
    test: (t) => /学|练习|刷题|备考/.test(t),
    simple: false,
    steps: () => [
      { label: `手机静音`, minutes: 1 },
      { label: `桌面只留练习册/平板`, minutes: 1 },
      { label: `翻到今天要做的题号/章节`, minutes: 2 },
      { label: `备好草稿纸和笔`, minutes: 2 },
      { label: `写下第 1 道题的第一步`, minutes: 5 },
      { label: `对答案并标出错因`, minutes: 3 },
      { label: `写下第 2 道题的已知条件`, minutes: 5 },
    ],
  },
];

const SYSTEM_PROMPT = `你是 FocusBoost 的 ADHD 友好任务规划 AI。用户用中文描述待办（可能来自语音转写）。

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
  // 去除口头禅/语气词前缀
  t = t.replace(/^(还要|也要|还得|得去|要去|需要去|去一下|赶紧|赶快|先|记得|要)\s*/g, "");
  // 规范化：下去买 → 下楼买
  t = t.replace(/下去买/g, "下楼买");
  // 去掉时间修饰和名词之间的 "的"：明天早上的早餐 → 明天早上早餐
  t = t.replace(/(早上|下午|晚上|中午|上午|傍晚|明天|今天|后天)(的)/g, "$1");
  // 去除重复名词：买早餐明天早上的早餐 → 买明天早上早餐
  t = t.replace(/(早餐|午餐|晚餐|午饭|晚饭|奶茶|咖啡|水果)(.+?)\1/g, "$2$1");
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
          .replace(/^(今天|本周|今日|明天|我要|我需要|我得|希望|计划|去做|做一下)\s*/i, "")
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
  if (!raw) return "打开任务工具并写下第一步";
  if (ACTION_START_PATTERN.test(raw) && !VAGUE_STEP_PATTERN.test(raw)) return raw;

  if (/引言|开头|报告|论文|周报|文案|邮件|写/.test(raw)) {
    if (/引言|开头/.test(raw)) return "打开 Word 软件并写下引言第一句话";
    if (/标题/.test(raw)) return "打开写作文档并写下第一句标题";
    return "打开 Word 软件并写下第一句标题";
  }
  if (/资料|文献|阅读|看/.test(raw)) return "打开资料页面并读完第一段";
  if (/代码|bug|开发|编程|优化|修改/.test(raw)) return "打开 IDE 并找到要修改的文件";
  if (/整理|收纳|清理/.test(raw)) return "选定桌面左上角并清走 3 件物品";
  if (/学习|复习|刷题|练习/.test(raw)) return "打开练习册并写下第一题第一步";
  if (/准备|思路|计划/.test(raw)) return "拿出纸笔并写下 1 个最小动作";
  if (/提交|发送/.test(raw)) return "打开提交页面并点击确认按钮";
  return `打开相关工具并完成「${shortTitle(raw, 10)}」的第一步`;
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
    return normalizeStepsList([toStep(short, 3)]);
  }

  // 默认模板（复杂任务）：以任务完成为目标拆解
  return normalizeStepsList([
    toStep(`打开电脑`, 2),
    toStep(`打开相关文档/工具`, 3),
    toStep(`完成第一个动作`, 4),
    toStep(`继续下一步`, 5),
    toStep(`检查完成情况`, 3),
    toStep(`收尾`, 4),
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
  return (import.meta.env.VITE_FOCUSBOOST_API_BASE || "").replace(/\/$/, "");
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
