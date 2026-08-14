// Stormfall: Last Horizon design contract — Babylon owns the living storm-rift world while React frames it with restrained tactical UI.
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Effect } from "@babylonjs/core/Materials/effect";
import { GameWorld, type MatchOutcome, type WorldOptions } from "./GameWorld";
import type { ProgressionData } from "./Progression";
import type { DungeonId } from "./DungeonConfig";

export type GameHandle = {
  scene: Scene;
  start: () => void;
  setAvatar: (avatarId: string) => void;
  dispose: () => void;
};

export type GameSceneOptions = Pick<WorldOptions, "demo" | "step" | "onResult" | "progression" | "dungeonId" | "debug" | "onTutorial"> & { avatarId: string };
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
    setAvatar: (avatarId) => world.setPlayerAvatar(avatarId),
    dispose: () => {
      world.dispose();
      scene.dispose();
    },
  };
}
