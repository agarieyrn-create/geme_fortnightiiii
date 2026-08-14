// Stormfall: Last Horizon — DOM-only HUD presenter. It never mutates game state.
import type { HudSnapshot } from "./contracts";

export class HudController {
  render(snapshot: HudSnapshot, playerPosition: { x: number; z: number }, stormRadius: number) {
    const setText = (id: string, text: string) => {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    };
    const setWidth = (id: string, value: number) => {
      const element = document.getElementById(id) as HTMLElement | null;
      if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
    };
    setText("health-value", Math.ceil(snapshot.hp).toString());
    setText("shield-value", Math.ceil(snapshot.shield).toString());
    setText("ammo-value", snapshot.ammo.toString());
    setText("reserve-value", snapshot.reserve.toString());
    setText("elims-value", snapshot.elims.toString());
    setText("remaining-count", snapshot.remaining.toString());
    setText("storm-timer", snapshot.zone);
    setText("zone-status", snapshot.zone === "BREACH" ? "BREACH" : "STABLE");
    setText("pickup-status", snapshot.pickup);
    setText("motion-state", snapshot.motion);
    setText("crouch-state", snapshot.crouching ? "CROUCH" : "STAND");
    setText("aim-status", snapshot.aiming ? "AIM" : "HIP");
    setWidth("health-fill", (snapshot.hp / Math.max(1, snapshot.maxHp)) * 100);
    setWidth("shield-fill", snapshot.shield);
    const miniPlayer = document.getElementById("mini-player") as HTMLElement | null;
    if (miniPlayer) {
      miniPlayer.style.left = `${50 + (playerPosition.x / 220) * 90}%`;
      miniPlayer.style.top = `${50 + (playerPosition.z / 220) * 90}%`;
    }
    const safe = document.getElementById("mini-safe") as HTMLElement | null;
    if (safe) {
      const diameter = Math.max(20, Math.min(90, (stormRadius / 110) * 88));
      safe.style.width = `${diameter}%`;
      safe.style.height = `${diameter}%`;
    }
  }
}
