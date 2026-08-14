export type TutorialKey = "move" | "look" | "aimFire" | "pickup" | "jump" | "caveSwitch";
export type GraphicsQuality = "light" | "standard" | "pretty";

export type ProgressionData = {
  coins: number;
  clears: number;
  ruinsCleared: boolean;
  forestUnlocked: boolean;
  forestClears: number;
  caveUnlocked: boolean;
  caveClears: number;
  iceMountainDiscovered: boolean;
  nextDungeonDiscovered: boolean;
  hpLevel: number;
  attackLevel: number;
  reloadLevel: number;
  sfxVolume: number;
  bgmVolume: number;
  graphicsQuality: GraphicsQuality;
  tutorialSeen: Record<TutorialKey, boolean>;
};

export const DEFAULT_PROGRESSION: ProgressionData = {
  coins: 0,
  clears: 0,
  ruinsCleared: false,
  forestUnlocked: false,
  forestClears: 0,
  caveUnlocked: false,
  caveClears: 0,
  iceMountainDiscovered: false,
  nextDungeonDiscovered: false,
  hpLevel: 1,
  attackLevel: 1,
  reloadLevel: 1,
  sfxVolume: 0.7,
  bgmVolume: 0.5,
  graphicsQuality: "standard",
  tutorialSeen: { move: false, look: false, aimFire: false, pickup: false, jump: false, caveSwitch: false },
};

const STORAGE_KEY = "stormfall-progression-v1";

export function loadProgression(): ProgressionData {
  if (typeof window === "undefined") return DEFAULT_PROGRESSION;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ProgressionData> | null;
    const data = { ...DEFAULT_PROGRESSION, ...(parsed ?? {}) };
    const graphicsQuality: GraphicsQuality = data.graphicsQuality === "light" || data.graphicsQuality === "pretty" || data.graphicsQuality === "standard" ? data.graphicsQuality : "standard";
    return { ...data, graphicsQuality, ruinsCleared: Boolean(data.ruinsCleared || data.clears > 0), forestUnlocked: Boolean(data.forestUnlocked || data.clears > 0), caveUnlocked: Boolean(data.caveUnlocked || data.forestClears > 0) };
  } catch {
    return DEFAULT_PROGRESSION;
  }
}

export function saveProgression(data: ProgressionData) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function markTutorialSeen(data: ProgressionData, key: TutorialKey) {
  if (data.tutorialSeen[key]) return data;
  const next = { ...data, tutorialSeen: { ...data.tutorialSeen, [key]: true } };
  saveProgression(next);
  return next;
}

export function resetProgression() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_PROGRESSION, tutorialSeen: { ...DEFAULT_PROGRESSION.tutorialSeen } };
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

export function dungeonReward(data: ProgressionData, dungeonId: "ruins" | "forest" | "cave" = "ruins", bonusReward = 0) {
  const baseReward = dungeonId === "cave" ? data.caveClears === 0 ? 200 : 150 : dungeonId === "forest" ? 100 : data.clears === 0 ? 100 : 50;
  const reward = baseReward + bonusReward;
  const next = dungeonId === "cave"
    ? { ...data, coins: data.coins + reward, caveClears: data.caveClears + 1, iceMountainDiscovered: true }
    : dungeonId === "forest"
    ? { ...data, coins: data.coins + reward, forestClears: data.forestClears + 1, nextDungeonDiscovered: true }
    : { ...data, coins: data.coins + reward, clears: data.clears + 1, ruinsCleared: true, forestUnlocked: true };
  if (dungeonId === "forest") next.caveUnlocked = true;
  saveProgression(next);
  return { data: next, reward, baseReward, bonusReward };
}
