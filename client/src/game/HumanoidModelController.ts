// Stormfall: Last Horizon — real GLB humanoid runtime. No sprites, planes, or billboard meshes are used.
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
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
  private weaponSocket?: TransformNode;
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
      modelRoot.scaling.setAll(0.28);
      modelRoot.rotation.y = HUMANOID_LOCAL_YAW;
      this.weaponSocket = new TransformNode(`${this.id}-weapon-socket`, this.scene);
      this.weaponSocket.parent = modelRoot;
      this.weaponSocket.position.set(0.48, 1.16, 0.34);
      this.weaponSocket.rotation.set(0.08, 0.18, -0.18);
      const handBone = result.skeletons[0]?.bones.find((bone) => /hand|wrist/i.test(bone.name));
      const handNode = handBone?.getTransformNode();
      if (handNode) {
        this.weaponSocket.parent = handNode;
        this.weaponSocket.position.set(0.08, 0.02, 0.12);
        this.weaponSocket.rotation.set(0, 0, 0);
      }
      const humanoidFallbackMaterial = new StandardMaterial(`${this.id}-humanoid-fallback-material`, this.scene);
      humanoidFallbackMaterial.diffuseColor = new Color3(0.22, 0.34, 0.42);
      humanoidFallbackMaterial.specularColor = new Color3(0.18, 0.2, 0.22);
      humanoidFallbackMaterial.emissiveColor = new Color3(0.012, 0.035, 0.045);
      result.meshes.forEach((mesh: AbstractMesh) => {
        if (mesh.parent === null) mesh.parent = modelRoot;
        mesh.isPickable = false;
        mesh.material = humanoidFallbackMaterial;
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

  getWeaponSocket() {
    return this.weaponSocket ?? this.anchor;
  }

  attachWeapon(weapon: TransformNode) {
    const socket = this.getWeaponSocket();
    if (weapon.parent !== socket) weapon.parent = socket;
    weapon.position.set(0.08, -0.03, -0.16);
    weapon.rotation.set(0, 0, Math.PI / 2.8);
  }

  setArmedPose(aiming: boolean, firing: boolean, crouched: boolean) {
    if (!this.weaponSocket) return;
    const targetX = crouched ? 0.18 : aiming ? -0.2 : 0.08;
    const targetZ = firing ? -0.28 : aiming ? -0.12 : -0.18;
    this.weaponSocket.rotation.x += (targetX - this.weaponSocket.rotation.x) * 0.24;
    this.weaponSocket.rotation.z += (targetZ - this.weaponSocket.rotation.z) * 0.24;
  }

  dispose() {
    this.groups.forEach((group) => group.dispose());
    this.modelRoot?.dispose(false, true);
  }

  private skeletonCountPush(count: number) {
    this.skeletonCount.push(count);
  }
}
