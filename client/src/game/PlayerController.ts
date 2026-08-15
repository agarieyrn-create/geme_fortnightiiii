// Stormfall: Last Horizon — camera-relative humanoid player motor for the player-feel pass.
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { InputSnapshot } from "./InputManager";
import type { MotionState } from "./contracts";
import { CameraController } from "./CameraController";
import { WeaponSystem } from "./WeaponSystem";

type Obstacle = { position: Vector3; radius: number };
type PlayerRig = { root: { position: Vector3; rotation: Vector3 }; velocityY: number; alive: boolean; setMotionState: (state: MotionState) => void; setAiming?: (aiming: boolean) => void; setColliderHeight?: (height: number) => void; updateVisual: (delta: number) => void };

export class PlayerController {
  private moveVelocity = new Vector3();
  private jumpHeld = false;
  private wasGrounded = true;
  private jumpStartTimer = 0;
  private landTimer = 0;
  private lastMotion: MotionState = "IDLE";
  aiming = false;
  crouching = false;
  motion: MotionState = "IDLE";

  constructor(readonly rig: PlayerRig, readonly camera: CameraController, readonly weapon: WeaponSystem) {}

  update(delta: number, snapshot: InputSnapshot, obstacles: Obstacle[], resolveObstacles: (position: Vector3, clearance: number) => void, onFire: (origin: Vector3, direction: Vector3, damage: number) => void, onEvent: (message: string) => void) {
    this.aiming = snapshot.aiming;
    this.rig.setAiming?.(this.aiming);
    const grounded = this.rig.root.position.y <= 0.025 && this.rig.velocityY <= 0.2;
    this.crouching = snapshot.crouch && grounded;
    this.rig.setColliderHeight?.(this.crouching ? 1.55 : 2.4);
    this.camera.look(snapshot.lookX, snapshot.lookY);
    this.camera.applyAutoFocus(delta, this.rig.root.position);

    const forward = this.camera.forward();
    const right = new Vector3(forward.z, 0, -forward.x);
    const direction = forward.scale(snapshot.forward).add(right.scale(snapshot.right));
    const moving = direction.lengthSquared() > 0.01;
    if (moving) direction.normalize();

    const speed = this.crouching ? 2.35 : snapshot.sprint && !snapshot.aiming ? 8.2 : snapshot.aiming ? 4.0 : 4.8;
    const targetVelocity = moving ? direction.scale(speed) : Vector3.Zero();
    const response = grounded ? (moving ? 18 : 22) : 4.5;
    this.moveVelocity = Vector3.Lerp(this.moveVelocity, targetVelocity, 1 - Math.exp(-response * delta));
    this.rig.root.position.addInPlace(this.moveVelocity.scale(delta));

    if (moving) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      const rotationDelta = Math.atan2(Math.sin(targetRotation - this.rig.root.rotation.y), Math.cos(targetRotation - this.rig.root.rotation.y));
      this.rig.root.rotation.y += rotationDelta * Math.min(1, delta * 13);
    }

    if (snapshot.jump && !this.jumpHeld && grounded && !this.crouching) {
      this.rig.velocityY = 7.4;
      this.jumpStartTimer = 0.14;
    }
    this.jumpHeld = snapshot.jump;
    this.jumpStartTimer = Math.max(0, this.jumpStartTimer - delta);
    this.landTimer = Math.max(0, this.landTimer - delta);
    this.rig.velocityY -= 20.5 * delta;
    this.rig.root.position.y = Math.max(0, this.rig.root.position.y + this.rig.velocityY * delta);
    const nowGrounded = this.rig.root.position.y <= 0.001;
    if (nowGrounded) this.rig.velocityY = 0;
    if (!this.wasGrounded && nowGrounded) this.landTimer = 0.14;

    this.rig.root.position.x = Math.max(-104, Math.min(104, this.rig.root.position.x));
    this.rig.root.position.z = Math.max(-104, Math.min(104, this.rig.root.position.z));
    resolveObstacles(this.rig.root.position, this.crouching ? 0.56 : 0.84);

    this.weapon.update(delta);
    if (snapshot.reloadPressed) this.weapon.reload();
    // Align the camera target before taking the firing ray. This keeps a fast mouse
    // sweep and the centre crosshair on the same frame as the hit test.
    const aimDirection = this.camera.syncAimRay(this.rig.root.position, this.aiming, this.crouching);
    const muzzle = this.rig.root.position.add(new Vector3(0, this.crouching ? 0.94 : 1.32, 0)).add(aimDirection.scale(0.8));
    const hasWeapon = this.weapon.definition() !== null;
    if (snapshot.firing && hasWeapon) this.weapon.fire({ origin: muzzle, direction: aimDirection, damage: 25 }, (request) => onFire(request.origin, request.direction, request.damage));

    let nextMotion: MotionState;
    if (this.weapon.state.isReloading) nextMotion = "RELOAD";
    else if (this.landTimer > 0) nextMotion = "LAND";
    else if (!nowGrounded) nextMotion = this.rig.velocityY > 0 ? (this.jumpStartTimer > 0 ? "JUMP_START" : "JUMP_LOOP") : "FALL";
    else if (this.crouching) nextMotion = moving ? "CROUCH_WALK" : "CROUCH_IDLE";
    else if (snapshot.firing && hasWeapon) nextMotion = "FIRE";
    else if (snapshot.aiming && !moving) nextMotion = "AIM";
    else if (snapshot.sprint && moving) nextMotion = "RUN";
    else if (!moving) nextMotion = "IDLE";
    else if (Math.abs(snapshot.forward) >= Math.abs(snapshot.right)) nextMotion = snapshot.forward >= 0 ? "WALK_FORWARD" : "WALK_BACKWARD";
    else nextMotion = snapshot.right >= 0 ? "STRAFE_RIGHT" : "STRAFE_LEFT";

    this.motion = nextMotion;
    this.rig.setMotionState(this.motion);
    if (this.motion !== this.lastMotion) {
      if (this.motion === "JUMP_START") onEvent("ジャンプ開始");
      if (this.motion === "FALL" && this.wasGrounded) onEvent("空中状態");
      if (this.motion === "LAND") onEvent("着地");
      if (this.motion === "RELOAD") onEvent("パルスライフルを再装填");
      this.lastMotion = this.motion;
    }
    this.wasGrounded = nowGrounded;
    this.rig.updateVisual(delta);
  }
}
