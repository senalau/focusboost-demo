export const DAILY_FOCUS_COINS = 10;
export const DEFAULT_STAKE_COINS = 3;
export const COMPLETION_THRESHOLD = 80;
export const WALLET_STORAGE_KEY = "focusboost_coin_wallet_v1";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSnapshot(snapshot = {}) {
  const todayKey = getTodayKey();
  const lastDailyGrantDate = snapshot.lastDailyGrantDate || null;
  const shouldGrantToday = lastDailyGrantDate !== todayKey;
  return {
    focusCoins: (Number(snapshot.focusCoins ?? 0) || 0) + (shouldGrantToday ? DAILY_FOCUS_COINS : 0),
    challengeLocked: Boolean(snapshot.challengeLocked),
    rolloverCoins: Number(snapshot.rolloverCoins) || 0,
    lockedAt: snapshot.lockedAt || null,
    lastDailyGrantDate: todayKey,
  };
}

export function loadFocusCoinSnapshot() {
  if (typeof window === "undefined") {
    return normalizeSnapshot();
  }
  try {
    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) {
      const snapshot = normalizeSnapshot();
      saveFocusCoinSnapshot(snapshot);
      return snapshot;
    }
    const parsed = JSON.parse(raw);
    const snapshot = normalizeSnapshot(parsed);
    saveFocusCoinSnapshot(snapshot);
    return snapshot;
  } catch {
    return normalizeSnapshot();
  }
}

export function saveFocusCoinSnapshot(snapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(snapshot));
}
