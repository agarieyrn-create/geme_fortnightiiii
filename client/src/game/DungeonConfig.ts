export type DungeonId = "ruins" | "forest" | "cave";

export type DungeonConfig = {
  id: DungeonId;
  name: string;
  recommendedStrength: number;
  firstReward: number;
  clearReward: number;
  unlockedByDefault: boolean;
};

export const DUNGEON_CONFIGS: Record<DungeonId, DungeonConfig> = {
  ruins: {
    id: "ruins",
    name: "はじまりの遺跡",
    recommendedStrength: 100,
    firstReward: 100,
    clearReward: 50,
    unlockedByDefault: true,
  },
  forest: {
    id: "forest",
    name: "まよいの森",
    recommendedStrength: 150,
    firstReward: 100,
    clearReward: 100,
    unlockedByDefault: false,
  },
  cave: {
    id: "cave",
    name: "くらやみの洞窟",
    recommendedStrength: 200,
    firstReward: 200,
    clearReward: 150,
    unlockedByDefault: false,
  },
};
