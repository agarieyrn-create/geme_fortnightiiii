// Stormfall: Last Horizon — touch-only input adapter. It shares no state with keyboard/mouse input.
import type { InputSnapshot } from "./InputManager";

export class TouchInputManager {
  private moveX = 0;
  private moveY = 0;
  private lookX = 0;
  private lookY = 0;
  private jump = false;
  private crouch = false;
  private sprint = false;
  private movePointer: number | null = null;
  private lookPointer: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private readonly cleanup: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.listen(canvas, "pointerdown", (event) => this.onPointerDown(event as PointerEvent));
    this.listen(canvas, "pointermove", (event) => this.onPointerMove(event as PointerEvent));
    this.listen(window, "pointerup", (event) => this.onPointerUp(event as PointerEvent));
    this.listen(window, "pointercancel", (event) => this.onPointerUp(event as PointerEvent));
    document.querySelectorAll<HTMLElement>("[data-touch-action]").forEach((button) => {
      this.listen(button, "pointerdown", (event) => {
        event.preventDefault();
        const action = button.dataset.touchAction;
        if (action === "jump") this.jump = true;
        if (action === "crouch") this.crouch = true;
        if (action === "sprint") this.sprint = true;
      });
      this.listen(button, "pointerup", () => this.releaseAction(button.dataset.touchAction));
      this.listen(button, "pointercancel", () => this.releaseAction(button.dataset.touchAction));
    });
  }

  snapshot(): InputSnapshot {
    const snapshot: InputSnapshot = { forward: this.moveY, right: this.moveX, jump: this.jump, sprint: this.sprint, crouch: this.crouch, aiming: false, firing: false, reloadPressed: false, lookX: this.lookX, lookY: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return snapshot;
  }

  isActive() {
    return this.movePointer !== null || this.lookPointer !== null || Math.abs(this.moveX) > 0.01 || Math.abs(this.moveY) > 0.01 || this.jump || this.crouch || this.sprint;
  }

  dispose() {
    this.cleanup.forEach((off) => off());
    this.cleanup.length = 0;
  }

  private onPointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse") return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < rect.width * 0.48 && this.movePointer === null) {
      this.movePointer = event.pointerId;
      this.updateMove(x, y, rect);
    } else if (this.lookPointer === null) {
      this.lookPointer = event.pointerId;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
    }
    this.canvas.setPointerCapture?.(event.pointerId);
  }

  private onPointerMove(event: PointerEvent) {
    if (event.pointerType === "mouse") return;
    const rect = this.canvas.getBoundingClientRect();
    if (event.pointerId === this.movePointer) this.updateMove(event.clientX - rect.left, event.clientY - rect.top, rect);
    if (event.pointerId === this.lookPointer) {
      this.lookX += event.clientX - this.lastLookX;
      this.lookY += event.clientY - this.lastLookY;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
    }
  }

  private onPointerUp(event: PointerEvent) {
    if (event.pointerId === this.movePointer) {
      this.movePointer = null;
      this.moveX = 0;
      this.moveY = 0;
      this.setKnob(0, 0);
    }
    if (event.pointerId === this.lookPointer) this.lookPointer = null;
  }

  private updateMove(x: number, y: number, rect: DOMRect) {
    const centerX = rect.width * 0.22;
    const centerY = rect.height * 0.75;
    const radius = Math.min(rect.width * 0.18, 86);
    const dx = x - centerX;
    const dy = y - centerY;
    const length = Math.hypot(dx, dy);
    const factor = Math.min(1, length / radius);
    this.moveX = length > 4 ? (dx / Math.max(radius, length)) * factor : 0;
    this.moveY = length > 4 ? -(dy / Math.max(radius, length)) * factor : 0;
    this.setKnob(this.moveX, this.moveY);
  }

  private setKnob(x: number, y: number) {
    const knob = document.getElementById("touch-knob");
    if (knob) knob.style.transform = `translate(${x * 42}px, ${-y * 42}px)`;
  }

  private releaseAction(action?: string) {
    if (action === "jump") this.jump = false;
    if (action === "crouch") this.crouch = false;
    if (action === "sprint") this.sprint = false;
  }

  private listen(target: EventTarget, name: string, handler: (event: Event) => void) {
    target.addEventListener(name, handler, { passive: false });
    this.cleanup.push(() => target.removeEventListener(name, handler));
  }
}
