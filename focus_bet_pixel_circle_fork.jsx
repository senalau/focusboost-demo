import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Bluetooth,
  Check,
  ChevronLeft,
  Circle as CircleIcon,
  Copy,
  Gift,
  Home,
  Mic,
  Send,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { useFragmentTimer } from "./src/hooks/useFragmentTimer.js";
import { appendSpeechText, useSpeechInput } from "./src/hooks/useSpeechInput.js";
import {
  getCurrentStep,
  getDefaultDailyTasks,
  planTasksFromInput,
} from "./src/lib/taskPlanner.js";
import {
  COMPLETION_THRESHOLD,
  DAILY_FOCUS_COINS,
  DEFAULT_STAKE_COINS,
  loadFocusCoinSnapshot,
  saveFocusCoinSnapshot,
} from "./src/lib/wallet.js";

const CIRCLES = [
  {
    id: "c1",
    avatar: "👩",
    name: "Mia",
    status: "guarded",
    role: "",
    tag: "启动困难",
    tagTone: "stuck",
    action: "正在憋论文引言",
    scene: "writing",
  },
  {
    id: "c2",
    avatar: "🧑‍💻",
    name: "Alex",
    status: "guarded",
    role: "",
    tag: "深度专注中",
    tagTone: "focusing",
    action: "正在写代码",
    scene: "coding",
  },
  {
    id: "c3",
    avatar: "🧑‍🎤",
    name: "Nina",
    status: "guarded",
    role: "",
    tag: "注意力偏航",
    tagTone: "drifting",
    action: "正在录歌 Demo",
    scene: "music",
  },
];

const CREW = ["👩", "🧑‍💻", "🧑‍🎤", "🧔"];
const SHOTS = ["09:12", "09:18", "09:24", "09:31", "09:40"];
const AUTO_CONFIRM_SECONDS = 3;
const STAKE_OPTIONS = [3, 5, 10];
const SUPPORT_SKILL_META = {
  double: { title: "翻倍奖励卡已投放", copy: "亲友把奖励翻倍卡塞进了你的道具栏，通关这条支线就爆金币。", thanks: "及时翻倍", medals: 2 },
  time: { title: "弹性续时卡已投放", copy: "亲友为你争取了 5 分钟弹性缓冲，先做眼前这一小格。", thanks: "及时续时", medals: 2 },
  cheer: { title: "温和鼓励卡已抵达", copy: "亲友的温和唤醒已经同步，先完成一个最小动作。", thanks: "温柔鼓励", medals: 1 },
};

function getCircleById(id) {
  return CIRCLES.find((item) => item.id === id) || CIRCLES[0];
}

function getTaskLevelLabel(index, total = 3) {
  return `关卡 ${index + 1}/${total}`;
}

function getFilledBlocks(progress) {
  return Math.max(1, Math.min(10, Math.ceil(progress / 10)));
}

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatCoin(value) {
  return Number(value || 0).toFixed(1);
}

