// Stormfall: Last Horizon design contract — readable arcade-sci-fi combat across warm sandstone, black basalt, and a teal storm ring.
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

const TEAL = new Color3(0.075, 0.85, 0.77);
const AMBER = new Color3(1, 0.54, 0.15);
const SAND = new Color3(0.31, 0.12, 0.035);
const BASALT = new Color3(0.12, 0.055, 0.023);
const RUST = new Color3(0.77, 0.16, 0.1);

const PLAYER_MAX_HP = 300;
const ENEMY_MAX_HP = 100;
const PLAYER_WEAPON_RANGE = 500;
const PLAYER_WEAPON_DAMAGE = 25;
const ENEMY_ATTACK_RANGE = 25;
const ENEMY_ATTACK_DAMAGE = 10;
const ENEMY_ATTACK_INTERVAL = 1.15;

const CHARACTER_LOADOUTS: Record<string, { suit: Color3; armor: Color3; accent: Color3; cloak: Color3; scale: number }> = {
  kairo: { suit: new Color3(0.14, 0.18, 0.23), armor: new Color3(0.39, 0.29, 0.18), accent: TEAL, cloak: new Color3(0.34, 0.25, 0.15), scale: 1 },
  haze: { suit: new Color3(0.11, 0.16, 0.22), armor: new Color3(0.17, 0.35, 0.4), accent: new Color3(0.06, 0.84, 0.77), cloak: new Color3(0.12, 0.27, 0.34), scale: 0.9 },
  vanta: { suit: new Color3(0.06, 0.08, 0.11), armor: new Color3(0.62, 0.58, 0.5), accent: new Color3(0.1, 0.76, 0.86), cloak: new Color3(0.58, 0.55, 0.48), scale: 1.08 },
  rustjaw: { suit: new Color3(0.11, 0.055, 0.045), armor: new Color3(0.46, 0.075, 0.035), accent: new Color3(0.96, 0.08, 0.04), cloak: new Color3(0.27, 0.04, 0.025), scale: 1.2 },
  veil: { suit: new Color3(0.11, 0.08, 0.14), armor: new Color3(0.3, 0.045, 0.11), accent: new Color3(0.95, 0.1, 0.08), cloak: new Color3(0.25, 0.02, 0.08), scale: 0.86 },
  anker: { suit: new Color3(0.1, 0.09, 0.08), armor: new Color3(0.56, 0.18, 0.04), accent: new Color3(0.97, 0.14, 0.04), cloak: new Color3(0.39, 0.105, 0.02), scale: 1.24 },
};

export type MatchOutcome = "victory" | "defeat";
export type WorldOptions = { demo: boolean; step: "step1" | "step2" | "step3" | "full"; onResult: (outcome: MatchOutcome) => void };

type Projectile = {
  mesh: Mesh;
  velocity: Vector3;
  owner: "player" | "rival";
  life: number;
  damage: number;
};

type Pickup = {
  root: TransformNode;
  type: "ammo" | "shield" | "med";
  collected: boolean;
};

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
  private aiming = false;
  private motionState = "IDLE";
  private poseTime = 0;
  private baseScale = 1;
  hp = 100;
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
    context.fillText(`${Math.ceil(this.hp)} / ${ENEMY_MAX_HP}`, 128, 49);
    this.hpTexture.update(false);
  }

  containsPoint(point: Vector3) {
    return this.alive && this.collider.intersectsPoint(point);
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
    const body = MeshBuilder.CreateBox(`${this.id}-weapon-body`, { width: 0.7, height: 0.18, depth: 0.18 }, this.scene);
    body.parent = weapon;
    body.material = this.armorMaterial;
    const barrel = MeshBuilder.CreateCylinder(`${this.id}-weapon-barrel`, { height: 0.52, diameter: 0.08, tessellation: 8 }, this.scene);
    barrel.parent = weapon;
    barrel.rotation.z = Math.PI / 2;
    barrel.position.x = 0.45;
    barrel.material = this.accentMaterial;
  }
}

