// Stormfall: Last Horizon design contract — readable arcade-sci-fi combat across warm sandstone, black basalt, and a teal storm ring.
// Stormfall Visual Layer: warm adventure light, cool storm accents, readable low-poly materials, and quality-gated rendering stay separate from gameplay rules.
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { InputManager, type InputSnapshot } from "./InputManager";
import { TouchInputManager } from "./TouchInputManager";
import { CameraController } from "./CameraController";
import { PlayerController } from "./PlayerController";
import { WeaponSystem } from "./WeaponSystem";
import { HudController } from "./HudController";
import { AnimationController } from "./AnimationController";
import { HumanoidModelController } from "./HumanoidModelController";
import { EnemyDirector } from "./EnemyDirector";
import { WorldBuilder } from "./WorldBuilder";
import type { GraphicsQuality, ProgressionData, TutorialKey } from "./Progression";
import { DUNGEON_CONFIGS, type DungeonId } from "./DungeonConfig";

const TEAL = new Color3(0.075, 0.85, 0.77);
const AMBER = new Color3(1, 0.54, 0.15);
const SAND = new Color3(0.31, 0.12, 0.035);
const BASALT = new Color3(0.12, 0.055, 0.023);
const RUST = new Color3(0.77, 0.16, 0.1);

const PLAYER_MAX_HP = 300;
const ENEMY_MAX_HP = 100;
const PLAYER_WEAPON_RANGE = 500;
const PLAYER_WEAPON_DAMAGE = 25;
const PICKUP_RANGE = 3.2;
const MEDKIT_HEAL = 50;
const MEDKIT_USE_TIME = 3;
const ENEMY_ATTACK_RANGE = 25;
const ENEMY_ATTACK_DAMAGE = 10;
const ENEMY_ATTACK_INTERVAL = 1.15;
// Test-only toggle: set false to restore the intended no-weapon scavenger start.
const DEBUG_START_WITH_WEAPON = true;


const CHARACTER_LOADOUTS: Record<string, { suit: Color3; armor: Color3; accent: Color3; cloak: Color3; scale: number }> = {
  kairo: { suit: new Color3(0.14, 0.18, 0.23), armor: new Color3(0.39, 0.29, 0.18), accent: TEAL, cloak: new Color3(0.34, 0.25, 0.15), scale: 1 },
  haze: { suit: new Color3(0.11, 0.16, 0.22), armor: new Color3(0.17, 0.35, 0.4), accent: new Color3(0.06, 0.84, 0.77), cloak: new Color3(0.12, 0.27, 0.34), scale: 0.9 },
  vanta: { suit: new Color3(0.06, 0.08, 0.11), armor: new Color3(0.62, 0.58, 0.5), accent: new Color3(0.1, 0.76, 0.86), cloak: new Color3(0.58, 0.55, 0.48), scale: 1.08 },
  rustjaw: { suit: new Color3(0.11, 0.055, 0.045), armor: new Color3(0.46, 0.075, 0.035), accent: new Color3(0.96, 0.08, 0.04), cloak: new Color3(0.27, 0.04, 0.025), scale: 1.2 },
  veil: { suit: new Color3(0.11, 0.08, 0.14), armor: new Color3(0.3, 0.045, 0.11), accent: new Color3(0.95, 0.1, 0.08), cloak: new Color3(0.25, 0.02, 0.08), scale: 0.86 },
  anker: { suit: new Color3(0.1, 0.09, 0.08), armor: new Color3(0.56, 0.18, 0.04), accent: new Color3(0.97, 0.14, 0.04), cloak: new Color3(0.39, 0.105, 0.02), scale: 1.24 },
};

export type MatchOutcome = "victory" | "defeat";
export type DungeonSummary = { dungeonId: DungeonId; baseReward: number; bonusReward: number };
export type WorldOptions = { demo: boolean; step: "step1" | "step2" | "step3" | "step4" | "step5" | "full"; dungeonId: DungeonId; avatarId: string; progression: ProgressionData; graphicsQuality: GraphicsQuality; debug: boolean; onTutorial: (key: TutorialKey, text: string, target: "move" | "look" | "aim" | "fire" | "pickup" | "jump") => void; onResult: (outcome: MatchOutcome, summary?: DungeonSummary) => void };

type Projectile = {
  mesh: Mesh;
  velocity: Vector3;
  owner: "player" | "rival";
  life: number;
  damage: number;
};

type Pickup = {
  root: TransformNode;
  type: "weapon" | "ammo" | "shield" | "med" | "key" | "rune" | "chest" | "secret";
  weaponId?: import("./contracts").WeaponId;
  ammoType?: "medium" | "light" | "shells";
  label: string;
  amount?: number;
  collected: boolean;
};

type CaveFloorTrap = { mesh: Mesh; position: Vector3; warning: number; cooldown: number; active: boolean };
type CaveMover = { mesh: Mesh; origin: Vector3; phase: number; cooldown: number };
type CaveSwitch = { root: TransformNode; position: Vector3; active: boolean };

type TrainingTarget = {
  root: TransformNode;
  hp: number;
  alive: boolean;
};

type Obstacle = { position: Vector3; radius: number };

class Combatant {
  readonly root: TransformNode;
  readonly body: Mesh;
  readonly halo: Mesh;
  private readonly bodyMaterial: StandardMaterial;
  private readonly armorMaterial: StandardMaterial;
  private readonly accentMaterial: StandardMaterial;
  private readonly cloakMaterial: StandardMaterial;
  private readonly limbs: Mesh[] = [];
  private readonly collider: Mesh;
  private hpLabel?: Mesh;
  private hpTexture?: DynamicTexture;
  private hpLabelMaterial?: StandardMaterial;
  private colliderHeight = 2.4;
  private readonly animationController = new AnimationController();
  private readonly humanoid?: HumanoidModelController;
  private weaponMount?: TransformNode;
  private readonly weaponVariants = new Map<import("./contracts").WeaponId, TransformNode>();
  private activeWeaponStyle: import("./contracts").WeaponId = "assault";
  private aiming = false;
  private motionState = "IDLE";
  private poseTime = 0;
  private baseScale = 1;
  hp = 100;
  maxHp = ENEMY_MAX_HP;
  shield = 50;
  alive = true;
  flash = 0;
  velocityY = 0;

  constructor(
    readonly scene: Scene,
    readonly id: string,
    readonly color: Color3,
    position: Vector3,
    readonly enemy = false,
  ) {
    this.root = new TransformNode(`${id}-root`, scene);
    if (enemy) {
      this.hp = ENEMY_MAX_HP;
      this.shield = 0;
    }
    this.root.position.copyFrom(position);
    this.humanoid = enemy ? undefined : new HumanoidModelController(scene, this.root, id);
    this.body = MeshBuilder.CreateCapsule(`${id}-body`, { height: 1.18, radius: 0.32, tessellation: 12 }, scene);
    this.body.parent = this.root;
    this.body.position.y = 1.28;
    this.bodyMaterial = new StandardMaterial(`${id}-mat`, scene);
    this.bodyMaterial.diffuseColor = color;
    this.bodyMaterial.specularColor = new Color3(0.08, 0.08, 0.08);
    this.body.material = this.bodyMaterial;
    this.collider = MeshBuilder.CreateCapsule(`${id}-capsule-collider`, { height: 2.4, radius: 0.38, tessellation: 8 }, scene);
    this.collider.parent = this.root;
    this.collider.position.y = 1.2;
    this.collider.isVisible = false;
    this.collider.metadata = enemy ? { enemyId: id } : { collider: "player" };
    this.collider.checkCollisions = true;
    this.root.metadata = { collider: "capsule", height: this.colliderHeight, radius: 0.38 };
    this.armorMaterial = new StandardMaterial(`${id}-armor-mat`, scene);
    this.armorMaterial.diffuseColor = enemy ? RUST : TEAL.scale(0.5);
    this.armorMaterial.specularColor = new Color3(0.16, 0.16, 0.16);
    this.accentMaterial = new StandardMaterial(`${id}-accent-mat`, scene);
    this.accentMaterial.diffuseColor = enemy ? new Color3(0.95, 0.08, 0.04) : TEAL;
    this.accentMaterial.emissiveColor = this.accentMaterial.diffuseColor.scale(0.45);
    this.accentMaterial.disableLighting = true;
    this.cloakMaterial = new StandardMaterial(`${id}-cloak-mat`, scene);
    this.cloakMaterial.diffuseColor = color.scale(0.72);
    this.cloakMaterial.specularColor = Color3.Black();

    const chest = MeshBuilder.CreateCapsule(`${id}-chest`, { height: 0.92, radius: 0.36, tessellation: 16 }, scene);
    chest.parent = this.root;
    chest.position.y = 1.34;
    chest.position.z = -0.2;
    chest.scaling.set(1.08, 0.82, 0.78);
    chest.material = this.armorMaterial;

    const head = MeshBuilder.CreateSphere(`${id}-head`, { diameter: 0.53, segments: 14 }, scene);
    head.parent = this.root;
    head.position.set(0, 2.03, 0);
    const skinMat = new StandardMaterial(`${id}-skin-mat`, scene);
    skinMat.diffuseColor = enemy ? new Color3(0.31, 0.16, 0.09) : new Color3(0.46, 0.27, 0.16);
    head.material = skinMat;
    const hair = MeshBuilder.CreateSphere(`${id}-hair`, { diameter: 0.56, segments: 12 }, scene);
    hair.parent = this.root;
    hair.position.set(0, 2.16, 0.015);
    hair.scaling.set(1.04, 0.44, 1.02);
    const hairMat = new StandardMaterial(`${id}-hair-mat`, scene);
    hairMat.diffuseColor = enemy ? new Color3(0.06, 0.02, 0.02) : new Color3(0.025, 0.03, 0.045);
    hair.material = hairMat;
    const neck = MeshBuilder.CreateCylinder(`${id}-neck`, { height: 0.22, diameter: 0.2, tessellation: 10 }, scene);
    neck.parent = this.root;
    neck.position.set(0, 1.78, 0);
    neck.material = skinMat;

    this.addLimb("arm-l", -0.48, 1.43, -0.02, -0.18, this.bodyMaterial);
    this.addLimb("arm-r", 0.48, 1.43, -0.02, 0.18, this.bodyMaterial);
    this.addLimb("leg-l", -0.21, 0.48, 0.03, 0, this.bodyMaterial, 0.96);
    this.addLimb("leg-r", 0.21, 0.48, 0.03, 0, this.bodyMaterial, 0.96);
    this.addFoot("boot-l", -0.21, 0.09, -0.08);
    this.addFoot("boot-r", 0.21, 0.09, -0.08);
    this.addArmorPart("knee-l", -0.21, 0.53, -0.14, 0.23, 0.27, 0.13, this.armorMaterial);
    this.addArmorPart("knee-r", 0.21, 0.53, -0.14, 0.23, 0.27, 0.13, this.armorMaterial);
    this.addArmorPart("shoulder-l", -0.5, 1.71, -0.02, 0.4, 0.22, 0.5, this.armorMaterial);
    this.addArmorPart("shoulder-r", 0.5, 1.71, -0.02, 0.4, 0.22, 0.5, this.armorMaterial);
    this.addArmorPart("backpack", 0, 1.27, 0.38, 0.56, 0.62, 0.27, this.armorMaterial);
    this.addArmorPart("gauntlet-l", -0.58, 1.2, -0.05, 0.25, 0.54, 0.26, this.accentMaterial);
    this.addArmorPart("gauntlet-r", 0.58, 1.2, -0.05, 0.25, 0.54, 0.26, this.armorMaterial);
    const cape = MeshBuilder.CreateBox(`${id}-cape`, { width: 0.9, height: 1.03, depth: 0.075 }, scene);
    cape.parent = this.root;
    cape.position.set(0, 1.23, 0.37);
    cape.material = this.cloakMaterial;
    this.createWeapon();
    if (enemy) this.createEnemyHpLabel();

    const visor = MeshBuilder.CreateSphere(`${id}-visor`, { diameter: 0.34, segments: 10 }, scene);
    visor.parent = this.root;
    visor.position.y = 1.76;
    visor.position.z = -0.39;
    visor.material = this.accentMaterial;

    this.halo = MeshBuilder.CreateTorus(`${id}-halo`, { diameter: 1.06, thickness: 0.035, tessellation: 28 }, scene);
    this.halo.parent = this.root;
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = 0.08;
    this.halo.material = this.accentMaterial;
    void this.humanoid?.load();
  }

  private createEnemyHpLabel() {
    this.hpTexture = new DynamicTexture(`${this.id}-hp-texture`, { width: 256, height: 64 }, this.scene, false);
    this.hpTexture.hasAlpha = true;
    this.hpLabelMaterial = new StandardMaterial(`${this.id}-hp-label-material`, this.scene);
    this.hpLabelMaterial.diffuseTexture = this.hpTexture;
    this.hpLabelMaterial.emissiveTexture = this.hpTexture;
    this.hpLabelMaterial.opacityTexture = this.hpTexture;
    this.hpLabelMaterial.disableLighting = true;
    this.hpLabelMaterial.backFaceCulling = false;
    this.hpLabel = MeshBuilder.CreatePlane(`${this.id}-hp-label`, { width: 2.35, height: 0.58 }, this.scene);
    this.hpLabel.parent = this.root;
    this.hpLabel.position.y = 3.05;
    this.hpLabel.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.hpLabel.isPickable = false;
    this.hpLabel.material = this.hpLabelMaterial;
    this.updateEnemyHpLabel();
  }

  private updateEnemyHpLabel() {
    if (!this.hpTexture) return;
    const context = this.hpTexture.getContext() as unknown as CanvasRenderingContext2D;
    context.clearRect(0, 0, 256, 64);
    context.fillStyle = "rgba(4, 12, 20, 0.82)";
    context.fillRect(2, 2, 252, 60);
    context.fillStyle = this.hp <= 0 ? "#ff5665" : "#f2f8f7";
    context.font = "bold 20px Arial";
    context.textAlign = "center";
    context.fillText(this.id.toUpperCase(), 128, 23);
    context.font = "bold 22px Arial";
    context.fillText(`${Math.ceil(this.hp)} / ${this.maxHp}`, 128, 49);
    this.hpTexture.update(false);
  }

  containsPoint(point: Vector3) {
    return this.alive && this.collider.intersectsPoint(point);
  }

  setWeaponVisible(visible: boolean) {
    this.weaponMount?.setEnabled(visible);
  }

  setWeaponStyle(style: import("./contracts").WeaponId) {
    this.activeWeaponStyle = style;
    this.weaponVariants.forEach((variant, id) => variant.setEnabled(id === style));
  }

  applyLoadout(loadoutId: string) {
    const loadout = CHARACTER_LOADOUTS[loadoutId];
    if (!loadout) return;
    this.bodyMaterial.diffuseColor.copyFrom(loadout.suit);
    this.armorMaterial.diffuseColor.copyFrom(loadout.armor);
    this.accentMaterial.diffuseColor.copyFrom(loadout.accent);
    this.accentMaterial.emissiveColor.copyFrom(loadout.accent.scale(0.46));
    this.cloakMaterial.diffuseColor.copyFrom(loadout.cloak);
    this.baseScale = loadout.scale;
    this.root.scaling.setAll(loadout.scale);
    this.humanoid?.setPalette(loadout.suit, loadout.armor, loadout.accent, loadout.cloak);
  }

  applyDamage(amount: number) {
    if (!this.alive) return false;
    let remaining = amount;
    if (this.shield > 0) {
      const shieldLoss = Math.min(this.shield, remaining);
      this.shield -= shieldLoss;
      remaining -= shieldLoss;
    }
    this.hp = Math.max(0, this.hp - remaining);
    this.updateEnemyHpLabel();
    this.flash = 0.24;
    if (this.hp <= 0) {
      this.alive = false;
      this.collider.setEnabled(false);
      if (this.enemy) {
        this.root.rotation.z = Math.PI / 2;
        this.root.position.y = 0.35;
      } else {
        this.root.setEnabled(false);
      }
    }
    return !this.alive;
  }

  updateVisual(delta: number) {
    this.flash = Math.max(0, this.flash - delta);
    this.poseTime += delta;
    this.halo.scaling.setAll(1 + Math.sin(performance.now() * 0.005) * 0.035);
    this.bodyMaterial.emissiveColor = this.flash > 0 ? new Color3(0.9, 0.9, 0.9) : Color3.Black();
    this.animationController.update(delta, this.motionState as import("./contracts").MotionState, this.limbs, this.root, this.baseScale);
    this.humanoid?.update(delta, this.motionState as import("./contracts").MotionState);
    this.humanoid?.setArmedPose(this.aiming || this.motionState === "FIRE", this.motionState === "FIRE", this.motionState === "CROUCH_IDLE" || this.motionState === "CROUCH_WALK");
    if (this.weaponMount) this.humanoid?.attachWeapon(this.weaponMount);
  }

  dispose() {
    this.humanoid?.dispose();
    this.root.dispose(false, true);
  }

  private addLimb(name: string, x: number, y: number, z: number, tilt: number, material: StandardMaterial, height = 0.92) {
    const limb = MeshBuilder.CreateCapsule(`${this.id}-${name}`, { height, radius: 0.145, tessellation: 10 }, this.scene);
    limb.parent = this.root;
    limb.position.set(x, y, z);
    limb.rotation.z = tilt;
    limb.material = material;
    this.limbs.push(limb);
  }

  setMotionState(state: string) {
    this.motionState = state;
    this.humanoid?.setMotion(state as import("./contracts").MotionState);
  }

  setAiming(aiming: boolean) {
    this.aiming = aiming;
  }

  setColliderHeight(height: number) {
    this.colliderHeight = height;
    this.collider.scaling.y = height / 2.4;
    this.collider.position.y = height / 2;
    this.root.metadata = { collider: "capsule", height, radius: 0.38 };
  }

  private addFoot(name: string, x: number, y: number, z: number) {
    const foot = MeshBuilder.CreateCapsule(`${this.id}-${name}`, { height: 0.34, radius: 0.18, tessellation: 12 }, this.scene);
    foot.parent = this.root;
    foot.position.set(x, y, z);
    foot.rotation.x = Math.PI / 2;
    foot.material = this.armorMaterial;
  }

  private addArmorPart(name: string, x: number, y: number, z: number, width: number, height: number, depth: number, material: StandardMaterial) {
    const part = MeshBuilder.CreateBox(`${this.id}-${name}`, { width, height, depth }, this.scene);
    part.parent = this.root;
    part.position.set(x, y, z);
    part.material = material;
  }

  private createWeapon() {
    const weapon = new TransformNode(`${this.id}-weapon`, this.scene);
    this.weaponMount = weapon;
    weapon.parent = this.root;
    weapon.position.set(0.72, 1.14, -0.35);
    weapon.rotation.z = Math.PI / 2.8;
    this.createWeaponVariant(weapon, "assault", 0.68, 0.5, 0.2, true);
    this.createWeaponVariant(weapon, "smg", 0.48, 0.32, 0.15, true);
    this.createWeaponVariant(weapon, "shotgun", 0.76, 0.78, 0.24, false);
    this.setWeaponStyle(this.activeWeaponStyle);
  }

  private createWeaponVariant(parent: TransformNode, id: import("./contracts").WeaponId, bodyLength: number, barrelLength: number, magazineLength: number, hasStock: boolean) {
    const variant = new TransformNode(`${this.id}-${id}-weapon`, this.scene);
    variant.parent = parent;
    const body = MeshBuilder.CreateBox(`${this.id}-${id}-receiver`, { width: bodyLength, height: id === "shotgun" ? 0.22 : 0.18, depth: id === "shotgun" ? 0.2 : 0.16 }, this.scene);
    body.parent = variant;
    body.material = this.armorMaterial;
    const barrel = MeshBuilder.CreateCylinder(`${this.id}-${id}-barrel`, { height: barrelLength, diameter: id === "shotgun" ? 0.105 : 0.075, tessellation: 8 }, this.scene);
    barrel.parent = variant;
    barrel.rotation.z = Math.PI / 2;
    barrel.position.x = bodyLength * 0.5 + barrelLength * 0.5 - 0.05;
    barrel.material = this.accentMaterial;
    const grip = MeshBuilder.CreateBox(`${this.id}-${id}-grip`, { width: 0.12, height: 0.27, depth: 0.13 }, this.scene);
    grip.parent = variant;
    grip.position.set(-0.1, -0.19, 0);
    grip.rotation.z = -0.22;
    grip.material = this.bodyMaterial;
    if (id !== "shotgun") {
      const magazine = MeshBuilder.CreateBox(`${this.id}-${id}-magazine`, { width: 0.12, height: magazineLength, depth: 0.12 }, this.scene);
      magazine.parent = variant;
      magazine.position.set(0.12, -magazineLength * 0.42, 0);
      magazine.rotation.z = -0.16;
      magazine.material = this.bodyMaterial;
    } else {
      const pump = MeshBuilder.CreateBox(`${this.id}-${id}-pump`, { width: 0.22, height: 0.13, depth: 0.2 }, this.scene);
      pump.parent = variant;
      pump.position.x = bodyLength * 0.5 + 0.18;
      pump.material = this.bodyMaterial;
    }
    if (hasStock) {
      const stock = MeshBuilder.CreateBox(`${this.id}-${id}-stock`, { width: 0.28, height: 0.16, depth: 0.14 }, this.scene);
      stock.parent = variant;
      stock.position.x = -bodyLength * 0.5 - 0.11;
      stock.material = this.bodyMaterial;
    }
    const sight = MeshBuilder.CreateBox(`${this.id}-${id}-sight`, { width: 0.14, height: 0.08, depth: 0.06 }, this.scene);
    sight.parent = variant;
    sight.position.set(0.06, 0.13, 0);
    sight.material = this.accentMaterial;
    this.weaponVariants.set(id, variant);
  }
}

