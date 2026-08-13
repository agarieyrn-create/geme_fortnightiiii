// Stormfall: Last Horizon — lightweight procedural animation state machine.
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { MotionState } from "./contracts";

export class AnimationController {
  private time = 0;

  update(delta: number, state: MotionState, limbs: Mesh[], root: TransformNode, baseScale: number) {
    this.time += delta;
    const moving = state.includes("WALK") || state === "RUN";
    const stride = Math.sin(this.time * (state === "RUN" ? 12 : 8)) * (moving ? (state === "RUN" ? 0.58 : 0.34) : 0.025);
    if (limbs.length >= 4) {
      limbs[0].rotation.x = stride;
      limbs[1].rotation.x = -stride;
      limbs[2].rotation.x = -stride * 0.82;
      limbs[3].rotation.x = stride * 0.82;
    }
    if (state === "CROUCH IDLE" || state === "CROUCH WALK") root.scaling.y = baseScale * 0.68;
    else if (!state.includes("JUMP") && state !== "FALL") root.scaling.y = baseScale;
    if (state === "LAND") root.scaling.y = baseScale * 1.04;
  }
}