function pickBossClearCopy(result) {
  const cleared = result?.success;
  const pool = cleared
    ? [
        "今日大 Boss 已被成功消灭",
        "主线 Boss 破防，今日通关",
        "专注魔王倒下了，奖励结算",
        "今日关底 Boss 已清屏",
      ]
    : [
        "今日 Boss 被打掉一大截",
        "Boss 血条已削弱，明天继续",
        "今日小队已推进战线",
        "Boss 没倒，但你抢回了回合",
      ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickCheerCardText(friendName = "我") {
  const pool = [
    `${friendName}：先不用完美，打开它就已经赢一半。`,
    `${friendName}：打掉眼前这一格，Boss 血条马上掉。`,
    `${friendName}：只做 30 秒也算启动，先动起来。`,
    `${friendName}：你的任务不是全做完，是先过这一小关。`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function speakGameCue(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1.22;
  utterance.pitch = 1.55;
  window.speechSynthesis.speak(utterance);
}

function buildSettlementResult({ stakeAmount, totalSteps, completedSteps, supportSkillCount = 0, unlockedStakeCoins = 0, doubleRewardCoins = 0 }) {
  const safeTotal = Math.max(1, totalSteps);
  const completed = Math.min(safeTotal, Math.max(0, completedSteps));
  const completionRate = Math.round((completed / safeTotal) * 100);
  const success = completionRate >= COMPLETION_THRESHOLD;
  const earnedBySteps = Math.min(stakeAmount, unlockedStakeCoins);
  const finalReturnAmount = success ? Math.max(0, stakeAmount - earnedBySteps) : 0;
  const challengeBonusAmount = success ? stakeAmount : 0;
  const guardianRewardAmount = success ? stakeAmount * 0.5 : 0;
  const rescuedAmount = earnedBySteps + finalReturnAmount;
  const lockedAmount = Math.max(0, stakeAmount - rescuedAmount);

  return {
    completionRate,
    success,
    completedSteps: completed,
    totalSteps: safeTotal,
    supportSkillCount,
    stakeAmount,
    stepCoinAmount: stakeAmount / safeTotal,
    earnedBySteps,
    rescuedAmount,
    finalReturnAmount,
    challengeBonusAmount,
    doubleRewardCoins,
    guardianRewardAmount,
    totalUserRewardAmount: rescuedAmount + challengeBonusAmount + doubleRewardCoins,
    lockedAmount,
    rolloverAmount: lockedAmount,
    settledAt: new Date().toISOString(),
  };
}

function runPrototypeSmokeTests() {
  const defaults = getDefaultDailyTasks();
  console.assert(defaults.length >= 1, "Expected at least one default task.");
  console.assert(defaults.every((task) => task.steps.length > 0), "Each task should have at least one step.");
  console.assert(CIRCLES.length === 3, "Expected three circle items.");
  console.assert(CIRCLES.every((item) => item.id && item.name && item.avatar), "Each circle item should have id, name, and avatar.");
  console.assert(getCircleById("c1").name === "Mia", "Expected c1 to resolve to Mia.");
  console.assert(getCircleById("missing").id === "c1", "Missing circle ids should fall back to first circle.");
  console.assert(CREW.length === 4, "Expected four crew avatars.");
  console.assert(getTaskLevelLabel(0) === "关卡 1/3", "Expected localized task level label.");
  console.assert(getFilledBlocks(0) === 1, "Progress should always show at least one pixel block.");
  console.assert(getFilledBlocks(100) === 10, "Progress should show ten pixel blocks at completion.");
}

function GlassCard({ children, className = "", style }) {
  return (
    <div
      className={`rounded-[2rem] border border-white/80 bg-white/68 shadow-[0_18px_40px_rgba(90,88,130,.10)] backdrop-blur-xl ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function Page({ children, immersive = false }) {
  const bg = immersive
    ? "bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,.95),transparent_34%),radial-gradient(circle_at_50%_88%,rgba(226,226,222,.88),transparent_42%),linear-gradient(160deg,#fafafa_0%,#eeeeea_54%,#dad9d4_100%)]"
    : "bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,.9),transparent_34%),radial-gradient(circle_at_85%_88%,rgba(226,226,222,.9),transparent_38%),linear-gradient(150deg,#f8f8f7_0%,#eeeeea_55%,#ddddda_100%)]";
  return <div className={`absolute inset-0 overflow-hidden px-5 pb-5 pt-16 ${bg}`}>{children}</div>;
}

function PhoneShell({ children }) {
  return (
    <div className="relative h-[800px] w-[390px] rounded-[58px] border-[9px] border-zinc-950 bg-zinc-950 shadow-[0_28px_90px_rgba(30,30,40,.30)]">
      <div className="absolute left-1/2 top-1 z-40 h-6 w-28 -translate-x-1/2 rounded-b-3xl bg-zinc-950" />
      <div className="pointer-events-none absolute inset-0 z-20 rounded-[48px] border border-white/25" />
      <div className="relative h-full w-full overflow-hidden rounded-[48px] bg-[#f4f4f2]">
        <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-8 pt-5 font-mono text-[12px] font-bold">
          <span>9:41</span>
          <span>●● ▰</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Top({ title, sub, back }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      {back ? (
        <button type="button" onClick={back} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/75 shadow-lg backdrop-blur-xl active:scale-95">
          <ChevronLeft size={18} />
        </button>
      ) : (
        <div className="h-11 w-11" />
      )}
      <div className="text-center font-mono">
        <div className="text-[11px] uppercase tracking-[.18em] text-slate-500">{title}</div>
        {sub ? <div className="mt-1 text-[10px] text-slate-400">{sub}</div> : null}
      </div>
      <div className="h-11 w-11" />
    </div>
  );
}

function Tabs({ items, activeTab, setTab }) {
  return (
    <div className="absolute bottom-5 left-5 right-5 z-30 flex items-center justify-around rounded-full border border-white/80 bg-white/75 py-2 shadow-2xl backdrop-blur-xl">
      {items.map(({ id, Icon, label }) => (
        <button
          type="button"
          key={id}
          onClick={() => setTab(id)}
          className={`rounded-full px-3 py-2 font-mono text-[10px] transition active:scale-95 ${activeTab === id ? "bg-white text-zinc-950 shadow" : "text-slate-400"}`}
        >
          <Icon className="mx-auto" size={17} />
          <div className="mt-0.5">{label}</div>
        </button>
      ))}
    </div>
  );
}

function AppTabs({ activeTab, setTab }) {
  const items = [
    { id: "home", Icon: Home, label: "Home" },
    { id: "circle", Icon: CircleIcon, label: "Circle" },
    { id: "profile", Icon: User, label: "Profile" },
  ];
  return <Tabs items={items} activeTab={activeTab} setTab={setTab} />;
}

function PixelCube({ size = 118, active = true }) {
  const dots = [
    "left-[28%] top-[4%]",
    "left-[18%] top-[8%]",
    "right-[21%] top-[10%]",
    "right-[13%] top-[22%]",
    "right-[9%] top-[38%]",
    "right-[13%] bottom-[25%]",
    "right-[24%] bottom-[12%]",
    "left-[33%] bottom-[7%]",
    "left-[19%] bottom-[13%]",
    "left-[10%] bottom-[28%]",
    "left-[7%] top-[42%]",
  ];
  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      animate={active ? { y: [0, -8, 0], rotate: [0, 1.25, 0] } : {}}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="absolute inset-[8%] rounded-[28%] bg-white shadow-[0_18px_35px_rgba(35,35,35,.10)]" />
      <div className="absolute inset-[8%] rounded-[28%] border-[3px] border-zinc-900" />
      <div className="absolute left-[18%] top-[14%] h-[34%] w-[28%] rounded-full bg-white" />
      <div className="absolute left-[15%] top-[18%] h-[62%] w-[46%] rounded-[45%] bg-zinc-100" />
      <div className="absolute right-[19%] top-[20%] h-[52%] w-[26%] rounded-[40%] bg-zinc-50" />
      {dots.map((cls) => <span key={cls} className={`absolute h-[7px] w-[7px] bg-zinc-900 ${cls}`} />)}
    </motion.div>
  );
}

function PixelBuddy({ size = 62, jumping = false }) {
  const floatAnim = { y: [0, -5, 0] };
  const jumpAnim = { y: [0, -30, 0, -30, 0], scale: [1, 1.15, 1, 1.15, 1] };
  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      animate={jumping ? jumpAnim : floatAnim}
      transition={jumping ? { duration: 0.5, repeat: 2, ease: "easeOut" } : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="absolute left-[22%] top-[18%] h-[54%] w-[56%] border-[3px] border-zinc-900 bg-[#fff36b]" />
      <div className="absolute left-[12%] top-[35%] h-[20%] w-[10%] border-[3px] border-r-0 border-zinc-900 bg-[#fff36b]" />
      <div className="absolute right-[12%] top-[35%] h-[20%] w-[10%] border-[3px] border-l-0 border-zinc-900 bg-[#fff36b]" />
      <div className="absolute left-[34%] top-[38%] h-[5px] w-[5px] bg-zinc-900" />
      <div className="absolute right-[34%] top-[38%] h-[5px] w-[5px] bg-zinc-900" />
      <div className="absolute left-[42%] top-[52%] h-[4px] w-[14px] bg-zinc-900" />
      <div className="absolute left-[29%] bottom-[8%] h-[10px] w-[5px] bg-zinc-900" />
      <div className="absolute right-[29%] bottom-[8%] h-[10px] w-[5px] bg-zinc-900" />
    </motion.div>
  );
}

function JackpotIcon({ amount = 10, size = 182 }) {
  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="absolute inset-0 rounded-[28px] border-[3px] border-zinc-900 bg-[#fff36b] shadow-[8px_8px_0_rgba(0,0,0,.08)]" />
      <div className="absolute left-[13%] right-[13%] top-[12%] h-[12%] border-[3px] border-zinc-900 bg-white" />
      <div className="absolute left-[18%] right-[18%] top-[34%] bottom-[16%] border-[3px] border-zinc-900 bg-white" />
      <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 text-center font-mono">
        <div className="text-[10px] uppercase tracking-[.16em] text-slate-400">FOCUSCOIN</div>
        <div className="mt-1 text-3xl font-bold text-zinc-900">{amount}</div>
      </div>
      <div className="absolute left-[10px] top-[12px] h-[7px] w-[7px] bg-zinc-900" />
      <div className="absolute right-[10px] top-[12px] h-[7px] w-[7px] bg-zinc-900" />
      <div className="absolute left-[10px] bottom-[12px] h-[7px] w-[7px] bg-zinc-900" />
      <div className="absolute right-[10px] bottom-[12px] h-[7px] w-[7px] bg-zinc-900" />
    </motion.div>
  );
}

function FloatingGifts({ gifts }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 bottom-24 z-20 overflow-hidden">
      <AnimatePresence>
        {gifts.map((gift, index) => (
          <motion.div
            key={gift.id}
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: [0, 1, 1, 0], y: -120, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5 }}
            className="absolute rounded-full border border-white/80 bg-white/75 px-3 py-2 font-mono text-[11px] shadow-xl backdrop-blur-xl"
            style={{ left: 30 + ((index * 72) % 220), bottom: 24 + ((index * 28) % 160) }}
          >
            {gift.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function PixelFireworks({ active, label = "BOOST SENT" }) {
  const sparks = useMemo(() => Array.from({ length: 18 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 18;
    const radius = 46 + (index % 4) * 12;
    return {
      id: index,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      color: index % 3 === 0 ? "#f6b73c" : index % 3 === 1 ? "#8c5cf6" : "#41a85f",
    };
  }), []);

  return (
    <AnimatePresence>
      {active ? (
        <motion.div className="pointer-events-none absolute inset-0 z-40 grid place-items-center font-mono" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="relative h-40 w-40">
            {sparks.map((spark) => (
              <motion.span
                key={spark.id}
                className="absolute left-1/2 top-1/2 h-3 w-3 border-2 border-zinc-900"
                style={{ backgroundColor: spark.color }}
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                animate={{ x: spark.x, y: spark.y, scale: [0.6, 1.15, 0.2], opacity: [0, 1, 0] }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-[3px] border-zinc-900 bg-[#fff36b] px-3 py-2 text-center text-[10px] font-bold text-zinc-950 shadow-[5px_5px_0_rgba(0,0,0,.18)]"
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: [0.75, 1.08, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.05 }}
            >
              {label}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DopamineFeedbackWarehouse({ event }) {
  const particles = useMemo(() => Array.from({ length: 24 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 24;
    const radius = 52 + (index % 4) * 11;
    return {
      id: index,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      color: index % 4 === 0 ? "#f6b73c" : index % 4 === 1 ? "#8c5cf6" : index % 4 === 2 ? "#3f8cff" : "#41a85f",
    };
  }), []);

  return (
    <AnimatePresence>
      {event ? (
        <motion.div key={event.id} className="pointer-events-none absolute inset-0 z-50 grid place-items-center overflow-hidden px-6 font-mono" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-[#171821]/16" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.25 }} />
          <div className="relative h-52 w-52 max-w-full">
            {particles.map((particle) => (
              <motion.span
                key={particle.id}
                className="absolute left-1/2 top-1/2 h-3 w-3 border-2 border-zinc-900"
                style={{ backgroundColor: particle.color }}
                initial={{ x: 0, y: 0, scale: 0.35, opacity: 0 }}
                animate={{ x: particle.x, y: particle.y, rotate: [0, 180], scale: [0.45, 1, 0.12], opacity: [0, 1, 0] }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="absolute left-1/2 top-1/2 w-[190px] max-w-[calc(100vw-96px)] -translate-x-1/2 -translate-y-1/2 border-[3px] border-zinc-900 bg-[#fff36b] px-3 py-3 text-center text-zinc-950 shadow-[6px_6px_0_rgba(0,0,0,.18)]"
              initial={{ y: 16, scale: 0.82, opacity: 0 }}
              animate={{ y: [16, -4, 0], scale: [0.82, 1.08, 1], opacity: [0, 1, 1] }}
              exit={{ y: -10, scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.38 }}
            >
              <div className="text-[9px] uppercase tracking-[.14em] text-[#8c5cf6]">Boost Drop</div>
              <div className="mt-1.5 text-base font-bold leading-5">{event.title}</div>
              <div className="mt-2 break-words text-[10px] leading-4 text-slate-700">{event.copy}</div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CrewAvatar({ emoji, index, confirmed }) {
  const justConfirmed = index === confirmed - 1;
  return (
    <motion.div animate={justConfirmed ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.55 }} className="relative grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-white text-lg shadow">
      {emoji}
      {index < confirmed ? (
        <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 340, damping: 16 }} className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-400 text-[9px] text-white shadow-[0_0_0_2px_white]">
          ✓
        </motion.span>
      ) : null}
    </motion.div>
  );
}

function GiftCircle({ gift }) {
  return (
    <motion.div initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-white text-base shadow">{gift.icon}</div>
      <div className="text-left text-[9px] text-slate-500">
        <div className="font-semibold text-slate-700">{gift.label}</div>
        <div>{gift.amount > 0 ? `+${gift.amount} pts` : "support"}</div>
      </div>
    </motion.div>
  );
}


function OverdueReminder({ open, step, elapsedSec, onDismiss, onComplete }) {
  return (
    <AnimatePresence>
      {open && step ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-[#171821]/55 px-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            className="w-full max-w-[300px] rounded-2xl border-[3px] border-zinc-900 bg-[#fff8df] p-5 shadow-[8px_8px_0_rgba(0,0,0,.12)]"
          >
            <div className="flex items-center gap-2 font-mono text-[#d94f4f]">
              <AlertTriangle size={18} />
              <span className="text-xs uppercase tracking-[.14em]">超时提醒</span>
            </div>
            <h3 className="mt-3 text-lg font-bold text-zinc-900">支线任务超时</h3>
            <p className="mt-2 text-left text-[11px] leading-5 text-slate-600">
              「{step.label}」已超过预估 {step.minutes} 分钟（已用 {formatClock(elapsedSec)}）。请尽快完成或调整计划。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={onDismiss} className="rounded-xl border-2 border-zinc-900 bg-white px-3 py-3 text-xs font-semibold active:scale-95">
                稍后提醒
              </button>
              <button type="button" onClick={onComplete} className="rounded-xl border-2 border-zinc-900 bg-zinc-950 px-3 py-3 text-xs font-semibold text-white active:scale-95">
                标记完成
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function MiniTaskList({ dailyTasks, currentTaskIndex, currentStepIndex }) {
  return (
    <div className="space-y-3">
      {dailyTasks.map((task, index) => (
        <GlassCard key={task.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{task.title}</div>
              <div className="mt-1 text-[10px] text-slate-400">关卡 {index + 1} / {dailyTasks.length} · {task.totalMinutes} min</div>
            </div>
            {index === currentTaskIndex ? <span className="rounded-full bg-zinc-950 px-2 py-1 text-[9px] text-white">current</span> : null}
          </div>
          <div className="mt-3 space-y-2">
            {task.steps.map((step, stepIndex) => (
              <div
                key={step.id}
                className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-3 text-xs ${
                  index === currentTaskIndex && stepIndex === currentStepIndex ? "border-2 border-zinc-900 bg-[#fff36b]/80" : "bg-white/60"
                }`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <span className="shrink-0 text-slate-400">{stepIndex + 1}.</span>
                  <span className="truncate">{step.label}</span>
                </span>
                <span className="shrink-0 text-slate-400">{step.minutes} min</span>
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
      <GlassCard className="p-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-400">Captured Timeline</div>
        <div className="mt-4 flex gap-2 overflow-auto pb-2">
          {SHOTS.map((time) => (
            <div key={time} className="relative h-24 min-w-20 overflow-hidden rounded-2xl border border-white/70 bg-[linear-gradient(135deg,#f8f8f7,#e2e2de)] shadow-inner">
              <span className="absolute bottom-2 left-2 rounded bg-white/75 px-1 text-[7px] font-mono">{time}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function TaskIconDock({ onOpenTasks }) {
  return (
    <div className="absolute bottom-[106px] right-5 z-30 font-mono">
      <button type="button" onClick={onOpenTasks} className="grid h-12 w-12 place-items-center rounded-full border border-white/85 bg-white/80 shadow-2xl backdrop-blur-xl active:scale-95">
        <Check size={18} />
      </button>
    </div>
  );
}

function RewardBubble({ reward, rewardGifts, walletOpen, setWalletOpen }) {
  return (
    <div className="absolute bottom-[106px] left-5 z-30 font-mono text-left">
      <button type="button" onClick={() => setWalletOpen(!walletOpen)} className="grid h-14 w-14 place-items-center rounded-full border border-white/85 bg-white/82 text-sm font-bold text-emerald-600 shadow-2xl backdrop-blur-xl active:scale-95">
        {reward}
      </button>
      <AnimatePresence>
        {walletOpen ? (
          <motion.div initial={{ opacity: 0, height: 0, y: 8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: 8 }} className="mt-2 w-[230px] overflow-hidden">
            <GlassCard className="p-3">
              <div className="text-[9px] uppercase tracking-widest text-slate-400">Reward Feed</div>
              <div className="mt-2 space-y-2">
                {rewardGifts.length > 0 ? rewardGifts.slice(0, 2).map((gift) => <GiftCircle key={gift.id} gift={gift} />) : <div className="text-[10px] text-slate-400">waiting for gifts...</div>}
              </div>
            </GlassCard>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function InlineTaskProgress({ currentTaskIndex, progress, totalTasks = 3 }) {
  const filledBlocks = getFilledBlocks(progress);
  return (
    <div className="mt-4 w-[120px] text-center font-mono">
      <div className="text-[9px] uppercase tracking-[.18em] text-slate-400">{getTaskLevelLabel(currentTaskIndex, totalTasks)}</div>
      <div className="mx-auto mt-2 grid w-[120px] grid-cols-10 gap-[2px]">
        {Array.from({ length: 10 }).map((_, idx) => (
          <motion.div
            key={idx}
            animate={idx < filledBlocks ? { opacity: [0.45, 1, 0.75] } : { opacity: 0.25 }}
            transition={{ duration: 1.1, repeat: idx < filledBlocks ? Infinity : 0, delay: idx * 0.05 }}
            className={`h-[6px] rounded-[2px] ${idx < filledBlocks ? "bg-zinc-950" : "bg-white/75"}`}
          />
        ))}
      </div>
    </div>
  );
}

function SittingPixelBuddy({ size = 28 }) {
  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      animate={{ y: [0, 2, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="absolute left-[18%] top-[12%] h-[46%] w-[64%] border-[2px] border-zinc-900 bg-[#fff36b]" />
      <div className="absolute left-[30%] top-[31%] h-[3px] w-[3px] bg-zinc-900" />
      <div className="absolute right-[30%] top-[31%] h-[3px] w-[3px] bg-zinc-900" />
      <div className="absolute left-[37%] top-[48%] h-[2px] w-[8px] bg-zinc-900" />
      <div className="absolute left-[9%] bottom-[8%] h-[8px] w-[34%] border-[2px] border-zinc-900 bg-[#f6ead0]" />
      <div className="absolute right-[9%] bottom-[8%] h-[8px] w-[34%] border-[2px] border-zinc-900 bg-[#f6ead0]" />
    </motion.div>
  );
}

function ProgressRoad({ currentTaskIndex, currentStepIndex, tasks, buddyJumping, isOverdue }) {
  const completedSteps = currentTaskIndex > 0 ? tasks.slice(0, currentTaskIndex).reduce((sum, task) => sum + task.steps.length, 0) : 0;
  const currentStepPos = completedSteps + currentStepIndex;
  const flatSteps = tasks.flatMap((task, taskIdx) =>
    task.steps.map((step, stepIdx) => ({
      id: `${task.id}-${step.id}`,
      taskIdx,
      stepIdx,
      label: step.label,
    }))
  );
  const totalSteps = flatSteps.length;
  const currentLeft = totalSteps <= 1 ? 50 : (currentStepPos / (totalSteps - 1)) * 100;

  if (totalSteps === 0) return null;

  return (
    <div className="mt-7 w-full max-w-[400px] px-5">
      <div className="relative mx-auto h-24">
        <div className="absolute inset-x-0 top-[48px] h-2 border-2 border-zinc-900 bg-[#f6ead0] shadow-[3px_3px_0_rgba(0,0,0,.12)]" />
        <div
          className="absolute left-0 top-[48px] h-2 border-y-2 border-l-2 border-zinc-900 bg-[#41a85f]"
          style={{ width: `${currentLeft}%` }}
        />
        <motion.div
          className="absolute top-[7px] z-20 -translate-x-1/2"
          animate={{ left: `${currentLeft}%`, y: buddyJumping ? [0, -18, 0] : 0 }}
          transition={{ duration: buddyJumping ? 0.46 : 0.26, ease: "easeOut" }}
        >
          {isOverdue ? <SittingPixelBuddy size={30} /> : <PixelBuddy size={28} jumping={false} />}
        </motion.div>

        {flatSteps.map((step, idx) => {
          const left = totalSteps <= 1 ? 50 : (idx / (totalSteps - 1)) * 100;
          const isDone = idx < currentStepPos;
          const isCurrent = idx === currentStepPos;
          const isTaskStart = step.stepIdx === 0;

          return (
            <div key={step.id} className="absolute top-[42px] -translate-x-1/2" style={{ left: `${left}%` }}>
              <div
                className={`grid place-items-center border-2 border-zinc-900 shadow-[2px_2px_0_rgba(0,0,0,.14)] ${
                  isCurrent
                    ? "h-7 w-7 bg-[#fff36b]"
                    : isDone
                      ? "h-6 w-6 bg-[#41a85f] text-white"
                      : "h-5 w-5 bg-white"
                }`}
              >
                {isDone ? <Check size={12} /> : <span className="h-2 w-2 bg-zinc-900" />}
              </div>
              {isTaskStart ? (
                <div className="absolute left-1/2 top-[-26px] -translate-x-1/2">
                  <div className={`h-5 w-6 border-2 border-zinc-900 ${step.taskIdx <= currentTaskIndex ? "bg-[#f6b73c]" : "bg-white"}`} />
                  <div className="mx-auto h-3 w-[3px] bg-zinc-900" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PixelLiveFrame({ statusText }) {
  return (
    <div className="relative mt-5 h-[390px] overflow-hidden rounded-[2rem] border border-white/80 bg-white/65 shadow-[0_18px_40px_rgba(90,88,130,.10)] backdrop-blur-xl">
      <div className="absolute inset-4 overflow-hidden rounded-[1.5rem] border-[3px] border-zinc-900 bg-[#fff36b]">
        <motion.div className="absolute left-10 top-12 h-10 w-10 border-[3px] border-zinc-900 bg-white" animate={{ x: [0, 140, 40, 0], y: [0, 30, 120, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
        <motion.div className="absolute right-10 bottom-10 h-8 w-8 border-[3px] border-zinc-900 bg-zinc-900" animate={{ y: [0, -50, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 border-[3px] border-zinc-900 bg-white" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        <div className="absolute bottom-5 left-5 right-5 rounded-full border-[3px] border-zinc-900 bg-white px-4 py-2 text-center font-mono text-[10px]">
          {statusText}
        </div>
      </div>
    </div>
  );
}

function CircleFriendCard({ friend, selected, onSelect }) {
  const tagClass = {
    focusing: "border-[#41a85f] bg-[#41a85f] text-white",
    stuck: "border-[#f97316] bg-[#f97316] text-white",
    drifting: "border-[#f6b73c] bg-[#fff36b] text-zinc-950",
    muted: "border-[#8c5cf6] bg-[#f6ead0] text-[#232637]",
  }[friend.tagTone] || "border-[#8c5cf6] bg-[#f6ead0] text-[#232637]";
  const shouldPulse = friend.tagTone === "stuck" || friend.tagTone === "drifting";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative min-h-[104px] w-[112px] shrink-0 border-[3px] p-2 text-left font-mono shadow-[4px_4px_0_rgba(0,0,0,.12)] active:translate-x-[1px] active:translate-y-[1px] ${
        selected ? "border-zinc-900 bg-[#fff8df]" : "border-white bg-white/78"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center border-[3px] border-zinc-900 bg-[#fff36b] text-xl shadow-[2px_2px_0_rgba(0,0,0,.14)]">
          {friend.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold">{friend.name}</div>
          <div className="mt-1 h-1.5 w-full border border-zinc-900 bg-white">
            <span className={`block h-full ${selected ? "bg-[#41a85f]" : "bg-[#3f8cff]"}`} />
          </div>
        </div>
      </div>

      <div className="mt-2">
        <motion.span
          animate={shouldPulse ? { opacity: [1, 0.58, 1] } : {}}
          transition={{ duration: 0.8, repeat: Infinity }}
          className={`inline-block max-w-full border-2 px-1.5 py-0.5 text-[9px] font-bold ${tagClass}`}
        >
          {friend.tag}
        </motion.span>
      </div>

      <div className="mt-2 line-clamp-2 min-h-[22px] text-[9px] leading-3 text-zinc-700">{friend.action}</div>
    </button>
  );
}

function PixelCameraScene({ scene }) {
  const isCoding = scene === "coding";
  const isMusic = scene === "music";

  return (
    <div className="absolute inset-4 overflow-hidden border-[3px] border-zinc-900 bg-[#171821]">
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="absolute inset-x-0 bottom-0 h-20 border-t-[3px] border-zinc-900 bg-[#41a85f]" />
      <motion.div
        className={`absolute bottom-16 left-12 h-16 w-14 border-[3px] border-zinc-900 ${isMusic ? "bg-[#f6b73c]" : "bg-[#fff36b]"}`}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute left-3 top-4 h-2 w-2 bg-zinc-900" />
        <div className="absolute right-3 top-4 h-2 w-2 bg-zinc-900" />
        <div className="absolute left-4 top-9 h-1.5 w-5 bg-zinc-900" />
      </motion.div>
      <motion.div
        className={`absolute bottom-24 right-10 border-[3px] border-zinc-900 bg-white ${isCoding ? "h-20 w-28" : isMusic ? "h-24 w-16" : "h-16 w-24"}`}
        animate={isCoding ? { opacity: [0.65, 1, 0.65] } : { y: [0, -5, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      >
        {isCoding ? (
          <div className="space-y-1 p-2">
            {[36, 62, 48, 70].map((width, idx) => <div key={idx} className="h-2 bg-[#3f8cff]" style={{ width }} />)}
          </div>
        ) : isMusic ? (
          <div className="grid h-full place-items-center text-3xl">♪</div>
        ) : (
          <div className="grid h-full place-items-center text-xs font-bold text-zinc-500">WAIT</div>
        )}
      </motion.div>
      <motion.div
        className="absolute left-1/2 top-12 h-8 w-8 border-2 border-zinc-900 bg-[#f6b73c]"
        animate={{ y: [0, 28, 0], rotate: [0, 90, 180] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function CircleLiveMonitor({ friend, eventText }) {
  return (
    <div className="relative mt-4 h-[360px] overflow-hidden border-[3px] border-zinc-900 bg-white/65 shadow-[6px_6px_0_rgba(0,0,0,.14)] backdrop-blur-xl">
      <PixelCameraScene scene={friend.scene} />
      <div className="absolute left-6 top-6 border-2 border-zinc-900 bg-white px-2 py-1 font-mono text-[9px] font-bold text-zinc-950 shadow-[2px_2px_0_rgba(0,0,0,.12)]">
        PIXEL LIVE · {friend.name}
      </div>
      <div className="absolute bottom-6 left-6 right-6 border-[3px] border-zinc-900 bg-white px-3 py-2 font-mono text-[10px] shadow-[4px_4px_0_rgba(0,0,0,.14)]">
        <div className="font-bold text-zinc-950">{friend.action}</div>
        <div className="mt-1 text-slate-500">{eventText || "摄像头帧已转译为隐私安全像素状态"}</div>
      </div>
    </div>
  );
}

function SupportConsole({ friend, onDoubleReward, onTimeExtension, onCheer }) {
  const buttons = [
    { id: "double", label: "翻倍奖励卡", sub: "通关奖励翻倍", icon: "✦", onClick: onDoubleReward, tone: "bg-[#f6b73c] text-zinc-950" },
    { id: "time", label: "弹性续时卡", sub: "追加缓冲时间", icon: "⏱", onClick: onTimeExtension, tone: "bg-[#3f8cff] text-white" },
    { id: "cheer", label: "温和鼓励卡", sub: "同步唤醒语音", icon: "♪", onClick: onCheer, tone: "bg-[#fff36b] text-zinc-950" },
  ];

  return (
    <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          onClick={button.onClick}
          className={`min-h-[76px] border-[3px] border-zinc-900 px-2 py-2 text-[9px] font-bold shadow-[4px_4px_0_rgba(0,0,0,.14)] active:translate-x-[1px] active:translate-y-[1px] ${button.tone}`}
        >
          <div className="text-lg leading-none">{button.icon}</div>
          <div className="mt-1 leading-3">{button.label}</div>
          <div className="mt-1 text-[8px] font-normal leading-3 opacity-80">{button.sub}</div>
        </button>
      ))}
    </div>
  );
}

function SkillConfirmModal({ open, skill, friend, giftText, setGiftText, onClose, onConfirm, onRandomCheer }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="absolute inset-0 z-50 flex items-center justify-center bg-[#171821]/55 px-6 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 18, scale: 0.94 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: 0.96 }} className="w-full border-[3px] border-zinc-900 bg-[#fff8df] p-5 font-mono shadow-[8px_8px_0_rgba(0,0,0,.18)]">
            <div className="text-xs font-bold text-zinc-950">确认投放给 {friend?.name}</div>
            <div className="mt-3 border-[3px] border-zinc-900 bg-white px-3 py-3">
              <div className="text-sm font-black">{skill?.label}</div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">确认消耗 {formatCoin(skill?.cost)} 个专注币兑换该技能，并立即投放到对方的专注流里？</p>
            </div>
            {skill?.id === "cheer" ? (
              <div className="mt-3 space-y-2">
                <input
                  value={giftText}
                  onChange={(event) => setGiftText(event.target.value)}
                  placeholder="自己输入一句温柔唤醒语"
                  className="w-full border-2 border-zinc-900 bg-white px-3 py-3 text-xs outline-none"
                  autoFocus
                />
                <button type="button" onClick={onRandomCheer} className="w-full border-2 border-zinc-900 bg-[#f6ead0] py-2.5 text-xs font-bold shadow-[3px_3px_0_rgba(0,0,0,.1)]">
                  FocusBoost 随机鼓励
                </button>
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="border-2 border-zinc-900 bg-white py-3 text-xs font-bold">取消</button>
              <button type="button" onClick={onConfirm} className="border-2 border-zinc-900 bg-[#fff36b] py-3 text-xs font-bold">确认投放</button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function GiftModal({ open, giftText, setGiftText, onClose, onConfirm }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="absolute inset-0 z-50 flex items-center justify-center bg-[#171821]/55 px-6 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 18, scale: 0.94 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: 0.96 }} className="w-full border-[3px] border-zinc-900 bg-[#fff8df] p-5 font-mono shadow-[8px_8px_0_rgba(0,0,0,.18)]">
            <div className="text-xs font-bold text-zinc-950">配置温和鼓励卡</div>
            <input
              value={giftText}
              onChange={(event) => setGiftText(event.target.value)}
              placeholder="语音名 / 表情 / 温柔唤醒语"
              className="mt-3 w-full border-2 border-zinc-900 bg-white px-3 py-3 text-xs outline-none"
              autoFocus
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="border-2 border-zinc-900 bg-white py-3 text-xs font-bold">取消</button>
              <button type="button" onClick={onConfirm} className="border-2 border-zinc-900 bg-[#fff36b] py-3 text-xs font-bold">发送 Cheer</button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function FragmentStepItem({ step, stepIndex, taskId, editingFragmentId, setEditingFragmentId, editingFragmentLabel, setEditingFragmentLabel, onEditFragment, onDeleteFragment, onAddFragment, stepsLength }) {
  const isEditing = editingFragmentId === step.id;

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/60 px-3 py-3 text-xs">
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span className="shrink-0 text-slate-400">{stepIndex + 1}.</span>
        {isEditing ? (
          <input
            type="text"
            value={editingFragmentLabel}
            onChange={(e) => setEditingFragmentLabel(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onEditFragment(taskId, step.id, editingFragmentLabel);
              } else if (e.key === 'Escape') {
                setEditingFragmentId(null);
                setEditingFragmentLabel("");
              }
            }}
            autoFocus
          />
        ) : (
          <span className="truncate">{step.label}</span>
        )}
      </span>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-slate-400">{step.minutes} min</span>
        <div className="flex gap-1">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => onEditFragment(taskId, step.id, editingFragmentLabel)}
                className="rounded-md bg-[#41a85f] px-2 py-0.5 text-[9px] text-white hover:bg-[#3a9252]"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingFragmentId(null);
                  setEditingFragmentLabel("");
                }}
                className="rounded-md bg-slate-200 px-2 py-0.5 text-[9px] text-slate-600 hover:bg-slate-300"
              >
                取消
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingFragmentId(step.id);
                  setEditingFragmentLabel(step.label);
                }}
                className="rounded-md bg-zinc-200/50 px-2 py-0.5 text-[9px] text-slate-600 hover:bg-zinc-300/50"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => onDeleteFragment(taskId, step.id)}
                className="rounded-md bg-[#d94f4f]/10 px-2 py-0.5 text-[9px] text-[#d94f4f] hover:bg-[#d94f4f]/20"
              >
                删除
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskInputBar({ value, onChange, onSubmit }) {
  const [interim, setInterim] = useState("");
  const { listening, error, toggle, supported, stop } = useSpeechInput({
    onFinalText: (text) => {
      onChange((prev) => appendSpeechText(prev, text));
      setInterim("");
    },
    onInterimText: setInterim,
  });

  const displayValue = interim ? appendSpeechText(value, interim) : value;

  return (
    <div className="absolute bottom-28 left-0 right-0 px-1 font-mono">
      <div className="rounded-[2rem] border border-white/80 bg-white/90 p-3 shadow-2xl backdrop-blur-xl">
        {error ? <p className="mb-2 text-left text-[10px] text-[#d94f4f]">{error}</p> : null}
        {!supported ? (
          <p className="mb-2 text-left text-[10px] text-slate-400">当前浏览器不支持语音，请直接输入文字</p>
        ) : null}
        {listening ? (
          <p className="mb-2 flex items-center gap-2 text-left text-[10px] text-[#07c160]">
            <motion.span className="inline-block h-2 w-2 rounded-full bg-[#07c160]" animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.9 }} />
            正在听你说…
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={toggle}
            disabled={!supported}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full shadow active:scale-95 ${
              listening ? "bg-[#d94f4f] text-white" : "bg-white text-zinc-900"
            } disabled:opacity-40`}
            aria-label={listening ? "停止录音" : "语音输入"}
          >
            <Mic size={18} />
          </button>
          <textarea
            value={displayValue}
            onChange={(event) => {
              if (listening) stop();
              setInterim("");
              onChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (listening) stop();
                onSubmit();
              }
            }}
            placeholder="输入或语音说出今天要完成的事…"
            rows={3}
            className="min-h-[52px] flex-1 resize-none rounded-3xl border border-zinc-200 bg-white p-3 text-left text-[12px] leading-5 text-zinc-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => {
              if (listening) stop();
              onSubmit();
            }}
            disabled={!value.trim() && !interim.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black text-white shadow active:scale-95 disabled:opacity-40"
            aria-label="提交任务"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestLaunchPanel({
  input,
  setInput,
  stakeAmount,
  setStakeAmount,
  focusCoinBalance,
  planLoading,
  stakeError,
  planError,
  submitHint,
  onSubmit,
}) {
  const [interim, setInterim] = useState("");
  const maxStake = Math.max(1, Math.floor(focusCoinBalance));
  const activeInput = input.trim().length > 0 || interim.trim().length > 0;
  const displayValue = interim ? appendSpeechText(input, interim) : input;
  const chargePct = Math.max(0, Math.min(100, (stakeAmount / maxStake) * 100));
  const middleStake = Math.max(1, Math.round(maxStake * 0.6));
  const lowStake = Math.max(1, Math.min(5, maxStake));
  const chargeColor = chargePct < 42
    ? "linear-gradient(90deg,#41a85f,#78d66b)"
    : chargePct < 76
      ? "linear-gradient(90deg,#41a85f,#fff36b,#f6b73c)"
      : "linear-gradient(90deg,#41a85f,#fff36b,#f97316,#d94f4f)";
  const { listening, error, toggle, supported, stop } = useSpeechInput({
    onFinalText: (text) => {
      setInput((prev) => appendSpeechText(prev, text));
      setInterim("");
    },
    onInterimText: setInterim,
  });
  const launchText = activeInput
    ? `⚡ 携带 ${formatCoin(stakeAmount)} 专注币杀入主线`
    : "⚡ 开启今日主线";

  const commitSubmit = () => {
    if (listening) stop();
    onSubmit();
  };

  return (
    <div className="relative w-full px-2 text-left">
      <div className="rounded-[2rem] border border-white/80 bg-white/90 p-3 shadow-2xl backdrop-blur-xl">
        {error ? <p className="mb-2 text-[10px] text-[#d94f4f]">{error}</p> : null}
        {!supported ? <p className="mb-2 text-[10px] text-slate-500">当前浏览器不支持语音，请直接输入文字</p> : null}
        {listening ? (
          <p className="mb-2 flex items-center gap-2 text-[10px] text-[#41a85f]">
            <motion.span className="inline-block h-2 w-2 rounded-full bg-[#41a85f]" animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.9 }} />
            正在听你说…
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={toggle}
            disabled={!supported || planLoading}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full shadow active:scale-95 ${
              listening ? "bg-[#d94f4f] text-white" : "bg-white text-zinc-900"
            } disabled:opacity-40`}
            aria-label={listening ? "停止录音" : "语音输入"}
          >
            <Mic size={18} />
          </button>
          <textarea
            value={displayValue}
            onChange={(event) => {
              if (listening) stop();
              setInterim("");
              setInput(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                commitSubmit();
              }
            }}
            placeholder="输入一句话（或按住语音说）：下午憋出周报 / 彻底清理书桌。AI 自动切碎，剩下的交给我们。"
            rows={3}
            className="min-h-[70px] flex-1 resize-none rounded-3xl border border-zinc-200 bg-white p-3 text-left text-[12px] leading-5 text-zinc-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <AnimatePresence>
          {activeInput ? (
            <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: 8, height: 0 }} className="overflow-hidden">
              <div className="mt-4">
                <div className="mb-2 text-[10px] font-bold text-slate-500">冲关能力</div>
                <div className="relative h-10 rounded-full border-2 border-zinc-900 bg-[#171821] p-1 shadow-[3px_3px_0_rgba(0,0,0,.12)]">
                  <motion.div
                    className="h-full rounded-full border border-zinc-900"
                    style={{ background: chargeColor }}
                    animate={{ width: `${chargePct}%` }}
                    transition={{ duration: 0.18 }}
                  />
                  <input
                    type="range"
                    min="1"
                    max={maxStake}
                    step="1"
                    value={Math.min(maxStake, Math.max(1, stakeAmount))}
                    onChange={(event) => setStakeAmount(Number(event.target.value))}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="调整抵押专注币"
                  />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[9px] font-black text-slate-500">
                  <span>小试水 ({lowStake})</span>
                  <span>迎战 ({middleStake})</span>
                  <span>全力以赴拉满 ({maxStake})</span>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={commitSubmit}
                disabled={planLoading || stakeAmount <= 0 || stakeAmount > focusCoinBalance}
                animate={!planLoading ? { opacity: [1, 0.72, 1], y: [0, -2, 0] } : {}}
                transition={{ repeat: Infinity, duration: 0.85 }}
                className="mx-auto mt-4 block rounded-2xl border-[3px] border-zinc-900 bg-[#fff36b] px-5 py-3 text-center text-sm font-black text-zinc-950 shadow-[5px_5px_0_rgba(0,0,0,.14)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_rgba(0,0,0,.14)] disabled:animate-none disabled:opacity-45"
              >
                {planLoading ? "AI 正在切碎任务…" : launchText}
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {submitHint || stakeError || planError ? <p className="mt-3 text-center text-[11px] text-[#d94f4f]">{submitHint || stakeError || planError}</p> : null}
      </div>
    </div>
  );
}

function InvitePanel({ open, onClose, onSend }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="absolute inset-0 z-40 flex items-end bg-zinc-950/55 px-5 pb-24 font-mono" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="w-full rounded-[2rem] border-2 border-zinc-900 bg-[#f8f8f6] p-5 shadow-[0_-12px_40px_rgba(0,0,0,.22)]">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-lg font-semibold">邀请亲友 · 守护者</div>
                <div className="mt-1 text-[10px] text-slate-500">为你的主线挑战组建守护团</div>
              </div>
              <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-sm active:scale-95">×</button>
            </div>
            <div className="mt-4 rounded-2xl border-2 border-zinc-900/10 bg-white p-4 text-left shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">为什么要邀请？</div>
              <ul className="mt-3 space-y-2.5 text-[11px] leading-5 text-slate-600">
                <li className="flex gap-2">
                  <span className="text-base leading-none">👀</span>
                  <span>守护者以像素直播围观你的专注过程，只能看到安全的状态画面，不会暴露隐私。</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-base leading-none">⚡</span>
                  <span>挑战进行中可收到技能卡、温柔提醒与弹性缓冲，把「一个人坚持」变成「有人看见」。</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-base leading-none">🏆</span>
                  <span>本局完成率达标，抵押的 FocusCoin 回到钱包；未达标的部分进入系统缓冲池，留给下一次主线挑战。</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 rounded-2xl border border-zinc-900 bg-[#fff36b] p-3 text-left text-[11px] shadow-[5px_5px_0_rgba(0,0,0,.08)]">focusboost.app/join/yuenong-420</div>
            <div className="mt-4 grid grid-cols-[.9fr_1.1fr] gap-3">
              <button type="button" className="flex items-center justify-center gap-2 rounded-full border-2 border-zinc-900/15 bg-white px-4 py-3 text-xs shadow active:scale-95"><Copy size={14} />复制链接</button>
              <button type="button" onClick={onSend} className="flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 py-3 text-xs text-white shadow active:scale-95"><Send size={14} />发送邀请</button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SettlementPage({ result, onStartNewBet }) {
  if (!result) return null;

  const [bossClearCopy] = useState(() => pickBossClearCopy(result));
  const milestoneCopy = result.completionRate > 0
    ? `今日成功解救 ${result.completionRate}% 专注力`
    : "今日完成了一次多巴胺复盘";
  const statusCopy = result.success
    ? `挑战达标，额外获得 ${formatCoin(result.challengeBonusAmount)} FC 多巴胺奖励。`
    : "每一条完成的支线都已即时解锁对应专注币。";

  return (
    <div className="relative h-full overflow-y-auto font-mono text-center">
      <div className="absolute inset-0 bg-[#fff8df]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(0,0,0,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.08)_1px,transparent_1px)] [background-size:18px_18px]" />

      <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center gap-4">
        {Array.from({ length: 9 }).map((_, idx) => (
          <motion.span
            key={idx}
            className={`h-5 w-5 border-2 border-zinc-900 shadow-[2px_2px_0_rgba(0,0,0,.16)] ${idx % 3 === 0 ? "bg-[#8c5cf6]" : idx % 3 === 1 ? "bg-[#f6b73c]" : "bg-[#41a85f]"}`}
            initial={{ y: -36, opacity: 0, rotate: 0 }}
            animate={{ y: [0, 150, 118], opacity: [0, 1, 0], rotate: [0, 180, 360] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: idx * 0.12, ease: "easeOut" }}
          />
        ))}
      </div>

      <div className="relative z-10 px-5 pb-28 pt-20 text-zinc-950">
        <motion.div
          initial={{ scale: 0.86, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mx-auto grid h-24 w-24 place-items-center border-[4px] border-zinc-900 bg-[#41a85f] shadow-[8px_8px_0_rgba(0,0,0,.16)]"
        >
          <Trophy size={42} />
        </motion.div>

        <div className="mt-7 text-[12px] uppercase tracking-[.18em] text-[#8c5cf6]">Dopamine Recap</div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-2 text-4xl font-bold leading-tight"
        >
          {bossClearCopy}
        </motion.h2>
        <p className="mx-auto mt-3 max-w-[280px] text-xs leading-5 text-slate-600">
          {milestoneCopy} · {statusCopy}
        </p>

        <div className="mt-6 border-[3px] border-zinc-900 bg-[#fff36b] px-4 py-4 text-zinc-950 shadow-[5px_5px_0_rgba(0,0,0,.16)]">
          <div className="text-[10px] uppercase tracking-[.16em] text-slate-600">Focus Rescued</div>
          <div className="mt-1 text-5xl font-bold leading-none">{result.completionRate}%</div>
          <div className="mt-2 grid grid-cols-10 gap-[3px]">
            {Array.from({ length: 10 }).map((_, idx) => (
              <span key={idx} className={`h-2 border border-zinc-900 ${idx < Math.ceil(result.completionRate / 10) ? "bg-[#41a85f]" : "bg-white/80"}`} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="border-2 border-zinc-900 bg-[#fff8df] px-2 py-3 text-zinc-950 shadow-[3px_3px_0_rgba(0,0,0,.16)]">
            <div className="text-[9px] text-slate-500">已返还</div>
            <div className="mt-1 text-2xl font-bold text-[#41a85f]">{formatCoin(result.rescuedAmount)} FC</div>
          </div>
          <div className="border-2 border-zinc-900 bg-white px-2 py-3 text-zinc-950 shadow-[3px_3px_0_rgba(0,0,0,.16)]">
            <div className="text-[9px] text-slate-500">达标奖励</div>
            <div className="mt-1 text-2xl font-bold">{formatCoin(result.challengeBonusAmount)} FC</div>
          </div>
          <div className="border-2 border-zinc-900 bg-[#f6ead0] px-2 py-3 text-zinc-950 shadow-[3px_3px_0_rgba(0,0,0,.16)]">
            <div className="text-[9px] text-slate-500">翻倍卡</div>
            <div className="mt-1 text-2xl font-bold text-[#8c5cf6]">{formatCoin(result.doubleRewardCoins)} FC</div>
          </div>
        </div>

        <div className="mt-5 border-2 border-zinc-900 bg-white p-4 text-left shadow-[5px_5px_0_rgba(0,0,0,.16)]">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Users size={16} />
            <span>亲友为你购买了 {result.supportSkillCount} 次助攻技能</span>
          </div>
          <div className="mt-3 space-y-2 text-[11px] leading-5 text-slate-600">
            <div>每条支线价值 {formatCoin(result.stepCoinAmount)} FC；完成即返还，对应翻倍卡会额外掉落同等专注币。</div>
            <div>本局亲友守护奖励：{formatCoin(result.guardianRewardAmount)} FC。</div>
            <div>{formatCoin(result.rolloverAmount)} FC 留在系统缓冲池，下一次主线挑战继续接住你。</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartNewBet}
          className="mt-6 w-full border-[3px] border-zinc-900 bg-[#fff36b] px-5 py-4 text-sm font-bold text-zinc-950 shadow-[6px_6px_0_rgba(0,0,0,.18)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[3px_3px_0_rgba(0,0,0,.18)]"
        >
          开始新的主线挑战
        </button>
      </div>
    </div>
  );
}

function UserHome({
  stage,
  setStage,
  setTab,
  input,
  setInput,
  confirmStart,
  currentTask,
  currentStep,
  currentTaskIndex,
  currentStepIndex,
  dailyTasks,
  planLoading,
  planError,
  onSubmitTask,
  onCompleteFragment,
  onEditFragment,
  onDeleteFragment,
  onAddFragment,
  editingFragmentId,
  setEditingFragmentId,
  editingFragmentLabel,
  setEditingFragmentLabel,
  reward,
  progress,
  gifts,
  rewardGifts,
  walletOpen,
  setWalletOpen,
  inviteCount,
  inviteRunning,
  setInviteRunning,
  setNextConfirmIn,
  taskReady,
  setTaskReady,
  fragmentTimer,
  overdueOpen,
  setOverdueOpen,
  overdueMessage,
  pot,
  stakeAmount,
  setStakeAmount,
  stakeError,
  focusCoinBalance,
  onLockFocusCoins,
  customStake,
  setCustomStake,
  showCustomInput,
  setShowCustomInput,
  taskPageOpen,
  setTaskPageOpen,
  buddyJumping,
  dopamineEvent,
  savedFocusCoins,
  completedFragmentCount,
  settlementResult,
  onStartNewBet,
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [submitHint, setSubmitHint] = useState("");
  const confirmed = Math.min(inviteCount, CREW.length);

  const sendInvites = () => {
    setInviteOpen(false);
    setStage("idle");
    setNextConfirmIn(AUTO_CONFIRM_SECONDS);
    setInviteRunning(true);
  };

  const submitTask = () => {
    if (input.trim().length > 0) {
      setSubmitHint("");
      onSubmitTask();
    } else {
      setSubmitHint("请先输入或语音说出任务内容");
    }
  };

  const finishTaskSetup = () => {
    setStage("stake");
  };

  if (taskPageOpen) {
    return (
      <Page>
        <div className="font-mono">
          <button type="button" onClick={() => setTaskPageOpen(false)} className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-white/75 shadow-lg backdrop-blur-xl active:scale-95">
            <ChevronLeft size={18} />
          </button>
          <div className="text-[11px] uppercase tracking-[.18em] text-slate-500">Today Tasks</div>
          <h2 className="mt-3 text-3xl">任务列表</h2>
          <div className="mt-5 max-h-[565px] overflow-auto pb-24">
            <MiniTaskList dailyTasks={dailyTasks} currentTaskIndex={currentTaskIndex} currentStepIndex={currentStepIndex} />
          </div>
        </div>
        <AppTabs activeTab="home" setTab={setTab} />
      </Page>
    );
  }

  return (
    <Page immersive>
      {stage === "active" ? null : <FloatingGifts gifts={gifts} />}

      {stage === "idle" ? (
        <div className="relative h-full font-mono text-center">
          <div className="absolute left-0 right-0 top-2 flex justify-center"><div className="text-[11px] uppercase tracking-[.18em] text-slate-500">FocusBoost</div></div>
          <div className="absolute right-0 top-1 border-2 border-zinc-900 bg-white/85 px-2.5 py-1.5 text-[10px] font-black text-zinc-950 shadow-[3px_3px_0_rgba(0,0,0,.12)]">
            🪙 拥有 {formatCoin(focusCoinBalance)} 专注币
          </div>
          <div className="flex h-[625px] flex-col items-center justify-center pt-8">
            <div className="text-4xl font-black leading-tight">今日主线</div>
            <p className="mt-2 max-w-[285px] text-xs leading-5 text-slate-500">
              写下今日任务，FocusBoost 会拆成可冲关的支线。你只管一格一格打掉。
            </p>
            <div className="mt-4 w-full">
              <QuestLaunchPanel
                input={input}
                setInput={setInput}
                stakeAmount={stakeAmount}
                setStakeAmount={setStakeAmount}
                focusCoinBalance={focusCoinBalance}
                planLoading={planLoading}
                stakeError={stakeError}
                planError={planError}
                submitHint={submitHint}
                onSubmit={submitTask}
              />
            </div>
            <div className="mt-4 flex items-center justify-center -space-x-2">
              {inviteRunning || confirmed > 0 ? CREW.map((emoji, index) => <CrewAvatar key={emoji} emoji={emoji} index={index} confirmed={confirmed} />) : null}
              <motion.button type="button" onClick={() => setInviteOpen(true)} animate={inviteRunning ? { opacity: [0.55, 1, 0.55] } : {}} transition={{ repeat: Infinity, duration: 1.2 }} className="relative grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-white/80 text-lg shadow active:scale-95">
                {inviteRunning ? <span className="text-lg text-slate-400">…</span> : <Users size={18} className="text-zinc-900" />}
              </motion.button>
            </div>
          </div>
          <InvitePanel open={inviteOpen} onClose={() => setInviteOpen(false)} onSend={sendInvites} />
        </div>
      ) : null}

      {stage === "input" ? (
        <div className="relative h-full font-mono text-center">
          <div className="absolute left-0 right-0 top-2 flex items-center justify-between">
            <button type="button" onClick={() => setStage("idle")} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-white/70 shadow-lg backdrop-blur-xl active:scale-95"><ChevronLeft size={18} /></button>
            <div className="text-[11px] uppercase tracking-[.18em] text-slate-500">Task Input</div>
            <div className="h-11 w-11" />
          </div>
          <div className="flex h-[480px] flex-col items-center justify-center px-6">
            <PixelBuddy size={70} />
            <PixelCube size={118} />
            <div className="mt-8 text-4xl">说出或写下任务</div>
            <p className="mt-3 max-w-[280px] text-[11px] leading-5 text-slate-500">
              例如：下午写周报、晚上健身、整理书桌。AI 会智能拆解为可执行的小步骤（每步 1-5 分钟）。
            </p>
            {submitHint ? <p className="mt-4 text-[11px] text-[#d94f4f]">{submitHint}</p> : null}
          </div>
          <TaskInputBar value={input} onChange={setInput} onSubmit={submitTask} />
        </div>
      ) : null}

      {stage === "planning" ? (
        <div className="font-mono">
          <Top title="AI Planner" sub="智能规划" back={() => setStage("input")} />
          <div className="mt-16 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}>
              <Sparkles className="mx-auto text-zinc-900" size={36} />
            </motion.div>
            <h2 className="mt-6 text-3xl">AI 正在分析</h2>
            <p className="mt-3 px-6 text-[11px] leading-5 text-slate-500">智能拆解为可执行的小步骤（每步 1-5 分钟）…</p>
            <motion.div className="mx-auto mt-8 h-1.5 w-32 rounded-full bg-zinc-950" animate={{ x: [-20, 20, -20] }} transition={{ repeat: Infinity, duration: 1.1 }} />
            {planError ? <p className="mt-6 text-[11px] text-[#d94f4f]">{planError}</p> : null}
          </div>
        </div>
      ) : null}

      {stage === "breakdown" ? (
        <div className="font-mono">
          <Top title="Confirm Plan" sub="确认计划" back={() => setStage("input")} />
          <div className="mt-4 text-center">
            <h2 className="text-3xl">确认任务计划</h2>
          </div>
          <div className="mt-5 max-h-[400px] overflow-auto space-y-3 pb-28">
            {dailyTasks.map((task, index) => (
              <GlassCard key={task.id} className="p-4 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-[10px] text-slate-400">#{index + 1}</div>
                    <div className="mt-1 text-sm font-semibold">{task.title}</div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400">{task.totalMinutes} min</div>
                </div>
                <div className="mt-3 space-y-2">
                  {task.steps.map((step, stepIndex) => (
                    <FragmentStepItem
                      key={step.id}
                      step={step}
                      stepIndex={stepIndex}
                      taskId={task.id}
                      editingFragmentId={editingFragmentId}
                      setEditingFragmentId={setEditingFragmentId}
                      editingFragmentLabel={editingFragmentLabel}
                      setEditingFragmentLabel={setEditingFragmentLabel}
                      onEditFragment={onEditFragment}
                      onDeleteFragment={onDeleteFragment}
                      onAddFragment={onAddFragment}
                      stepsLength={task.steps.length}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => onAddFragment(task.id)}
                    className="w-full rounded-2xl border-2 border-dashed border-zinc-300 px-3 py-2 text-xs text-slate-500 hover:border-zinc-400 hover:text-slate-600"
                  >
                    + 添加支线任务
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
          <div className="absolute bottom-28 left-5 right-5">
            <button type="button" disabled={planLoading || dailyTasks.length === 0} onClick={finishTaskSetup} className="w-full rounded-full border border-white/85 bg-zinc-950 px-4 py-4 text-sm text-white shadow-2xl backdrop-blur-xl active:scale-95 disabled:opacity-50">确认计划</button>
          </div>
        </div>
      ) : null}

      {stage === "stake" ? (
        <div className="relative h-full font-mono">
          <Top title="FocusCoin" sub="抵押专注币" back={() => setStage("breakdown")} />
          <div className="mt-4 text-center">
            <h2 className="text-3xl">抵押专注币</h2>
            <p className="mt-2 px-6 text-[11px] leading-5 text-slate-500">
              系统每天发放 {formatCoin(DAILY_FOCUS_COINS)} 个 FocusCoin。抵押自己的专注币挑战主线任务，完成率 ≥ {COMPLETION_THRESHOLD}% 即可守住。
            </p>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 px-1">
            {STAKE_OPTIONS.map((amount) => {
              const selected = !showCustomInput && stakeAmount === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => { setShowCustomInput(false); setStakeAmount(amount); }}
                  className={`rounded-2xl border-2 px-4 py-5 text-center transition active:scale-[.98] ${
                    selected ? "border-zinc-900 bg-[#fff36b] shadow-[4px_4px_0_rgba(0,0,0,.08)]" : "border-white/80 bg-white/70"
                  }`}
                >
                  <div className="text-[10px] text-slate-500">抵押</div>
                  <div className="mt-1 text-2xl font-bold">{formatCoin(amount)} FC</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 px-1">
            <button
              type="button"
              onClick={() => { setShowCustomInput(true); setStakeAmount(Number(customStake) || 0); }}
              className={`w-full rounded-2xl border-2 px-4 py-4 text-center transition active:scale-[.98] ${
                showCustomInput ? "border-zinc-900 bg-[#fff36b] shadow-[4px_4px_0_rgba(0,0,0,.08)]" : "border-white/80 bg-white/70"
              }`}
            >
              <div className="text-[10px] text-slate-500">自定义专注币</div>
              <div className="mt-1 text-lg font-bold">{showCustomInput ? formatCoin(stakeAmount) : "…"} FC</div>
            </button>
            <AnimatePresence>
              {showCustomInput ? (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={focusCoinBalance}
                    value={customStake}
                    onChange={(e) => { setCustomStake(e.target.value); setStakeAmount(Math.max(0, Math.floor(Number(e.target.value) || 0))); }}
                    placeholder="输入专注币数量"
                    className="mt-2 w-full rounded-xl border-2 border-zinc-300 bg-white px-4 py-3 text-lg font-bold outline-none focus:border-zinc-900"
                    autoFocus
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <GlassCard className="mx-1 mt-5 p-4 text-left">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">本局任务</div>
            <div className="mt-2 space-y-1">
              {dailyTasks.slice(0, 3).map((task, index) => (
                <div key={task.id} className="text-xs text-slate-600">
                  {index + 1}. {task.title}
                </div>
              ))}
            </div>
          </GlassCard>
          <div className="absolute bottom-28 left-5 right-5">
            <button
              type="button"
              onClick={onLockFocusCoins}
              disabled={stakeAmount <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-zinc-900 bg-[#fff36b] py-4 text-sm font-bold text-zinc-950 shadow-[4px_4px_0_rgba(0,0,0,.12)] active:scale-[.99] disabled:opacity-50"
            >
              <span className="grid h-6 w-6 place-items-center border-2 border-zinc-900 bg-white text-xs">FC</span>
              锁定 {formatCoin(stakeAmount)} FocusCoin
            </button>
            {stakeError ? <p className="mt-3 text-center text-[11px] text-[#d94f4f]">{stakeError}</p> : null}
          </div>
        </div>
      ) : null}

      {stage === "active" ? (
        <div className="relative h-full font-mono text-center">
          <DopamineFeedbackWarehouse event={dopamineEvent} />
          <div className="absolute inset-x-0 top-3 flex justify-center"><div className="text-[11px] uppercase tracking-[.18em] text-slate-500">FocusBoost</div></div>
          <div className="flex h-[560px] flex-col items-center justify-center">
            <div className="text-[11px] uppercase tracking-[.18em] text-slate-400">{currentTask?.title}</div>
            <motion.h1 key={currentStep?.id} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45 }} className="mt-3 px-3 text-4xl font-bold leading-[1.1]">
              {currentStep?.label}
            </motion.h1>
            <div className="mt-2 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[10px] text-slate-500 shadow">关卡 {currentTaskIndex + 1}/{dailyTasks.length} · 支线 {currentStepIndex + 1}/{currentTask?.steps?.length || 0}</div>
            {overdueMessage ? (
              <motion.div
                key={overdueMessage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex max-w-[286px] items-center gap-2 border-2 border-zinc-900 bg-[#fff36b] px-3 py-2 text-[11px] font-bold leading-4 text-zinc-950 shadow-[4px_4px_0_rgba(0,0,0,.12)]"
              >
                <motion.span animate={{ opacity: [1, 0.35, 1] }} transition={{ repeat: Infinity, duration: 0.9 }} className="grid h-5 w-5 place-items-center border-2 border-zinc-900 bg-white text-[10px]">♪</motion.span>
                FocusBoost 正在语音提醒你回到任务
              </motion.div>
            ) : null}
            <div className="mt-4 grid w-[260px] grid-cols-2 gap-2 text-left">
              <div className="border-2 border-zinc-900 bg-[#fff8df] px-3 py-2 shadow-[3px_3px_0_rgba(0,0,0,.12)]">
                <div className="text-[9px] uppercase tracking-[.16em] text-slate-500">SAVED</div>
                <div className="mt-1 text-xl font-bold text-[#41a85f]">{savedFocusCoins} FC</div>
              </div>
              <div className="border-2 border-zinc-900 bg-white px-3 py-2 shadow-[3px_3px_0_rgba(0,0,0,.12)]">
                <div className="text-[9px] uppercase tracking-[.16em] text-slate-500">CLEARED</div>
                <div className="mt-1 text-xl font-bold text-zinc-900">{completedFragmentCount}</div>
              </div>
            </div>
            <ProgressRoad
              currentTaskIndex={currentTaskIndex}
              currentStepIndex={currentStepIndex}
              tasks={dailyTasks}
              buddyJumping={buddyJumping}
              isOverdue={Boolean(overdueMessage)}
            />
          </div>
          <div className="absolute bottom-[108px] left-5 right-5 z-30">
            <button type="button" onClick={onCompleteFragment} className="mx-auto block w-44 rounded-full border-2 border-zinc-900 bg-[#41a85f] py-2.5 text-xs font-semibold text-white shadow-[4px_4px_0_rgba(0,0,0,.12)] active:scale-[.99]">
              完成当前支线
            </button>
          </div>
          <TaskIconDock onOpenTasks={() => setTaskPageOpen(true)} />
        </div>
      ) : null}

      {stage === "settlement" ? (
        <SettlementPage result={settlementResult} onStartNewBet={onStartNewBet} />
      ) : null}

      {stage === "settlement" ? null : <AppTabs activeTab="home" setTab={setTab} />}
    </Page>
  );
}

function CirclePage({ setTab, gifts, activeCircle, setActiveCircle, onSupportSkill, guardianBroadcasts }) {
  const [eventText, setEventText] = useState("");
  const [pendingSkill, setPendingSkill] = useState(null);
  const [giftText, setGiftText] = useState("");
  const [fireworkLabel, setFireworkLabel] = useState("");
  const skillOptions = {
    double: { id: "double", label: "翻倍奖励卡", cost: 2, firework: "翻倍奖励", event: `${getCircleById(activeCircle).name} 当前支线通关后奖励翻倍。` },
    time: { id: "time", label: "弹性续时卡", cost: 1, firework: "弹性续时", event: `为 ${getCircleById(activeCircle).name} 追加弹性缓冲。` },
    cheer: { id: "cheer", label: "温和鼓励卡", cost: 1, firework: "", event: `${getCircleById(activeCircle).name} 收到温和唤醒。` },
  };

  const friends = CIRCLES;
  const active = friends.find((item) => item.id === activeCircle) || friends[0];

  const chooseFriend = (friend) => {
    setActiveCircle(friend.id);
    setEventText("");
  };

  const activateDoubleReward = () => {
    setPendingSkill(skillOptions.double);
  };

  const activateTimeExtension = () => {
    setPendingSkill(skillOptions.time);
  };

  const openCheer = () => {
    setGiftText("");
    setPendingSkill(skillOptions.cheer);
  };

  const randomizeCheer = () => {
    setGiftText(pickCheerCardText(active.name));
  };

  const confirmSkill = () => {
    if (!pendingSkill) return;
    const item = giftText.trim() || "先做一个最小动作，我在这儿";
    onSupportSkill?.(pendingSkill.id, active, item);
    if (pendingSkill.firework) {
      setFireworkLabel(pendingSkill.firework);
      window.setTimeout(() => setFireworkLabel(""), 1100);
    }
    setEventText(pendingSkill.id === "cheer" ? `${active.name} 收到温和唤醒「${item}」。` : pendingSkill.event);
    setPendingSkill(null);
  };

  return (
    <Page immersive>
      <FloatingGifts gifts={gifts} />
      <PixelFireworks active={Boolean(fireworkLabel)} label={fireworkLabel} />
      <div className="max-h-[590px] overflow-y-auto pb-44 pr-1 font-mono">
        <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between border border-white/80 bg-white/88 px-4 py-3 shadow-xl backdrop-blur-xl">
          <div>
            <div className="text-[10px] uppercase tracking-[.18em] text-slate-500">守护广场</div>
            <div className="mt-0.5 text-xl font-bold">亲友广场</div>
          </div>
          <div className="border-2 border-zinc-900 bg-[#fff36b] px-2 py-1 text-[10px] font-bold shadow-[2px_2px_0_rgba(0,0,0,.14)]">助攻待命</div>
        </div>

        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {friends.map((friend) => (
            <CircleFriendCard
              key={friend.id}
              friend={friend}
              selected={active.id === friend.id}
              onSelect={() => chooseFriend(friend)}
            />
          ))}
        </div>

        <CircleLiveMonitor friend={active} eventText={eventText} />
        {guardianBroadcasts.length > 0 ? (
          <div className="mt-3 space-y-2">
            {guardianBroadcasts.slice(0, 2).map((broadcast) => (
              <motion.div
                key={broadcast.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-[3px] border-zinc-900 bg-[#fff36b] px-3 py-3 text-left text-[10px] font-bold leading-4 text-zinc-950 shadow-[4px_4px_0_rgba(0,0,0,.14)]"
              >
                {broadcast.text}
              </motion.div>
            ))}
          </div>
        ) : null}
        <SupportConsole friend={active} onDoubleReward={activateDoubleReward} onTimeExtension={activateTimeExtension} onCheer={openCheer} />
      </div>
      <SkillConfirmModal open={Boolean(pendingSkill)} skill={pendingSkill} friend={active} giftText={giftText} setGiftText={setGiftText} onClose={() => setPendingSkill(null)} onConfirm={confirmSkill} onRandomCheer={randomizeCheer} />
      <AppTabs activeTab="circle" setTab={setTab} />
    </Page>
  );
}

function UserProfile({ setTab, rewardGifts, reward, rewardDropCount, focusCoinBalance, rescuedMinutes, supportSkillHistory }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rechargedCard, setRechargedCard] = useState(null);
  const fallbackSupportHistory = [
    { id: "seed-time", friend: "Mia", type: "time", text: "为你注入了 3 次弹性时间", icon: "⏳", count: 3 },
    { id: "seed-double", friend: "Alex", type: "double", text: "燃放了 2 次多巴胺翻倍烟花", icon: "⚡", count: 2 },
    { id: "seed-cheer", friend: "Nina", type: "cheer", text: "送来了 1 张温和鼓励卡", icon: "💌", count: 1 },
  ];
  const visibleSupportHistory = supportSkillHistory.length > 0 ? supportSkillHistory : fallbackSupportHistory;
  const warehouseCards = [
    ...rewardGifts.slice(0, 4).map((gift) => ({
      id: `gift-${gift.id}`,
      icon: gift.icon || "🎁",
      title: gift.label || "奖励掉落",
      detail: gift.amount > 0 ? `奖励掉落 +${gift.amount} pts` : "亲友投喂的正反馈",
      tone: "bg-[#fff36b]",
    })),
    { id: "cheer-card-1", icon: "💌", title: "温和鼓励卡", detail: "Mia：先打开文档，写一个字就算启动成功。", tone: "bg-[#f6ead0]" },
    { id: "cheer-card-2", icon: "🎙️", title: "语音唤醒卡", detail: "Alex：你不用一口气做完，只要过这一小格。", tone: "bg-white" },
  ];
  const triggerRecharge = (cardId) => {
    setRechargedCard(cardId);
    window.setTimeout(() => setRechargedCard((current) => (current === cardId ? null : current)), 1200);
  };

  if (settingsOpen) {
    return (
      <Page>
        <div className="font-mono">
          <button type="button" onClick={() => setSettingsOpen(false)} className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-white/75 shadow-lg backdrop-blur-xl active:scale-95"><ChevronLeft size={18} /></button>
          <h2 className="text-3xl">设置</h2>
          <div className="mt-6 space-y-3 text-sm">
            <GlassCard className="p-5"><div className="flex items-center gap-3"><Users size={18} /><div><div>邀请好友</div><div className="mt-1 text-xs text-slate-500">管理本期亲友、邀请链接和围观权限</div></div></div></GlassCard>
            <GlassCard className="p-5"><div className="flex items-center gap-3"><Bluetooth size={18} /><div><div>硬件连接状态</div><div className="mt-1 text-xs text-slate-500">Clip Cam / Voice · 已连接</div></div></div></GlassCard>
            <GlassCard className="p-5"><div className="flex items-center gap-3"><Bell size={18} /><div><div>提醒强度</div><div className="mt-1 text-xs text-slate-500">当前：中</div></div></div></GlassCard>
            <GlassCard className="p-5"><div className="flex items-center gap-3"><Shield size={18} /><div><div>隐私与直播权限</div><div className="mt-1 text-xs text-slate-500">截图频率、可见范围、弹幕权限</div></div></div></GlassCard>
          </div>
        </div>
        <AppTabs activeTab="profile" setTab={setTab} />
      </Page>
    );
  }

  return (
    <Page>
      <div className="pt-3 font-mono text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white text-5xl shadow-xl">🧑‍🚀</div>
        <h2 className="mt-4 text-2xl">Yuenong</h2>
      </div>
      <div className="mt-5 max-h-[575px] overflow-auto space-y-4 pb-24 font-mono text-sm">
        <div className="border-[3px] border-zinc-900 bg-[#fff8df] p-4 shadow-[5px_5px_0_rgba(0,0,0,.18)]">
          <div className="text-left text-[10px] uppercase tracking-widest text-slate-500">Profile Backpack</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div className="border-2 border-zinc-900 bg-white px-3 py-4 shadow-[3px_3px_0_rgba(0,0,0,.12)]">
              <div className="text-[10px] text-slate-500">专注力解救总量</div>
              <div className="mt-2 text-2xl font-black text-[#41a85f]">{rescuedMinutes}</div>
              <div className="mt-1 text-[10px] text-slate-500">本周已成功解救分钟</div>
            </div>
            <div className="border-2 border-zinc-900 bg-[#fff36b] px-3 py-4 shadow-[3px_3px_0_rgba(0,0,0,.12)]">
              <div className="text-[10px] text-zinc-700">专注币余额</div>
              <div className="mt-2 text-2xl font-black text-zinc-950">{formatCoin(focusCoinBalance)} FC</div>
              <div className="mt-1 text-[10px] text-zinc-700">可兑换 / 可助攻</div>
            </div>
          </div>
        </div>
        <div className="border-[3px] border-zinc-900 bg-white/85 p-4 shadow-[5px_5px_0_rgba(0,0,0,.14)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">助攻接受记录</div>
              <div className="mt-1 text-[10px] text-slate-500">亲友技能注入历史</div>
            </div>
            <Shield size={18} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {visibleSupportHistory.slice(0, 4).map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 border-2 border-zinc-900 bg-[#f6ead0] px-3 py-3 shadow-[3px_3px_0_rgba(0,0,0,.1)]"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center border-2 border-zinc-900 bg-white text-lg">{item.icon}</div>
                <div className="min-w-0 text-left">
                  <div className="truncate text-xs font-black text-zinc-950">{item.friend}</div>
                  <div className="mt-0.5 text-[10px] leading-4 text-slate-600">{item.text}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="border-[3px] border-zinc-900 bg-[#232637] p-4 text-white shadow-[5px_5px_0_rgba(0,0,0,.2)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">动力仓库</div>
              <div className="mt-1 text-[10px] text-white/60">奖励掉落 {rewardDropCount} · 多巴胺能量 {reward} pts</div>
            </div>
            <Gift size={18} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {warehouseCards.slice(0, 5).map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => triggerRecharge(card.id)}
                className={`relative w-full border-2 border-zinc-900 ${card.tone} px-3 py-3 text-left text-zinc-950 shadow-[3px_3px_0_rgba(255,255,255,.18)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center border-2 border-zinc-900 bg-white text-lg">{card.icon}</div>
                  <div className="min-w-0">
                    <div className="text-xs font-black">{card.title}</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-zinc-700">{card.detail}</div>
                  </div>
                </div>
                {rechargedCard === card.id ? (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-2 top-2 border-2 border-zinc-900 bg-[#41a85f] px-2 py-1 text-[9px] font-black text-white"
                  >
                    HP +1
                  </motion.div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => setSettingsOpen(true)} className="w-full text-left active:scale-[.99]">
          <GlassCard className="p-5"><div className="flex items-center justify-between"><div><div>设置</div><div className="mt-1 text-xs text-slate-500">好友、硬件、提醒、隐私</div></div><Settings size={18} /></div></GlassCard>
        </button>
      </div>
      <AppTabs activeTab="profile" setTab={setTab} />
    </Page>
  );
}

export default function FocusBoostPrototype() {
  const initialCoinSnapshot = loadFocusCoinSnapshot();
  const [tab, setTab] = useState("home");
  const [userStage, setUserStage] = useState("idle");
  const [taskInput, setTaskInput] = useState("");
  const [dailyTasks, setDailyTasks] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planSource, setPlanSource] = useState("local");
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reward, setReward] = useState(80);
  const [progress, setProgress] = useState(18);
  const [pot, setPot] = useState(initialCoinSnapshot.rolloverCoins);
  const [focusCoinBalance, setFocusCoinBalance] = useState(initialCoinSnapshot.focusCoins);
  const [stakeAmount, setStakeAmount] = useState(DEFAULT_STAKE_COINS);
  const [, setChallengeLocked] = useState(initialCoinSnapshot.challengeLocked);
  const [editingFragmentId, setEditingFragmentId] = useState(null);
  const [editingFragmentLabel, setEditingFragmentLabel] = useState("");
  const [stakeError, setStakeError] = useState("");
  const [rewardDropCount, setRewardDropCount] = useState(1);
  const [gifts, setGifts] = useState([]);
  const [rewardGifts, setRewardGifts] = useState([]);
  const [walletOpen, setWalletOpen] = useState(false);
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);
  const [inviteRunning, setInviteRunning] = useState(false);
  const [nextConfirmIn, setNextConfirmIn] = useState(AUTO_CONFIRM_SECONDS);
  const [taskReady, setTaskReady] = useState(false);
  const [activeCircle, setActiveCircle] = useState("c1");
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [overdueMessage, setOverdueMessage] = useState("");
  const [customStake, setCustomStake] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [buddyJumping, setBuddyJumping] = useState(false);
  const [taskPageOpen, setTaskPageOpen] = useState(false);
  const [settlementResult, setSettlementResult] = useState(null);
  const [supportSkillCount, setSupportSkillCount] = useState(0);
  const [dopamineEvent, setDopamineEvent] = useState(null);
  const [pendingSupportSkill, setPendingSupportSkill] = useState(null);
  const [guardianBroadcasts, setGuardianBroadcasts] = useState([]);
  const [supportSkillHistory, setSupportSkillHistory] = useState([]);
  const [unlockedStakeCoins, setUnlockedStakeCoins] = useState(0);
  const [doubleRewardCoins, setDoubleRewardCoins] = useState(0);
  const [demoSupportEvents, setDemoSupportEvents] = useState({ double: false, cheer: false });

  const currentTask = dailyTasks[currentTaskIndex] || dailyTasks[0] || null;
  const currentStep = getCurrentStep(currentTask, currentStepIndex);

  const totalSteps = useMemo(() => dailyTasks.reduce((sum, t) => sum + t.steps.length, 0), [dailyTasks]);
  const completedFragmentCount = useMemo(() => {
    if (!dailyTasks.length) return 0;
    const previousTaskSteps = currentTaskIndex > 0 ? dailyTasks.slice(0, currentTaskIndex).reduce((sum, task) => sum + task.steps.length, 0) : 0;
    return Math.min(totalSteps, previousTaskSteps + currentStepIndex);
  }, [dailyTasks, currentTaskIndex, currentStepIndex, totalSteps]);
  const stepFocusCoinAmount = totalSteps > 0 ? stakeAmount / totalSteps : 0;
  const savedFocusCoins = formatCoin(unlockedStakeCoins + doubleRewardCoins);
  const rescuedFocusMinutes = 124 + completedFragmentCount * 6 + supportSkillHistory.length * 2;

  useEffect(() => {
    runPrototypeSmokeTests();
    if (initialCoinSnapshot.challengeLocked) {
      setTaskReady(true);
    }
  }, []);

  const lockFocusCoins = useCallback(() => {
    setStakeError("");
    if (stakeAmount <= 0) {
      setStakeError("请至少抵押 1 个 FocusCoin");
      return;
    }
    if (stakeAmount > focusCoinBalance) {
      setStakeError(`今日可用 FocusCoin 只有 ${formatCoin(focusCoinBalance)} 个`);
      return;
    }
    const nextBalance = focusCoinBalance - stakeAmount;
    const nextRollover = pot + stakeAmount;
    setFocusCoinBalance(nextBalance);
    setChallengeLocked(true);
    setPot(nextRollover);
    setSupportSkillCount(0);
    setUnlockedStakeCoins(0);
    setDoubleRewardCoins(0);
    setDemoSupportEvents({ double: false, cheer: false });
    saveFocusCoinSnapshot({
      focusCoins: nextBalance,
      challengeLocked: true,
      rolloverCoins: nextRollover,
      lockedAt: new Date().toISOString(),
      lastDailyGrantDate: initialCoinSnapshot.lastDailyGrantDate,
    });
    setTaskReady(true);
    setUserStage("idle");
  }, [focusCoinBalance, pot, stakeAmount]);

  const pushFloatingNote = (text) => {
    const id = Date.now() + Math.random();
    setGifts((old) => [...old, { id, text }].slice(-5));
    window.setTimeout(() => setGifts((old) => old.filter((gift) => gift.id !== id)), 2400);
  };

  const creditFocusCoins = useCallback(
    ({ baseReturn = 0, bonus = 0, note = "" }) => {
      const totalCredit = baseReturn + bonus;
      if (totalCredit <= 0) return;
      const nextBalance = focusCoinBalance + totalCredit;
      const nextPot = Math.max(0, pot - baseReturn);
      setFocusCoinBalance(nextBalance);
      setPot(nextPot);
      saveFocusCoinSnapshot({
        focusCoins: nextBalance,
        challengeLocked: true,
        rolloverCoins: nextPot,
        lockedAt: initialCoinSnapshot.lockedAt,
        lastDailyGrantDate: initialCoinSnapshot.lastDailyGrantDate,
      });
    },
    [focusCoinBalance, pot]
  );

  const receiveSupportSkill = useCallback((skillType, friend, cheerText = "") => {
    const meta = SUPPORT_SKILL_META[skillType] || SUPPORT_SKILL_META.cheer;
    const friendName = friend?.name || "亲友";
    const cheerCopy = cheerText ? `${friendName}：${cheerText}` : meta.copy;
    const event = { id: Date.now() + Math.random(), type: skillType, title: meta.title, copy: skillType === "cheer" ? cheerCopy : meta.copy };
    const historyCopy = {
      double: "燃放了 1 次多巴胺翻倍烟花",
      time: "为你注入了 1 次弹性时间",
      cheer: cheerText ? `送来温和鼓励卡：${cheerText}` : "送来了 1 张温和鼓励卡",
    }[skillType] || "送来 1 次守护助攻";
    const historyIcon = { double: "⚡", time: "⏳", cheer: "💌" }[skillType] || "✨";
    setSupportSkillCount((value) => value + 1);
    setPendingSupportSkill({ type: skillType, ...meta });
    setSupportSkillHistory((old) => [
      { id: event.id, friend: friendName, type: skillType, text: historyCopy, icon: historyIcon, count: 1 },
      ...old,
    ].slice(0, 8));
    setDopamineEvent(event);
    if (skillType === "cheer") {
      speakGameCue(cheerText || "先做一个最小动作，我在这儿。");
    }
    window.setTimeout(() => setDopamineEvent((current) => (current?.id === event.id ? null : current)), 1600);
  }, []);

  const settleChallenge = useCallback(
    (completedSteps = completedFragmentCount, unlockedOverride = unlockedStakeCoins, doubleOverride = doubleRewardCoins, balanceOverride = focusCoinBalance, potOverride = pot) => {
      if (totalSteps <= 0) return;
      const result = buildSettlementResult({
        stakeAmount,
        totalSteps,
        completedSteps,
        supportSkillCount,
        unlockedStakeCoins: unlockedOverride,
        doubleRewardCoins: doubleOverride,
      });
      const finalUserCredit = result.finalReturnAmount + result.challengeBonusAmount;
      const nextBalance = balanceOverride + finalUserCredit;
      const nextPot = Math.max(0, potOverride - result.finalReturnAmount);

      setSettlementResult(result);
      setUserStage("settlement");
      setChallengeStarted(false);
      setWalletOpen(false);
      setOverdueOpen(false);
      setOverdueMessage("");
      setTaskPageOpen(false);
      setTaskReady(false);
      setChallengeLocked(false);
      setFocusCoinBalance(nextBalance);
      setPot(nextPot);
      saveFocusCoinSnapshot({
        focusCoins: nextBalance,
        challengeLocked: false,
        rolloverCoins: nextPot,
        lockedAt: null,
        lastDailyGrantDate: initialCoinSnapshot.lastDailyGrantDate,
      });
    },
    [completedFragmentCount, doubleRewardCoins, focusCoinBalance, pot, stakeAmount, supportSkillCount, totalSteps, unlockedStakeCoins]
  );

  const startNewChallenge = useCallback(() => {
    setSettlementResult(null);
    setDopamineEvent(null);
    setPendingSupportSkill(null);
    setGuardianBroadcasts([]);
    setTaskInput("");
    setDailyTasks([]);
    setCurrentTaskIndex(0);
    setCurrentStepIndex(0);
    setProgress(18);
    setWalletOpen(false);
    setOverdueOpen(false);
    setOverdueMessage("");
    setTaskPageOpen(false);
    setTaskReady(false);
    setStakeAmount(DEFAULT_STAKE_COINS);
    setCustomStake("");
    setShowCustomInput(false);
    setStakeError("");
    setInviteCount(0);
    setSupportSkillCount(0);
    setUnlockedStakeCoins(0);
    setDoubleRewardCoins(0);
    setDemoSupportEvents({ double: false, cheer: false });
    setInviteRunning(false);
    setNextConfirmIn(AUTO_CONFIRM_SECONDS);
    setUserStage("idle");
  }, []);

  const generateOverdueMessage = async (stepLabel) => {
    const baseUrl = (import.meta.env.VITE_FOCUSBOOST_API_BASE || "").replace(/\/$/, "");
    const fallbacks = [
      "先做30秒，Boss 血条就会动",
      "只点开第一步，这回合就算赢",
      "拿起工具，先过眼前这一格",
      "写下一个字，大脑就开始热身",
      "读一行就好，先把角色动起来",
      "把手放到任务上，下一格会亮",
    ];
    try {
      const res = await fetch(`${baseUrl}/api/fragments/overdue-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepLabel }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      return data?.message?.trim() || fallbacks[Math.floor(Math.random() * fallbacks.length)];
    } catch {
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  };

  const handleOverdue = useCallback(
    async ({ step, elapsedSec }) => {
      const message = await generateOverdueMessage(step.label);
      setOverdueMessage(message);
      speakGameCue(message);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("FocusBoost 支线超时", { body: message });
      }
    },
    []
  );

  const fragmentTimer = useFragmentTimer({
    enabled: userStage === "active" && Boolean(currentStep),
    step: currentStep,
    onOverdue: handleOverdue,
  });

  useEffect(() => {
    if (userStage !== "active" || !currentStep) return undefined;
    const stepProgress = Math.min(100, fragmentTimer.progressPct);
    setProgress(Math.max(12, stepProgress));
    return undefined;
  }, [userStage, currentStep?.id, fragmentTimer.progressPct]);

  useEffect(() => {
    if (userStage !== "active" || !currentStep?.label) return undefined;
    const timer = window.setTimeout(() => {
      speakGameCue(`新的支线任务，${currentStep.label}`);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [userStage, currentStep?.id, currentStep?.label]);

  useEffect(() => {
    if (userStage !== "active" || totalSteps <= 0) return undefined;
    if (!demoSupportEvents.double && completedFragmentCount === 0) {
      const timer = window.setTimeout(() => {
        receiveSupportSkill("double", CIRCLES[0]);
        setDemoSupportEvents((old) => ({ ...old, double: true }));
      }, 1400);
      return () => window.clearTimeout(timer);
    }
    if (!demoSupportEvents.cheer && completedFragmentCount >= 1) {
      const timer = window.setTimeout(() => {
        receiveSupportSkill("cheer", CIRCLES[1], "你已经过了一格，别追求完美，继续打掉眼前这一步！");
        setDemoSupportEvents((old) => ({ ...old, cheer: true }));
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [userStage, totalSteps, completedFragmentCount, demoSupportEvents, receiveSupportSkill]);

  const handleSubmitTask = async () => {
    if (!taskInput.trim()) return;
    setPlanError("");
    setStakeError("");
    if (stakeAmount <= 0) {
      setStakeError("请至少携带 1.0 个专注币");
      return;
    }
    if (stakeAmount > focusCoinBalance) {
      setStakeError(`当前最多可携带 ${formatCoin(focusCoinBalance)} 个专注币`);
      return;
    }
    setPlanLoading(true);
    try {
      const plan = await planTasksFromInput(taskInput);
      const nextBalance = focusCoinBalance - stakeAmount;
      const nextRollover = pot + stakeAmount;
      setDailyTasks(plan.tasks);
      setPlanSource(plan.source);
      setCurrentTaskIndex(0);
      setCurrentStepIndex(0);
      setProgress(12);
      setFocusCoinBalance(nextBalance);
      setPot(nextRollover);
      setChallengeLocked(true);
      setTaskReady(false);
      setChallengeStarted(true);
      setWalletOpen(false);
      setOverdueOpen(false);
      setOverdueMessage("");
      setTaskPageOpen(false);
      setSupportSkillCount(0);
      setUnlockedStakeCoins(0);
      setDoubleRewardCoins(0);
      setDemoSupportEvents({ double: false, cheer: false });
      saveFocusCoinSnapshot({
        focusCoins: nextBalance,
        challengeLocked: true,
        rolloverCoins: nextRollover,
        lockedAt: new Date().toISOString(),
        lastDailyGrantDate: initialCoinSnapshot.lastDailyGrantDate,
      });
      setUserStage("active");
    } catch (error) {
      setPlanError(error.message || "任务规划失败，请重试");
      setUserStage("idle");
    } finally {
      setPlanLoading(false);
    }
  };

  const handleEditFragment = (taskId, stepId, newLabel) => {
    if (!newLabel.trim()) return;
    setDailyTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          steps: task.steps.map(step =>
            step.id === stepId ? { ...step, label: newLabel } : step
          )
        };
      }
      return task;
    }));
    setEditingFragmentId(null);
    setEditingFragmentLabel("");
  };

  const handleDeleteFragment = (taskId, stepId) => {
    setDailyTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          steps: task.steps.filter(step => step.id !== stepId),
          totalMinutes: task.steps.filter(step => step.id !== stepId).reduce((sum, step) => sum + step.minutes, 0)
        };
      }
      return task;
    }));
  };

  const handleAddFragment = (taskId) => {
    const newStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: "新支线任务",
      minutes: 3
    };
    setDailyTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          steps: [...task.steps, newStep],
          totalMinutes: task.totalMinutes + newStep.minutes
        };
      }
      return task;
    }));
    setEditingFragmentId(newStep.id);
    setEditingFragmentLabel("新支线任务");
  };

  const unlockCurrentStepCoins = useCallback(() => {
    if (totalSteps <= 0) {
      return { nextUnlockedStakeCoins: unlockedStakeCoins, nextDoubleRewardCoins: doubleRewardCoins, nextBalance: focusCoinBalance, nextPot: pot };
    }
    const baseReturn = stepFocusCoinAmount;
    const bonus = pendingSupportSkill?.type === "double" ? stepFocusCoinAmount : 0;
    const nextUnlockedStakeCoins = Math.min(stakeAmount, unlockedStakeCoins + baseReturn);
    const nextDoubleRewardCoins = doubleRewardCoins + bonus;
    const nextBalance = focusCoinBalance + baseReturn + bonus;
    const nextPot = Math.max(0, pot - baseReturn);
    setUnlockedStakeCoins(nextUnlockedStakeCoins);
    setDoubleRewardCoins(nextDoubleRewardCoins);
    creditFocusCoins({
      baseReturn,
      bonus,
      note: bonus > 0
        ? `支线完成：返还 ${formatCoin(baseReturn)} FC，翻倍奖励 +${formatCoin(bonus)} FC`
        : `支线完成：返还 ${formatCoin(baseReturn)} FC`,
    });
    return { nextUnlockedStakeCoins, nextDoubleRewardCoins, nextBalance, nextPot };
  }, [creditFocusCoins, doubleRewardCoins, focusCoinBalance, pendingSupportSkill, pot, stakeAmount, stepFocusCoinAmount, totalSteps, unlockedStakeCoins]);

  const advanceFragment = useCallback(() => {
    if (!currentTask) return;
    setOverdueOpen(false);
    setOverdueMessage("");
    const unlockedAfterStep = unlockCurrentStepCoins();

    if (pendingSupportSkill) {
      const broadcast = {
        id: Date.now() + Math.random(),
        text: `由于你的${pendingSupportSkill.thanks}，Sena 刚刚成功通关了「关卡 ${currentTaskIndex + 1}」！你获得了 ${pendingSupportSkill.medals} 个守护勋章。`,
      };
      setGuardianBroadcasts((old) => [broadcast, ...old].slice(0, 4));
      setPendingSupportSkill(null);
    }

    setBuddyJumping(true);
    setTimeout(() => setBuddyJumping(false), 1200);

    const isLastStep = currentStepIndex >= currentTask.steps.length - 1;
    if (!isLastStep) {
      setCurrentStepIndex((idx) => idx + 1);
      setProgress(12);
      return;
    }

    const isLastTask = currentTaskIndex >= dailyTasks.length - 1;
    if (isLastTask) {
      setProgress(18);
      settleChallenge(totalSteps, unlockedAfterStep.nextUnlockedStakeCoins, unlockedAfterStep.nextDoubleRewardCoins, unlockedAfterStep.nextBalance, unlockedAfterStep.nextPot);
      return;
    }

    const nextTask = dailyTasks[currentTaskIndex + 1];
    setCurrentTaskIndex((idx) => idx + 1);
    setCurrentStepIndex(0);
    setProgress(12);
    pushFloatingNote(`下一关卡 → ${nextTask.title}`);
  }, [currentTask, currentStepIndex, currentTaskIndex, dailyTasks, pendingSupportSkill, settleChallenge, totalSteps, unlockCurrentStepCoins]);

  const giftPool = [
    { icon: "🎁", label: "奖励掉落", amount: 10 },
    { icon: "💝", label: "encourage gift", amount: 0 },
    { icon: "✨", label: "spark bonus", amount: 8 },
    { icon: "🍀", label: "luck drop", amount: 0 },
    { icon: "🪙", label: "FocusCoin burst", amount: 15 },
  ];

  const addAutoGift = () => {
    const picked = giftPool[Math.floor(Math.random() * giftPool.length)];
    const gift = { id: Date.now() + Math.random(), ...picked };
    setRewardGifts((old) => [gift, ...old].slice(0, 8));
    setRewardDropCount((value) => value + 1);
    if (gift.amount > 0) {
      setReward((value) => value + gift.amount);
      pushFloatingNote(`${gift.icon} +${gift.amount} pts`);
    } else {
      pushFloatingNote(`${gift.icon} ${gift.label}`);
    }
  };

  useEffect(() => {
    const canRun = tab === "home" && userStage === "idle" && inviteRunning && inviteCount < CREW.length;
    if (!canRun) return undefined;
    setNextConfirmIn(AUTO_CONFIRM_SECONDS);
    const confirmTimer = window.setInterval(() => setInviteCount((value) => Math.min(CREW.length, value + 1)), AUTO_CONFIRM_SECONDS * 1000);
    return () => window.clearInterval(confirmTimer);
  }, [tab, userStage, inviteRunning, inviteCount]);

  useEffect(() => {
    if (!inviteRunning || inviteCount <= 0) return undefined;
    pushFloatingNote(`Crew ${inviteCount} confirmed ✓`);
    if (inviteCount >= CREW.length) {
      setInviteRunning(false);
      setNextConfirmIn(0);
    }
    return undefined;
  }, [inviteCount, inviteRunning]);

  useEffect(() => {
    const shouldRun = tab === "home" && userStage === "active";
    if (!shouldRun) return undefined;
    const giftTimer = window.setInterval(() => addAutoGift(), 5000);
    return () => window.clearInterval(giftTimer);
  }, [tab, userStage]);

  useEffect(() => {
    const shouldSettleAtMidnight = tab === "home" && userStage === "active" && challengeStarted && totalSteps > 0;
    if (!shouldSettleAtMidnight) return undefined;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const midnightTimer = window.setTimeout(() => settleChallenge(completedFragmentCount), midnight.getTime() - now.getTime());
    return () => window.clearTimeout(midnightTimer);
  }, [tab, userStage, challengeStarted, totalSteps, completedFragmentCount, settleChallenge]);

  const confirmUserStart = useCallback(() => {
    if (!taskReady) {
      pushFloatingNote("先在首页输入一句任务，再携带专注币开局");
      setUserStage("idle");
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setUserStage("active");
    setChallengeStarted(true);
    setCurrentTaskIndex(0);
    setCurrentStepIndex(0);
    setProgress(12);
    setWalletOpen(false);
    setOverdueOpen(false);
    setOverdueMessage("");
  }, [taskReady]);

  const page = useMemo(() => {
    if (tab === "home") {
      return (
        <UserHome
          stage={userStage}
          setStage={setUserStage}
          setTab={setTab}
          input={taskInput}
          setInput={setTaskInput}
          confirmStart={confirmUserStart}
          currentTask={currentTask}
          currentStep={currentStep}
          currentTaskIndex={currentTaskIndex}
          currentStepIndex={currentStepIndex}
          dailyTasks={dailyTasks}
          planLoading={planLoading}
          planError={planError}
          onSubmitTask={handleSubmitTask}
          onCompleteFragment={advanceFragment}
          onEditFragment={handleEditFragment}
          onDeleteFragment={handleDeleteFragment}
          onAddFragment={handleAddFragment}
          editingFragmentId={editingFragmentId}
          setEditingFragmentId={setEditingFragmentId}
          editingFragmentLabel={editingFragmentLabel}
          setEditingFragmentLabel={setEditingFragmentLabel}
          reward={reward}
          progress={progress}
          gifts={gifts}
          rewardGifts={rewardGifts}
          walletOpen={walletOpen}
          setWalletOpen={setWalletOpen}
          inviteCount={inviteCount}
          inviteRunning={inviteRunning}
          setInviteRunning={setInviteRunning}
          nextConfirmIn={nextConfirmIn}
          setNextConfirmIn={setNextConfirmIn}
          taskReady={taskReady}
          setTaskReady={setTaskReady}
          fragmentTimer={fragmentTimer}
          overdueOpen={overdueOpen}
          setOverdueOpen={setOverdueOpen}
          overdueMessage={overdueMessage}
          pot={pot}
          stakeAmount={stakeAmount}
          setStakeAmount={setStakeAmount}
          stakeError={stakeError}
          focusCoinBalance={focusCoinBalance}
          onLockFocusCoins={lockFocusCoins}
          customStake={customStake}
          setCustomStake={setCustomStake}
          showCustomInput={showCustomInput}
          setShowCustomInput={setShowCustomInput}
          taskPageOpen={taskPageOpen}
          setTaskPageOpen={setTaskPageOpen}
          buddyJumping={buddyJumping}
          dopamineEvent={dopamineEvent}
          savedFocusCoins={savedFocusCoins}
          completedFragmentCount={completedFragmentCount}
          settlementResult={settlementResult}
          onStartNewBet={startNewChallenge}
        />
      );
    }
    if (tab === "circle") {
      return (
        <CirclePage
          setTab={setTab}
          gifts={gifts}
          activeCircle={activeCircle}
          setActiveCircle={setActiveCircle}
          onSupportSkill={receiveSupportSkill}
          guardianBroadcasts={guardianBroadcasts}
        />
      );
    }
    return (
      <UserProfile
        setTab={setTab}
        rewardGifts={rewardGifts}
        reward={reward}
        rewardDropCount={rewardDropCount}
        focusCoinBalance={focusCoinBalance}
        rescuedMinutes={rescuedFocusMinutes}
        supportSkillHistory={supportSkillHistory}
      />
    );
  }, [tab, userStage, taskInput, currentTask, currentStep, currentTaskIndex, currentStepIndex, dailyTasks, planLoading, planError, planSource, reward, progress, gifts, rewardGifts, walletOpen, pot, stakeAmount, focusCoinBalance, stakeError, lockFocusCoins, rewardDropCount, challengeStarted, inviteCount, inviteRunning, nextConfirmIn, taskReady, activeCircle, fragmentTimer, overdueOpen, overdueMessage, taskPageOpen, settlementResult, startNewChallenge, dopamineEvent, receiveSupportSkill, guardianBroadcasts, rescuedFocusMinutes, supportSkillHistory]);

  const transitionKey = `${tab}-${userStage}-${activeCircle}-${challengeStarted ? "started" : "idle"}`;

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f7f7f6,#ececea_55%,#d8d8d3)] text-zinc-950">
      <div className="flex min-h-screen items-center justify-center p-6">
        <PhoneShell>
          <AnimatePresence mode="wait">
            <motion.div key={transitionKey} className="absolute inset-0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              {page}
            </motion.div>
          </AnimatePresence>
        </PhoneShell>
      </div>
    </div>
  );
}
