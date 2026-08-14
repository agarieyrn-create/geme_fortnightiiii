// Stormfall Character Visual Layer — one locked GLB skeleton receives explorer gear, palette changes, and pose offsets without runtime model swaps.
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
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
  private loadGeneration = 0;
  private readonly skeletonCount: number[] = [];
  private explorerGear?: TransformNode;
  private suitMaterial?: StandardMaterial;
  private armorMaterial?: StandardMaterial;
  private accentMaterial?: StandardMaterial;
  private cloakMaterial?: StandardMaterial;
  private palette = {
    suit: new Color3(0.22, 0.34, 0.42),
    armor: new Color3(0.34, 0.42, 0.46),
    accent: new Color3(0.075, 0.85, 0.77),
    cloak: new Color3(0.17, 0.25, 0.3),
  };

  constructor(private readonly scene: Scene, private readonly anchor: TransformNode, private readonly id: string) {}

  async load() {
    if (this.loaded || this.loadFailed) return;
    const generation = ++this.loadGeneration;
    try {
      const legacyMeshes = this.anchor.getChildMeshes().filter((mesh) => mesh.name !== `${this.id}-capsule-collider`);
      const result = await ImportMeshAsync(HUMANOID_URL, this.scene);
      if (generation !== this.loadGeneration) {
        result.animationGroups.forEach((group) => group.dispose());
        result.meshes.forEach((mesh) => mesh.dispose(false, true));
        result.skeletons.forEach((skeleton) => skeleton.dispose());
        return;
      }
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
      this.suitMaterial = new StandardMaterial(`${this.id}-humanoid-suit-material`, this.scene);
      this.armorMaterial = new StandardMaterial(`${this.id}-humanoid-armor-material`, this.scene);
      this.accentMaterial = new StandardMaterial(`${this.id}-humanoid-accent-material`, this.scene);
      this.cloakMaterial = new StandardMaterial(`${this.id}-humanoid-cloak-material`, this.scene);
      this.applyPalette();
      result.meshes.forEach((mesh: AbstractMesh) => {
        if (mesh.parent === null) mesh.parent = modelRoot;
        mesh.isPickable = false;
        const meshName = mesh.name.toLowerCase();
        mesh.material = /eye|visor|emissive|light/.test(meshName) ? this.accentMaterial! : /arm|leg|joint|wheel/.test(meshName) ? this.armorMaterial! : this.suitMaterial!;
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
      legacyMeshes.forEach((mesh) => {
        mesh.isVisible = false;
        mesh.setEnabled(false);
      });
      this.createExplorerGear();
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
    if (this.explorerGear) {
      const gearY = isCrouched ? -0.16 : 0;
      this.explorerGear.position.y += (gearY - this.explorerGear.position.y) * Math.min(1, delta * 12);
      const gearLean = state === "RUN" ? 0.08 : state === "AIM" || state === "FIRE" ? -0.06 : 0;
      this.explorerGear.rotation.x += (gearLean - this.explorerGear.rotation.x) * Math.min(1, delta * 10);
    }
  }

  setPalette(suit: Color3, armor: Color3, accent: Color3, cloak: Color3) {
    this.palette = { suit: suit.clone(), armor: armor.clone(), accent: accent.clone(), cloak: cloak.clone() };
    this.applyPalette();
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
    this.loadGeneration += 1;
    this.groups.forEach((group) => group.dispose());
    this.explorerGear?.dispose(false, true);
    this.modelRoot?.dispose(false, true);
  }

  private applyPalette() {
    if (this.suitMaterial) {
      this.suitMaterial.diffuseColor.copyFrom(this.palette.suit);
      this.suitMaterial.specularColor = new Color3(0.1, 0.12, 0.14);
      this.suitMaterial.specularPower = 52;
    }
    if (this.armorMaterial) {
      this.armorMaterial.diffuseColor.copyFrom(this.palette.armor);
      this.armorMaterial.specularColor = new Color3(0.2, 0.22, 0.24);
      this.armorMaterial.specularPower = 72;
    }
    if (this.accentMaterial) {
      this.accentMaterial.diffuseColor.copyFrom(this.palette.accent);
      this.accentMaterial.emissiveColor.copyFrom(this.palette.accent.scale(0.32));
      this.accentMaterial.specularColor = new Color3(0.12, 0.18, 0.18);
    }
    if (this.cloakMaterial) {
      this.cloakMaterial.diffuseColor.copyFrom(this.palette.cloak);
      this.cloakMaterial.specularColor = Color3.Black();
    }
  }

  private createExplorerGear() {
    if (this.explorerGear || !this.suitMaterial || !this.armorMaterial || !this.accentMaterial || !this.cloakMaterial) return;
    const gear = new TransformNode(`${this.id}-explorer-gear`, this.scene);
    gear.parent = this.anchor;
    const coat = MeshBuilder.CreateCapsule(`${this.id}-explorer-coat`, { height: 1.06, radius: 0.34, tessellation: 12 }, this.scene);
    coat.parent = gear;
    coat.position.set(0, 1.27, 0.02);
    coat.scaling.set(1.1, 0.92, 0.82);
    coat.material = this.suitMaterial!;
    const hood = MeshBuilder.CreateSphere(`${this.id}-explorer-hood`, { diameter: 0.67, segments: 12 }, this.scene);
    hood.parent = gear;
    hood.position.set(0, 2.05, 0.035);
    hood.scaling.set(1.02, 0.62, 1.04);
    hood.material = this.cloakMaterial!;
    const visor = MeshBuilder.CreateBox(`${this.id}-explorer-visor`, { width: 0.38, height: 0.14, depth: 0.08 }, this.scene);
    visor.parent = gear;
    visor.position.set(0, 2.03, -0.32);
    visor.material = this.accentMaterial!;
    const backpack = MeshBuilder.CreateBox(`${this.id}-explorer-pack`, { width: 0.5, height: 0.62, depth: 0.22 }, this.scene);
    backpack.parent = gear;
    backpack.position.set(0, 1.33, 0.34);
    backpack.material = this.armorMaterial!;
    [-1, 1].forEach((side) => {
      const shoulder = MeshBuilder.CreateIcoSphere(`${this.id}-explorer-shoulder-${side}`, { radius: 0.23, subdivisions: 1 }, this.scene);
      shoulder.parent = gear;
      shoulder.position.set(side * 0.42, 1.72, -0.01);
      shoulder.scaling.set(1.1, 0.74, 0.86);
      shoulder.material = this.armorMaterial!;
    });
    const coatTail = MeshBuilder.CreateBox(`${this.id}-explorer-coat-tail`, { width: 0.62, height: 0.78, depth: 0.07 }, this.scene);
    coatTail.parent = gear;
    coatTail.position.set(0, 0.93, 0.36);
    coatTail.material = this.cloakMaterial!;
    this.explorerGear = gear;
  }

  private skeletonCountPush(count: number) {
    this.skeletonCount.push(count);
  }
}
