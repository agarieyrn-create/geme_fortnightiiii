// Stormfall: Last Horizon — weapon state is independent from the player motor and projectile renderer.
import type { WeaponState, FireRequest } from "./contracts";

export class WeaponSystem {
  readonly state: WeaponState = { magazine: 30, reserve: 90, cooldown: 0, reloadTimer: 0, isReloading: false };
  readonly magazineSize = 30;
  readonly fireInterval = 0.145;

  update(delta: number) {
    this.state.cooldown = Math.max(-0.4, this.state.cooldown - delta);
    if (this.state.isReloading) {
      this.state.reloadTimer = Math.max(0, this.state.reloadTimer - delta);
      if (this.state.reloadTimer === 0) this.finishReload();
    }
  }

  reload() {
    if (this.state.isReloading || this.state.magazine >= this.magazineSize || this.state.reserve <= 0) return false;
    this.state.isReloading = true;
    this.state.reloadTimer = 0.82;
    return true;
  }

  fire(request: FireRequest, onFire: (request: FireRequest) => void) {
    if (this.state.isReloading || this.state.cooldown > 0 || this.state.magazine <= 0) return false;
    onFire(request);
    this.state.magazine -= 1;
    this.state.cooldown = this.fireInterval;
    if (this.state.magazine === 0 && this.state.reserve > 0) this.reload();
    return true;
  }

  addReserve(amount: number) {
    this.state.reserve = Math.min(180, this.state.reserve + amount);
  }

  private finishReload() {
    const amount = Math.min(this.magazineSize - this.state.magazine, this.state.reserve);
    this.state.magazine += amount;
    this.state.reserve -= amount;
    this.state.isReloading = false;
  }
}
