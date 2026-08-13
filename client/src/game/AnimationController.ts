// Stormfall: Last Horizon — procedural humanoid animation state machine with blended limb phase.
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { MotionState } from "./contracts";

export class AnimationController {
  private time = 0;
  private stride = 0;

  update(delta: number, state: MotionState, limbs: Mesh[], root: TransformNode, baseScale: number) {
    this.time += delta;
    const moving = ["WALK_FORWARD", "WALK_BACKWARD", "STRAFE_LEFT", "STRAFE_RIGHT", "RUN", "CROUCH_WALK"].includes(state);
    const targetStride = moving ? (state === "RUN" ? 0.58 : state === "CROUCH_WALK" ? 0.22 : 0.34) : 0.025;
    this.stride += (targetStride - this.stride) * Math.min(1, delta * 12);
    const speed = state === "RUN" ? 12 : state === "CROUCH_WALK" ? 6.5 : 8;
    const phase = Math.sin(this.time * speed) * this.stride;
    const sideBias = state === "STRAFE_LEFT" ? -0.08 : state === "STRAFE_RIGHT" ? 0.08 : 0;
    const backward = state === "WALK_BACKWARD" ? -1 : 1;
    if (limbs.length >= 4) {
      limbs[0].rotation.x = phase * backward;
      limbs[1].rotation.x = -phase * backward;
      limbs[2].rotation.x = -phase * 0.82 * backward;
      limbs[3].rotation.x = phase * 0.82 * backward;
    }
    const crouched = state === "CROUCH_IDLE" || state === "CROUCH_WALK";
    root.scaling.y += ((crouched ? baseScale * 0.68 : baseScale) - root.scaling.y) * Math.min(1, delta * 14);
    root.rotation.z += ((sideBias + (moving ? Math.sin(this.time * speed) * 0.018 : 0)) - root.rotation.z) * Math.min(1, delta * 10);
    if (state === "JUMP_START") root.rotation.x += (-0.08 - root.rotation.x) * Math.min(1, delta * 12);
    else if (state === "FALL") root.rotation.x += (0.06 - root.rotation.x) * Math.min(1, delta * 8);
    else if (state === "LAND") root.rotation.x += (0 - root.rotation.x) * Math.min(1, delta * 18);
    else root.rotation.x += (0 - root.rotation.x) * Math.min(1, delta * 8);
    if (state === "LAND") root.scaling.y = baseScale * 0.96;
  }
}
