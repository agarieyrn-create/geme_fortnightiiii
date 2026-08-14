// Stormfall: Last Horizon — real GLB humanoid runtime. No sprites, planes, or billboard meshes are used.
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";
import type { MotionState } from "./contracts";

const HUMANOID_URL = "/manus-storage/stormfall-robot_94040332.glb";
// RobotExpressive's face/chest points along Babylon's +Z in this asset. Keep the
// visual forward axis aligned with PlayerController's atan2(direction.x, direction.z)
// convention; do not compensate by reversing movement vectors.
const HUMANOID_LOCAL_YAW = 0;

type ClipName = "Idle" | "Walk" | "Run" | "Jump";

export class HumanoidModelController {
  private modelRoot?: TransformNode;
  private readonly groups = new Map<ClipName, AnimationGroup>();
  private current?: AnimationGroup;
  private target?: AnimationGroup;
  private blend = 1;
  private loaded = false;
  private loadFailed = false;
  private readonly skeletonCount: number[] = [];

  constructor(private readonly scene: Scene, private readonly anchor: TransformNode, private readonly id: string) {}

  async load() {
    if (this.loaded || this.loadFailed) return;
    try {
      const legacyMeshes = this.anchor.getChildMeshes().filter((mesh) => mesh.name !== `${this.id}-capsule-collider`);
      const result = await ImportMeshAsync(HUMANOID_URL, this.scene);
      this.modelRoot = new TransformNode(`${this.id}-humanoid-root`, this.scene);
      const modelRoot = this.modelRoot;
      modelRoot.parent = this.anchor;
      modelRoot.position.y = 0;
      modelRoot.scaling.setAll(0.78);
      modelRoot.rotation.y = HUMANOID_LOCAL_YAW;
      result.meshes.forEach((mesh: AbstractMesh) => {
        if (mesh.parent === null) mesh.parent = modelRoot;
        mesh.isPickable = false;
      });
      result.skeletons.forEach((skeleton) => this.skeletonCountPush(skeleton.bones.length));
      result.animationGroups.forEach((group) => {
        const normalized = group.name.toLowerCase();
        if (normalized === "idle" || normalized === "standing") this.groups.set("Idle", group);
        if (normalized === "walk" || normalized === "walking") this.groups.set("Walk", group);
        if (normalized === "run" || normalized === "running") this.groups.set("Run", group);
        if (normalized === "jump" || normalized === "walkjump") this.groups.set("Jump", group);
        group.stop();
      });
      this.anchor.metadata = { ...(this.anchor.metadata ?? {}), renderType: "GLB_HUMANOID", source: "RobotExpressive.glb", skeletonCount: result.skeletons.length, boneCounts: this.skeletonCount, animationGroups: result.animationGroups.map((group) => group.name) };
      legacyMeshes.forEach((mesh) => mesh.setEnabled(false));
      this.loaded = true;
      this.setMotion("IDLE");
    } catch (error) {
      this.loadFailed = true;
      console.error(`[Stormfall] GLB humanoid failed for ${this.id}`, error);
    }
  }

  update(delta: number, state: MotionState) {
    if (!this.loaded || !this.modelRoot) return;
    if (this.target && this.blend < 1) {
      this.blend = Math.min(1, this.blend + delta * 7.5);
      this.target.setWeightForAllAnimatables(this.blend);
      this.current?.setWeightForAllAnimatables(1 - this.blend);
      if (this.blend >= 1 && this.current && this.current !== this.target) this.current.stop();
      if (this.blend >= 1) this.current = this.target;
    }
    const motion = state === "RUN" ? 1.32 : state === "WALK_FORWARD" || state === "WALK_BACKWARD" || state === "STRAFE_LEFT" || state === "STRAFE_RIGHT" || state === "CROUCH_WALK" ? 1.0 : 0.72;
    if (this.current) this.current.speedRatio = motion;
    const isAirborne = state === "JUMP_START" || state === "JUMP_LOOP" || state === "FALL";
    const isCrouched = state === "CROUCH_IDLE" || state === "CROUCH_WALK";
    const targetY = isCrouched ? -0.42 : isAirborne ? 0.06 : 0;
    this.modelRoot.position.y += (targetY - this.modelRoot.position.y) * Math.min(1, delta * 12);
    this.modelRoot.scaling.y += ((isCrouched ? 0.82 : 1) - this.modelRoot.scaling.y) * Math.min(1, delta * 10);
  }

  setMotion(state: MotionState) {
    if (!this.loaded) return;
    const desired: ClipName = ["JUMP_START", "JUMP_LOOP", "FALL", "LAND"].includes(state) ? "Jump" : state === "RUN" ? "Run" : ["WALK_FORWARD", "WALK_BACKWARD", "STRAFE_LEFT", "STRAFE_RIGHT", "CROUCH_WALK"].includes(state) ? "Walk" : "Idle";
    const next = this.groups.get(desired);
    if (!next || next === this.current || next === this.target) return;
    next.play(desired === "Jump" ? false : true);
    next.setWeightForAllAnimatables(0);
    this.target = next;
    this.blend = 0;
  }

  dispose() {
    this.groups.forEach((group) => group.dispose());
    this.modelRoot?.dispose(false, true);
  }

  private skeletonCountPush(count: number) {
    this.skeletonCount.push(count);
  }
}