class Rival extends Combatant {
  aiState: import("./contracts").EnemyState = "IDLE";
  private fireCooldown = 0.65 + Math.random() * 0.35;
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
      if (this.aiState === "ALERT" && this.stateTimer <= 0) this.aiState = distance <= 24 ? "ATTACK" : "CHASE";
      if (this.aiState === "CHASE" && distance <= 24) this.aiState = "ATTACK";
      if (this.aiState === "ATTACK" && distance > 27) this.aiState = "CHASE";
    } else {
      this.lostTimer += delta;
      if ((this.aiState === "CHASE" || this.aiState === "ATTACK" || this.aiState === "ALERT") && (this.lostTimer > 7 || distance > 68)) {
        this.aiState = "PATROL";
        this.stateTimer = 2;
      }
      if (this.aiState === "IDLE" && this.stateTimer <= 0) this.aiState = "PATROL";
    }

    if (this.aiState === "PATROL") this.patrol(delta, world);
    if (this.aiState === "CHASE") this.moveToward(this.lastSeen, 4.5, delta, world);
    if (this.aiState === "ALERT") this.faceToward(this.lastSeen);
    if (this.aiState === "ATTACK") {
      this.faceToward(player.root.position);
      if (visible && distance <= ENEMY_ATTACK_RANGE && this.fireCooldown <= 0) {
        const direction = playerAim.subtract(eye).normalize();
        world.spawnProjectile(eye.add(direction.scale(0.8)), direction, "rival", ENEMY_ATTACK_DAMAGE);
        this.fireCooldown = ENEMY_ATTACK_INTERVAL;
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
  private readonly stormRing?: Mesh;
  private readonly stormCore?: Mesh;
  private readonly terrainMaterial: StandardMaterial;
  private mode: "briefing" | "playing" | MatchOutcome = "briefing";
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

  constructor(readonly scene: Scene, readonly canvas: HTMLCanvasElement, readonly options: WorldOptions) {
    scene.clearColor = new Color4(0.018, 0.048, 0.11, 1);
    scene.ambientColor = new Color3(0.14, 0.18, 0.25);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.035, 0.07, 0.12);
    scene.fogDensity = canvas.clientWidth < 600 ? 0.0042 : 0.0085;
    new HemisphericLight("sky-hemisphere", new Vector3(0.15, 1, 0.1), scene).intensity = 0.88;
    const sun = new DirectionalLight("low-sun", new Vector3(-0.36, -0.72, 0.38), scene);
    sun.position = new Vector3(42, 72, -35);
    sun.intensity = 1.05;

    this.terrainMaterial = new StandardMaterial("sandstone-terrain", scene);
    this.terrainMaterial.diffuseColor = SAND;
    this.terrainMaterial.specularColor = new Color3(0.04, 0.035, 0.025);
    this.terrainMaterial.diffuseTexture = this.createTerrainTexture();
    this.terrainMaterial.emissiveColor = new Color3(0.006, 0.001, 0);
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
    this.player = new Combatant(scene, "ranger", new Color3(0.34, 0.28, 0.19), new Vector3(0, 0, 36));
    this.player.applyLoadout("kairo");
    this.player.hp = options.step === "step3" ? PLAYER_MAX_HP : 100;
    this.player.shield = options.step === "step3" ? 0 : 65;
    if (options.step === "full" || options.step === "step3") {
      this.createRivals();
      if (options.step === "full") {
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
    this.weaponSystem = new WeaponSystem();
    this.playerController = new PlayerController(this.player, this.cameraController, this.weaponSystem);
    this.updateCamera(0);
    this.updateHud(true);
  }

  start() {
    if (this.mode !== "briefing") return;
    this.mode = "playing";
    this.announcement = "裂け目への降下を確認";
    this.pushEvent("エリア RIFT-07 に着地");
  }

  setPlayerAvatar(avatarId: string) {
    if (this.mode !== "briefing") return;
    this.player.applyLoadout(avatarId);
    this.announcement = `${avatarId.toUpperCase()} の降下準備完了`;
  }

  update(delta: number) {
    if (this.mode === "playing") {
      this.elapsed += delta;
      if (this.options.step === "full") this.updateStorm(delta);
      this.updatePlayer(delta);
      if (this.options.step === "full" || this.options.step === "step3") {
        this.enemyDirector.update(delta, this);
        this.updateProjectiles(delta);
        if (this.options.step === "full") this.updatePickups(delta);
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

  private fireAtAimPoint(origin: Vector3, cameraDirection: Vector3) {
    const direction = cameraDirection.normalize();
    const ray = new Ray(this.camera.position, direction, PLAYER_WEAPON_RANGE);
    const pick = this.scene.pickWithRay(ray, (mesh) => Boolean(mesh.metadata?.trainingTargetId || mesh.metadata?.enemyId));
    const aimPoint = pick?.hit && pick.pickedPoint ? pick.pickedPoint.clone() : this.camera.position.add(direction.scale(PLAYER_WEAPON_RANGE));
    const enemyId = pick?.pickedMesh?.metadata?.enemyId as string | undefined;
    const target = enemyId ? this.rivals.find((rival) => rival.id === enemyId && rival.alive) : undefined;
    if (target) {
      const eliminated = target.applyDamage(PLAYER_WEAPON_DAMAGE);
      this.showHitMarker();
      this.pushEvent(`-${PLAYER_WEAPON_DAMAGE} HP`);
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

  private playShotSound() {
    if (typeof window === "undefined") return;
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === "suspended") void this.audioContext.resume();
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(135, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(58, this.audioContext.currentTime + 0.07);
    gain.gain.setValueAtTime(0.035, this.audioContext.currentTime);
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
    this.input.dispose();
    this.touchInput.dispose();
    this.player.dispose();
    this.enemyDirector.dispose();
    this.pickups.forEach((pickup) => pickup.root.dispose(false, true));
    this.trainingTargets.forEach((target) => target.root.dispose(false, true));
    this.projectiles.forEach((projectile) => projectile.mesh.dispose());
  }

  private buildEnvironment() {
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

  private createRivals() {
    const placements = this.options.step === "step3"
      ? [new Vector3(-26, 0, 18), new Vector3(29, 0, 10), new Vector3(-10, 0, -34)]
      : [new Vector3(-26, 0, 18), new Vector3(29, 0, 10), new Vector3(-10, 0, -34), new Vector3(37, 0, -39)];
    placements.forEach((position, index) => {
      const rival = new Rival(this.scene, `rival-${index + 1}`, position);
      const loadout = ["rustjaw", "veil", "anker", "rustjaw"][index];
      rival.applyLoadout(loadout);
      rival.shield = 0;
      rival.hp = ENEMY_MAX_HP;
      this.rivals.push(rival);
    });
  }

  private createPickups() {
    const placements: Array<[number, number, Pickup["type"]]> = [[-4, 23, "ammo"], [16, -4, "shield"], [-31, -23, "med"], [34, 32, "ammo"], [-49, 4, "shield"], [8, -52, "ammo"]];
    placements.forEach(([x, z, type], index) => {
      const root = new TransformNode(`supply-${index}`, this.scene);
      root.position.set(x, 0.8, z);
      const crate = MeshBuilder.CreateBox(`supply-crate-${index}`, { width: 0.9, height: 0.56, depth: 0.9 }, this.scene);
      crate.parent = root;
      const crateMat = new StandardMaterial(`supply-mat-${index}`, this.scene);
      crateMat.diffuseColor = new Color3(0.15, 0.12, 0.09);
      crateMat.emissiveColor = AMBER.scale(0.13);
      crate.material = crateMat;
      const signal = MeshBuilder.CreateSphere(`supply-signal-${index}`, { diameter: 0.38, segments: 8 }, this.scene);
      signal.parent = root;
      signal.position.y = 0.68;
      const signalMat = new StandardMaterial(`supply-glow-${index}`, this.scene);
      signalMat.emissiveColor = type === "shield" ? TEAL : AMBER;
      signalMat.disableLighting = true;
      signal.material = signalMat;
      const ring = MeshBuilder.CreateTorus(`supply-ring-${index}`, { diameter: 1.35, thickness: 0.022, tessellation: 20 }, this.scene);
      ring.parent = root;
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.52;
      ring.material = signalMat;
      this.pickups.push({ root, type, collected: false });
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
      this.currentAiming = false;
      this.currentCrouching = false;
      return;
    }
    const rawSnapshot = this.options.demo ? this.demoInput() : this.touchInput.isActive() ? this.touchInput.snapshot() : this.input.snapshot();
    const snapshot = this.options.step === "step1" ? { ...rawSnapshot, aiming: false, firing: false, reloadPressed: false } : rawSnapshot;
    this.playerController.update(delta, snapshot, this.obstacles, (position, clearance) => this.resolveObstacles(position, clearance), (origin, direction) => this.fireAtAimPoint(origin, direction), (message) => this.pushEvent(message));
    this.currentAiming = this.playerController.aiming;
    this.currentCrouching = this.playerController.crouching;
    this.lastMotionState = this.playerController.motion;
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
          const eliminated = target.applyDamage(projectile.damage);
          this.showHitMarker();
          this.pushEvent(`-${projectile.damage} HP`);
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
        const eliminated = this.debugGodMode ? false : this.player.applyDamage(projectile.damage);
        this.showPlayerDamage(projectile.mesh.position);
        this.pushEvent(this.debugGodMode ? `-${projectile.damage} HP (GOD BLOCKED)` : `-${projectile.damage} HP`);
        if (eliminated) this.pushEvent("PLAYER DEAD");
        hit = true;
      }
      if (hit || projectile.life <= 0) {
        projectile.mesh.dispose();
        this.projectiles.splice(index, 1);
      }
    }
  }

  private updatePickups(delta: number) {
    this.pickups.forEach((pickup) => {
      if (pickup.collected) return;
      pickup.root.position.y = 0.82 + Math.sin(this.elapsed * 2.6 + pickup.root.position.x) * 0.12;
      pickup.root.rotation.y += delta * 0.8;
      if (Vector3.DistanceSquared(this.player.root.position, pickup.root.position) < 5.2) {
        pickup.collected = true;
        pickup.root.setEnabled(false);
        if (pickup.type === "ammo") {
          this.weaponSystem.addReserve(24);
          this.pushEvent("補給物資：パルス弾薬 +24");
        } else if (pickup.type === "shield") {
          this.player.shield = Math.min(100, this.player.shield + 28);
          this.pushEvent("補給物資：シールド +28");
        } else {
          this.player.hp = Math.min(100, this.player.hp + 34);
          this.pushEvent("補給物資：フィールドメッド +34");
        }
      }
    });
  }

  private updateCamera(delta: number) {
    this.cameraController.update(delta, this.player.root.position, this.currentAiming, this.currentCrouching);
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
    else if (this.rivals.length > 0 && this.rivals.every((rival) => !rival.alive)) this.finish("victory");
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
    this.options.onResult(outcome);
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
    return { forward: 0, right: 0, jump: false, sprint: false, crouch: false, aiming: true, firing: Boolean(rival || training), reloadPressed: false, lookX: 0, lookY: 0 };
  }

  private updateHud(_force = false) {
    const zone = this.options.step === "step1" ? "STEP 1 // EXPLORE" : this.options.step === "step2" ? "STEP 2 // LIVE FIRE" : this.options.step === "step3" ? "STEP 3 // HOSTILES" : this.mode === "briefing" ? "嵐を追跡中" : `収束 ${Math.max(0, Math.ceil((this.stormRadius - 25) / 0.43)).toString().padStart(2, "0")}s`;
    this.hudController.render({
      hp: this.player.hp,
      maxHp: this.options.step === "step3" ? PLAYER_MAX_HP : 100,
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
    }, this.player.root.position, this.stormRadius);
  }

  private pushEvent(message: string) {
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
