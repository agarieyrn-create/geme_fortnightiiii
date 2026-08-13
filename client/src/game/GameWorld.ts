// Stormfall: Last Horizon design contract — readable arcade-sci-fi combat across warm sandstone, black basalt, and a teal storm ring.
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/standard.fragment";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { InputManager, type InputSnapshot } from "./InputManager";

const TEAL = new Color3(0.075, 0.85, 0.77);
const AMBER = new Color3(1, 0.54, 0.15);
const SAND = new Color3(0.31, 0.12, 0.035);
const BASALT = new Color3(0.12, 0.055, 0.023);
const RUST = new Color3(0.77, 0.16, 0.1);

const CHARACTER_LOADOUTS: Record<string, { suit: Color3; armor: Color3; accent: Color3; cloak: Color3; scale: number }> = {
  kairo: { suit: new Color3(0.14, 0.18, 0.23), armor: new Color3(0.39, 0.29, 0.18), accent: TEAL, cloak: new Color3(0.34, 0.25, 0.15), scale: 1 },
  haze: { suit: new Color3(0.11, 0.16, 0.22), armor: new Color3(0.17, 0.35, 0.4), accent: new Color3(0.06, 0.84, 0.77), cloak: new Color3(0.12, 0.27, 0.34), scale: 0.9 },
  vanta: { suit: new Color3(0.06, 0.08, 0.11), armor: new Color3(0.62, 0.58, 0.5), accent: new Color3(0.1, 0.76, 0.86), cloak: new Color3(0.58, 0.55, 0.48), scale: 1.08 },
  rustjaw: { suit: new Color3(0.11, 0.055, 0.045), armor: new Color3(0.46, 0.075, 0.035), accent: new Color3(0.96, 0.08, 0.04), cloak: new Color3(0.27, 0.04, 0.025), scale: 1.2 },
  veil: { suit: new Color3(0.11, 0.08, 0.14), armor: new Color3(0.3, 0.045, 0.11), accent: new Color3(0.95, 0.1, 0.08), cloak: new Color3(0.25, 0.02, 0.08), scale: 0.86 },
  anker: { suit: new Color3(0.1, 0.09, 0.08), armor: new Color3(0.56, 0.18, 0.04), accent: new Color3(0.97, 0.14, 0.04), cloak: new Color3(0.39, 0.105, 0.02), scale: 1.24 },
};

const CHARACTER_RENDERS: Record<string, string> = {
  kairo: "/manus-storage/stormfall-player-anchor_21f4d359.png",
  haze: "/manus-storage/stormfall-haze-final_4236e3e5.png",
  vanta: "/manus-storage/stormfall-vanta-final_dc45be78.png",
  rustjaw: "/manus-storage/stormfall-rustjaw-final_97dfa9cd.png",
  veil: "/manus-storage/stormfall-veil-final_829eb401.png",
  anker: "/manus-storage/stormfall-anker-final_a22065d6.png",
};

export type MatchOutcome = "victory" | "defeat";
export type WorldOptions = { demo: boolean; onResult: (outcome: MatchOutcome) => void };

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

type Obstacle = { position: Vector3; radius: number };

class Combatant {
  readonly root: TransformNode;
  readonly body: Mesh;
  readonly halo: Mesh;
  private portrait?: Mesh;
  private portraitMaterial?: StandardMaterial;
  private readonly bodyMaterial: StandardMaterial;
  private readonly armorMaterial: StandardMaterial;
  private readonly accentMaterial: StandardMaterial;
  private readonly cloakMaterial: StandardMaterial;
  private readonly limbs: Mesh[] = [];
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
    this.root.position.copyFrom(position);
    this.body = MeshBuilder.CreateCapsule(`${id}-body`, { height: 1.18, radius: 0.32, tessellation: 12 }, scene);
    this.body.parent = this.root;
    this.body.position.y = 1.28;
    this.bodyMaterial = new StandardMaterial(`${id}-mat`, scene);
    this.bodyMaterial.diffuseColor = color;
    this.bodyMaterial.specularColor = new Color3(0.08, 0.08, 0.08);
    this.body.material = this.bodyMaterial;
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

    const chest = MeshBuilder.CreateBox(`${id}-chest`, { width: 0.72, height: 0.5, depth: 0.4 }, scene);
    chest.parent = this.root;
    chest.position.y = 1.37;
    chest.position.z = -0.28;
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
    this.addArmorPart("boot-l", -0.21, 0.09, -0.08, 0.28, 0.2, 0.43, this.armorMaterial);
    this.addArmorPart("boot-r", 0.21, 0.09, -0.08, 0.28, 0.2, 0.43, this.armorMaterial);
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

