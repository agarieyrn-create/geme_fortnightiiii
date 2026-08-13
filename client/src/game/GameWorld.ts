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
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { InputManager, type InputSnapshot } from "./InputManager";

const TEAL = new Color3(0.075, 0.85, 0.77);
const AMBER = new Color3(1, 0.54, 0.15);
const SAND = new Color3(0.31, 0.12, 0.035);
const BASALT = new Color3(0.06, 0.085, 0.115);
const RUST = new Color3(0.77, 0.16, 0.1);

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
    this.body = MeshBuilder.CreateCapsule(`${id}-body`, { height: 2.25, radius: 0.43, tessellation: 10 }, scene);
    this.body.parent = this.root;
    this.body.position.y = 1.1;
    const bodyMat = new StandardMaterial(`${id}-mat`, scene);
    bodyMat.diffuseColor = color;
    bodyMat.specularColor = new Color3(0.08, 0.08, 0.08);
    this.body.material = bodyMat;

    const chest = MeshBuilder.CreateBox(`${id}-chest`, { width: 0.76, height: 0.48, depth: 0.46 }, scene);
    chest.parent = this.root;
    chest.position.y = 1.2;
    chest.position.z = -0.34;
    const chestMat = new StandardMaterial(`${id}-chest-mat`, scene);
    chestMat.diffuseColor = enemy ? RUST : TEAL;
    chestMat.emissiveColor = enemy ? RUST.scale(0.22) : TEAL.scale(0.22);
    chest.material = chestMat;

    const visor = MeshBuilder.CreateSphere(`${id}-visor`, { diameter: 0.34, segments: 10 }, scene);
    visor.parent = this.root;
    visor.position.y = 1.76;
    visor.position.z = -0.39;
    const visorMat = new StandardMaterial(`${id}-visor-mat`, scene);
    visorMat.emissiveColor = enemy ? new Color3(1, 0.12, 0.06) : TEAL;
    visorMat.disableLighting = true;
    visor.material = visorMat;

    this.halo = MeshBuilder.CreateTorus(`${id}-halo`, { diameter: 1.06, thickness: 0.035, tessellation: 28 }, scene);
    this.halo.parent = this.root;
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = 0.08;
    const haloMat = new StandardMaterial(`${id}-halo-mat`, scene);
    haloMat.emissiveColor = enemy ? RUST : TEAL;
    haloMat.alpha = 0.68;
    haloMat.disableLighting = true;
    this.halo.material = haloMat;
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
    this.halo.scaling.setAll(1 + Math.sin(performance.now() * 0.005) * 0.035);
    const material = this.body.material as StandardMaterial;
    material.emissiveColor = this.flash > 0 ? new Color3(0.9, 0.9, 0.9) : Color3.Black();
  }

  dispose() {
    this.root.dispose(false, true);
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

  constructor(readonly scene: Scene, readonly canvas: HTMLCanvasElement, readonly options: WorldOptions) {
    scene.clearColor = new Color4(0.018, 0.048, 0.11, 1);
    scene.ambientColor = new Color3(0.14, 0.18, 0.25);
    new HemisphericLight("sky-hemisphere", new Vector3(0.15, 1, 0.1), scene).intensity = 0.88;
    const sun = new DirectionalLight("low-sun", new Vector3(-0.36, -0.72, 0.38), scene);
    sun.position = new Vector3(42, 72, -35);
    sun.intensity = 1.05;

    this.terrainMaterial = new StandardMaterial("sandstone-terrain", scene);
    this.terrainMaterial.diffuseColor = SAND;
    this.terrainMaterial.specularColor = new Color3(0.04, 0.035, 0.025);
    this.terrainMaterial.emissiveColor = new Color3(0.014, 0.004, 0.001);
    this.buildEnvironment();

    this.input = new InputManager(canvas);
    this.player = new Combatant(scene, "ranger", new Color3(0.34, 0.28, 0.19), new Vector3(0, 0, 36));
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
    const boulder = MeshBuilder.CreateSphere(`basalt-${index}`, { diameter: size, segments: 9 }, this.scene);
    boulder.position.set(x, size * 0.36, z);
    boulder.scaling.set(1.25, 0.72, 0.84);
    boulder.rotation.set(index * 0.29, index * 0.77, index * 0.13);
    const material = new StandardMaterial(`basalt-mat-${index}`, this.scene);
    material.diffuseColor = BASALT.add(new Color3(index * 0.006, 0.008, 0.012));
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

  private createRivals() {
    [new Vector3(-26, 0, 18), new Vector3(29, 0, 10), new Vector3(-10, 0, -34), new Vector3(37, 0, -39)].forEach((position, index) => {
      const rival = new Rival(this.scene, `rival-${index + 1}`, position);
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
    this.yaw -= snapshot.lookX * 0.0023;
    this.pitch = Math.max(-0.72, Math.min(0.28, this.pitch - snapshot.lookY * 0.00185));
    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(forward.z, 0, -forward.x);
    const direction = forward.scale(snapshot.forward).add(right.scale(snapshot.right));
    if (direction.lengthSquared() > 0.01) {
      direction.normalize();
      const speed = snapshot.sprint ? 9.2 : 5.4;
      this.player.root.position.addInPlace(direction.scale(speed * delta));
      this.player.root.rotation.y = Math.atan2(direction.x, direction.z);
    }
    if (snapshot.jump && !this.jumpHeld && this.player.root.position.y <= 0.01) this.player.velocityY = 8.1;
    this.jumpHeld = snapshot.jump;
    this.player.velocityY -= 22 * delta;
    this.player.root.position.y = Math.max(0, this.player.root.position.y + this.player.velocityY * delta);
    if (this.player.root.position.y <= 0) this.player.velocityY = 0;
    this.player.root.position.x = Math.max(-104, Math.min(104, this.player.root.position.x));
    this.player.root.position.z = Math.max(-104, Math.min(104, this.player.root.position.z));
    this.resolveObstacles(this.player.root.position, 0.84);
    this.player.updateVisual(delta);

    this.fireCooldown -= delta;
    if (snapshot.firing && this.fireCooldown <= 0 && this.ammo > 0) {
      const muzzle = this.player.root.position.add(new Vector3(0, 1.32, 0)).add(forward.scale(0.8));
      const aim = forward.add(new Vector3(0, this.pitch * 0.42, 0)).normalize();
      this.spawnProjectile(muzzle, aim, "player", 25);
      this.fireCooldown = 0.145;
      this.ammo -= 1;
    }
    if (this.ammo <= 0 && this.reserve > 0 && this.fireCooldown <= -0.4) {
      const refill = Math.min(30, this.reserve);
      this.reserve -= refill;
      this.ammo = refill;
      this.fireCooldown = 0.7;
      this.pushEvent("パルスライフルを再装填");
    }
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

  private updateCamera(_delta: number) {
    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const shoulder = new Vector3(Math.cos(this.yaw) * 1.25, 0, -Math.sin(this.yaw) * 1.25);
    const target = this.player.root.position.add(new Vector3(0, 1.42, 0));
    const desired = target.subtract(forward.scale(7.2)).add(new Vector3(0, 3.5 + this.pitch * 2.2, 0)).add(shoulder);
    this.camera.position.copyFrom(desired);
    this.camera.setTarget(target.add(forward.scale(8)).add(new Vector3(0, this.pitch * 4, 0)));
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
    return { forward: radius > this.stormRadius - 9 ? -1 : 0.75, right: Math.sin(this.elapsed * 0.9) * 0.55, jump: false, sprint: false, firing: Boolean(closest), lookX: 0, lookY: 0 };
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
