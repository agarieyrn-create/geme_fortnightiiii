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
    setText("weapon-name", snapshot.weaponName ?? "武器なし");
    const weaponShortNames: Record<string, string> = { assault: "AR", smg: "SMG", shotgun: "SG" };
    const weaponFullNames: Record<string, string> = { assault: "アサルトライフル", smg: "サブマシンガン", shotgun: "ショットガン" };
    snapshot.slots?.forEach((slot, index) => {
      const element = document.getElementById(`slot-${index + 1}`);
      if (element) element.textContent = slot ? weaponShortNames[slot] ?? slot : "なし";
      element?.classList.toggle("selected", slot !== null && weaponFullNames[slot] === snapshot.weaponName);
    });
    const medkits = snapshot.medkits ?? 0;
    setText("medkit-value", `回復 ×${medkits}`);
    const medkitButton = document.getElementById("medkit-value");
    if (medkitButton) medkitButton.classList.toggle("is-available", medkits > 0);
    const pickupButton = document.querySelector<HTMLElement>('[data-touch-action="pickup"]');
    if (pickupButton) {
      pickupButton.classList.toggle("is-available", Boolean(snapshot.switchPrompt));
      pickupButton.textContent = snapshot.switchPrompt ? "おす" : "ひろう";
    }
    const reloadButton = document.querySelector<HTMLElement>('[data-touch-action="reload"]');
    const magazineSize = snapshot.weaponName === "ショットガン" ? 5 : 30;
    if (reloadButton) reloadButton.classList.toggle("is-available", snapshot.ammo > 0 && snapshot.reserve > 0 && snapshot.ammo < magazineSize);
    setText("elims-value", snapshot.elims.toString());
    setText("remaining-count", snapshot.remaining.toString());
    const motionNames: Record<string, string> = { IDLE: "待機", WALK_FORWARD: "歩く", WALK_BACKWARD: "後ろへ", STRAFE_LEFT: "左へ", STRAFE_RIGHT: "右へ", RUN: "ダッシュ", JUMP_START: "ジャンプ", JUMP_LOOP: "空中", FALL: "落下", LAND: "着地", CROUCH_IDLE: "しゃがみ", CROUCH_WALK: "しゃがみ歩き", AIM: "ねらう", FIRE: "うつ", RELOAD: "リロード" };
    const zoneNames: Record<string, string> = { "STEP 1 // EXPLORE": "STEP 1 // たんけん", "STEP 2 // LIVE FIRE": "STEP 2 // れんしゅう", "STEP 3 // HOSTILES": "STEP 3 // てき", "STEP 4 // SCAVENGE": "STEP 4 // ひろう", BREACH: "危険" };
    setText("storm-timer", zoneNames[snapshot.zone] ?? snapshot.zone);
    setText("zone-status", snapshot.zone === "BREACH" ? "危険" : "安全");
    setText("pickup-status", snapshot.pickup);
    setText("dungeon-objective", snapshot.objective ?? "");
    const bossPanel = document.getElementById("boss-panel");
    if (bossPanel) bossPanel.classList.toggle("is-visible", typeof snapshot.bossHp === "number" && typeof snapshot.bossMaxHp === "number" && snapshot.bossMaxHp > 0);
    if (typeof snapshot.bossHp === "number" && typeof snapshot.bossMaxHp === "number") {
      setText("boss-name", snapshot.bossName ?? "ボス");
      setText("boss-hp-value", `${Math.ceil(snapshot.bossHp)} / ${snapshot.bossMaxHp}`);
      setWidth("boss-hp-fill", (snapshot.bossHp / Math.max(1, snapshot.bossMaxHp)) * 100);
    }
    setText("motion-state", motionNames[snapshot.motion] ?? snapshot.motion);
    setText("crouch-state", snapshot.crouching ? "しゃがむ" : "立つ");
    setText("aim-status", snapshot.aiming ? "ねらう" : "通常");
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