  setPortrait(renderId: string) {
    const url = CHARACTER_RENDERS[renderId];
    if (!url) return;
    if (!this.portrait) {
      this.portrait = MeshBuilder.CreatePlane(`${this.id}-portrait`, { width: 1.45, height: 2.38, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
      this.portrait.parent = this.root;
      this.portrait.position.y = 1.72;
      this.portrait.scaling.y = -1;
      this.portrait.billboardMode = Mesh.BILLBOARDMODE_ALL;
      this.portrait.setEnabled(false);
      this.portraitMaterial = new StandardMaterial(`${this.id}-portrait-mat`, this.scene);
      this.portraitMaterial.backFaceCulling = false;
      this.portraitMaterial.useAlphaFromDiffuseTexture = true;
      this.portraitMaterial.disableLighting = true;
      this.portraitMaterial.emissiveColor = new Color3(0.88, 0.94, 0.96);
      this.portrait.material = this.portraitMaterial;
    }
    const texture = new Texture(url, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE, undefined, () => {
      this.portrait?.setEnabled(false);
      this.root.getChildMeshes().forEach((mesh) => {
        if (mesh !== this.portrait) mesh.setEnabled(true);
      });
    });
    texture.hasAlpha = true;
    texture.onLoadObservable.addOnce(() => {
      this.root.getChildMeshes().forEach((mesh) => {
        if (mesh !== this.portrait) mesh.setEnabled(false);
      });
      this.portrait?.setEnabled(true);
    });
    this.portraitMaterial!.diffuseTexture = texture;
    this.portraitMaterial!.opacityTexture = texture;
  }

  applyDamage(amount: number) {
    let remaining = amount;
    if (this.shield > 0) {
      const shieldLoss = Math.min(this.shield, remaining);
      this.shield -= shieldLoss;
      remaining -= shieldLoss;
    }
    this.hp = Math.max(0, this.hp - remaining);
    this.flash = 0.24;
    if (this.hp <= 0) {
      this.alive = false;
      this.root.setEnabled(false);
    }
    return !this.alive;
  }

  updateVisual(delta: number) {
    this.flash = Math.max(0, this.flash - delta);
    this.poseTime += delta;
    this.halo.scaling.setAll(1 + Math.sin(performance.now() * 0.005) * 0.035);
    this.bodyMaterial.emissiveColor = this.flash > 0 ? new Color3(0.9, 0.9, 0.9) : Color3.Black();
    const moving = this.motionState.includes("WALK") || this.motionState === "RUN" || this.motionState === "CROUCH WALK";
    const stride = Math.sin(this.poseTime * (this.motionState === "RUN" ? 12 : 8)) * (moving ? (this.motionState === "RUN" ? 0.58 : 0.34) : 0.025);
    if (this.limbs.length >= 4) {
      this.limbs[0].rotation.x = stride;
      this.limbs[1].rotation.x = -stride;
      this.limbs[2].rotation.x = -stride * 0.82;
      this.limbs[3].rotation.x = stride * 0.82;
    }
    if (this.motionState === "CROUCH IDLE" || this.motionState === "CROUCH WALK") {
      this.root.scaling.y = this.baseScale * 0.68;
    } else if (!this.motionState.includes("JUMP") && this.motionState !== "FALL") {
      this.root.scaling.y = this.baseScale;
    }
  }

  dispose() {
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
  }

  private addArmorPart(name: string, x: number, y: number, z: number, width: number, height: number, depth: number, material: StandardMaterial) {
    const part = MeshBuilder.CreateBox(`${this.id}-${name}`, { width, height, depth }, this.scene);
    part.parent = this.root;
    part.position.set(x, y, z);
    part.material = material;
  }

  private createWeapon() {
    const weapon = new TransformNode(`${this.id}-weapon`, this.scene);
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
  private fireCooldown = 0.8 + Math.random();
  private sway = Math.random() * Math.PI * 2;

  constructor(scene: Scene, id: string, position: Vector3) {
    super(scene, id, new Color3(0.28, 0.12, 0.1), position, true);
  }

  update(delta: number, world: GameWorld) {
    if (!this.alive) return;
    this.fireCooldown -= delta;
    const player = world.player;
    const toPlayer = player.root.position.subtract(this.root.position);
    const distance = toPlayer.length();
    const outsideStorm = this.root.position.length() > world.stormRadius - 4;
    const desired = outsideStorm
      ? this.root.position.scale(-1).normalize()
      : distance > 17
        ? toPlayer.normalize()
        : new Vector3(-toPlayer.z, 0, toPlayer.x).normalize().scale(Math.sin(world.elapsed * 1.7 + this.sway));
    const speed = outsideStorm ? 8.4 : distance > 17 ? 5.1 : 3.1;
    this.root.position.addInPlace(desired.scale(speed * delta));
    world.resolveObstacles(this.root.position, 0.72);
    this.root.position.x = Math.max(-104, Math.min(104, this.root.position.x));
    this.root.position.z = Math.max(-104, Math.min(104, this.root.position.z));
    this.root.rotation.y = Math.atan2(desired.x, desired.z);
    if (distance < 35 && this.fireCooldown <= 0 && player.alive) {
      const direction = toPlayer.normalize();
      world.spawnProjectile(this.root.position.add(new Vector3(0, 1.35, 0)).add(direction.scale(0.8)), direction, "rival", 13);
      this.fireCooldown = 1.05 + Math.random() * 0.7;
    }
    if (this.root.position.length() > world.stormRadius) this.applyDamage(delta * 5.2);
    this.updateVisual(delta);
  }
}

export class GameWorld {
  readonly player: Combatant;
  readonly rivals: Rival[] = [];
  readonly input: InputManager;
  readonly camera: UniversalCamera;
  readonly obstacles: Obstacle[] = [];
  readonly projectiles: Projectile[] = [];
  readonly pickups: Pickup[] = [];
  private readonly stormRing: Mesh;
  private readonly stormCore: Mesh;
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
  reserve = 90;
  elims = 0;
  private reloadTimer = 0;
  private moveVelocity = new Vector3();
  private wasGrounded = true;
  private lastMotionState = "IDLE";
  private currentAiming = false;
  private currentCrouching = false;

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
    this.player = new Combatant(scene, "ranger", new Color3(0.34, 0.28, 0.19), new Vector3(0, 0, 36));
    this.player.applyLoadout("kairo");
    this.player.setPortrait("kairo");
    this.player.shield = 65;
    this.createRivals();
    this.createPickups();
    this.stormRing = this.createStormRing();
    this.stormCore = this.createStormCore();

    this.camera = new UniversalCamera("ranger-camera", new Vector3(0, 5, 43), scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 500;
    this.camera.fov = 0.94;
    scene.activeCamera = this.camera;
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
    this.player.setPortrait(avatarId);
    this.announcement = `${avatarId.toUpperCase()} の降下準備完了`;
  }

  update(delta: number) {
    if (this.mode === "playing") {
      this.elapsed += delta;
      this.updateStorm(delta);
      this.updatePlayer(delta);
      this.rivals.forEach((rival) => rival.update(delta, this));
      this.updateProjectiles(delta);
      this.updatePickups(delta);
      this.checkEndState();
    }
    this.updateCamera(delta);
    this.uiTick -= delta;
    if (this.uiTick <= 0) {
      this.updateHud();
      this.uiTick = 0.1;
    }
  }

  spawnProjectile(origin: Vector3, direction: Vector3, owner: "player" | "rival", damage: number) {
    const mesh = MeshBuilder.CreateSphere(`${owner}-pulse`, { diameter: owner === "player" ? 0.18 : 0.14, segments: 8 }, this.scene);
    mesh.position.copyFrom(origin);
    const material = new StandardMaterial(`${owner}-pulse-mat`, this.scene);
    material.emissiveColor = owner === "player" ? TEAL : AMBER;
    material.disableLighting = true;
    mesh.material = material;
    this.projectiles.push({ mesh, velocity: direction.normalize().scale(owner === "player" ? 52 : 38), owner, life: 1.35, damage });
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

  dispose() {
    this.input.dispose();
    this.player.dispose();
    this.rivals.forEach((rival) => rival.dispose());
    this.pickups.forEach((pickup) => pickup.root.dispose(false, true));
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
    this.obstacles.push({ position: new Vector3(x, 0, z), radius: radius * 0.62 });
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
    this.obstacles.push({ position: new Vector3(x, 0, z), radius: 2 });
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

  private createRivals() {
    [new Vector3(-26, 0, 18), new Vector3(29, 0, 10), new Vector3(-10, 0, -34), new Vector3(37, 0, -39)].forEach((position, index) => {
      const rival = new Rival(this.scene, `rival-${index + 1}`, position);
      const loadout = ["rustjaw", "veil", "anker", "rustjaw"][index];
      rival.applyLoadout(loadout);
      rival.setPortrait(loadout);
      rival.shield = 35 + index * 4;
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
        const target = this.rivals.find((rival) => rival.alive && Vector3.DistanceSquared(projectile.mesh.position, rival.root.position.add(new Vector3(0, 1, 0))) < 1.6);
        if (target) {
          const eliminated = target.applyDamage(projectile.damage);
          this.showHitMarker();
          if (eliminated) {
            this.elims += 1;
            this.pushEvent(`${target.id.toUpperCase()} を排除`);
          }
          hit = true;
        }
      } else if (this.player.alive && Vector3.DistanceSquared(projectile.mesh.position, this.player.root.position.add(new Vector3(0, 1, 0))) < 1.45) {
        const eliminated = this.player.applyDamage(projectile.damage);
        if (eliminated) this.pushEvent("ライバルのパルスを受けた");
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
          this.reserve = Math.min(180, this.reserve + 24);
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
    else if (this.rivals.every((rival) => !rival.alive)) this.finish("victory");
  }

  private finish(outcome: MatchOutcome) {
    if (this.resultSent) return;
    this.resultSent = true;
    this.mode = outcome;
    this.options.onResult(outcome);
  }

  private demoInput(): InputSnapshot {
    const closest = this.rivals.filter((rival) => rival.alive).sort((a, b) => Vector3.DistanceSquared(a.root.position, this.player.root.position) - Vector3.DistanceSquared(b.root.position, this.player.root.position))[0];
    if (closest) {
      const direction = closest.root.position.subtract(this.player.root.position);
      this.yaw = Math.atan2(direction.x, direction.z);
    } else {
      this.yaw += 0.2;
    }
    const radius = this.player.root.position.length();
    return { forward: radius > this.stormRadius - 9 ? -1 : 0.75, right: Math.sin(this.elapsed * 0.9) * 0.55, jump: false, sprint: false, crouch: false, aiming: false, firing: Boolean(closest), reloadPressed: false, lookX: 0, lookY: 0 };
  }

  private updateHud(force = false) {
    const setText = (id: string, text: string) => {
      const element = document.getElementById(id);
      if (element && (force || element.textContent !== text)) element.textContent = text;
    };
    const setWidth = (id: string, value: number) => {
      const element = document.getElementById(id) as HTMLElement | null;
      if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
    };
    setText("health-value", Math.ceil(this.player.hp).toString());
    setText("shield-value", Math.ceil(this.player.shield).toString());
    setText("ammo-value", this.ammo.toString());
    setText("reserve-value", this.reserve.toString());
    setText("elims-value", this.elims.toString());
    setText("remaining-count", (this.rivals.filter((rival) => rival.alive).length + (this.player.alive ? 1 : 0)).toString());
    setText("storm-timer", this.mode === "briefing" ? "嵐を追跡中" : `収束 ${Math.max(0, Math.ceil((this.stormRadius - 25) / 0.43)).toString().padStart(2, "0")}s`);
    setText("zone-status", this.player.root.position.length() > this.stormRadius ? "BREACH" : "STABLE");
    setText("pickup-status", this.announcement);
    setText("motion-state", this.lastMotionState);
    setText("crouch-state", this.currentCrouching ? "CROUCH" : "STAND");
    setText("aim-status", this.currentAiming ? "AIM" : "HIP");
    setWidth("health-fill", this.player.hp);
    setWidth("shield-fill", this.player.shield);
    const miniPlayer = document.getElementById("mini-player") as HTMLElement | null;
    if (miniPlayer) {
      miniPlayer.style.left = `${50 + (this.player.root.position.x / 220) * 90}%`;
      miniPlayer.style.top = `${50 + (this.player.root.position.z / 220) * 90}%`;
    }
    const safe = document.getElementById("mini-safe") as HTMLElement | null;
    if (safe) {
      const diameter = Math.max(20, Math.min(90, (this.stormRadius / 110) * 88));
      safe.style.width = `${diameter}%`;
      safe.style.height = `${diameter}%`;
    }
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
    if (!marker) return;
    marker.classList.add("active");
    window.setTimeout(() => marker.classList.remove("active"), 80);
  }
}
