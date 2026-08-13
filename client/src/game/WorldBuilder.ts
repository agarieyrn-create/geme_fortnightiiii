// Stormfall: Last Horizon — world registry. Geometry creation remains data-driven, while collision metadata belongs here.
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type WorldObstacle = { position: Vector3; radius: number };

export class WorldBuilder {
  readonly obstacles: WorldObstacle[] = [];

  registerObstacle(position: Vector3, radius: number) {
    this.obstacles.push({ position, radius });
  }

  clear() {
    this.obstacles.length = 0;
  }
}
