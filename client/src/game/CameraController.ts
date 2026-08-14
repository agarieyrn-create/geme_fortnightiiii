// Stormfall TPS Visual Layer — shoulder framing, readable aim zoom, and a restrained sprint FOV preserve the existing orbit-control contract.
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

type CameraObstacle = { position: Vector3; radius: number };

export class CameraController {
  yaw = Math.PI;
  pitch = -0.16;
  private readonly forwardVector = new Vector3();
  private recoil = 0;

  constructor(readonly camera: UniversalCamera, private readonly obstacles: CameraObstacle[]) {
    camera.minZ = 0.05;
    camera.maxZ = 500;
    camera.fov = 0.94;
  }

  look(deltaX: number, deltaY: number) {
    this.yaw -= deltaX * 0.0021;
    // Camera-only vertical look: clamp to roughly -60° / +70° so the player body never pitches.
    this.pitch = Math.max(-1.05, Math.min(1.22, this.pitch - deltaY * 0.0017));
  }

  setYaw(nextYaw: number) {
    this.yaw = nextYaw;
  }

  forward() {
    this.forwardVector.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    return this.forwardVector.clone();
  }

  aimDirection() {
    return this.camera.getForwardRay(300).direction.normalize();
  }

  addRecoil(amount = 0.014) {
    this.recoil = Math.min(0.08, this.recoil + amount);
  }

  update(delta: number, targetPosition: Vector3, aiming: boolean, crouching: boolean, running = false) {
    const forward = this.forward();
    const shoulder = new Vector3(Math.cos(this.yaw) * (aiming ? 0.68 : 1.08), 0, -Math.sin(this.yaw) * (aiming ? 0.68 : 1.08));
    this.recoil *= Math.exp(-delta * 18);
    const target = targetPosition.add(new Vector3(0, crouching ? 1.0 : 1.42, 0));
    const distance = aiming ? 4.75 : 6.85;
    const desired = target.subtract(forward.scale(distance)).add(new Vector3(0, (aiming ? 2.35 : 3.3) + this.pitch * 2.2, 0)).add(shoulder);
    let safePosition = desired.clone();
    const segment = desired.subtract(target);
    this.obstacles.forEach((obstacle) => {
      const toObstacle = obstacle.position.subtract(target);
      const t = Math.max(0, Math.min(1, Vector3.Dot(toObstacle, segment) / Math.max(0.001, segment.lengthSquared())));
      const closest = target.add(segment.scale(t));
      const clearance = obstacle.radius + 0.62;
      if (Vector3.DistanceSquared(closest, obstacle.position) < clearance * clearance) {
        const away = closest.subtract(obstacle.position);
        safePosition = obstacle.position.add((away.lengthSquared() > 0.01 ? away.normalize() : forward.scale(-1)).scale(clearance));
        safePosition.y = Math.max(target.y + 0.35, safePosition.y);
      }
    });
    this.camera.position = Vector3.Lerp(this.camera.position, safePosition, 1 - Math.exp(-delta * 10));
    const targetFov = aiming ? 0.78 : running ? 1.01 : 0.92;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, delta * 6.5);
    const pitchLook = (this.pitch - this.recoil) * (aiming ? 4.6 : 4.2);
    this.camera.setTarget(target.add(forward.scale(aiming ? 3.4 : 8.5)).add(new Vector3(0, pitchLook, 0)));
  }
}
