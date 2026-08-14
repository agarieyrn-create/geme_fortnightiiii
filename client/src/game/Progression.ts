export type ProgressionData = {
  coins: number;
  clears: number;
  ruinsCleared: boolean;
  forestUnlocked: boolean;
  forestClears: number;
  nextDungeonDiscovered: boolean;
  hpLevel: number;
  attackLevel: number;
  reloadLevel: number;
  sfxVolume: number;
  bgmVolume: number;
};

export const DEFAULT_PROGRESSION: ProgressionData = {
  coins: 0,
  clears: 0,
  ruinsCleared: false,
  forestUnlocked: false,
  forestClears: 0,
  nextDungeonDiscovered: false,
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
    const data = { ...DEFAULT_PROGRESSION, ...(parsed ?? {}) };
    return { ...data, ruinsCleared: Boolean(data.ruinsCleared || data.clears > 0), forestUnlocked: Boolean(data.forestUnlocked || data.clears > 0) };
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

export function getStrength(data: ProgressionData) {
  return 100 + (data.hpLevel - 1) * 15 + (data.attackLevel - 1) * 15 + (data.reloadLevel - 1) * 15;
}

export function getPlayerStats(data: ProgressionData) {
  return {
    maxHp: 300 + (data.hpLevel - 1) * 20,
    damage: 25 * (1 + (data.attackLevel - 1) * 0.1),
    reloadTime: 0.82 * Math.max(0.6, 1 - (data.reloadLevel - 1) * 0.1),
  };
}

export function dungeonReward(data: ProgressionData, dungeonId: "ruins" | "forest" = "ruins", bonusReward = 0) {
  const baseReward = dungeonId === "forest" ? 100 : data.clears === 0 ? 100 : 50;
  const reward = baseReward + bonusReward;
  const next = dungeonId === "forest"
    ? { ...data, coins: data.coins + reward, forestClears: data.forestClears + 1, nextDungeonDiscovered: true }
    : { ...data, coins: data.coins + reward, clears: data.clears + 1, ruinsCleared: true, forestUnlocked: true };
  saveProgression(next);
  return { data: next, reward, baseReward, bonusReward };
}
