export type ProgressionData = {
  coins: number;
  clears: number;
  hpLevel: number;
  attackLevel: number;
  reloadLevel: number;
  sfxVolume: number;
  bgmVolume: number;
};

export const DEFAULT_PROGRESSION: ProgressionData = {
  coins: 0,
  clears: 0,
  hpLevel: 1,
  attackLevel: 1,
  reloadLevel: 1,
  sfxVolume: 0.7,
  bgmVolume: 0.5,
};

const STORAGE_KEY = "stormfall-progression-v1";

export function loadProgression(): ProgressionData {
  if (typeof window === "undefined") return DEFAULT_PROGRESSION;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ProgressionData> | null;
    return { ...DEFAULT_PROGRESSION, ...(parsed ?? {}) };
  } catch {
    return DEFAULT_PROGRESSION;
  }
}

export function saveProgression(data: ProgressionData) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function upgradeCost(level: number) {
  return [0, 100, 200, 300, 500][level] ?? 500;
}

export function applyUpgrade(data: ProgressionData, key: "hpLevel" | "attackLevel" | "reloadLevel") {
  if (data[key] >= 5) return { data, ok: false, message: "もう最大だよ！" };
  const cost = upgradeCost(data[key]);
  if (data.coins < cost) return { data, ok: false, message: "コインがたりないよ！" };
  const next = { ...data, coins: data.coins - cost, [key]: data[key] + 1 } as ProgressionData;
  saveProgression(next);
  return { data: next, ok: true, message: "レベルアップ！" };
}

export function dungeonReward(data: ProgressionData) {
  const reward = data.clears === 0 ? 100 : 50;
  const next = { ...data, coins: data.coins + reward, clears: data.clears + 1 };
  saveProgression(next);
  return { data: next, reward };
}
