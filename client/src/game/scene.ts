// Stormfall: Last Horizon Visual Layer — Babylon owns the low-poly daylight, readable fog, and quality-aware scene while React frames tactical UI.
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Effect } from "@babylonjs/core/Materials/effect";
import { GameWorld, type MatchOutcome, type WorldOptions } from "./GameWorld";
import type { ProgressionData } from "./Progression";
import type { DungeonId } from "./DungeonConfig";

export type GameHandle = {
  scene: Scene;
  start: () => void;
  pause: () => void;
  resume: () => void;
  returnToBriefing: () => void;
  setAvatar: (avatarId: string) => void;
  dispose: () => void;
};

export type GameSceneOptions = Pick<WorldOptions, "demo" | "step" | "onResult" | "progression" | "dungeonId" | "debug" | "onTutorial" | "graphicsQuality"> & { avatarId: string };
export type { MatchOutcome };

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement, options: GameSceneOptions): Promise<GameHandle> {
  (Effect as typeof Effect & { LogShaderCode?: boolean }).LogShaderCode = options.debug;
  const scene = new Scene(engine);
  const world = new GameWorld(scene, canvas, options);
  scene.onBeforeRenderObservable.add(() => {
    world.update(Math.min(0.05, scene.getEngine().getDeltaTime() / 1000));
  });
  return {
    scene,
    start: () => world.start(),
    pause: () => world.pause(),
    resume: () => world.resume(),
    returnToBriefing: () => world.returnToBriefing(),
    setAvatar: (avatarId) => world.setPlayerAvatar(avatarId),
    dispose: () => {
      world.dispose();
      scene.dispose();
    },
  };
}