class Rival extends Combatant {
  aiState: import("./contracts").EnemyState = "IDLE";
  style: "normal" | "melee" | "ranged" | "shield" | "forestBoss" | "caveBoss" = "normal";
  private fireCooldown = 0.65 + Math.random() * 0.35;
  attackDamage = ENEMY_ATTACK_DAMAGE;
  private stateTimer = 1.5 + Math.random() * 1.5;
  private lostTimer = 0;
  private lastSeen = new Vector3();
  private patrolIndex = 0;
  private readonly patrolPoints: Vector3[];

  constructor(scene: Scene, id: string, position: Vector3) {
    super(scene, id, new Color3(0.28, 0.12, 0.1), position, true);
    this.patrolPoints = [
      position.clone(),
      position.add(new Vector3(5.5, 0, 2.5)),
      position.add(new Vector3(-3.5, 0, 6)),
      position.add(new Vector3(-6, 0, -3)),
    ];
    this.lastSeen.copyFrom(position);
  }

  setStyle(style: "normal" | "melee" | "ranged" | "shield" | "forestBoss" | "caveBoss") {
    this.style = style;
    if (style === "melee") {
      this.attackDamage = 12;
      this.applyLoadout("anker");
      this.root.scaling.setAll(1.08);
      this.addMeleeSilhouette();
    } else if (style === "ranged") {
      this.attackDamage = 8;
      this.applyLoadout("veil");
      this.root.scaling.setAll(0.92);
      this.addRangedSilhouette();
    } else if (style === "forestBoss") {
      this.attackDamage = 15;
      this.applyLoadout("anker");
      this.root.scaling.setAll(1.82);
      this.addBossSilhouette("forest");
    } else if (style === "shield") {
      this.attackDamage = 9;
      this.applyLoadout("anker");
      this.root.scaling.setAll(1.16);
      const shield = MeshBuilder.CreateDisc(`${this.id}-shield`, { radius: 0.9, tessellation: 24 }, this.scene);
      shield.parent = this.root;
      shield.position.set(0, 1.25, 0.72);
      const shieldMat = new StandardMaterial(`${this.id}-shield-mat`, this.scene);
      shieldMat.diffuseColor = TEAL;
      shieldMat.emissiveColor = TEAL.scale(0.6);
      shieldMat.alpha = 0.48;
      shieldMat.disableLighting = true;
      shield.material = shieldMat;
      this.addShieldSilhouette(shieldMat);
    } else if (style === "caveBoss") {
      this.attackDamage = 16;
      this.applyLoadout("anker");
      this.root.scaling.setAll(2.05);
      this.addBossSilhouette("cave");
    }
  }

  private addMeleeSilhouette() {
    const material = new StandardMaterial(`${this.id}-melee-armour`, this.scene);
    material.diffuseColor = new Color3(0.5, 0.12, 0.035);
    material.specularColor = new Color3(0.18, 0.08, 0.04);
    [-1, 1].forEach((side) => {
      const arm = MeshBuilder.CreateCapsule(`${this.id}-melee-arm-${side}`, { height: 0.92, radius: 0.23, tessellation: 10 }, this.scene);
      arm.parent = this.root;
      arm.position.set(side * 0.63, 1.25, -0.08);
      arm.rotation.z = side * 0.22;
      arm.material = material;
    });
    const crest = MeshBuilder.CreateCylinder(`${this.id}-melee-crest`, { height: 0.46, diameterTop: 0, diameterBottom: 0.28, tessellation: 5 }, this.scene);
    crest.parent = this.root;
    crest.position.y = 2.37;
    crest.material = material;
  }

  private addRangedSilhouette() {
    const material = new StandardMaterial(`${this.id}-ranged-kit`, this.scene);
    material.diffuseColor = new Color3(0.19, 0.045, 0.08);
    material.emissiveColor = new Color3(0.08, 0.005, 0.012);
    const antenna = MeshBuilder.CreateCylinder(`${this.id}-ranged-antenna`, { height: 0.72, diameter: 0.04, tessellation: 6 }, this.scene);
    antenna.parent = this.root;
    antenna.position.set(-0.18, 2.55, 0.13);
    antenna.rotation.z = -0.16;
    antenna.material = material;
    const scope = MeshBuilder.CreateCylinder(`${this.id}-ranged-scope`, { height: 0.26, diameter: 0.14, tessellation: 8 }, this.scene);
    scope.parent = this.root;
    scope.position.set(0.89, 1.32, -0.38);
    scope.rotation.z = Math.PI / 2;
    scope.material = material;
  }

  private addShieldSilhouette(material: StandardMaterial) {
    const crest = MeshBuilder.CreateBox(`${this.id}-shield-crest`, { width: 0.18, height: 1.18, depth: 0.16 }, this.scene);
    crest.parent = this.root;
    crest.position.set(0, 1.25, 0.83);
    crest.material = material;
  }

  private addBossSilhouette(kind: "forest" | "cave") {
    const outer = new StandardMaterial(`${this.id}-${kind}-boss-outer`, this.scene);
    outer.diffuseColor = kind === "forest" ? new Color3(0.1, 0.27, 0.08) : new Color3(0.13, 0.11, 0.2);
    outer.specularColor = new Color3(0.08, 0.1, 0.09);
    const core = new StandardMaterial(`${this.id}-${kind}-boss-core`, this.scene);
    core.diffuseColor = kind === "forest" ? new Color3(0.08, 0.72, 0.44) : new Color3(0.1, 0.65, 0.75);
    core.emissiveColor = core.diffuseColor.scale(0.55);
    [-1, 1].forEach((side) => {
      const shoulder = MeshBuilder.CreateIcoSphere(`${this.id}-${kind}-boss-shoulder-${side}`, { radius: 0.42, subdivisions: 1 }, this.scene);
      shoulder.parent = this.root;
      shoulder.position.set(side * 0.55, 1.75, 0);
      shoulder.scaling.set(1.15, 0.8, 0.9);
      shoulder.material = outer;
    });
    const bossCore = MeshBuilder.CreateSphere(`${this.id}-${kind}-boss-core`, { diameter: 0.42, segments: 10 }, this.scene);
    bossCore.parent = this.root;
    bossCore.position.set(0, 1.48, -0.38);
    bossCore.material = core;
  }

  override applyDamage(amount: number) {
    const eliminated = super.applyDamage(amount);
    if (eliminated) {
      this.aiState = "DEAD";
      this.setMotionState("DEAD");
    } else {
      this.aiState = "ALERT";
      this.lostTimer = 0;
    }
    return eliminated;
  }

  update(delta: number, world: GameWorld) {
    if (!this.alive) return;
    const player = world.player;
    if (!player.alive) {
      this.aiState = "PATROL";
      this.patrol(delta, world);
      this.updateVisual(delta);
      return;
    }
    this.fireCooldown -= delta;
    this.stateTimer -= delta;
    const eye = this.root.position.add(new Vector3(0, 1.35, 0));
    const playerAim = player.root.position.add(new Vector3(0, 1.05, 0));
    const toPlayer = player.root.position.subtract(this.root.position);
    const distance = toPlayer.length();
    const visible = distance <= 44 && world.hasLineOfSight(eye, playerAim);

    if (visible) {
      this.lastSeen.copyFrom(player.root.position);
      this.lostTimer = 0;
      if (this.aiState === "IDLE" || this.aiState === "PATROL") this.aiState = "ALERT";
      const attackRange = this.style === "melee" ? 4.2 : this.style === "ranged" ? 20 : 24;
      if (this.aiState === "ALERT" && this.stateTimer <= 0) this.aiState = distance <= attackRange ? "ATTACK" : "CHASE";
      if (this.aiState === "CHASE" && distance <= attackRange) this.aiState = "ATTACK";
      if (this.aiState === "ATTACK" && distance > attackRange + 3) this.aiState = "CHASE";
    } else {
      this.lostTimer += delta;
      if ((this.aiState === "CHASE" || this.aiState === "ATTACK" || this.aiState === "ALERT") && (this.lostTimer > 7 || distance > 68)) {
        this.aiState = "PATROL";
        this.stateTimer = 2;
      }
      if (this.aiState === "IDLE" && this.stateTimer <= 0) this.aiState = "PATROL";
    }

    if (this.aiState === "PATROL") this.patrol(delta, world);
    if (this.aiState === "CHASE") this.moveToward(this.lastSeen, this.style === "melee" ? 6.1 : this.style === "ranged" ? 3.6 : 4.5, delta, world);
    if (this.aiState === "ALERT") this.faceToward(this.lastSeen);
    if (this.aiState === "ATTACK") {
      this.faceToward(player.root.position);
      const attackRange = this.style === "melee" ? 4.2 : this.style === "ranged" ? 22 : ENEMY_ATTACK_RANGE;
      if (visible && distance <= attackRange && this.fireCooldown <= 0) {
        const direction = playerAim.subtract(eye).normalize();
        if (this.style === "caveBoss") {
          world.queueCaveRockThrow(player.root.position);
          this.fireCooldown = 3.6;
        } else if (this.style === "melee") {
          world.pushEvent("敵がとびこんでくる！");
          world.spawnProjectile(eye.add(direction.scale(0.45)), direction, "rival", this.attackDamage);
          this.fireCooldown = 1.45;
        } else {
          if (this.style === "ranged") world.pushEvent("遠くの敵がねらっている！");
          world.spawnProjectile(eye.add(direction.scale(0.8)), direction, "rival", this.attackDamage);
          this.fireCooldown = this.style === "ranged" ? 1.5 : ENEMY_ATTACK_INTERVAL;
        }
      }
    }
    this.setMotionState(this.aiState === "PATROL" || this.aiState === "CHASE" ? "WALK_FORWARD" : this.aiState);
    world.resolveObstacles(this.root.position, 0.72);
    world.resolveEnemySeparation(this);
    this.root.position.x = Math.max(-104, Math.min(104, this.root.position.x));
    this.root.position.z = Math.max(-104, Math.min(104, this.root.position.z));
    this.updateVisual(delta);
  }

  private patrol(delta: number, world: GameWorld) {
    const point = this.patrolPoints[this.patrolIndex];
    if (Vector3.DistanceSquared(this.root.position, point) < 1.5) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
      this.stateTimer = 1.2;
    } else if (this.stateTimer <= 0) {
      this.moveToward(point, 2.1, delta, world);
    }
    this.stateTimer -= delta;
  }

  private moveToward(target: Vector3, speed: number, delta: number, world: GameWorld) {
    const direction = target.subtract(this.root.position);
    direction.y = 0;
    if (direction.lengthSquared() < 0.01) return;
    const normalized = direction.normalize();
    this.root.position.addInPlace(normalized.scale(speed * delta));
    this.faceToward(target);
    world.resolveObstacles(this.root.position, 0.72);
  }

  private faceToward(target: Vector3) {
    const direction = target.subtract(this.root.position);
    direction.y = 0;
    if (direction.lengthSquared() > 0.01) this.root.rotation.y = Math.atan2(direction.x, direction.z);
  }
}

export class GameWorld {
  readonly player: Combatant;
  readonly rivals: Rival[] = [];
  private readonly enemyDirector = new EnemyDirector<Rival, GameWorld>(this.rivals);
  readonly input: InputManager;
  readonly touchInput: TouchInputManager;
  readonly camera: UniversalCamera;
  private readonly worldBuilder = new WorldBuilder();
  readonly obstacles: Obstacle[] = this.worldBuilder.obstacles;
  readonly projectiles: Projectile[] = [];
  readonly pickups: Pickup[] = [];
  readonly trainingTargets: TrainingTarget[] = [];
  private readonly cameraController: CameraController;
  private readonly weaponSystem: WeaponSystem;
  private readonly playerController: PlayerController;
  private readonly hudController = new HudController();
  private audioContext?: AudioContext;
  private ambientTimer = 1.4;
  private readonly stormRing?: Mesh;
  private readonly stormCore?: Mesh;
  private readonly terrainMaterial: StandardMaterial;
  private shadowGenerator?: ShadowGenerator;
  private renderingPipeline?: DefaultRenderingPipeline;
  private shadowRefreshTimer = 0;
  private readonly shadowCasters = new Set<Mesh>();
  private mode: "briefing" | "playing" | "paused" | MatchOutcome = "briefing";
  private fireCooldown = 0;
  private uiTick = 0;
  private announcement = "降下を待機中";
  private yaw = Math.PI;
  private pitch = -0.16;
  private jumpHeld = false;
  private resultSent = false;
  elapsed = 0;
  stormRadius = 93;
  ammo = 30;
  reserve = 120;
  elims = 0;
  private reloadTimer = 0;
  private moveVelocity = new Vector3();
  private wasGrounded = true;
  private lastMotionState = "IDLE";
  private currentAiming = false;
  private currentCrouching = false;
  private debugGodMode = false;
  private medkits = 0;
  private medkitTimer = 0;
  private nearbyPickup?: Pickup;
  private selectedCharacterId: string;
  private readonly progression: ProgressionData;
  private dungeonArea = 1;
  private dungeonTransition = 0;
  private dungeonKey = false;
  private explorationTokens = 0;
  private explorationGoal = 0;
  private explorationLabel = "";
  private dungeonChest = false;
  private dungeonStartedAt = 0;
  private boss?: Rival;
  private dungeonWave: Rival[] = [];
  private dungeonObjective = "敵を3体たおそう！";
  private readonly dungeonDoors = new Map<number, { mesh: Mesh; obstacle: Obstacle; opening: boolean; progress: number }>();
  private dungeonWaveActive = true;
  private bossAttackCooldown = 3.5;
  private bossWarningTimer = 0;
  private bossWarning?: Mesh;
  private bossWarningPosition = new Vector3();
  private forestRoute: "left" | "right" | null = null;
  private forestSecretFound = false;
  private forestBossDashCooldown = 5.5;
  private forestBossDashWarning = 0;
  private forestBossDashDirection = new Vector3();
  private caveFloorTraps: CaveFloorTrap[] = [];
  private caveMovers: CaveMover[] = [];
  private caveSwitches: CaveSwitch[] = [];
  private nearbyCaveSwitch?: CaveSwitch;
  private caveSwitchesOn = 0;
  private caveBossRockCooldown = 3.4;
  private caveBossRockTimer = 0;
  private caveBossRockPosition = new Vector3();
  private caveBossRockMarker?: Mesh;
  private caveBossFallingCooldown = 5.2;
  private caveBossPhaseTwo = false;
  private tutorialSent = new Set<TutorialKey>();

  private get isForestDungeon() {
    return this.options.step === "step5" && this.options.dungeonId === "forest";
  }

  private get isCaveDungeon() {
    return this.options.step === "step5" && this.options.dungeonId === "cave";
  }

  private get isEasyMode() {
    return this.progression.difficulty === "easy";
  }

  private enemyMaxHp() {
    return this.isEasyMode ? 50 : ENEMY_MAX_HP;
  }

  private scaleIncomingDamage(amount: number) {
    return this.isEasyMode ? Math.max(1, Math.round(amount * 0.25)) : amount;
  }

  private applyDifficultyToRival(rival: Rival) {
    rival.hp = this.enemyMaxHp();
    rival.maxHp = this.enemyMaxHp();
    if (this.isEasyMode) rival.attackDamage = Math.max(2, Math.round(rival.attackDamage * 0.25));
  }

  private configureVisualLighting() {
    const quality = this.options.graphicsQuality;
    const isMobile = this.canvas.clientWidth < 600;
    const fogMultiplier = quality === "light" ? 0.68 : quality === "pretty" ? 1.08 : 0.9;
    this.scene.clearColor = new Color4(0.055, 0.12, 0.22, 1);
    this.scene.ambientColor = new Color3(0.22, 0.26, 0.34);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.095, 0.18, 0.27);
    this.scene.fogDensity = (isMobile ? 0.0036 : 0.0067) * fogMultiplier;
    if (this.isForestDungeon) {
      this.scene.clearColor = new Color4(0.075, 0.19, 0.13, 1);
      this.scene.ambientColor = new Color3(0.2, 0.31, 0.2);
      this.scene.fogColor = new Color3(0.14, 0.28, 0.18);
      this.scene.fogDensity = (isMobile ? 0.0045 : 0.008) * fogMultiplier;
    } else if (this.isCaveDungeon) {
      this.scene.clearColor = new Color4(0.035, 0.03, 0.075, 1);
      this.scene.ambientColor = new Color3(0.18, 0.16, 0.29);
      this.scene.fogColor = new Color3(0.075, 0.06, 0.15);
      this.scene.fogDensity = (isMobile ? 0.0042 : 0.0075) * fogMultiplier;
    }

    const sky = new HemisphericLight("stormfall-sky-fill", new Vector3(0.18, 1, 0.08), this.scene);
    sky.groundColor = this.isCaveDungeon ? new Color3(0.08, 0.035, 0.13) : this.isForestDungeon ? new Color3(0.075, 0.12, 0.055) : new Color3(0.16, 0.075, 0.035);
    sky.intensity = this.isCaveDungeon ? 0.72 : this.isForestDungeon ? 0.94 : 1.02;
    if (quality === "light") return;

