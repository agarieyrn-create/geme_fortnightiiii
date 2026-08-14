import type { FireRequest, WeaponDefinition, WeaponId, WeaponState } from "./contracts";

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  assault: { id: "assault", name: "ASSAULT RIFLE", damage: 25, magazineSize: 30, fireInterval: 0.145, range: 500, ammoType: "medium", pellets: 1 },
  smg: { id: "smg", name: "SMG", damage: 15, magazineSize: 30, fireInterval: 0.075, range: 260, ammoType: "light", pellets: 1 },
  shotgun: { id: "shotgun", name: "SHOTGUN", damage: 14, magazineSize: 5, fireInterval: 0.78, range: 90, ammoType: "shells", pellets: 8 },
};

type MagazineState = { magazine: number; reserve: number };

export class WeaponSystem {
  readonly state: WeaponState = { magazine: 0, reserve: 0, cooldown: 0, reloadTimer: 0, isReloading: false, equipped: null };
  private readonly inventory = new Map<WeaponId, MagazineState>();
  private readonly reserves: Record<"medium" | "light" | "shells", number> = { medium: 0, light: 0, shells: 0 };

  update(delta: number) {
    this.state.cooldown = Math.max(-0.4, this.state.cooldown - delta);
    if (this.state.isReloading) {
      this.state.reloadTimer = Math.max(0, this.state.reloadTimer - delta);
      if (this.state.reloadTimer === 0) this.finishReload();
    }
  }

  equip(id: WeaponId, reserveBonus = 0) {
    if (this.state.isReloading) return false;
    if (this.state.equipped) this.inventory.set(this.state.equipped, { magazine: this.state.magazine, reserve: this.state.reserve });
    const definition = WEAPON_DEFINITIONS[id];
    const saved = this.inventory.get(id) ?? { magazine: definition.magazineSize, reserve: reserveBonus + this.reserves[definition.ammoType] };
    this.inventory.set(id, saved);
    this.state.equipped = id;
    this.state.magazine = saved.magazine;
    this.state.reserve = saved.reserve;
    this.state.cooldown = 0;
    return true;
  }

  clear() {
    this.state.equipped = null;
    this.state.magazine = 0;
    this.state.reserve = 0;
    this.state.isReloading = false;
    this.state.reloadTimer = 0;
  }

  definition() {
    return this.state.equipped ? WEAPON_DEFINITIONS[this.state.equipped] : null;
  }

  has(id: WeaponId) {
    return this.inventory.has(id);
  }

  slots(): Array<WeaponId | null> {
    const ids: WeaponId[] = ["assault", "smg", "shotgun"];
    return ids.map((id) => this.inventory.has(id) ? id : null);
  }

  reload() {
    const definition = this.definition();
    if (!definition || this.state.isReloading || this.state.magazine >= definition.magazineSize || this.state.reserve <= 0) return false;
    this.state.isReloading = true;
    this.state.reloadTimer = definition.id === "shotgun" ? 1.1 : 0.82;
    return true;
  }

  fire(request: FireRequest, onFire: (request: FireRequest) => void) {
    const definition = this.definition();
    if (!definition || this.state.isReloading || this.state.cooldown > 0 || this.state.magazine <= 0) return false;
    onFire({ ...request, damage: definition.damage });
    this.state.magazine -= 1;
    this.state.cooldown = definition.fireInterval;
    this.persistCurrent();
    if (this.state.magazine === 0 && this.state.reserve > 0) this.reload();
    return true;
  }

  addReserve(amount: number, ammoType?: "medium" | "light" | "shells") {
    if (!ammoType) {
      if (this.state.equipped) this.state.reserve = Math.min(240, this.state.reserve + amount);
      return;
    }
    this.reserves[ammoType] = Math.min(240, this.reserves[ammoType] + amount);
    if (this.definition()?.ammoType === ammoType) {
      this.state.reserve = Math.min(240, this.state.reserve + amount);
      this.persistCurrent();
    }
  }

  reserveFor(ammoType: "medium" | "light" | "shells") {
    return this.reserves[ammoType];
  }

  private finishReload() {
    const definition = this.definition();
    if (!definition) return;
    const amount = Math.min(definition.magazineSize - this.state.magazine, this.state.reserve);
    this.state.magazine += amount;
    this.state.reserve -= amount;
    this.state.isReloading = false;
    this.persistCurrent();
  }

  private persistCurrent() {
    if (this.state.equipped) this.inventory.set(this.state.equipped, { magazine: this.state.magazine, reserve: this.state.reserve });
  }
}
