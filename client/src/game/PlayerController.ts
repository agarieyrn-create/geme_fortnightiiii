// Stormfall: Last Horizon — deterministic player motor for the TPS specification.
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { InputSnapshot } from "./InputManager";
import type { MotionState } from "./contracts";
import { CameraController } from "./CameraController";
import { WeaponSystem } from "./WeaponSystem";

type Obstacle = { position: Vector3; radius: number };
type PlayerRig = { root: { position: Vector3; rotation: Vector3 }; velocityY: number; alive: boolean; setMotionState: (state: MotionState) => void; updateVisual: (delta: number) => void };

export class PlayerController {
  private moveVelocity = new Vector3();
  private jumpHeld = false;
  private wasGrounded = true;
  private lastMotion: MotionState = "IDLE";
  aiming = false;
  crouching = false;
  motion: MotionState = "IDLE";

  constructor(readonly rig: PlayerRig, readonly camera: CameraController, readonly weapon: WeaponSystem) {}

  update(delta: number, snapshot: InputSnapshot, obstacles: Obstacle[], resolveObstacles: (position: Vector3, clearance: number) => void, onFire: (origin: Vector3, direction: Vector3) => void, onEvent: (message: string) => void) {
    this.aiming = snapshot.aiming;
    this.crouching = snapshot.crouch && this.rig.root.position.y <= 0.025 && this.rig.velocityY <= 0.2;
    this.camera.look(snapshot.lookX, snapshot.lookY);
    const forward = this.camera.forward();
    const right = new Vector3(forward.z, 0, -forward.x);
    const direction = forward.scale(snapshot.forward).add(right.scale(snapshot.right));
    const grounded = this.rig.root.position.y <= 0.025 && this.rig.velocityY <= 0.2;
    const moving = direction.lengthSquared() > 0.01;
    if (moving) direction.normalize();
    const speed = this.crouching ? 2.65 : snapshot.sprint && !snapshot.aiming ? 9.2 : snapshot.aiming ? 4.1 : 5.4;
    const targetVelocity = moving ? direction.scale(speed) : Vector3.Zero();
    this.moveVelocity = Vector3.Lerp(this.moveVelocity, targetVelocity, 1 - Math.exp(-(grounded ? 15 : 5) * delta));
    this.rig.root.position.addInPlace(this.moveVelocity.scale(delta));
    if (moving || snapshot.aiming) {
      const targetRotation = snapshot.aiming ? this.camera.yaw : Math.atan2(direction.x, direction.z);
      const rotationDelta = Math.atan2(Math.sin(targetRotation - this.rig.root.rotation.y), Math.cos(targetRotation - this.rig.root.rotation.y));
      this.rig.root.rotation.y += rotationDelta * Math.min(1, delta * (snapshot.aiming ? 16 : 11));
    }
    if (snapshot.jump && !this.jumpHeld && grounded && !this.crouching) this.rig.velocityY = 8.1;
    this.jumpHeld = snapshot.jump;
    this.rig.velocityY -= 22 * delta;
    this.rig.root.position.y = Math.max(0, this.rig.root.position.y + this.rig.velocityY * delta);
    const nowGrounded = this.rig.root.position.y <= 0.001;
    if (nowGrounded) this.rig.velocityY = 0;
    this.rig.root.position.x = Math.max(-104, Math.min(104, this.rig.root.position.x));
    this.rig.root.position.z = Math.max(-104, Math.min(104, this.rig.root.position.z));
    resolveObstacles(this.rig.root.position, this.crouching ? 0.56 : 0.84);

    this.weapon.update(delta);
    if (snapshot.reloadPressed) this.weapon.reload();
    const muzzle = this.rig.root.position.add(new Vector3(0, this.crouching ? 0.94 : 1.32, 0)).add(forward.scale(0.8));
    if (snapshot.firing) this.weapon.fire({ origin: muzzle, direction: forward.add(new Vector3(0, this.camera.pitch * 0.42, 0)).normalize(), damage: 25 }, (request) => onFire(request.origin, request.direction));

    this.motion = this.weapon.state.isReloading ? "RELOAD" : !nowGrounded ? (this.rig.velocityY > 0 ? "JUMP" : "FALL") : this.crouching ? (moving ? "CROUCH WALK" : "CROUCH IDLE") : snapshot.aiming ? (snapshot.firing ? "FIRE" : "AIM") : moving ? (snapshot.sprint ? "RUN" : "WALK") : "IDLE";
    this.rig.setMotionState(this.motion);
    if (this.motion !== this.lastMotion) {
      if (this.motion === "JUMP") onEvent("ジャンプ開始");
      if (this.motion === "FALL" && this.wasGrounded) onEvent("空中状態");
      if (this.motion === "IDLE" && !this.wasGrounded) onEvent("着地");
      if (this.motion === "RELOAD") onEvent("パルスライフルを再装填");
      this.lastMotion = this.motion;
    }
    this.wasGrounded = nowGrounded;
    this.rig.updateVisual(delta);
  }
}
