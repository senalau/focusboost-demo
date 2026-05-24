import { useCallback, useEffect, useRef, useState } from "react";

export function useFragmentTimer({ enabled, step, onOverdue }) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isOverdue, setIsOverdue] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const lastRemindAt = useRef(0);
  const remindCountRef = useRef(0);
  const onOverdueRef = useRef(onOverdue);

  onOverdueRef.current = onOverdue;

  const reset = useCallback(() => {
    setElapsedSec(0);
    setIsOverdue(false);
    setOverdueCount(0);
    lastRemindAt.current = 0;
    remindCountRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled || !step) {
      reset();
      return undefined;
    }

    reset();
    const startedAt = Date.now();
    const budgetSec = Math.max(60, (step.minutes || 5) * 60);
    const remindIntervalMs = Math.max(30_000, (step.minutes || 5) * 60 * 1000);

    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSec(elapsed);

      if (elapsed <= budgetSec) return;

      setIsOverdue(true);

      const shouldRemind = remindCountRef.current === 0 || Date.now() - lastRemindAt.current >= remindIntervalMs;
      if (!shouldRemind) return;

      lastRemindAt.current = Date.now();
      remindCountRef.current += 1;
      setOverdueCount(remindCountRef.current);
      onOverdueRef.current?.({
        step,
        elapsedSec: elapsed,
        budgetSec,
        remindIndex: remindCountRef.current,
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [enabled, step?.id, step?.minutes, reset]);

  const remainingSec = step ? Math.max(0, step.minutes * 60 - elapsedSec) : 0;
  const progressPct = step ? Math.min(100, Math.round((elapsedSec / (step.minutes * 60)) * 100)) : 0;

  return {
    elapsedSec,
    remainingSec,
    progressPct,
    isOverdue,
    overdueCount,
    reset,
  };
}