    const sun = new DirectionalLight("stormfall-key-light", new Vector3(-0.36, -0.72, 0.38), this.scene);
    sun.position = new Vector3(42, 72, -35);
    sun.intensity = this.isCaveDungeon ? 0.48 : this.isForestDungeon ? 0.96 : 1.16;
    if (quality === "pretty") {
      const shadowGenerator = new ShadowGenerator(isMobile ? 1024 : 1536, sun);
      shadowGenerator.useBlurExponentialShadowMap = true;
      shadowGenerator.blurKernel = isMobile ? 8 : 16;
      shadowGenerator.bias = 0.0008;
      this.shadowGenerator = shadowGenerator;
    }
  }

  private configureRenderingPipeline() {
    const quality = this.options.graphicsQuality;
    if (quality === "light") return;
    const imageProcessing = this.scene.imageProcessingConfiguration;
    imageProcessing.toneMappingEnabled = true;
    imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    imageProcessing.exposure = this.isCaveDungeon ? 1.06 : 1.12;
    imageProcessing.contrast = this.isCaveDungeon ? 1.12 : 1.08;
    const pipeline = new DefaultRenderingPipeline("stormfall-visual-pipeline", true, this.scene, [this.camera]);
    pipeline.fxaaEnabled = true;
    pipeline.imageProcessingEnabled = true;
    pipeline.samples = quality === "pretty" ? 2 : 1;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = quality === "pretty" ? 0.8 : 1.05;
    pipeline.bloomWeight = quality === "pretty" ? 0.14 : 0.055;
    pipeline.bloomKernel = quality === "pretty" ? 56 : 40;
    this.renderingPipeline = pipeline;
  }

  private refreshShadowCasters() {
    if (!this.shadowGenerator) return;
    this.scene.meshes.forEach((mesh) => {
      if (!(mesh instanceof Mesh) || this.shadowCasters.has(mesh) || !mesh.isVisible || !mesh.isEnabled()) return;
      if (/collider|hp-label|event|warning|halo|hit-marker|terrain-scar/i.test(mesh.name)) return;
      this.shadowGenerator?.addShadowCaster(mesh);
      mesh.receiveShadows = true;
      this.shadowCasters.add(mesh);
    });
  }

  constructor(readonly scene: Scene, readonly canvas: HTMLCanvasElement, readonly options: WorldOptions) {
    this.configureVisualLighting();

    this.terrainMaterial = new StandardMaterial("sandstone-terrain", scene);
    this.terrainMaterial.diffuseColor = this.isCaveDungeon ? new Color3(0.13, 0.095, 0.19) : this.isForestDungeon ? new Color3(0.09, 0.26, 0.13) : SAND;
    this.terrainMaterial.specularColor = new Color3(0.04, 0.035, 0.025);
    this.terrainMaterial.diffuseTexture = this.createTerrainTexture();
    this.terrainMaterial.emissiveColor = this.isCaveDungeon ? new Color3(0.018, 0.008, 0.052) : this.isForestDungeon ? new Color3(0.005, 0.024, 0.01) : new Color3(0.006, 0.001, 0);
    this.buildEnvironment();

    this.input = new InputManager(canvas);
    this.touchInput = new TouchInputManager(canvas);
    const godToggle = document.getElementById("god-mode-toggle");
    godToggle?.addEventListener("click", () => {
      this.debugGodMode = !this.debugGodMode;
      godToggle.textContent = this.debugGodMode ? "GOD: ON" : "GOD: OFF";
      godToggle.setAttribute("aria-pressed", String(this.debugGodMode));
      this.pushEvent(this.debugGodMode ? "DEBUG GOD MODE ON" : "DEBUG GOD MODE OFF");
    });
    this.selectedCharacterId = options.avatarId;
    this.progression = options.progression;
    this.debugGodMode = options.demo;
    this.player = new Combatant(scene, "ranger", new Color3(0.34, 0.28, 0.19), new Vector3(0, 0, 36));
    this.player.applyLoadout(this.selectedCharacterId);
    this.player.hp = options.step === "step3" || options.step === "step4" || options.step === "step5" ? this.playerMaxHp() : 100;
    this.player.shield = options.step === "step3" || options.step === "step4" || options.step === "step5" ? 0 : 65;
    if (options.step === "step5") {
      if (this.isCaveDungeon) this.createCaveAreaOne();
      else if (this.isForestDungeon) this.createForestAreaOne();
      else this.createDungeonAreaOne();
    } else if (options.step === "full" || options.step === "step3" || options.step === "step4") {
      this.createRivals();
      if (options.step === "full" || options.step === "step4") {
        this.createPickups();
        this.stormRing = this.createStormRing();
        this.stormCore = this.createStormCore();
      }
    } else if (options.step === "step2") {
      this.createTrainingTargets();
    }

    this.camera = new UniversalCamera("ranger-camera", new Vector3(0, 5, 43), scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 500;
    scene.activeCamera = this.camera;
    this.cameraController = new CameraController(this.camera, this.obstacles);
    this.configureRenderingPipeline();
    this.weaponSystem = new WeaponSystem();
    this.weaponSystem.damageMultiplier = (this.isEasyMode ? 2.35 : 1) * (1 + Math.max(0, this.progression.attackLevel - 1) * 0.1);
    this.weaponSystem.reloadMultiplier = Math.max(0.6, 1 - Math.max(0, this.progression.reloadLevel - 1) * 0.1);
    const startsArmed = options.step === "step3" || options.step === "full" || ((options.step === "step4" || options.step === "step5") && DEBUG_START_WITH_WEAPON);
    if (startsArmed) {
      this.weaponSystem.equip("assault", 120);
      this.player.setWeaponVisible(true);
      this.player.setWeaponStyle("assault");
    } else {
      this.player.setWeaponVisible(false);
    }
    this.playerController = new PlayerController(this.player, this.cameraController, this.weaponSystem);
    this.refreshShadowCasters();
    this.updateCamera(0);
    this.updateHud(true);
  }

  start() {
    if (this.mode !== "briefing") return;
    this.mode = "playing";
    this.dungeonStartedAt = performance.now();
    this.ambientTimer = 1.1;
    this.announcement = this.options.step === "step5" ? (this.isCaveDungeon ? "くらやみの洞窟　明かりをたよりに進もう！" : this.isForestDungeon ? "まよいの森　森のおくへ進もう！" : "はじまりの遺跡　敵をたおして、いちばん奥を目指そう！") : "裂け目への降下を確認";
    this.dungeonObjective = this.options.step === "step5" ? (this.isCaveDungeon ? "洞窟のおくへ進もう！" : this.isForestDungeon ? "森のおくへ進もう！" : "敵を3体たおそう！") : this.dungeonObjective;
    this.pushEvent(this.options.step === "step5" ? (this.isCaveDungeon ? "洞窟外縁信号を確認。明かりを追え。" : this.isForestDungeon ? "森林信号を確認。分岐を見失うな。" : "遺跡信号を確認。最深部へ進め。") : "エリア RIFT-07 に着地");
    if (this.options.step === "step5") this.playDungeonCue("spawn");
  }

  returnToBriefing() {
    if (this.mode !== "playing" && this.mode !== "paused") return;
    this.mode = "briefing";
    this.input.reset();
    this.touchInput.reset();
    this.currentAiming = false;
    this.currentCrouching = false;
    this.player.setAiming(false);
    this.ambientTimer = 1.4;
    this.announcement = "降下準備画面へもどったよ";
  }

  pause() {
    if (this.mode !== "playing") return;
    this.mode = "paused";
    this.input.reset();
    this.touchInput.reset();
    this.currentAiming = false;
    this.currentCrouching = false;
    this.player.setAiming(false);
  }

  resume() {
    if (this.mode === "paused") this.mode = "playing";
  }

  setPlayerAvatar(avatarId: string) {
    // Selection is allowed only in the briefing. Once play starts, the same
    // CharacterVisual and its animations remain active until the world ends.
    if (this.mode !== "briefing") return;
    this.selectedCharacterId = avatarId;
    this.player.applyLoadout(this.selectedCharacterId);
    this.announcement = `${this.selectedCharacterId.toUpperCase()} の降下準備完了`;
  }

  update(delta: number) {
    if (this.mode === "paused") return;
    this.shadowRefreshTimer -= delta;
    if (this.shadowGenerator && this.shadowRefreshTimer <= 0) {
      this.refreshShadowCasters();
      this.shadowRefreshTimer = 1.6;
    }
    if (this.mode === "playing") {
      this.elapsed += delta;
      this.updateAmbientSound(delta);
      if (this.options.step === "full") this.updateStorm(delta);
      this.updatePlayer(delta);
      if (this.options.step === "full" || this.options.step === "step3" || this.options.step === "step4" || this.options.step === "step5") {
        this.enemyDirector.update(delta, this);
        this.updateProjectiles(delta);
        if (this.options.step === "full" || this.options.step === "step4" || this.options.step === "step5") this.updatePickups(delta);
        if (this.options.step === "step5") {
          this.updateDungeonDoors(delta);
          this.updateDungeonRoomTrigger();
          this.updateDungeonProgress(delta);
          this.updateCaveGimmicks(delta);
          this.updateBossAttack(delta);
        }
        this.checkEndState();
      } else if (this.options.step === "step2") {
        this.updateProjectiles(delta);
      }
    }
    this.updateCamera(delta);
    this.uiTick -= delta;
    if (this.uiTick <= 0) {
      this.updateHud();
      this.uiTick = 0.1;
    }
  }

  private playerMaxHp() {
    return (this.isEasyMode ? 500 : PLAYER_MAX_HP) + Math.max(0, this.progression.hpLevel - 1) * 20;
  }

  private showTutorial(key: TutorialKey, text: string, target: "move" | "look" | "aim" | "fire" | "pickup" | "jump") {
    if (this.options.progression.tutorialSeen[key] || this.tutorialSent.has(key)) return;
    this.tutorialSent.add(key);
    this.options.onTutorial(key, text, target);
  }

  private applyDamageToRival(target: Rival, amount: number, attackerPosition: Vector3) {
    let adjusted = amount;
    if (target.style === "shield") {
      const enemyForward = new Vector3(Math.sin(target.root.rotation.y), 0, Math.cos(target.root.rotation.y));
      const fromEnemy = attackerPosition.subtract(target.root.position);
      fromEnemy.y = 0;
      if (fromEnemy.lengthSquared() > 0.01 && Vector3.Dot(enemyForward, fromEnemy.normalize()) > 0.18) {
        adjusted = Math.max(1, Math.round(amount * 0.4));
        this.pushEvent("シールドでダメージをへらされた！ 回りこんでみよう！");
      }
    }
    return { eliminated: target.applyDamage(adjusted), amount: adjusted };
  }

  private fireAtAimPoint(origin: Vector3, cameraDirection: Vector3, damageOverride?: number) {
    const direction = cameraDirection.normalize();
    const definition = this.weaponSystem.definition();
    const range = definition?.range ?? PLAYER_WEAPON_RANGE;
    const damage = damageOverride ?? definition?.damage ?? PLAYER_WEAPON_DAMAGE;
    const ray = new Ray(this.camera.position, direction, range);
    const pick = this.scene.pickWithRay(ray, (mesh) => Boolean(mesh.metadata?.trainingTargetId || mesh.metadata?.enemyId));
    const aimPoint = pick?.hit && pick.pickedPoint ? pick.pickedPoint.clone() : this.camera.position.add(direction.scale(range));
    const enemyId = pick?.pickedMesh?.metadata?.enemyId as string | undefined;
    const target = enemyId ? this.rivals.find((rival) => rival.id === enemyId && rival.alive) : undefined;
    if (target) {
      const hit = this.applyDamageToRival(target, damage, origin);
      const eliminated = hit.eliminated;
      this.showHitMarker();
      this.pushEvent(`-${hit.amount} HP`);
      this.createImpact(aimPoint, eliminated);
      if (eliminated) {
        this.elims += 1;
        this.pushEvent(`${target.id.toUpperCase()} を排除`);
      }
    }
    this.playShotSound();
    this.cameraController.addRecoil(0.014);
    const tracer = MeshBuilder.CreateLines("bullet-tracer", { points: [origin, aimPoint] }, this.scene);
    tracer.color = TEAL;
    window.setTimeout(() => tracer.dispose(), 85);
  }

  private playDungeonCue(kind: "door" | "spawn" | "clear" | "key" | "chest" | "boss" | "victory" | "warning" | "impact") {
    if (typeof window === "undefined") return;
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === "suspended") void this.audioContext.resume();
    const patterns: Record<typeof kind, { notes: number[]; noteLength: number; volume: number; type: "sine" | "triangle" | "sawtooth" | "square" }> = {
      // Door: three bright notes rising, like a small door unlocking.
      door: { notes: [330, 494, 659], noteLength: 0.09, volume: 0.045, type: "triangle" },
      // Enemy: two low descending sawtooth notes, clearly different from success sounds.
      spawn: { notes: [138, 82], noteLength: 0.16, volume: 0.052, type: "sawtooth" },
      // Clear: a short major triad ascending, warm and celebratory.
      clear: { notes: [523, 659, 784], noteLength: 0.11, volume: 0.045, type: "sine" },
      key: { notes: [660], noteLength: 0.16, volume: 0.04, type: "sine" },
      chest: { notes: [392, 523, 784], noteLength: 0.1, volume: 0.045, type: "triangle" },
      boss: { notes: [72, 54], noteLength: 0.2, volume: 0.058, type: "sawtooth" },
      victory: { notes: [523, 659, 784, 1047], noteLength: 0.1, volume: 0.05, type: "sine" },
      warning: { notes: [180], noteLength: 0.12, volume: 0.05, type: "square" },
      impact: { notes: [110], noteLength: 0.16, volume: 0.045, type: "square" },
    };
    const pattern = patterns[kind];
    const start = this.audioContext.currentTime;
    pattern.notes.forEach((frequency, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      const noteStart = start + index * pattern.noteLength;
      oscillator.type = pattern.type;
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(pattern.volume * this.progression.sfxVolume, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + pattern.noteLength * 0.92);
      oscillator.connect(gain).connect(this.audioContext!.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + pattern.noteLength);
    });
  }

  private playExplorationHint(kind: "fork" | "safe" | "treasure" | "deep") {
    if (typeof window === "undefined" || this.progression.sfxVolume <= 0.01) return;
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === "suspended") void this.audioContext.resume();
    const patterns: Record<typeof kind, { notes: number[]; type: OscillatorType; volume: number }> = {
      fork: { notes: [330, 440], type: "sine", volume: 0.022 },
      safe: { notes: [392, 523], type: "triangle", volume: 0.024 },
      treasure: { notes: [659, 784, 1047], type: "sine", volume: 0.02 },
      deep: { notes: [147, 110], type: "triangle", volume: 0.022 },
    };
    const pattern = patterns[kind];
    const start = this.audioContext.currentTime;
    pattern.notes.forEach((frequency, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      const noteStart = start + index * 0.12;
      oscillator.type = pattern.type;
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(pattern.volume * this.progression.sfxVolume, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.16);
      oscillator.connect(gain).connect(this.audioContext!.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.18);
    });
  }

  private updateAmbientSound(delta: number) {
    if (this.options.step !== "step5" || this.progression.sfxVolume <= 0.01) return;
    this.ambientTimer -= delta;
    if (this.ambientTimer > 0 || typeof window === "undefined") return;
    this.ambientTimer = this.isCaveDungeon ? 7.5 : this.isForestDungeon ? 10.5 : 9;
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === "suspended") void this.audioContext.resume();
    const sound = this.isCaveDungeon
      ? { notes: [64, 96], type: "sine" as OscillatorType, volume: 0.009 }
      : this.isForestDungeon
        ? { notes: [523, 659], type: "sine" as OscillatorType, volume: 0.008 }
        : { notes: [98, 147], type: "triangle" as OscillatorType, volume: 0.009 };
    const start = this.audioContext.currentTime;
    sound.notes.forEach((frequency, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      const noteStart = start + index * 0.42;
      oscillator.type = sound.type;
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(sound.volume * this.progression.sfxVolume, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.7);
      oscillator.connect(gain).connect(this.audioContext!.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.74);
    });
  }

  private updateBossAttack(delta: number) {
    const bossArea = this.isCaveDungeon ? 6 : 5;
    if (this.options.step !== "step5" || this.dungeonArea !== bossArea || !this.boss?.alive) return;
    if (this.isForestDungeon) this.updateForestBossDash(delta);
    if (this.isCaveDungeon) {
      this.updateCaveBossAttacks(delta);
      if (this.caveBossRockTimer > 0) return;
    }
    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer = Math.max(0, this.bossWarningTimer - delta);
      if (this.bossWarning) {
        const pulse = 1 + Math.sin(performance.now() * 0.018) * 0.08;
        this.bossWarning.scaling.setAll(pulse);
      }
      if (this.bossWarningTimer === 0) {
        if (this.bossWarning) { this.bossWarning.dispose(); this.bossWarning = undefined; }
        const close = Vector3.DistanceSquared(this.player.root.position, this.bossWarningPosition) < 28;
        if (close && this.player.alive) {
          const eliminated = this.debugGodMode ? false : this.player.applyDamage(this.scaleIncomingDamage(18));
          this.showPlayerDamage(this.bossWarningPosition);
          this.pushEvent(this.debugGodMode ? "範囲攻撃をよけた！" : "範囲攻撃 -18 HP");
          if (eliminated) this.pushEvent("PLAYER DEAD");
        }
        this.playDungeonCue("impact");
        this.bossAttackCooldown = 4.2;
      }
      return;
    }
    this.bossAttackCooldown -= delta;
    if (this.bossAttackCooldown <= 0) {
      this.bossWarningPosition.copyFrom(this.player.root.position);
      this.bossWarning = MeshBuilder.CreateDisc("boss-warning", { radius: 2.8, tessellation: 32 }, this.scene);
      this.bossWarning.position.copyFrom(this.bossWarningPosition);
      this.bossWarning.position.y = 0.035;
      this.bossWarning.rotation.x = Math.PI / 2;
      const material = new StandardMaterial("boss-warning-material", this.scene);
      material.diffuseColor = new Color3(0.92, 0.12, 0.08);
      material.emissiveColor = new Color3(0.75, 0.04, 0.02);
      material.alpha = 0.55;
      material.disableLighting = true;
      this.bossWarning.material = material;
      this.bossWarningTimer = 1.25;
      this.announcement = this.isCaveDungeon ? "ゴルムが地面をたたく！ はなれよう！" : "気をつけて！ 赤い場所からにげよう！";
      this.pushEvent(this.isCaveDungeon ? "地面攻撃のよこく！" : "ボスの範囲攻撃！");
      this.playDungeonCue("warning");
    }
  }

  queueCaveRockThrow(position: Vector3, falling = false) {
    if (!this.isCaveDungeon || !this.boss?.alive || this.caveBossRockTimer > 0) return;
    this.caveBossRockPosition.copyFrom(position);
    this.caveBossRockMarker = MeshBuilder.CreateDisc(`cave-rock-warning-${falling ? "fall" : "throw"}`, { radius: falling ? 2.3 : 1.75, tessellation: 28 }, this.scene);
    this.caveBossRockMarker.position.copyFrom(position);
    this.caveBossRockMarker.position.y = 0.045;
    this.caveBossRockMarker.rotation.x = Math.PI / 2;
    const material = new StandardMaterial("cave-rock-warning-mat", this.scene);
    material.diffuseColor = falling ? new Color3(0.8, 0.18, 0.08) : AMBER;
    material.emissiveColor = falling ? new Color3(0.62, 0.04, 0.02) : AMBER.scale(0.48);
    material.alpha = 0.55;
    material.disableLighting = true;
    this.caveBossRockMarker.material = material;
    this.caveBossRockTimer = falling ? 1.25 : 1.05;
    this.announcement = falling ? "天井から岩が落ちる！ にげよう！" : "岩が飛んでくる！ 横へにげよう！";
    this.pushEvent(this.announcement);
    this.playDungeonCue("warning");
  }

  private updateCaveBossAttacks(delta: number) {
    if (!this.boss?.alive) return;
    if (!this.caveBossPhaseTwo && this.boss.hp <= this.boss.maxHp * 0.5) {
      this.caveBossPhaseTwo = true;
      this.announcement = "ゴルムが怒った！";
      this.pushEvent("新しい攻撃に気をつけよう！");
      this.playDungeonCue("boss");
    }
    if (this.caveBossRockTimer > 0) {
      this.caveBossRockTimer = Math.max(0, this.caveBossRockTimer - delta);
      if (this.caveBossRockMarker) this.caveBossRockMarker.scaling.setAll(1 + Math.sin(this.elapsed * 20) * 0.07);
      if (this.caveBossRockTimer === 0) {
        this.caveBossRockMarker?.dispose();
        this.caveBossRockMarker = undefined;
        const hit = Vector3.DistanceSquared(this.player.root.position, this.caveBossRockPosition) < 6.4;
        if (hit && this.player.alive) {
          const eliminated = this.debugGodMode ? false : this.player.applyDamage(this.scaleIncomingDamage(this.caveBossPhaseTwo ? 18 : 14));
          this.showPlayerDamage(this.caveBossRockPosition);
          this.pushEvent(this.debugGodMode ? "岩をよけた！" : "岩の攻撃を受けた！");
          if (eliminated) this.pushEvent("PLAYER DEAD");
        }
        this.playDungeonCue("impact");
      }
      return;
    }
    this.caveBossRockCooldown -= delta;
    this.caveBossFallingCooldown -= delta;
    if (this.caveBossPhaseTwo && this.caveBossFallingCooldown <= 0) {
      this.queueCaveRockThrow(this.player.root.position, true);
      this.caveBossFallingCooldown = 5.4;
    } else if (this.caveBossRockCooldown <= 0) {
      this.queueCaveRockThrow(this.player.root.position);
      this.caveBossRockCooldown = 3.8;
    }
  }

  private updateForestBossDash(delta: number) {
    if (!this.boss?.alive) return;
    if (this.forestBossDashWarning > 0) {
      this.forestBossDashWarning = Math.max(0, this.forestBossDashWarning - delta);
      if (this.forestBossDashWarning === 0) {
        this.boss.root.position.addInPlace(this.forestBossDashDirection.scale(7.2));
        const hit = Vector3.DistanceSquared(this.player.root.position, this.boss.root.position) < 10;
        if (hit && this.player.alive) {
          const eliminated = this.debugGodMode ? false : this.player.applyDamage(this.scaleIncomingDamage(16));
          this.showPlayerDamage(this.boss.root.position);
          this.pushEvent(this.debugGodMode ? "突進をよけた！" : "突進 -16 HP");
          if (eliminated) this.pushEvent("PLAYER DEAD");
        } else {
          this.pushEvent("突進をよけた！");
        }
        this.playDungeonCue("impact");
        this.forestBossDashCooldown = 5.5;
      }
      return;
    }
    this.forestBossDashCooldown -= delta;
    if (this.forestBossDashCooldown <= 0) {
      this.forestBossDashDirection = this.player.root.position.subtract(this.boss.root.position);
      this.forestBossDashDirection.y = 0;
      if (this.forestBossDashDirection.lengthSquared() < 0.01) this.forestBossDashDirection.z = 1;
      this.forestBossDashDirection.normalize();
      this.boss.root.rotation.y = Math.atan2(this.forestBossDashDirection.x, this.forestBossDashDirection.z);
      this.forestBossDashWarning = 0.9;
      this.announcement = "くるぞ！ 横へにげよう！";
      this.pushEvent("ガーディアンが突進のじゅんび！");
      this.playDungeonCue("warning");
    }
  }

  private playShotSound() {
    if (typeof window === "undefined") return;
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === "suspended") void this.audioContext.resume();
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(135, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(58, this.audioContext.currentTime + 0.07);
    gain.gain.setValueAtTime(0.035 * this.progression.sfxVolume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.08);
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.08);
  }

  private createImpact(position: Vector3, destroyed = false) {
    const impact = MeshBuilder.CreateTorus("target-impact", { diameter: destroyed ? 0.8 : 0.48, thickness: 0.045, tessellation: 16 }, this.scene);
    impact.position.copyFrom(position);
    impact.rotation.x = Math.PI / 2;
    const material = new StandardMaterial("target-impact-mat", this.scene);
    material.emissiveColor = destroyed ? AMBER : TEAL;
    material.disableLighting = true;
    impact.material = material;
    window.setTimeout(() => impact.dispose(), destroyed ? 220 : 110);
  }

  spawnProjectile(origin: Vector3, direction: Vector3, owner: "player" | "rival", damage: number) {
    const mesh = MeshBuilder.CreateSphere(`${owner}-pulse`, { diameter: owner === "player" ? 0.18 : 0.14, segments: 8 }, this.scene);
    mesh.position.copyFrom(origin);
    const material = new StandardMaterial(`${owner}-pulse-mat`, this.scene);
    material.emissiveColor = owner === "player" ? TEAL : AMBER;
    material.disableLighting = true;
    mesh.material = material;
    const speed = owner === "player" ? 52 : 38;
    const life = owner === "player" ? PLAYER_WEAPON_RANGE / speed + 0.25 : 1.35;
    this.projectiles.push({ mesh, velocity: direction.normalize().scale(speed), owner, life, damage });
    if (owner === "player") this.createMuzzleFlash(origin, direction);
  }

  private createMuzzleFlash(origin: Vector3, direction: Vector3) {
    const flash = MeshBuilder.CreateSphere("muzzle-flash", { diameter: 0.34, segments: 8 }, this.scene);
    flash.position.copyFrom(origin.add(direction.scale(0.22)));
    const material = new StandardMaterial("muzzle-flash-mat", this.scene);
    material.emissiveColor = AMBER;
    material.disableLighting = true;
    flash.material = material;
    window.setTimeout(() => flash.dispose(), 70);
  }

  resolveObstacles(position: Vector3, clearance: number) {
    if (this.options.step === "step5") position.x = Math.max(-7.4, Math.min(7.4, position.x));
    this.obstacles.forEach((obstacle) => {
      const delta = position.subtract(obstacle.position);
      delta.y = 0;
      const distance = delta.length();
      const minDistance = obstacle.radius + clearance;
      if (distance < minDistance) {
        const push = (distance < 0.001 ? new Vector3(1, 0, 0) : delta.normalize()).scale(minDistance - distance);
        position.addInPlace(push);
      }
    });
  }

  hasLineOfSight(from: Vector3, to: Vector3) {
    const segment = to.subtract(from);
    const horizontal = new Vector3(segment.x, 0, segment.z);
    const lengthSquared = Math.max(0.001, horizontal.lengthSquared());
    return !this.obstacles.some((obstacle) => {
      const offset = new Vector3(obstacle.position.x - from.x, 0, obstacle.position.z - from.z);
      const t = Math.max(0, Math.min(1, Vector3.Dot(offset, horizontal) / lengthSquared));
      const closest = new Vector3(from.x, 0, from.z).add(horizontal.scale(t));
      return Vector3.DistanceSquared(closest, new Vector3(obstacle.position.x, 0, obstacle.position.z)) < (obstacle.radius + 0.5) ** 2;
    });
  }

  resolveEnemySeparation(enemy: Rival) {
    this.rivals.forEach((other) => {
      if (other === enemy || !other.alive) return;
      const delta = enemy.root.position.subtract(other.root.position);
      delta.y = 0;
      const distance = delta.length();
      if (distance > 0 && distance < 1.45) enemy.root.position.addInPlace(delta.normalize().scale((1.45 - distance) * 0.5));
    });
  }

  dispose() {
    this.renderingPipeline?.dispose();
    this.shadowGenerator?.dispose();
    this.input.dispose();
    this.touchInput.dispose();
    this.player.dispose();
    this.enemyDirector.dispose();
    this.pickups.forEach((pickup) => pickup.root.dispose(false, true));
    this.trainingTargets.forEach((target) => target.root.dispose(false, true));
    this.projectiles.forEach((projectile) => projectile.mesh.dispose());
  }

  private buildEnvironment() {
    if (this.isCaveDungeon) {
      this.buildCaveEnvironment();
      return;
    }
    if (this.isForestDungeon) {
      this.buildForestEnvironment();
      return;
    }
    const ground = MeshBuilder.CreateGround("rift-island", { width: 220, height: 220, subdivisions: 40 }, this.scene);
    ground.material = this.terrainMaterial;
    this.createTerrainScars();
    const edge = MeshBuilder.CreateTorus("island-edge", { diameter: 216, thickness: 0.42, tessellation: 96 }, this.scene);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.16;
    const edgeMat = new StandardMaterial("island-edge-mat", this.scene);
    edgeMat.emissiveColor = new Color3(0.11, 0.18, 0.24);
    edgeMat.alpha = 0.65;
    edge.material = edgeMat;

    const waterMat = new StandardMaterial("channel-water", this.scene);
    waterMat.diffuseColor = new Color3(0.025, 0.31, 0.38);
    waterMat.emissiveColor = new Color3(0.015, 0.08, 0.11);
    waterMat.alpha = 0.76;
    const water = MeshBuilder.CreateGround("shallow-channel", { width: 25, height: 170, subdivisions: 4 }, this.scene);
    water.position.set(-39, 0.025, -4);
    water.rotation.y = -0.18;
    water.material = waterMat;

    const boulderPositions = [
      [-12, 20, 4.2], [15, 6, 5.1], [-25, -14, 5.4], [31, -29, 4.6], [4, -39, 3.5],
      [48, 16, 4.7], [-49, 42, 4], [39, 47, 4.4], [-6, -5, 3.3], [11, 43, 3.8],
    ] as const;
    boulderPositions.forEach(([x, z, size], index) => this.createBoulder(index, x, z, size));
    [[-70, 70, 16, 11], [72, 65, 18, 13], [-79, -57, 20, 12], [78, -68, 15, 10], [-7, -88, 18, 12], [96, 5, 22, 14]].forEach(([x, z, height, radius], index) => this.createMesa(index, x, z, height, radius));
    [[-58, -9], [47, -4], [17, 59], [-19, -58]].forEach(([x, z], index) => this.createPylon(index, x, z));
    this.createDistantIslets();
    this.createRoads();
    this.createHills();
    this.createTrees();
    this.createBuildings();
    if (this.options.step === "step5") this.createRuinsVisualPass();
  }

  private createRuinsVisualPass() {
    const stoneMat = new StandardMaterial("ruins-weathered-stone", this.scene);
    stoneMat.diffuseColor = new Color3(0.42, 0.28, 0.15);
    stoneMat.specularColor = new Color3(0.08, 0.06, 0.035);
    stoneMat.specularPower = 34;
    const mossMat = new StandardMaterial("ruins-vine-moss", this.scene);
    mossMat.diffuseColor = new Color3(0.12, 0.31, 0.09);
    mossMat.emissiveColor = new Color3(0.005, 0.025, 0.004);
    const flameMat = new StandardMaterial("ruins-torch-flame", this.scene);
    flameMat.diffuseColor = AMBER;
    flameMat.emissiveColor = AMBER.scale(0.95);
    flameMat.disableLighting = true;
    [30, 10, -18, -48, -76].forEach((z, room) => {
      const floor = MeshBuilder.CreateBox(`ruins-floor-slab-${room}`, { width: 16.5, height: 0.14, depth: 18 }, this.scene);
      floor.position.set(0, 0.06, z);
      floor.material = stoneMat;
      [-1, 1].forEach((side) => {
        const pillar = MeshBuilder.CreateCylinder(`ruins-pillar-${room}-${side}`, { height: 4.9 - (room % 2) * 1.2, diameterTop: 0.52, diameterBottom: 0.7, tessellation: 8 }, this.scene);
        pillar.position.set(side * 7.1, pillar.getBoundingInfo().boundingBox.extendSize.y, z + (room % 2 ? 3.8 : -3.8));
        pillar.rotation.z = side * (room % 2 ? 0.11 : -0.04);
        pillar.material = stoneMat;
        const vine = MeshBuilder.CreateTorus(`ruins-vine-${room}-${side}`, { diameter: 0.72, thickness: 0.07, tessellation: 12 }, this.scene);
        vine.position.set(side * 7.12, 2.2, z + (room % 2 ? 3.82 : -3.78));
        vine.rotation.x = Math.PI / 2;
        vine.material = mossMat;
      });
      if (room < 4) {
        const torch = MeshBuilder.CreateCylinder(`ruins-torch-${room}`, { height: 2.3, diameter: 0.13, tessellation: 6 }, this.scene);
        torch.position.set(room % 2 ? -6.1 : 6.1, 1.15, z);
        torch.material = stoneMat;
        const flame = MeshBuilder.CreateSphere(`ruins-flame-${room}`, { diameter: 0.3, segments: 8 }, this.scene);
        flame.position.set(torch.position.x, 2.36, z);
        flame.material = flameMat;
        if (this.options.graphicsQuality !== "light") {
          const light = new PointLight(`ruins-torch-light-${room}`, flame.position.clone(), this.scene);
          light.diffuse = new Color3(1, 0.55, 0.2);
          light.intensity = this.options.graphicsQuality === "pretty" ? 1.8 : 1.15;
          light.range = this.options.graphicsQuality === "pretty" ? 11 : 7;
        }
      }
    });
    [-73, -75, -77].forEach((z, index) => {
      const step = MeshBuilder.CreateBox(`ruins-boss-step-${index}`, { width: 8.5 - index * 0.7, height: 0.24, depth: 1.2 }, this.scene);
      step.position.set(0, 0.12 + index * 0.16, z);
      step.material = stoneMat;
    });
    this.createWorldSignal("ruins-forward-signal", new Vector3(-4.7, 0, 21), stoneMat, new Color3(0.075, 0.85, 0.77));
  }

  private createWorldSignal(id: string, position: Vector3, structureMaterial: StandardMaterial, signalColor: Color3) {
    const root = new TransformNode(id, this.scene);
    root.position.copyFrom(position);
    [-1, 1].forEach((side) => {
      const leg = MeshBuilder.CreateCylinder(`${id}-leg-${side}`, { height: 3.3, diameterTop: 0.12, diameterBottom: 0.27, tessellation: 6 }, this.scene);
      leg.parent = root;
      leg.position.set(side * 0.42, 1.48, 0);
      leg.rotation.z = side * 0.18;
      leg.material = structureMaterial;
    });
    const spine = MeshBuilder.CreateCylinder(`${id}-spine`, { height: 4.4, diameterTop: 0.1, diameterBottom: 0.19, tessellation: 6 }, this.scene);
    spine.parent = root;
    spine.position.y = 2.2;
    spine.material = structureMaterial;
    const beacon = MeshBuilder.CreateSphere(`${id}-beacon`, { diameter: 0.48, segments: 10 }, this.scene);
    beacon.parent = root;
    beacon.position.y = 4.55;
    const beaconMat = new StandardMaterial(`${id}-beacon-material`, this.scene);
    beaconMat.diffuseColor = signalColor;
    beaconMat.emissiveColor = signalColor.scale(0.8);
    beaconMat.disableLighting = true;
    beacon.material = beaconMat;
    const ring = MeshBuilder.CreateTorus(`${id}-ring`, { diameter: 1.7, thickness: 0.045, tessellation: 24 }, this.scene);
    ring.parent = root;
    ring.position.y = 0.08;
    ring.rotation.x = Math.PI / 2;
    ring.material = beaconMat;
  }

  private buildCaveEnvironment() {
    const ground = MeshBuilder.CreateGround("cave-ground", { width: 28, height: 154, subdivisions: 20 }, this.scene);
    ground.material = this.terrainMaterial;
    const basaltMat = new StandardMaterial("cave-basalt-mat", this.scene);
    basaltMat.diffuseColor = new Color3(0.13, 0.1, 0.19);
    basaltMat.emissiveColor = new Color3(0.012, 0.008, 0.028);
    basaltMat.specularColor = Color3.Black();
    const crystalMat = new StandardMaterial("cave-crystal-mat", this.scene);
    crystalMat.diffuseColor = new Color3(0.04, 0.5, 0.6);
    crystalMat.emissiveColor = new Color3(0.015, 0.58, 0.68);
    const lampMat = new StandardMaterial("cave-lamp-mat", this.scene);
    lampMat.emissiveColor = AMBER;
    lampMat.disableLighting = true;
    for (let z = 34, index = 0; z > -102; z -= 10, index += 1) {
      [-12.5, 12.5].forEach((x, side) => {
        const wall = MeshBuilder.CreateIcoSphere(`cave-wall-${index}-${side}`, { radius: 4.4 + (index % 2) * 0.8, subdivisions: 1 }, this.scene);
        wall.position.set(x, 2.5, z + (side ? 1.8 : -1.8));
        wall.scaling.set(1.15, 1.5, 1.05);
        wall.material = basaltMat;
        this.obstacles.push({ position: new Vector3(x, 0, z + (side ? 1.8 : -1.8)), radius: 3.2 });
      });
      if (index % 2 === 0) {
        const torch = MeshBuilder.CreateCylinder(`cave-torch-${index}`, { height: 2.6, diameter: 0.18, tessellation: 8 }, this.scene);
        torch.position.set(index % 4 === 0 ? -8.5 : 8.5, 1.3, z);
        torch.material = lampMat;
        if (this.options.graphicsQuality !== "light" && (this.options.graphicsQuality === "pretty" || index % 4 === 0)) {
          const light = new PointLight(`cave-torch-light-${index}`, torch.position.add(new Vector3(0, 1.1, 0)), this.scene);
          light.diffuse = new Color3(1, 0.45, 0.14);
          light.intensity = this.options.graphicsQuality === "pretty" ? 2.65 : 2.1;
          light.range = this.options.graphicsQuality === "pretty" ? 16 : 12;
        }
      } else {
        [-0.42, 0, 0.42].forEach((offset, shard) => {
          const crystal = MeshBuilder.CreateCylinder(`cave-crystal-${index}-${shard}`, { height: 1.45 + shard * 0.35, diameterTop: 0.07, diameterBottom: 0.42, tessellation: 5 }, this.scene);
          crystal.position.set((index % 3 === 0 ? -8 : 8) + offset, 0.72 + shard * 0.15, z + offset * 0.6);
          crystal.rotation.z = (index % 3 === 0 ? -0.25 : 0.22) + offset * 0.2;
          crystal.material = crystalMat;
        });
      }
      if (index % 3 === 0) {
        const stalactite = MeshBuilder.CreateCylinder(`cave-stalactite-${index}`, { height: 2.7, diameterTop: 0.05, diameterBottom: 0.72, tessellation: 6 }, this.scene);
        stalactite.position.set(index % 2 ? -3.6 : 3.6, 7.1, z + 2.1);
        stalactite.rotation.z = index % 2 ? 0.12 : -0.12;
        stalactite.material = basaltMat;
      }
    }
    if (this.options.graphicsQuality !== "light") {
      const playerLight = new PointLight("cave-player-light", new Vector3(0, 2.8, 34), this.scene);
      playerLight.diffuse = new Color3(0.18, 0.78, 0.9);
      playerLight.intensity = this.options.graphicsQuality === "pretty" ? 2.65 : 2.1;
      playerLight.range = this.options.graphicsQuality === "pretty" ? 20 : 16;
      this.scene.onBeforeRenderObservable.add(() => playerLight.position.copyFrom(this.player.root.position.add(new Vector3(0, 2.8, 0))));
    }
    [[-8.5, 21], [8.5, -52]].forEach(([x, z], index) => {
      const pylon = MeshBuilder.CreateCylinder(`cave-nav-pylon-${index}`, { height: 5.4, diameterTop: 0.2, diameterBottom: 0.52, tessellation: 6 }, this.scene);
      pylon.position.set(x, 2.7, z);
      const pylonMat = new StandardMaterial(`cave-nav-pylon-mat-${index}`, this.scene);
      pylonMat.diffuseColor = new Color3(0.035, 0.09, 0.13);
      pylonMat.emissiveColor = TEAL.scale(0.32);
      pylon.material = pylonMat;
      const signal = MeshBuilder.CreateSphere(`cave-nav-signal-${index}`, { diameter: 0.54, segments: 10 }, this.scene);
      signal.position.set(x, 5.55, z);
      const signalMat = new StandardMaterial(`cave-nav-signal-mat-${index}`, this.scene);
      signalMat.emissiveColor = TEAL;
      signalMat.disableLighting = true;
      signal.material = signalMat;
      const beacon = MeshBuilder.CreateCylinder(`cave-supply-beacon-${index}`, { height: 1.15, diameter: 0.28, tessellation: 8 }, this.scene);
      beacon.position.set(x * -0.62, 0.58, z - 2.4);
      const beaconMat = new StandardMaterial(`cave-supply-beacon-mat-${index}`, this.scene);
      beaconMat.emissiveColor = AMBER;
      beaconMat.disableLighting = true;
      beacon.material = beaconMat;
    });
    this.createWorldSignal("cave-forward-signal", new Vector3(3.8, 0, 23), basaltMat, TEAL);
  }

  private createCaveAreaOne() {
    this.createDungeonDoor(16);
    this.createDungeonDoor(-10);
    this.createDungeonDoor(-42);
    this.createDungeonDoor(-74);
    this.createCaveFloorTrap(new Vector3(-2.4, 0.06, 7), 0);
    this.createCaveFloorTrap(new Vector3(2.8, 0.06, -1), 1);
    this.createCaveMover(new Vector3(0, 1.2, 0), 0);
    this.createCaveSwitch(new Vector3(-6, 0, -3), 0);
    this.createCaveSwitch(new Vector3(6, 0, -7), 1);
    this.createExplorationWall("cave-left-turn", new Vector3(-7.4, 0, -1), 1.1, 7.5, new Color3(0.1, 0.08, 0.16));
    this.createExplorationWall("cave-right-turn", new Vector3(7.4, 0, -7), 1.1, 7.5, new Color3(0.1, 0.08, 0.16));
    this.createExplorationWall("cave-deep-turn", new Vector3(0, 0, -17), 7.2, 1.1, new Color3(0.1, 0.08, 0.16));
    this.dungeonObjective = "洞窟のおくへ進もう！";
    this.dungeonWaveActive = false;
  }

  private createCaveFloorTrap(position: Vector3, index: number) {
    const mesh = MeshBuilder.CreateBox(`cave-floor-trap-${index}`, { width: 3.2, height: 0.1, depth: 3.2 }, this.scene);
    mesh.position.copyFrom(position);
    const material = new StandardMaterial(`cave-floor-trap-mat-${index}`, this.scene);
    material.diffuseColor = new Color3(0.18, 0.05, 0.06);
    material.emissiveColor = new Color3(0.12, 0.01, 0.015);
    mesh.material = material;
    this.caveFloorTraps.push({ mesh, position: position.clone(), warning: 0, cooldown: 1.6, active: false });
  }

  private createCaveMover(origin: Vector3, index: number) {
    const mesh = MeshBuilder.CreateBox(`cave-moving-rock-${index}`, { width: 2.8, height: 2.4, depth: 1.1 }, this.scene);
    mesh.position.copyFrom(origin);
    const material = new StandardMaterial(`cave-moving-rock-mat-${index}`, this.scene);
    material.diffuseColor = new Color3(0.12, 0.09, 0.17);
    material.emissiveColor = new Color3(0.01, 0.02, 0.06);
    mesh.material = material;
    this.caveMovers.push({ mesh, origin: origin.clone(), phase: index * 1.7, cooldown: 0 });
  }

  private createCaveSwitch(position: Vector3, index: number) {
    const root = new TransformNode(`cave-switch-${index}`, this.scene);
    root.position.copyFrom(position);
    const base = MeshBuilder.CreateCylinder(`cave-switch-base-${index}`, { height: 1.25, diameter: 0.9, tessellation: 8 }, this.scene);
    base.parent = root;
    base.position.y = 0.62;
    const material = new StandardMaterial(`cave-switch-mat-${index}`, this.scene);
    material.diffuseColor = new Color3(0.07, 0.08, 0.14);
    material.emissiveColor = new Color3(0.03, 0.2, 0.26);
    base.material = material;
    const lamp = MeshBuilder.CreateSphere(`cave-switch-lamp-${index}`, { diameter: 0.34, segments: 10 }, this.scene);
    lamp.parent = root;
    lamp.position.y = 1.38;
    lamp.material = material;
    this.caveSwitches.push({ root, position: position.clone(), active: false });
  }

  private activateCaveSwitch(switchNode: CaveSwitch) {
    if (switchNode.active) return;
    switchNode.active = true;
    this.caveSwitchesOn += 1;
    switchNode.root.getChildMeshes().forEach((mesh) => {
      const material = mesh.material as StandardMaterial | null;
      if (material) material.emissiveColor = AMBER;
    });
    this.playDungeonCue("key");
    if (this.caveSwitchesOn < 2) {
      this.dungeonObjective = this.explorationComplete() ? "スイッチを2つさがそう！ あと1つ！" : `${this.explorationLabel} をあと ${this.explorationGoal - this.explorationTokens}こ見つけよう！`;
      this.announcement = "できた！ あと1つ！";
    } else {
      this.dungeonObjective = this.explorationComplete() ? "扉がひらいた！ 先へ進もう！" : `${this.explorationLabel} をあと ${this.explorationGoal - this.explorationTokens}こ見つけよう！`;
      this.announcement = "扉がひらいた！";
      this.openDungeonDoor(-10);
      this.playDungeonCue("door");
    }
    this.pushEvent(this.announcement);
    this.nearbyCaveSwitch = undefined;
  }

  private updateCaveGimmicks(delta: number) {
    if (!this.isCaveDungeon) return;
    if (this.options.demo && this.dungeonArea === 3 && this.caveSwitchesOn < 2) {
      const nextSwitch = this.caveSwitches.find((switchNode) => !switchNode.active);
      if (nextSwitch) this.activateCaveSwitch(nextSwitch);
    }
    this.nearbyCaveSwitch = this.caveSwitches.find((switchNode) => !switchNode.active && Vector3.DistanceSquared(this.player.root.position, switchNode.position) < PICKUP_RANGE * PICKUP_RANGE);
    if (this.nearbyCaveSwitch) this.showTutorial("caveSwitch", "スイッチに近づいて『おす』！", "pickup");
    this.caveFloorTraps.forEach((trap) => {
      trap.cooldown = Math.max(0, trap.cooldown - delta);
      const material = trap.mesh.material as StandardMaterial | null;
      const close = Vector3.DistanceSquared(this.player.root.position, trap.position) < 4.2;
      if (!trap.active && trap.cooldown === 0 && close) {
        trap.active = true;
        trap.warning = 1;
        if (material) material.emissiveColor = new Color3(0.85, 0.11, 0.035);
        this.announcement = "危ない床が光っている！";
        this.playDungeonCue("warning");
      }
      if (!trap.active) return;
      trap.warning = Math.max(0, trap.warning - delta);
      if (material) material.emissiveColor = new Color3(0.55 + Math.sin(this.elapsed * 18) * 0.25, 0.035, 0.02);
      if (trap.warning === 0) {
        const hit = Vector3.DistanceSquared(this.player.root.position, trap.position) < 4.2;
        if (hit && this.player.alive) {
          const eliminated = this.debugGodMode ? false : this.player.applyDamage(12);
          this.showPlayerDamage(trap.position);
          this.pushEvent(this.debugGodMode ? "床トラップをよけた！" : "床トラップ -12 HP");
          if (eliminated) this.pushEvent("PLAYER DEAD");
        }
        if (material) material.emissiveColor = new Color3(0.12, 0.01, 0.015);
        trap.active = false;
        trap.cooldown = 3.2;
      }
    });
    this.caveMovers.forEach((mover) => {
      mover.phase += delta;
      mover.cooldown = Math.max(0, mover.cooldown - delta);
      mover.mesh.position.x = mover.origin.x + Math.sin(mover.phase * 1.35) * 6.3;
      if (mover.cooldown === 0 && Vector3.DistanceSquared(this.player.root.position, mover.mesh.position) < 3.4) {
        const eliminated = this.debugGodMode ? false : this.player.applyDamage(10);
        this.showPlayerDamage(mover.mesh.position);
        this.pushEvent(this.debugGodMode ? "動く岩をよけた！" : "動く岩 -10 HP");
        this.playDungeonCue("impact");
        mover.cooldown = 1.4;
        if (eliminated) this.pushEvent("PLAYER DEAD");
      }
    });
  }

  private buildForestEnvironment() {
    const ground = MeshBuilder.CreateGround("forest-ground", { width: 64, height: 150, subdivisions: 24 }, this.scene);
    ground.material = this.terrainMaterial;
    const pathMat = new StandardMaterial("forest-path-mat", this.scene);
    pathMat.diffuseColor = new Color3(0.18, 0.24, 0.09);
    pathMat.emissiveColor = new Color3(0.006, 0.012, 0.002);
    [[0, 18, 11, 42, 0], [-3, -13, 11, 24, 0.26], [4, -13, 11, 24, -0.26], [0, -48, 12, 52, 0]].forEach(([x, z, width, depth, rotation], index) => {
      const path = MeshBuilder.CreateGround(`forest-path-${index}`, { width, height: depth, subdivisions: 2 }, this.scene);
      path.position.set(x, 0.028, z);
      path.rotation.y = rotation;
      path.material = pathMat;
    });
    const trunkMat = new StandardMaterial("forest-trunk", this.scene);
    trunkMat.diffuseColor = new Color3(0.115, 0.055, 0.02);
    const leafMat = new StandardMaterial("forest-leaf", this.scene);
    leafMat.diffuseColor = new Color3(0.055, 0.28, 0.09);
    leafMat.emissiveColor = new Color3(0.006, 0.035, 0.012);
    const mossMat = new StandardMaterial("forest-moss", this.scene);
    mossMat.diffuseColor = new Color3(0.12, 0.42, 0.14);
    const grassMat = new StandardMaterial("forest-grass", this.scene);
    grassMat.diffuseColor = new Color3(0.17, 0.44, 0.12);
    grassMat.emissiveColor = new Color3(0.008, 0.028, 0.006);
    const placements = [[-11, 28], [11, 25], [-10, 13], [10, 7], [-12, -4], [12, -6], [-11, -20], [12, -22], [-10, -38], [11, -43], [-12, -64], [12, -70], [-10, -88], [10, -92]];
    placements.forEach(([x, z], index) => {
      const trunk = MeshBuilder.CreateCylinder(`forest-tree-trunk-${index}`, { height: 5.2 + (index % 3), diameterTop: 0.36, diameterBottom: 0.72, tessellation: 8 }, this.scene);
      trunk.position.set(x, 2.8, z);
      trunk.rotation.z = (index % 2 ? 0.08 : -0.06);
      trunk.material = trunkMat;
      const canopy = MeshBuilder.CreateIcoSphere(`forest-tree-canopy-${index}`, { radius: 2.4 + (index % 2) * 0.5, subdivisions: 1 }, this.scene);
      canopy.position.set(x + (index % 2 ? 0.28 : -0.2), 6.4 + (index % 3) * 0.2, z);
      canopy.scaling.y = 1.38;
      canopy.material = leafMat;
      [-1, 1].forEach((side) => {
        const branch = MeshBuilder.CreateIcoSphere(`forest-tree-branch-${index}-${side}`, { radius: 1.45 + (index % 2) * 0.2, subdivisions: 1 }, this.scene);
        branch.position.set(x + side * 1.28, 5.45 + (index % 3) * 0.16, z + (side > 0 ? 0.45 : -0.4));
        branch.scaling.set(1.18, 0.88, 0.92);
        branch.material = leafMat;
      });
      this.obstacles.push({ position: new Vector3(x, 0, z), radius: 1.15 });
    });
    [[-6, 1], [7, -16], [-7, -31], [7, -35], [-6, -57], [7, -77]].forEach(([x, z], index) => {
      const rock = MeshBuilder.CreateIcoSphere(`forest-moss-rock-${index}`, { radius: 1.1 + (index % 2) * 0.45, subdivisions: 1 }, this.scene);
      rock.position.set(x, 0.74, z);
      rock.scaling.set(1.25, 0.72, 0.92);
      rock.material = mossMat;
      this.obstacles.push({ position: new Vector3(x, 0, z), radius: 1.1 });
    });
    const grassCount = this.options.graphicsQuality === "light" ? 16 : this.options.graphicsQuality === "pretty" ? 44 : 30;
    for (let index = 0; index < grassCount; index += 1) {
      const z = 30 - ((index * 17) % 120);
      const x = ((index * 11) % 19) - 9.5;
      if (Math.abs(x) < 3.6) continue;
      const tuft = MeshBuilder.CreateCylinder(`forest-grass-tuft-${index}`, { height: 0.38 + (index % 3) * 0.09, diameterTop: 0, diameterBottom: 0.34, tessellation: 4 }, this.scene);
      tuft.position.set(x, tuft.getBoundingInfo().boundingBox.extendSize.y, z);
      tuft.rotation.y = index * 0.74;
      tuft.material = grassMat;
    }
    const pylonMat = new StandardMaterial("forest-pylon-mat", this.scene);
    pylonMat.diffuseColor = new Color3(0.055, 0.085, 0.085);
    pylonMat.emissiveColor = TEAL.scale(0.1);
    const beaconMat = new StandardMaterial("forest-beacon-mat", this.scene);
    beaconMat.emissiveColor = AMBER;
    beaconMat.disableLighting = true;
    [[-5.8, 25], [5.6, -52]].forEach(([x, z], index) => {
      const pylon = MeshBuilder.CreateCylinder(`forest-nav-pylon-${index}`, { height: 5.8, diameterTop: 0.26, diameterBottom: 0.55, tessellation: 6 }, this.scene);
      pylon.position.set(x, 2.9, z);
      pylon.material = pylonMat;
      const signal = MeshBuilder.CreateSphere(`forest-nav-signal-${index}`, { diameter: 0.62, segments: 10 }, this.scene);
      signal.position.set(x, 5.9, z);
      signal.material = beaconMat;
      this.obstacles.push({ position: new Vector3(x, 0, z), radius: 0.85 });
    });
    [[4.6, 17], [-4.4, -47]].forEach(([x, z], index) => {
      const beacon = MeshBuilder.CreateCylinder(`forest-supply-beacon-${index}`, { height: 1.45, diameter: 0.38, tessellation: 10 }, this.scene);
      beacon.position.set(x, 0.72, z);
      beacon.material = beaconMat;
      const ring = MeshBuilder.CreateTorus(`forest-storm-marker-${index}`, { diameter: 1.6, thickness: 0.04, tessellation: 24 }, this.scene);
      ring.position.set(x, 0.06, z);
      ring.rotation.x = Math.PI / 2;
      const ringMat = new StandardMaterial(`forest-storm-marker-mat-${index}`, this.scene);
      ringMat.emissiveColor = TEAL;
      ringMat.disableLighting = true;
      ring.material = ringMat;
    });
    this.createWorldSignal("forest-forward-signal", new Vector3(-3.8, 0, 19), pylonMat, TEAL);
    this.createForestDirectionSign(new Vector3(-4.8, 0, 2.2), "← 安全な道\n回復があるよ");
    this.createForestDirectionSign(new Vector3(4.8, 0, 2.2), "危険な道 →\n宝箱があるかも！");
  }

  private createForestDirectionSign(position: Vector3, label: string) {
    const postMat = new StandardMaterial(`forest-sign-post-${position.x}`, this.scene);
    postMat.diffuseColor = new Color3(0.16, 0.09, 0.04);
    const post = MeshBuilder.CreateCylinder(`forest-sign-post-${position.x}`, { height: 2.1, diameter: 0.14, tessellation: 6 }, this.scene);
    post.position.copyFrom(position);
    post.position.y = 1.05;
    post.material = postMat;
    const board = MeshBuilder.CreatePlane(`forest-sign-board-${position.x}`, { width: 2.7, height: 1.05 }, this.scene);
    board.position.copyFrom(position);
    board.position.y = 2.05;
    board.rotation.y = Math.PI;
    const texture = new DynamicTexture(`forest-sign-text-${position.x}`, { width: 512, height: 192 }, this.scene, false);
    texture.hasAlpha = true;
    texture.drawText(label, 256, 74, "bold 35px sans-serif", "#d7fff4", "#102722", true, true);
    const material = new StandardMaterial(`forest-sign-mat-${position.x}`, this.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    board.material = material;
  }

  private createForestAreaOne() {
    this.createDungeonDoor(6);
    this.createDungeonDoor(-38);
    this.createDungeonDoor(-70);
    this.createExplorationWall("forest-left-turn", new Vector3(-7.7, 0, -10), 1.2, 7.5, new Color3(0.08, 0.24, 0.09));
    this.createExplorationWall("forest-right-turn", new Vector3(7.7, 0, -16), 1.2, 7.5, new Color3(0.08, 0.24, 0.09));
    this.createExplorationWall("forest-merge", new Vector3(0, 0, -29), 6.8, 1.1, new Color3(0.08, 0.24, 0.09));
    this.dungeonObjective = "森のおくへ進もう！";
  }

  private createRoads() {
    const roadMat = new StandardMaterial("step1-road-mat", this.scene);
    roadMat.diffuseColor = new Color3(0.18, 0.12, 0.08);
    roadMat.specularColor = Color3.Black();
    [[0, 0, 18, 150, 0.12], [0, 0, 150, 18, -0.32], [-43, -1, 10, 92, 0.18]].forEach(([x, z, width, depth, rotation], index) => {
      const road = MeshBuilder.CreateGround(`step1-road-${index}`, { width, height: depth, subdivisions: 4 }, this.scene);
      road.position.set(x, 0.035, z);
      road.rotation.y = rotation;
      road.material = roadMat;
      const stripe = MeshBuilder.CreateGround(`step1-road-stripe-${index}`, { width: Math.max(0.18, width * 0.035), height: depth * 0.92, subdivisions: 1 }, this.scene);
      stripe.position.set(x, 0.045, z);
      stripe.rotation.y = rotation;
      const stripeMat = new StandardMaterial(`step1-road-stripe-mat-${index}`, this.scene);
      stripeMat.diffuseColor = new Color3(0.58, 0.32, 0.13);
      stripeMat.emissiveColor = new Color3(0.035, 0.012, 0.002);
      stripe.material = stripeMat;
    });
  }

  private createHills() {
    [[-34, -20, 5.2, 14], [36, 25, 4.2, 11], [-48, 35, 3.4, 9]].forEach(([x, z, height, radius], index) => {
      const hill = MeshBuilder.CreateCylinder(`step1-hill-${index}`, { height, diameterTop: radius * 1.15, diameterBottom: radius * 2.2, tessellation: 12 }, this.scene);
      hill.position.set(x, height / 2, z);
      const mat = new StandardMaterial(`step1-hill-mat-${index}`, this.scene);
      mat.diffuseColor = new Color3(0.24, 0.11, 0.045);
      mat.specularColor = Color3.Black();
      hill.material = mat;
      this.worldBuilder.registerObstacle(new Vector3(x, 0, z), radius * 0.84);
    });
  }

  private createTrees() {
    const treeMat = new StandardMaterial("step1-tree-trunk", this.scene);
    treeMat.diffuseColor = new Color3(0.12, 0.055, 0.025);
    const canopyMat = new StandardMaterial("step1-tree-canopy", this.scene);
    canopyMat.diffuseColor = new Color3(0.08, 0.19, 0.14);
    canopyMat.emissiveColor = new Color3(0.01, 0.025, 0.018);
    [[-18, 31, 1.2], [23, 34, 1.1], [44, -13, 1.4], [-52, -24, 1.25], [55, 40, 1.05], [-63, 16, 1.2]].forEach(([x, z, scale], index) => {
      const root = new TransformNode(`step1-tree-${index}`, this.scene);
      root.position.set(x, 0, z);
      const trunk = MeshBuilder.CreateCylinder(`step1-trunk-${index}`, { height: 3.2 * scale, diameterTop: 0.34 * scale, diameterBottom: 0.56 * scale, tessellation: 8 }, this.scene);
      trunk.parent = root;
      trunk.position.y = 1.6 * scale;
      trunk.material = treeMat;
      const canopy = MeshBuilder.CreateIcoSphere(`step1-canopy-${index}`, { radius: 1.8 * scale, subdivisions: 1 }, this.scene);
      canopy.parent = root;
      canopy.position.y = 3.35 * scale;
      canopy.scaling.y = 1.25;
      canopy.material = canopyMat;
      this.worldBuilder.registerObstacle(new Vector3(x, 0, z), 0.9 * scale);
    });
  }

  private createBuildings() {
    const wallMat = new StandardMaterial("step1-building-mat", this.scene);
    wallMat.diffuseColor = new Color3(0.26, 0.18, 0.12);
    wallMat.specularColor = Color3.Black();
    const trimMat = new StandardMaterial("step1-building-trim", this.scene);
    trimMat.diffuseColor = new Color3(0.06, 0.15, 0.17);
    trimMat.emissiveColor = TEAL.scale(0.12);
    [[-52, -42, 14, 9, 4.5], [48, 27, 11, 8, 5.2], [4, 62, 16, 7, 3.5]].forEach(([x, z, width, depth, height], index) => {
      const root = new TransformNode(`step1-building-${index}`, this.scene);
      root.position.set(x, 0, z);
      const building = MeshBuilder.CreateBox(`step1-building-body-${index}`, { width, height, depth }, this.scene);
      building.parent = root;
      building.position.y = height / 2;
      building.material = wallMat;
      const roof = MeshBuilder.CreateBox(`step1-building-roof-${index}`, { width: width + 0.6, height: 0.22, depth: depth + 0.6 }, this.scene);
      roof.parent = root;
      roof.position.y = height + 0.12;
      roof.material = trimMat;
      const door = MeshBuilder.CreateBox(`step1-building-door-${index}`, { width: 1.2, height: 2.2, depth: 0.08 }, this.scene);
      door.parent = root;
      door.position.set(0, 1.1, depth / 2 + 0.05);
      door.material = trimMat;
      this.worldBuilder.registerObstacle(new Vector3(x, 0, z), Math.max(width, depth) * 0.62);
    });
  }

  private createBoulder(index: number, x: number, z: number, size: number) {
    const boulder = MeshBuilder.CreateIcoSphere(`basalt-${index}`, { radius: size * 0.56, subdivisions: 2 }, this.scene);
    boulder.position.set(x, size * 0.36, z);
    boulder.scaling.set(1.32, 0.74, 0.88);
    boulder.rotation.set(index * 0.29, index * 0.77, index * 0.13);
    const material = new StandardMaterial(`basalt-mat-${index}`, this.scene);
    material.diffuseColor = BASALT.add(new Color3(index * 0.011, 0.006, 0.004));
    material.emissiveColor = new Color3(0.012, 0.003, 0.001);
    material.specularColor = Color3.Black();
    boulder.material = material;
    this.obstacles.push({ position: new Vector3(x, 0, z), radius: size * 0.68 });
  }

  private createMesa(index: number, x: number, z: number, height: number, radius: number) {
    const mesa = MeshBuilder.CreateCylinder(`sandstone-mesa-${index}`, { height, diameterTop: radius * 1.52, diameterBottom: radius * 1.1, tessellation: 7, subdivisions: 2 }, this.scene);
    mesa.position.set(x, height / 2, z);
    mesa.rotation.y = index * 0.47;
    const material = new StandardMaterial(`mesa-mat-${index}`, this.scene);
    material.diffuseColor = new Color3(0.22 + index * 0.01, 0.07 + index * 0.004, 0.025);
    material.emissiveColor = new Color3(0.012, 0.003, 0.001);
    material.specularColor = Color3.Black();
    mesa.material = material;
    const cap = MeshBuilder.CreateCylinder(`mesa-cap-${index}`, { height: 0.28, diameter: radius * 1.62, tessellation: 7 }, this.scene);
    cap.position.set(x, height + 0.12, z);
    cap.rotation.y = index * 0.47;
    const capMat = new StandardMaterial(`mesa-cap-mat-${index}`, this.scene);
    capMat.diffuseColor = new Color3(0.075, 0.09, 0.078);
    capMat.specularColor = Color3.Black();
    cap.material = capMat;
    this.worldBuilder.registerObstacle(new Vector3(x, 0, z), radius * 0.62);
  }

  private createPylon(index: number, x: number, z: number) {
    const root = new TransformNode(`pylon-${index}`, this.scene);
    root.position.set(x, 0, z);
    const mat = new StandardMaterial(`pylon-mat-${index}`, this.scene);
    mat.diffuseColor = new Color3(0.05, 0.075, 0.09);
    mat.emissiveColor = TEAL.scale(0.08);
    for (let leg = 0; leg < 3; leg += 1) {
      const angle = (Math.PI * 2 * leg) / 3;
      const pillar = MeshBuilder.CreateCylinder(`pylon-leg-${index}-${leg}`, { height: 4.6, diameterTop: 0.16, diameterBottom: 0.38, tessellation: 6 }, this.scene);
      pillar.parent = root;
      pillar.position.set(Math.cos(angle) * 1.1, 2.25, Math.sin(angle) * 1.1);
      pillar.rotation.z = Math.sin(angle) * 0.16;
      pillar.rotation.x = Math.cos(angle) * 0.16;
      pillar.material = mat;
    }
    const beacon = MeshBuilder.CreateSphere(`pylon-beacon-${index}`, { diameter: 0.48, segments: 10 }, this.scene);
    beacon.parent = root;
    beacon.position.y = 5.05;
    const beaconMat = new StandardMaterial(`pylon-glow-${index}`, this.scene);
    beaconMat.emissiveColor = TEAL;
    beaconMat.disableLighting = true;
    beacon.material = beaconMat;
    this.worldBuilder.registerObstacle(new Vector3(x, 0, z), 2);
  }

  private createDistantIslets() {
    [[-86, 21, 23], [82, -36, 17], [34, 88, 19], [-68, -78, 16]].forEach(([x, z, height], index) => {
      const islet = MeshBuilder.CreateSphere(`sky-islet-${index}`, { diameter: 18, segments: 8 }, this.scene);
      islet.position.set(x, height, z);
      islet.scaling.set(1.9, 0.38, 1.3);
      const mat = new StandardMaterial(`sky-islet-mat-${index}`, this.scene);
      mat.diffuseColor = new Color3(0.12, 0.13, 0.16);
      mat.specularColor = Color3.Black();
      islet.material = mat;
    });
  }

  private createTerrainTexture() {
    const generatedTextureUrl = this.isCaveDungeon
      ? "/manus-storage/stormfall-cave-ground-texture_32b8bd63.png"
      : this.isForestDungeon
        ? "/manus-storage/stormfall-forest-ground-texture_6eb34a85.png"
        : "/manus-storage/stormfall-ruins-ground-texture_441a71b0.png";
    const generatedTexture = new Texture(generatedTextureUrl, this.scene, true, false);
    generatedTexture.uScale = this.isCaveDungeon ? 7.6 : this.isForestDungeon ? 6.8 : 7.2;
    generatedTexture.vScale = this.isCaveDungeon ? 22 : this.isForestDungeon ? 18 : 12;
    generatedTexture.anisotropicFilteringLevel = this.options.graphicsQuality === "pretty" ? 8 : this.options.graphicsQuality === "standard" ? 4 : 1;
    return generatedTexture;
    /* Legacy procedural texture retained below as an offline fallback reference for future non-network builds.
    const texture = new DynamicTexture("sandstone-field-texture", { width: 1024, height: 1024 }, this.scene, false);
    const context = texture.getContext();
    context.fillStyle = "#6f3513";
    context.fillRect(0, 0, 1024, 1024);
    for (let index = 0; index < 42; index += 1) {
      const x = (index * 197) % 1024;
      const y = (index * 431) % 1024;
      const radius = 34 + ((index * 29) % 80);
      const gradient = context.createRadialGradient(x, y, 2, x, y, radius);
      gradient.addColorStop(0, index % 3 === 0 ? "rgba(204,121,48,.32)" : "rgba(51,20,8,.26)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.lineWidth = 3;
    for (let index = 0; index < 95; index += 1) {
      const x = (index * 73) % 1024;
      const y = (index * 181) % 1024;
      context.strokeStyle = index % 2 === 0 ? "rgba(38,13,6,.38)" : "rgba(225,137,58,.18)";
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 18 + ((index * 11) % 47), y + ((index * 17) % 36) - 18);
      context.stroke();
    }
    texture.uScale = 5.4;
    texture.vScale = 5.4;
    texture.update(false);
    return texture;
    */
  }

  private createTerrainScars() {
    const scarMat = new StandardMaterial("terrain-scar-mat", this.scene);
    scarMat.diffuseColor = new Color3(0.19, 0.055, 0.015);
    scarMat.emissiveColor = new Color3(0.014, 0.002, 0);
    scarMat.alpha = 0.72;
    const strataMat = new StandardMaterial("strata-mat", this.scene);
    strataMat.diffuseColor = new Color3(0.34, 0.12, 0.032);
    strataMat.specularColor = Color3.Black();
    for (let index = 0; index < 18; index += 1) {
      const angle = index * 2.399;
      const radius = 17 + (index % 5) * 14;
      const patch = MeshBuilder.CreateDisc(`erosion-scar-${index}`, { radius: 3.4 + (index % 4) * 1.5, tessellation: 9 }, this.scene);
      patch.rotation.x = Math.PI / 2;
      patch.rotation.z = angle;
      patch.position.set(Math.cos(angle) * radius, 0.022, Math.sin(angle) * radius);
      patch.scaling.x = 1.9;
      patch.material = scarMat;
    }
    for (let index = 0; index < 22; index += 1) {
      const angle = index * 1.97;
      const radius = 12 + (index % 6) * 13;
      const rock = MeshBuilder.CreateCylinder(`strata-slab-${index}`, { height: 0.36 + (index % 3) * 0.25, diameterTop: 1.5 + (index % 4) * .55, diameterBottom: 1.85 + (index % 4) * .55, tessellation: 6 }, this.scene);
      rock.position.set(Math.cos(angle) * radius, 0.18, Math.sin(angle) * radius);
      rock.rotation.y = angle * 1.6;
      rock.material = strataMat;
    }
  }

  private createTrainingTargets() {
    // Near, medium and far lanes make the 250-unit camera ray easy to verify without moving the player.
    const placements = [[-10, 18], [10, 20], [-18, 48], [18, 52], [0, 88]] as const;
    const bodyMat = new StandardMaterial("training-target-body", this.scene);
    bodyMat.diffuseColor = new Color3(0.12, 0.18, 0.2);
    const coreMat = new StandardMaterial("training-target-core", this.scene);
    coreMat.emissiveColor = AMBER;
    coreMat.disableLighting = true;
    placements.forEach(([x, z], index) => {
      const root = new TransformNode(`training-target-${index + 1}`, this.scene);
      root.position.set(x, 0, z);
      root.metadata = { trainingTargetId: index + 1 };
      const body = MeshBuilder.CreateCylinder(`training-target-body-${index + 1}`, { height: 2.2, diameterTop: 1.1, diameterBottom: 1.35, tessellation: 12 }, this.scene);
      body.parent = root;
      body.position.y = 1.1;
      body.material = bodyMat;
      body.metadata = { trainingTargetId: index + 1 };
      const core = MeshBuilder.CreateSphere(`training-target-core-${index + 1}`, { diameter: 0.62, segments: 12 }, this.scene);
      core.parent = root;
      core.position.y = 1.45;
      core.material = coreMat;
      core.metadata = { trainingTargetId: index + 1 };
      const ring = MeshBuilder.CreateTorus(`training-target-ring-${index + 1}`, { diameter: 1.75, thickness: 0.05, tessellation: 24 }, this.scene);
      ring.parent = root;
      ring.position.y = 1.1;
      ring.rotation.x = Math.PI / 2;
      ring.material = coreMat;
      ring.metadata = { trainingTargetId: index + 1 };
      this.trainingTargets.push({ root, hp: 100, alive: true });
    });
  }

  private createDungeonAreaOne() {
    this.createDungeonDoor(6);
    this.createDungeonDoor(-12);
    this.createDungeonDoor(-42);
    this.createDungeonDoor(-72);
    this.spawnDungeonWave([
      new Vector3(-6, 0, 22),
      new Vector3(6, 0, 18),
      new Vector3(0, 0, 10),
    ], "area1");
    this.createExplorationWall("ruins-a", new Vector3(-6.5, 0, -1), 5.8, 1.1, new Color3(0.23, 0.25, 0.22));
    this.createExplorationWall("ruins-b", new Vector3(6.5, 0, -7), 5.8, 1.1, new Color3(0.23, 0.25, 0.22));
    this.createExplorationWall("ruins-c", new Vector3(0, 0, -17), 8.5, 1.1, new Color3(0.23, 0.25, 0.22));
    this.dungeonObjective = "敵を3体たおそう！";
  }

  private createDungeonDoor(z: number) {
    const door = MeshBuilder.CreateBox(`dungeon-door-${z}`, { width: 5.4, height: 3.4, depth: 0.35 }, this.scene);
    door.position.set(0, 1.7, z);
    const material = new StandardMaterial(`dungeon-door-material-${z}`, this.scene);
    material.diffuseColor = new Color3(0.16, 0.22, 0.26);
    material.emissiveColor = new Color3(0.02, 0.08, 0.09);
    door.material = material;
    door.metadata = { dungeonDoor: true, z };
    const obstacle: Obstacle = { position: new Vector3(0, 0, z), radius: 8.0 };
    this.obstacles.push(obstacle);
    this.dungeonDoors.set(z, { mesh: door, obstacle, opening: false, progress: 0 });
  }

  private updateDungeonDoors(delta: number) {
    this.dungeonDoors.forEach((door) => {
      if (!door.opening) return;
      door.progress = Math.min(1, door.progress + delta / 0.72);
      door.mesh.position.y = 1.7 + door.progress * 4.2;
      door.mesh.visibility = 1 - door.progress;
      if (door.progress >= 1) {
        door.mesh.setEnabled(false);
        const index = this.obstacles.indexOf(door.obstacle);
        if (index >= 0) this.obstacles.splice(index, 1);
      }
    });
  }

  private spawnDungeonWave(positions: Vector3[], prefix: string, styles: Rival["style"][] = []) {
    this.dungeonWave = [];
    positions.forEach((position, index) => {
      const rival = new Rival(this.scene, `${prefix}-${index + 1}`, position);
      rival.applyLoadout(index % 2 === 0 ? "rustjaw" : "veil");
      if (styles[index]) rival.setStyle(styles[index]);
      rival.shield = 0;
      this.applyDifficultyToRival(rival);
      this.rivals.push(rival);
      this.dungeonWave.push(rival);
    });
  }

  private createDungeonPickup(position: Vector3, type: Pickup["type"], label: string, amount?: number, ammoType?: Pickup["ammoType"], weaponId?: import("./contracts").WeaponId) {
    const root = new TransformNode(`dungeon-pickup-${type}-${this.pickups.length}`, this.scene);
    root.position.copyFrom(position);
    const material = new StandardMaterial(`dungeon-pickup-material-${this.pickups.length}`, this.scene);
    material.diffuseColor = type === "weapon" ? (weaponId === "shotgun" ? AMBER : weaponId === "smg" ? TEAL : new Color3(0.38, 0.68, 0.9)) : type === "key" || type === "rune" ? AMBER : type === "chest" ? new Color3(0.8, 0.45, 0.12) : type === "secret" ? new Color3(0.2, 0.82, 0.36) : type === "med" ? new Color3(0.86, 0.22, 0.22) : new Color3(0.7, 0.64, 0.22);
    material.emissiveColor = material.diffuseColor.scale(0.35);
    const base = MeshBuilder.CreateBox(`dungeon-pickup-base-${this.pickups.length}`, { width: type === "chest" ? 1.6 : 0.72, height: type === "chest" ? 0.9 : 0.5, depth: type === "chest" ? 1.0 : 0.62 }, this.scene);
    base.parent = root;
    base.position.y = type === "chest" ? 0.45 : 0.25;
    base.material = material;
    if (type === "weapon") {
      const barrel = MeshBuilder.CreateCylinder(`dungeon-pickup-barrel-${this.pickups.length}`, { height: weaponId === "shotgun" ? 1.02 : 0.78, diameter: weaponId === "shotgun" ? 0.11 : 0.075, tessellation: 8 }, this.scene);
      barrel.parent = root;
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.36, 0.38, 0);
      barrel.material = material;
    }
    const ring = MeshBuilder.CreateTorus(`dungeon-pickup-ring-${this.pickups.length}`, { diameter: type === "chest" ? 2.1 : 1.25, thickness: 0.035, tessellation: 20 }, this.scene);
    ring.parent = root;
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    ring.material = material;
    this.pickups.push({ root, type, label, amount, ammoType, weaponId, collected: false });
  }

  private beginExploration(goal: number, label: string) {
    this.explorationTokens = 0;
    this.explorationGoal = goal;
    this.explorationLabel = label;
    this.dungeonObjective = `${label} を ${goal}こ見つけよう！`;
  }

  private explorationComplete() {
    return this.explorationGoal === 0 || this.explorationTokens >= this.explorationGoal;
  }

  private createExplorationWall(id: string, position: Vector3, width: number, depth: number, color: Color3) {
    const wall = MeshBuilder.CreateBox(`explore-wall-${id}`, { width, height: 2.4, depth }, this.scene);
    wall.position.copyFrom(position);
    wall.position.y = 1.2;
    const material = new StandardMaterial(`explore-wall-mat-${id}`, this.scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.035);
    material.specularColor = Color3.Black();
    wall.material = material;
    this.obstacles.push({ position: position.clone(), radius: Math.max(width, depth) * 0.52 });
  }

  private updateDungeonProgress(delta: number) {
    if (this.options.step !== "step5") return;
    if (this.isCaveDungeon) {
      this.updateCaveProgress(delta);
      return;
    }
    if (this.isForestDungeon) {
      this.updateForestProgress(delta);
      return;
    }
    if (this.dungeonTransition > 0) {
      this.dungeonTransition = Math.max(0, this.dungeonTransition - delta);
      return;
    }
    if (this.dungeonArea === 1 && this.dungeonWave.length > 0 && this.dungeonWave.every((rival) => !rival.alive)) {
      this.dungeonArea = 2;
      this.beginExploration(3, "古代のしるし");
      this.announcement = "クリア！ 次の部屋へ進もう！";
      this.openDungeonDoor(6);
      this.createDungeonPickup(new Vector3(-8.8, 0.75, -4), "rune", "古代のしるし 1");
      this.createDungeonPickup(new Vector3(8.8, 0.75, -10), "rune", "古代のしるし 2");
      this.createDungeonPickup(new Vector3(0, 0.75, -20), "rune", "古代のしるし 3");
      this.createDungeonPickup(new Vector3(-11.5, 0.75, -15), "med", "迷路の回復キット", 1);
      this.createDungeonPickup(new Vector3(11.5, 0.75, -17), "secret", "古代の小さな宝箱", 25);
      this.createDungeonPickup(new Vector3(-4.2, 0.75, -3.8), "weapon", "サブマシンガン", undefined, undefined, "smg");
      this.dungeonTransition = 1.2;
      this.pushEvent("次の部屋へ進もう！");
      this.playDungeonCue("clear");
      this.playExplorationHint("fork");
    } else if (this.dungeonArea === 2 && this.dungeonKey && this.explorationComplete()) {
      this.dungeonArea = 3;
      this.dungeonObjective = "敵をぜんぶたおそう！";
      this.openDungeonDoor(-12);
      this.spawnDungeonWave([
        new Vector3(-8, 0, -24), new Vector3(8, 0, -26), new Vector3(-5, 0, -34),
        new Vector3(5, 0, -36),
      ], "area3");
      this.dungeonTransition = 1.2;
      this.pushEvent("エリア3へ進もう！");
      this.playDungeonCue("spawn");
    } else if (this.dungeonArea === 3 && this.dungeonWave.length > 0 && this.dungeonWave.every((rival) => !rival.alive)) {
      this.dungeonArea = 4;
      this.beginExploration(3, "最深部の石版");
      this.openDungeonDoor(-42);
      this.createDungeonPickup(new Vector3(-4, 0.75, -50), "ammo", "弾薬", 60, "medium");
      this.createDungeonPickup(new Vector3(4, 0.75, -50), "med", "回復キット", 1);
      this.createDungeonPickup(new Vector3(7.2, 0.75, -50), "weapon", "ショットガン", undefined, undefined, "shotgun");
      this.createDungeonPickup(new Vector3(-11.5, 0.75, -48), "rune", "最深部の石版 1");
      this.createDungeonPickup(new Vector3(11.5, 0.75, -57), "rune", "最深部の石版 2");
      this.createDungeonPickup(new Vector3(0, 0.75, -65), "rune", "最深部の石版 3");
      this.createDungeonPickup(new Vector3(-12, 0.75, -61), "secret", "崩れた宝物庫", 25);
      this.dungeonTransition = 1.2;
      this.pushEvent("ボスへの道がひらいた！");
      this.playDungeonCue("clear");
      this.playExplorationHint("deep");
    } else if (this.dungeonArea === 4 && this.explorationComplete() && this.player.root.position.z < -62) {
      this.openDungeonDoor(-72);
      if (this.player.root.position.z >= -70) return;
      const boss = new Rival(this.scene, "boss", new Vector3(0, 0, -78));
      boss.applyLoadout("rustjaw");
      boss.root.scaling.setAll(1.7);
      boss.shield = 0;
      boss.hp = this.isEasyMode ? 150 : 400;
      boss.maxHp = this.isEasyMode ? 150 : 400;
      boss.attackDamage = this.isEasyMode ? 4 : 14;
      this.rivals.push(boss);
      this.boss = boss;
      this.dungeonWave = [boss];
      this.dungeonArea = 5;
      this.dungeonObjective = "ボスをたおそう！";
      this.announcement = "ボスがあらわれた！";
      this.pushEvent("ボスがあらわれた！");
      this.playDungeonCue("boss");
    } else if (this.dungeonArea === 5 && this.boss && !this.boss.alive && !this.dungeonChest) {
      this.dungeonArea = 6;
      this.dungeonChest = true;
      this.dungeonObjective = "宝箱をあけよう！";
      this.announcement = "ボスをたおした！ 宝箱をあけよう！";
      this.createDungeonPickup(new Vector3(0, 0.75, -78), "chest", "宝箱");
      this.pushEvent("ボスをたおした！");
      this.playDungeonCue("clear");
    }
  }

  private updateCaveProgress(delta: number) {
    if (this.dungeonTransition > 0) {
      this.dungeonTransition = Math.max(0, this.dungeonTransition - delta);
      return;
    }
    const z = this.player.root.position.z;
    const waveCleared = this.dungeonWave.length > 0 && this.dungeonWave.every((rival) => !rival.alive);
    if (this.dungeonArea === 1 && !this.dungeonWaveActive && z < 28) {
      this.dungeonWaveActive = true;
      this.dungeonObjective = "敵を3体たおそう！";
      this.announcement = "洞窟の敵があらわれた！";
      this.spawnDungeonWave([new Vector3(-4, 0, 22), new Vector3(4, 0, 18), new Vector3(0, 0, 13)], "cave-entry", ["melee", "ranged", "melee"]);
      this.pushEvent("近づく敵と遠くの敵に気をつけよう！");
      this.playDungeonCue("spawn");
    } else if (this.dungeonArea === 1 && this.dungeonWaveActive && waveCleared) {
      this.dungeonArea = 2;
      this.dungeonWaveActive = false;
      this.dungeonObjective = "光る床をよけよう！";
      this.announcement = "クリア！ 光る床に気をつけよう！";
      this.openDungeonDoor(16);
      this.playDungeonCue("clear");
    } else if (this.dungeonArea === 2 && z < 9) {
      this.dungeonArea = 3;
      this.beginExploration(3, "光る鉱石");
      this.announcement = "光る鉱石とスイッチをさがそう！";
      this.createDungeonPickup(new Vector3(-10.5, 0.75, 2), "rune", "光る鉱石 1");
      this.createDungeonPickup(new Vector3(10.5, 0.75, -5), "rune", "光る鉱石 2");
      this.createDungeonPickup(new Vector3(0, 0.75, -20), "rune", "光る鉱石 3");
      this.createDungeonPickup(new Vector3(-11.5, 0.75, -10), "med", "洞窟の回復キット", 1);
      this.createDungeonPickup(new Vector3(11.5, 0.75, -15), "secret", "鉱石の小さな報酬", 25);
      this.pushEvent("近づいたら、おしてみよう！");
      this.playDungeonCue("key");
      this.playExplorationHint("fork");
    } else if (this.dungeonArea === 3 && this.caveSwitchesOn >= 2 && this.explorationComplete()) {
      this.dungeonArea = 4;
      this.dungeonWaveActive = false;
      this.dungeonObjective = "強い敵をたおそう！";
      this.dungeonTransition = 0.8;
    } else if (this.dungeonArea === 4 && !this.dungeonWaveActive && z < -16) {
      this.dungeonWaveActive = true;
      this.spawnDungeonWave([new Vector3(-4, 0, -24), new Vector3(4, 0, -28), new Vector3(0, 0, -34)], "cave-strong", ["shield", "melee", "ranged"]);
      this.announcement = "強い敵があらわれた！";
      this.playDungeonCue("spawn");
    } else if (this.dungeonArea === 4 && this.dungeonWaveActive && waveCleared) {
      this.dungeonArea = 5;
      this.beginExploration(3, "深層の鉱石");
      this.announcement = "クリア！ ボスへの道がひらいた！";
      this.openDungeonDoor(-42);
      this.createDungeonPickup(new Vector3(-3, 0.75, -55), "ammo", "弾薬", 100, "medium");
      this.createDungeonPickup(new Vector3(3, 0.75, -55), "med", "回復キット", 2);
      this.createDungeonPickup(new Vector3(6.6, 0.75, -55), "weapon", "ショットガン", undefined, undefined, "shotgun");
      this.createDungeonPickup(new Vector3(-10.5, 0.75, -45), "rune", "深層の鉱石 1");
      this.createDungeonPickup(new Vector3(10.5, 0.75, -56), "rune", "深層の鉱石 2");
      this.createDungeonPickup(new Vector3(0, 0.75, -67), "rune", "深層の鉱石 3");
      this.createDungeonPickup(new Vector3(11, 0.75, -62), "secret", "深層の小さな報酬", 25);
      this.playDungeonCue("clear");
      this.playExplorationHint("deep");
    } else if (this.dungeonArea === 5 && this.explorationComplete() && z < -66) {
      this.openDungeonDoor(-74);
      if (z >= -74) return;
      const boss = new Rival(this.scene, "gorum", new Vector3(0, 0, -86));
      boss.setStyle("caveBoss");
      this.applyDifficultyToRival(boss);
      boss.shield = 0;
      boss.hp = this.isEasyMode ? 230 : 520;
      boss.maxHp = this.isEasyMode ? 230 : 520;
      this.rivals.push(boss);
      this.boss = boss;
      this.dungeonWave = [boss];
      this.dungeonArea = 6;
      this.dungeonObjective = "岩の王 ゴルムをたおそう！";
      this.announcement = "岩の王 ゴルムがあらわれた！";
      this.pushEvent("ボスがあらわれた！");
      this.playDungeonCue("boss");
    } else if (this.dungeonArea === 6 && this.boss && !this.boss.alive && !this.dungeonChest) {
      this.dungeonArea = 7;
      this.dungeonChest = true;
      this.dungeonObjective = "宝箱をあけよう！";
      this.announcement = "ゴルムをたおした！ 宝箱をあけよう！";
      this.createDungeonPickup(new Vector3(0, 0.75, -86), "chest", "洞窟の宝箱");
      this.playDungeonCue("clear");
    }
  }

  private updateForestProgress(delta: number) {
    if (this.dungeonTransition > 0) {
      this.dungeonTransition = Math.max(0, this.dungeonTransition - delta);
      return;
    }
    const z = this.player.root.position.z;
    const waveCleared = this.dungeonWave.length > 0 && this.dungeonWave.every((rival) => !rival.alive);
    if (this.dungeonArea === 1 && !this.dungeonWaveActive && z < 28) {
      this.dungeonWaveActive = true;
      this.dungeonObjective = "敵を3体たおそう！";
      this.announcement = "森の敵があらわれた！";
      this.spawnDungeonWave([new Vector3(-4, 0, 22), new Vector3(4, 0, 18), new Vector3(0, 0, 12)], "forest-entry", ["melee", "ranged", "melee"]);
      this.pushEvent("近づく敵と遠くの敵に気をつけよう！");
      this.playDungeonCue("spawn");
    } else if (this.dungeonArea === 1 && this.dungeonWaveActive && waveCleared) {
      this.dungeonArea = 2;
      this.dungeonWaveActive = false;
      this.dungeonObjective = "どっちに行く？";
      this.announcement = "クリア！ どっちに行く？";
      this.openDungeonDoor(6);
      this.createDungeonPickup(new Vector3(-3.6, 0.75, 2.4), "weapon", "サブマシンガン", undefined, undefined, "smg");
      this.createDungeonPickup(new Vector3(3.6, 0.75, 2.4), "weapon", "ショットガン", undefined, undefined, "shotgun");
      this.pushEvent("左は回復、右は宝箱の道だよ");
      this.playDungeonCue("clear");
      this.playExplorationHint("fork");
    } else if (this.dungeonArea === 2 && !this.forestRoute && z < 1) {
      this.forestRoute = this.player.root.position.x < 0 ? "left" : "right";
      this.dungeonWaveActive = true;
      this.beginExploration(3, "森のひかり");
      if (this.forestRoute === "left") {
        this.createDungeonPickup(new Vector3(-5, 0.75, -15), "med", "回復キット", 1);
        this.createDungeonPickup(new Vector3(-10.5, 0.75, -8), "rune", "森のひかり 1");
        this.createDungeonPickup(new Vector3(-11, 0.75, -18), "rune", "森のひかり 2");
        this.createDungeonPickup(new Vector3(-4, 0.75, -27), "rune", "森のひかり 3");
        this.createDungeonPickup(new Vector3(-12, 0.75, -24), "secret", "木のうろの報酬", 25);
        this.spawnDungeonWave([new Vector3(-5, 0, -10), new Vector3(-4, 0, -20)], "forest-left", ["melee", "ranged"]);
        this.announcement = "左の道　回復を見つけよう！";
        this.playExplorationHint("safe");
      } else {
        this.createDungeonPickup(new Vector3(6, 0.75, -20), "secret", "隠し宝箱", 50);
        this.createDungeonPickup(new Vector3(10.5, 0.75, -8), "rune", "森のひかり 1");
        this.createDungeonPickup(new Vector3(11, 0.75, -18), "rune", "森のひかり 2");
        this.createDungeonPickup(new Vector3(4, 0.75, -27), "rune", "森のひかり 3");
        this.createDungeonPickup(new Vector3(12, 0.75, -24), "med", "木かげの回復", 1);
        this.spawnDungeonWave([new Vector3(5, 0, -9), new Vector3(6, 0, -16), new Vector3(4, 0, -24)], "forest-right", ["ranged", "melee", "ranged"]);
        this.announcement = "右の道　宝箱を探そう！";
        this.playExplorationHint("treasure");
      }
      this.pushEvent(this.announcement);
      this.playDungeonCue("spawn");
    } else if (this.dungeonArea === 2 && this.dungeonWaveActive && waveCleared && this.explorationComplete()) {
      this.dungeonArea = 3;
      this.dungeonObjective = "合流地点へ進もう！";
      this.announcement = "クリア！ 合流地点へ進もう！";
      this.dungeonTransition = 0.9;
      this.playDungeonCue("clear");
    } else if (this.dungeonArea === 3 && z < -28) {
      this.dungeonArea = 4;
      this.beginExploration(3, "森の道しるべ");
      this.openDungeonDoor(-38);
      this.createDungeonPickup(new Vector3(-3, 0.75, -48), "ammo", "弾薬", 80, "medium");
      this.createDungeonPickup(new Vector3(3, 0.75, -48), "med", "回復キット", 1);
      this.createDungeonPickup(new Vector3(-11, 0.75, -39), "rune", "森の道しるべ 1");
      this.createDungeonPickup(new Vector3(11, 0.75, -50), "rune", "森の道しるべ 2");
      this.createDungeonPickup(new Vector3(0, 0.75, -61), "rune", "森の道しるべ 3");
      this.createDungeonPickup(new Vector3(-12, 0.75, -57), "secret", "木立の小さな報酬", 25);
      this.announcement = "ボス前の補給だよ！";
      this.playDungeonCue("door");
    } else if (this.dungeonArea === 4 && this.explorationComplete() && z < -61) {
      this.openDungeonDoor(-70);
      if (z >= -70) return;
      const boss = new Rival(this.scene, "forest-guardian", new Vector3(0, 0, -82));
      boss.setStyle("forestBoss");
      this.applyDifficultyToRival(boss);
      boss.shield = 0;
      boss.hp = this.isEasyMode ? 200 : 460;
      boss.maxHp = this.isEasyMode ? 200 : 460;
      this.rivals.push(boss);
      this.boss = boss;
      this.dungeonWave = [boss];
      this.dungeonArea = 5;
      this.dungeonObjective = "森のガーディアンをたおそう！";
      this.announcement = "森のガーディアンがあらわれた！";
      this.pushEvent("ボスがあらわれた！");
      this.playDungeonCue("boss");
    } else if (this.dungeonArea === 5 && this.boss && !this.boss.alive && !this.dungeonChest) {
      this.dungeonArea = 6;
      this.dungeonChest = true;
      this.dungeonObjective = "宝箱をあけよう！";
      this.announcement = "森をまもってくれてありがとう！";
      this.createDungeonPickup(new Vector3(0, 0.75, -82), "chest", "森の宝箱");
      this.playDungeonCue("clear");
    }
  }

  private openDungeonDoor(z: number) {
    const door = this.dungeonDoors.get(z);
    if (!door || door.opening || door.progress >= 1) return;
    door.opening = true;
    this.announcement = "扉がひらいた！";
    this.playDungeonCue("door");
  }

  private updateDungeonRoomTrigger() {
    if (this.options.step !== "step5") return;
    if (this.isForestDungeon || this.isCaveDungeon) return;
    const z = this.player.root.position.z;
    if (this.dungeonArea === 2 && z < 2) {
      this.dungeonObjective = this.explorationComplete() ? "しるしがそろった！ 次の部屋へ進もう！" : `${this.explorationLabel} をあと ${this.explorationGoal - this.explorationTokens}こ見つけよう！`;
      this.announcement = "エリア2　迷路のしるしをさがそう！";
    } else if (this.dungeonArea === 3 && z < -18) {
      this.dungeonObjective = "敵をぜんぶたおそう！";
      this.announcement = "エリア3　敵をぜんぶたおそう！";
    } else if ((this.dungeonArea === 4 || this.dungeonArea === 5) && z < -58) {
      this.dungeonObjective = this.dungeonArea === 5 ? "ボスをたおそう！" : "ボス部屋へ進もう！";
    }
  }

  private createRivals() {
    const placements = this.options.step === "step3"
      ? [new Vector3(-26, 0, 18), new Vector3(29, 0, 10), new Vector3(-10, 0, -34)]
      : [new Vector3(-26, 0, 18), new Vector3(29, 0, 10), new Vector3(-10, 0, -34), new Vector3(37, 0, -39)];
    placements.forEach((position, index) => {
      const rival = new Rival(this.scene, `rival-${index + 1}`, position);
      const loadout = ["rustjaw", "veil", "anker", "rustjaw"][index];
      rival.applyLoadout(loadout);
      rival.shield = 0;
      this.applyDifficultyToRival(rival);
      this.rivals.push(rival);
    });
  }

  private createPickups() {
    const placements: Array<[number, number, Pickup["type"], string, import("./contracts").WeaponId | undefined, "medium" | "light" | "shells" | undefined, number | undefined]> = [
      [-4, 23, "weapon", "アサルトライフル", "assault", undefined, undefined],
      [16, -4, "weapon", "ショットガン", "shotgun", undefined, undefined],
      [-31, -23, "weapon", "サブマシンガン", "smg", undefined, undefined],
      [34, 32, "ammo", "弾薬（中）", undefined, "medium", 30],
      [-49, 4, "ammo", "弾薬（小）", undefined, "light", 30],
      [8, -52, "ammo", "ショットガンの弾", undefined, "shells", 12],
      [23, -31, "med", "回復キット", undefined, undefined, 1],
    ];
    placements.forEach(([x, z, type, label, weaponId, ammoType, amount], index) => {
      const root = new TransformNode(`pickup-${index}`, this.scene);
      root.position.set(x, 0.75, z);
      const base = MeshBuilder.CreateBox(`pickup-base-${index}`, { width: 0.88, height: 0.42, depth: 0.62 }, this.scene);
      base.parent = root;
      const material = new StandardMaterial(`pickup-material-${index}`, this.scene);
      material.diffuseColor = type === "weapon" ? (weaponId === "shotgun" ? AMBER : weaponId === "smg" ? TEAL : new Color3(0.38, 0.68, 0.9)) : type === "med" ? new Color3(0.86, 0.22, 0.22) : new Color3(0.7, 0.64, 0.22);
      material.emissiveColor = material.diffuseColor.scale(0.3);
      base.material = material;
      if (type === "weapon") {
        const barrel = MeshBuilder.CreateCylinder(`pickup-barrel-${index}`, { height: 0.82, diameter: 0.08, tessellation: 8 }, this.scene);
        barrel.parent = root;
        barrel.rotation.z = Math.PI / 2;
        barrel.position.x = 0.38;
        barrel.material = material;
      } else if (type === "med") {
        const cross = MeshBuilder.CreateBox(`pickup-cross-${index}`, { width: 0.12, height: 0.5, depth: 0.08 }, this.scene);
        cross.parent = root;
        cross.position.y = 0.25;
        cross.material = material;
      } else {
        const signal = MeshBuilder.CreateSphere(`pickup-signal-${index}`, { diameter: 0.3, segments: 8 }, this.scene);
        signal.parent = root;
        signal.position.y = 0.36;
        signal.material = material;
      }
      const ring = MeshBuilder.CreateTorus(`pickup-ring-${index}`, { diameter: 1.25, thickness: 0.024, tessellation: 20 }, this.scene);
      ring.parent = root;
      ring.rotation.x = Math.PI / 2;
      ring.material = material;
      this.pickups.push({ root, type, weaponId, ammoType, label, amount, collected: false });
    });
  }

  private createStormRing() {
    const ring = MeshBuilder.CreateTorus("storm-boundary", { diameter: 2, thickness: 0.06, tessellation: 128 }, this.scene);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    const mat = new StandardMaterial("storm-boundary-mat", this.scene);
    mat.emissiveColor = TEAL;
    mat.alpha = 0.92;
    mat.disableLighting = true;
    ring.material = mat;
    return ring;
  }

  private createStormCore() {
    const core = MeshBuilder.CreateCylinder("storm-horizon", { height: 0.03, diameter: 2, tessellation: 96 }, this.scene);
    core.position.y = 0.01;
    const mat = new StandardMaterial("storm-horizon-mat", this.scene);
    mat.diffuseColor = TEAL;
    mat.emissiveColor = TEAL.scale(0.35);
    mat.alpha = 0.045;
    core.material = mat;
    return core;
  }

  private updateStorm(delta: number) {
    const targetRadius = Math.max(25, 93 - this.elapsed * 0.43);
    this.stormRadius += (targetRadius - this.stormRadius) * Math.min(1, delta * 0.8);
    if (!this.stormRing || !this.stormCore) return;
    this.stormRing.scaling.x = this.stormRadius;
    this.stormRing.scaling.z = this.stormRadius;
    this.stormRing.rotation.y += delta * 0.08;
    this.stormCore.scaling.x = this.stormRadius;
    this.stormCore.scaling.z = this.stormRadius;
    if (this.player.root.position.length() > this.stormRadius) {
      this.player.applyDamage(delta * 7.3);
      this.announcement = "嵐の外縁 — 即時に退避";
    } else {
      this.announcement = `収束半径 ${Math.round(this.stormRadius)}m`;
    }
  }

  private updatePlayer(delta: number) {
    if (!this.player.alive) {
      this.input.reset();
      this.touchInput.reset();
      this.currentAiming = false;
      this.currentCrouching = false;
      return;
    }
    const rawSnapshot = this.options.demo ? this.demoInput() : this.touchInput.isActive() ? this.touchInput.snapshot() : this.input.snapshot();
    if (this.options.dungeonId === "ruins") {
      if (!this.tutorialSent.has("move")) this.showTutorial("move", "左を動かして進もう！", "move");
      else if (!this.tutorialSent.has("look") && (Math.abs(rawSnapshot.forward) > 0.08 || Math.abs(rawSnapshot.right) > 0.08)) this.showTutorial("look", "右側を動かして周りを見よう！", "look");
      else if (!this.tutorialSent.has("aimFire") && this.tutorialSent.has("look") && this.rivals.some((rival) => rival.alive && Vector3.DistanceSquared(rival.root.position, this.player.root.position) < 900)) this.showTutorial("aimFire", "ねらって、うってみよう！", "fire");
      else if (!this.tutorialSent.has("jump") && this.dungeonArea >= 2) this.showTutorial("jump", "ジャンプしてみよう！", "jump");
    }
    if (this.options.step === "step4" || this.options.step === "step5") {
      if (rawSnapshot.slotPressed) this.switchWeapon(rawSnapshot.slotPressed);
      if (rawSnapshot.pickupPressed && this.isCaveDungeon && this.nearbyCaveSwitch) this.activateCaveSwitch(this.nearbyCaveSwitch);
      else if (rawSnapshot.pickupPressed) this.pickupNearest();
      if (rawSnapshot.medkitPressed) this.beginMedkit();
    }
    this.updateAutoFocusTarget(rawSnapshot);
    this.medkitTimer = Math.max(0, this.medkitTimer - delta);
    const usingMedkit = this.medkitTimer > 0;
    const snapshot = this.options.step === "step1" ? { ...rawSnapshot, aiming: false, firing: false, reloadPressed: false } : usingMedkit ? { ...rawSnapshot, forward: 0, right: 0, sprint: false, aiming: false, firing: false, jump: false } : rawSnapshot;
    this.playerController.update(delta, snapshot, this.obstacles, (position, clearance) => this.resolveObstacles(position, clearance), (origin, direction, damage) => this.fireAtAimPoint(origin, direction, damage), (message) => this.pushEvent(message));
    this.currentAiming = this.playerController.aiming;
    this.currentCrouching = this.playerController.crouching;
    this.lastMotionState = this.playerController.motion;
  }

  private updateAutoFocusTarget(snapshot: InputSnapshot) {
    const hasManualLook = Math.abs(snapshot.lookX) + Math.abs(snapshot.lookY) > 0.45;
    if (!this.progression.aimAssistEnabled || (!snapshot.aiming && !snapshot.firing) || hasManualLook) {
      this.cameraController.setAutoFocusTarget();
      return;
    }
    const strength = this.progression.aimAssistStrength === "strong" ? 1.55 : this.progression.aimAssistStrength === "weak" ? 0.58 : 1;
    const eye = this.player.root.position.add(new Vector3(0, 1.25, 0));
    const forward = this.cameraController.forward();
    let bestTarget: Vector3 | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    const evaluate = (position: Vector3, height: number) => {
      const toTarget = position.add(new Vector3(0, height, 0)).subtract(eye);
      const distance = toTarget.length();
      if (distance > 38 || distance < 0.1) return;
      const alignment = Vector3.Dot(forward, toTarget.scale(1 / distance));
      if (alignment < -0.12) return;
      const score = distance + (1 - alignment) * 17;
      if (score < bestScore) {
        bestScore = score;
        bestTarget = position.add(new Vector3(0, height, 0));
      }
    };
    this.rivals.forEach((rival) => { if (rival.alive) evaluate(rival.root.position, 1.25); });
    this.trainingTargets.forEach((target) => { if (target.alive) evaluate(target.root.position, 1.35); });
    this.cameraController.setAutoFocusTarget(bestTarget, strength);
  }

  private updatePlayerLegacy(delta: number) {
    const snapshot = this.options.demo ? this.demoInput() : this.input.snapshot();
    this.currentAiming = snapshot.aiming;
    this.currentCrouching = snapshot.crouch;
    this.yaw -= snapshot.lookX * 0.0023;
    this.pitch = Math.max(-0.72, Math.min(0.28, this.pitch - snapshot.lookY * 0.00185));
    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(forward.z, 0, -forward.x);
    const direction = forward.scale(snapshot.forward).add(right.scale(snapshot.right));
    const grounded = this.player.root.position.y <= 0.025 && this.player.velocityY <= 0.2;
    const crouched = snapshot.crouch && grounded;
    const moving = direction.lengthSquared() > 0.01;
    if (moving) direction.normalize();
    const speed = crouched ? 2.65 : snapshot.sprint && !snapshot.aiming ? 9.2 : snapshot.aiming ? 4.1 : 5.4;
    const targetVelocity = moving ? direction.scale(speed) : Vector3.Zero();
    const response = 1 - Math.exp(-(grounded ? 15 : 5) * delta);
    this.moveVelocity = Vector3.Lerp(this.moveVelocity, targetVelocity, response);
    this.player.root.position.addInPlace(this.moveVelocity.scale(delta));
    if (moving || snapshot.aiming) {
      const targetRotation = snapshot.aiming ? this.yaw : Math.atan2(direction.x, direction.z);
      const rotationDelta = Math.atan2(Math.sin(targetRotation - this.player.root.rotation.y), Math.cos(targetRotation - this.player.root.rotation.y));
      this.player.root.rotation.y += rotationDelta * Math.min(1, delta * (snapshot.aiming ? 16 : 11));
    }
    if (snapshot.jump && !this.jumpHeld && grounded && !crouched) this.player.velocityY = 8.1;
    this.jumpHeld = snapshot.jump;
    this.player.velocityY -= 22 * delta;
    this.player.root.position.y = Math.max(0, this.player.root.position.y + this.player.velocityY * delta);
    const nowGrounded = this.player.root.position.y <= 0.001;
    if (nowGrounded) this.player.velocityY = 0;
    this.player.root.position.x = Math.max(-104, Math.min(104, this.player.root.position.x));
    this.player.root.position.z = Math.max(-104, Math.min(104, this.player.root.position.z));
    this.resolveObstacles(this.player.root.position, crouched ? 0.56 : 0.84);

    const wasReloading = this.reloadTimer > 0;
    this.reloadTimer = Math.max(0, this.reloadTimer - delta);
    if (snapshot.reloadPressed && this.reloadTimer <= 0 && this.ammo < 30 && this.reserve > 0) {
      this.reloadTimer = 0.82;
      this.announcement = "マガジン交換中";
      this.pushEvent("パルスライフルを再装填");
    }
    if (wasReloading && this.reloadTimer === 0) {
      const refill = Math.min(30 - this.ammo, this.reserve);
      this.reserve -= refill;
      this.ammo += refill;
      this.announcement = "マガジン装填完了";
    }
    this.fireCooldown -= delta;
    if (snapshot.firing && this.reloadTimer <= 0 && this.fireCooldown <= 0 && this.ammo > 0) {
      const muzzle = this.player.root.position.add(new Vector3(0, crouched ? 0.94 : 1.32, 0)).add(forward.scale(0.8));
      const aim = forward.add(new Vector3(0, this.pitch * 0.42, 0)).normalize();
      this.spawnProjectile(muzzle, aim, "player", 25);
      this.fireCooldown = 0.145;
      this.ammo -= 1;
    }
    if (this.ammo <= 0 && this.reserve > 0 && this.reloadTimer <= 0) this.reloadTimer = 0.82;
    const motionState = this.reloadTimer > 0 ? "RELOAD" : !nowGrounded ? (this.player.velocityY > 0 ? "JUMP" : "FALL") : crouched ? (moving ? "CROUCH WALK" : "CROUCH IDLE") : snapshot.aiming ? (snapshot.firing ? "FIRE" : "AIM") : moving ? (snapshot.sprint ? "RUN" : "WALK") : "IDLE";
    this.player.setMotionState(motionState);
    if (motionState !== this.lastMotionState) {
      if (motionState === "JUMP") this.pushEvent("ジャンプ開始");
      if (motionState === "FALL" && this.wasGrounded) this.pushEvent("空中状態");
      if (motionState === "IDLE" && !this.wasGrounded) this.pushEvent("着地");
      this.lastMotionState = motionState;
    }
    this.wasGrounded = nowGrounded;
    this.player.updateVisual(delta);
  }

  private updateProjectiles(delta: number) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.mesh.position.addInPlace(projectile.velocity.scale(delta));
      projectile.life -= delta;
      let hit = false;
      if (projectile.owner === "player") {
        const target = this.rivals.find((rival) => rival.containsPoint(projectile.mesh.position));
        if (target) {
          const attackerPosition = projectile.mesh.position.subtract(projectile.velocity.normalize().scale(0.8));
          const hitResult = this.applyDamageToRival(target, projectile.damage, attackerPosition);
          const eliminated = hitResult.eliminated;
          this.showHitMarker();
          this.pushEvent(`-${hitResult.amount} HP`);
          this.createImpact(projectile.mesh.position, eliminated);
          if (eliminated) {
            this.elims += 1;
            this.pushEvent(`${target.id.toUpperCase()} を排除`);
          }
          hit = true;
        } else {
          const training = this.trainingTargets.find((candidate) => candidate.alive && Vector3.DistanceSquared(projectile.mesh.position, candidate.root.position.add(new Vector3(0, 1.1, 0))) < 1.65);
          if (training) {
            training.hp = Math.max(0, training.hp - projectile.damage);
            const destroyed = training.hp === 0;
            training.alive = !destroyed;
            this.showHitMarker();
            this.createImpact(projectile.mesh.position, destroyed);
            if (destroyed) {
              training.root.setEnabled(false);
              this.pushEvent("射撃ターゲットを破壊");
            }
            hit = true;
          }
        }
      } else if (this.player.alive && Vector3.DistanceSquared(projectile.mesh.position, this.player.root.position.add(new Vector3(0, 1, 0))) < 1.45) {
        const incoming = this.scaleIncomingDamage(projectile.damage);
        const eliminated = this.debugGodMode ? false : this.player.applyDamage(incoming);
        this.showPlayerDamage(projectile.mesh.position);
        this.pushEvent(this.debugGodMode ? `-${incoming} HP (GOD BLOCKED)` : `-${incoming} HP`);
        if (eliminated) this.pushEvent("PLAYER DEAD");
        hit = true;
      }
      if (hit || projectile.life <= 0) {
        projectile.mesh.dispose();
        this.projectiles.splice(index, 1);
      }
    }
  }

  private switchWeapon(slot: number) {
    const id = (["assault", "smg", "shotgun"] as const)[slot - 1];
    if (!id || !this.weaponSystem.has(id)) {
      this.pushEvent(`SLOT ${slot}: 未取得`);
      return;
    }
    this.weaponSystem.equip(id);
    this.player.setWeaponVisible(true);
    this.player.setWeaponStyle(id);
    this.announcement = `${this.weaponSystem.definition()?.name ?? id} 装備`;
    this.pushEvent(this.announcement);
  }

  private pickupNearest() {
    const pickup = this.nearbyPickup;
    if (!pickup || pickup.collected) {
      this.pushEvent("拾得範囲にアイテムなし");
      return;
    }
    pickup.collected = true;
    pickup.root.setEnabled(false);
    if (pickup.type === "key") {
      this.dungeonKey = true;
      this.playDungeonCue("key");
      this.dungeonObjective = "カギを手に入れた！ 次の部屋へ進もう！";
      this.announcement = "カギを手に入れた！";
    } else if (pickup.type === "rune") {
      this.explorationTokens += 1;
      const remaining = Math.max(0, this.explorationGoal - this.explorationTokens);
      this.playDungeonCue("key");
      if (remaining === 0) {
        this.dungeonKey = true;
        this.dungeonObjective = "しるしがそろった！ 次の部屋へ進もう！";
        this.announcement = `${this.explorationLabel} がそろった！`;
      } else {
        this.dungeonObjective = `${this.explorationLabel} をあと ${remaining}こ見つけよう！`;
        this.announcement = `${pickup.label} を見つけた！`;
      }
    } else if (pickup.type === "chest") {
      this.announcement = this.isCaveDungeon ? "洞窟の宝箱をあけた！ コイン +50" : this.isForestDungeon ? "森の報酬を手に入れた！" : "コイン ×100　回復　弾薬";
      this.playDungeonCue("chest");
      this.pushEvent(this.announcement);
      this.finish("victory");
    } else if (pickup.type === "secret") {
      this.forestSecretFound = true;
      this.announcement = "宝箱を見つけた！ コイン +50";
      this.playDungeonCue("chest");
    } else if (pickup.type === "weapon" && pickup.weaponId) {
      this.weaponSystem.equip(pickup.weaponId, 90);
      this.player.setWeaponVisible(true);
      this.player.setWeaponStyle(pickup.weaponId);
      this.announcement = `${pickup.label}をひろった`;
    } else if (pickup.type === "ammo" && pickup.ammoType) {
      this.weaponSystem.addReserve(pickup.amount ?? 30, pickup.ammoType);
      this.announcement = `${pickup.label} +${pickup.amount ?? 30}`;
    } else if (pickup.type === "med") {
      this.medkits = Math.min(3, this.medkits + 1);
      this.announcement = `回復キット ×${this.medkits}`;
    } else {
      this.player.shield = Math.min(100, this.player.shield + 28);
      this.announcement = "シールド +28";
    }
    this.pushEvent(this.announcement);
    this.nearbyPickup = undefined;
  }

  private beginMedkit() {
    if (this.medkits <= 0 || this.medkitTimer > 0 || this.player.hp >= this.playerMaxHp()) {
      this.pushEvent(this.medkits <= 0 ? "回復キットがないよ" : "HPはいっぱいだよ");
      return;
    }
    this.medkits -= 1;
    this.medkitTimer = MEDKIT_USE_TIME;
    this.announcement = "回復中…";
    this.pushEvent("回復をはじめたよ");
    window.setTimeout(() => {
      if (this.medkitTimer <= 0 && this.player.alive) {
        const healAmount = this.isEasyMode ? 220 : MEDKIT_HEAL;
        this.player.hp = Math.min(this.playerMaxHp(), this.player.hp + healAmount);
        this.pushEvent(`+${healAmount} HP`);
      }
    }, MEDKIT_USE_TIME * 1000);
  }

  private updatePickups(delta: number) {
    let nearest: Pickup | undefined;
    let nearestDistance = PICKUP_RANGE * PICKUP_RANGE;
    this.pickups.forEach((pickup) => {
      if (pickup.collected) return;
      pickup.root.position.y = 0.78 + Math.sin(this.elapsed * 2.6 + pickup.root.position.x) * 0.12;
      pickup.root.rotation.y += delta * 0.8;
      const distance = Vector3.DistanceSquared(this.player.root.position, pickup.root.position);
      if (distance <= nearestDistance) {
        nearest = pickup;
        nearestDistance = distance;
      }
    });
    this.nearbyPickup = nearest;
    if (nearest && !this.isCaveDungeon) this.showTutorial("pickup", "近づくと自動でひろうよ！", "move");
    const medkitButton = document.querySelector<HTMLButtonElement>('[data-touch-action="medkit"]');
    if (medkitButton) medkitButton.disabled = this.medkits <= 0 || this.medkitTimer > 0;
    if (nearest) {
      // STEP 4 uses proximity pickup: the closest item is consumed as soon as
      // the player enters the detection radius. pickupNearest() owns all
      // inventory, weapon visibility, HUD, and ground-removal updates.
      this.pickupNearest();
      return;
    }
    this.announcement = this.medkitTimer > 0 ? "回復中…" : "近くのアイテムを探そう";
  }

  private updateCamera(delta: number) {
    this.cameraController.update(delta, this.player.root.position, this.currentAiming, this.currentCrouching, this.lastMotionState === "RUN");
  }

  private updateCameraLegacy(delta: number) {
    const aiming = this.currentAiming;
    const crouching = this.currentCrouching;
    this.pitch = Math.max(-0.72, Math.min(0.28, this.pitch));
    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const shoulder = new Vector3(Math.cos(this.yaw) * (aiming ? 0.82 : 1.25), 0, -Math.sin(this.yaw) * (aiming ? 0.82 : 1.25));
    const target = this.player.root.position.add(new Vector3(0, crouching ? 1.0 : 1.42, 0));
    const distance = aiming ? 4.65 : 7.2;
    const desired = target.subtract(forward.scale(distance)).add(new Vector3(0, (aiming ? 2.65 : 3.5) + this.pitch * 2.2, 0)).add(shoulder);
    let safePosition = desired.clone();
    const segment = desired.subtract(target);
    this.obstacles.forEach((obstacle) => {
      const toObstacle = obstacle.position.subtract(target);
      const denominator = Math.max(0.001, segment.lengthSquared());
      const t = Math.max(0, Math.min(1, Vector3.Dot(toObstacle, segment) / denominator));
      const closest = target.add(segment.scale(t));
      const clearance = obstacle.radius + 0.62;
      if (Vector3.DistanceSquared(closest, obstacle.position) < clearance * clearance) {
        const away = closest.subtract(obstacle.position);
        safePosition = obstacle.position.add((away.lengthSquared() > 0.01 ? away.normalize() : forward.scale(-1)).scale(clearance));
        safePosition.y = Math.max(target.y + 0.35, safePosition.y);
      }
    });
    this.camera.position = Vector3.Lerp(this.camera.position, safePosition, 1 - Math.exp(-delta * 18));
    this.camera.setTarget(target.add(forward.scale(aiming ? 6 : 8)).add(new Vector3(0, this.pitch * 4, 0)));
  }

  private checkEndState() {
    if (!this.player.alive) this.finish("defeat");
    else if (this.options.step !== "step5" && this.rivals.length > 0 && this.rivals.every((rival) => !rival.alive)) this.finish("victory");
  }

  private showPlayerDamage(hitPosition: Vector3) {
    const hud = document.getElementById("hud");
    const direction = hitPosition.subtract(this.player.root.position);
    const angle = Math.atan2(direction.x, direction.z) * 180 / Math.PI;
    if (hud) {
      hud.classList.add("damage-flash");
      hud.style.setProperty("--hit-direction", `${angle}deg`);
      window.setTimeout(() => hud.classList.remove("damage-flash"), 160);
    }
    this.cameraController.addRecoil(0.028);
  }

  private finish(outcome: MatchOutcome) {
    if (this.resultSent) return;
    this.resultSent = true;
    this.mode = outcome;
    if (this.options.step === "step5") {
      const time = Math.max(0, Math.floor((performance.now() - this.dungeonStartedAt) / 1000));
      const timeElement = document.getElementById("result-time");
      const elimsElement = document.getElementById("result-elims");
      if (timeElement) timeElement.textContent = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
      if (elimsElement) elimsElement.textContent = String(this.elims);
    }
          if (outcome === "victory" && this.options.step === "step5") this.playDungeonCue("victory");
      const summary = outcome === "victory" && this.options.step === "step5"
        ? { dungeonId: this.options.dungeonId, baseReward: DUNGEON_CONFIGS[this.options.dungeonId].clearReward, bonusReward: this.isCaveDungeon ? 50 : this.isForestDungeon && this.forestSecretFound ? 50 : 0 }
        : undefined;
      this.options.onResult(outcome, summary);

  }

  private demoInput(): InputSnapshot {
    const rival = this.rivals.filter((candidate) => candidate.alive).sort((a, b) => Vector3.DistanceSquared(a.root.position, this.player.root.position) - Vector3.DistanceSquared(b.root.position, this.player.root.position))[0];
    const training = this.trainingTargets.filter((candidate) => candidate.alive).sort((a, b) => Vector3.DistanceSquared(a.root.position, this.player.root.position) - Vector3.DistanceSquared(b.root.position, this.player.root.position))[0];
    if (rival) {
      const toRival = rival.root.position.subtract(this.player.root.position);
      this.yaw = Math.atan2(toRival.x, toRival.z);
    } else {
      this.yaw = Math.PI;
    }
    this.cameraController.setYaw(this.yaw);
    const forestAdvance = this.isForestDungeon && !rival && this.dungeonArea < 6;
    const caveAdvance = this.isCaveDungeon && !rival && this.dungeonArea < 7;
    const advancing = forestAdvance || caveAdvance;
    const forestLeftFork = forestAdvance && this.dungeonArea === 2 && !this.forestRoute;
    return { forward: advancing ? 1 : 0, right: forestLeftFork ? 0.55 : 0, jump: false, sprint: advancing, crouch: false, aiming: true, firing: Boolean(rival || training), reloadPressed: false, pickupPressed: false, slotPressed: null, medkitPressed: false, lookX: 0, lookY: 0 };
  }

  private updateHud(_force = false) {
    const explorationStatus = this.options.step === "step5" && this.explorationGoal > 0 && !this.explorationComplete() ? ` ・ 探索 ${this.explorationTokens}/${this.explorationGoal}` : "";
    const zone = (this.options.step === "step1" ? "STEP 1 // EXPLORE" : this.options.step === "step2" ? "STEP 2 // LIVE FIRE" : this.options.step === "step3" ? "STEP 3 // HOSTILES" : this.options.step === "step4" ? "STEP 4 // SCAVENGE" : this.options.step === "step5" ? `${this.isCaveDungeon ? "洞窟" : this.isForestDungeon ? "森" : "遺跡"} エリア${Math.min(this.isCaveDungeon ? 6 : 5, this.dungeonArea)}` : this.mode === "briefing" ? "嵐を追跡中" : `収束 ${Math.max(0, Math.ceil((this.stormRadius - 25) / 0.43)).toString().padStart(2, "0")}s`) + explorationStatus;
    this.hudController.render({
      hp: this.player.hp,
      maxHp: this.options.step === "step3" || this.options.step === "step4" || this.options.step === "step5" ? this.playerMaxHp() : 100,
      shield: this.player.shield,
      ammo: this.weaponSystem.state.magazine,
      reserve: this.weaponSystem.state.reserve,
      elims: this.elims,
      remaining: this.enemyDirector.remaining() + (this.player.alive ? 1 : 0),
      zone,
      motion: this.playerController.motion,
      aiming: this.playerController.aiming,
      crouching: this.playerController.crouching,
      pickup: this.announcement,
      switchPrompt: this.isCaveDungeon && Boolean(this.nearbyCaveSwitch),
      objective: this.options.step === "step5" ? this.dungeonObjective : undefined,
      bossName: this.isCaveDungeon ? "岩の王 ゴルム" : this.isForestDungeon ? "森のガーディアン" : "ボス",
      bossHp: this.options.step === "step5" && this.boss?.alive ? this.boss.hp : undefined,
      bossMaxHp: this.options.step === "step5" && this.boss?.alive ? this.boss.maxHp : undefined,
      weaponName: this.weaponSystem.definition()?.name ?? "武器なし",
      slots: this.weaponSystem.slots(),
      medkits: this.medkits,
    }, this.player.root.position, this.stormRadius);
    if (this.options.debug) {
      const debug = document.getElementById("playtest-debug");
      if (debug) debug.textContent = `DEBUG PLAYTEST\nダンジョン: ${this.isCaveDungeon ? "くらやみの洞窟" : this.isForestDungeon ? "まよいの森" : "はじまりの遺跡"}\nエリア: ${this.dungeonArea}\nHP: ${Math.ceil(this.player.hp)} / ${this.playerMaxHp()}\n武器: ${this.weaponSystem.definition()?.name ?? "武器なし"}\nコイン: ${this.progression.coins}\n強化: HP${this.progression.hpLevel} / 攻${this.progression.attackLevel} / 装${this.progression.reloadLevel}\nFPS: ${Math.round(this.scene.getEngine().getFps())}`;
    }
  }

  pushEvent(message: string) {
    const feed = document.getElementById("event-feed");
    if (!feed) return;
    const entry = document.createElement("li");
    entry.textContent = message;
    feed.prepend(entry);
    while (feed.childElementCount > 3) feed.lastElementChild?.remove();
  }

  private showHitMarker() {
    const marker = document.getElementById("hit-marker");
    const crosshair = document.querySelector<HTMLElement>(".crosshair");
    if (marker) {
      marker.classList.add("active");
      window.setTimeout(() => marker.classList.remove("active"), 80);
    }
    if (crosshair) {
      crosshair.classList.add("hit");
      window.setTimeout(() => crosshair.classList.remove("hit"), 120);
    }
  }
}
