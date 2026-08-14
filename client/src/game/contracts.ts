// Stormfall: Last Horizon — shared contracts for the rebuilt TPS runtime.
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type MotionState = "IDLE" | "WALK_FORWARD" | "WALK_BACKWARD" | "STRAFE_LEFT" | "STRAFE_RIGHT" | "RUN" | "JUMP_START" | "JUMP_LOOP" | "FALL" | "LAND" | "CROUCH_IDLE" | "CROUCH_WALK" | "AIM" | "FIRE" | "RELOAD";
export type EnemyState = "IDLE" | "PATROL" | "ALERT" | "CHASE" | "ATTACK" | "DEAD";
export type WeaponState = { magazine: number; reserve: number; cooldown: number; reloadTimer: number; isReloading: boolean };
export type HealthState = { hp: number; shield: number; alive: boolean };
export type PlayerState = { position: Vector3; velocity: Vector3; verticalVelocity: number; grounded: boolean; crouching: boolean; aiming: boolean; motion: MotionState; health: HealthState };
export type HudSnapshot = { hp: number; shield: number; ammo: number; reserve: number; remaining: number; elims: number; zone: string; motion: MotionState; aiming: boolean; crouching: boolean; pickup: string };

export type FireRequest = { origin: Vector3; direction: Vector3; damage: number };
export type InputSource = { sample: () => import("./InputManager").InputSnapshot; dispose: () => void };
