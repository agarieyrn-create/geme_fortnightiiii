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
  private aiming = false;
  private firing = false;
  private reloadPressed = false;
  private pickupPressed = false;
  private slotPressed: number | null = null;
  private medkitPressed = false;
  private movementPointerId: number | null = null;
  private cameraPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private readonly cleanup: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.listen(canvas, "pointerdown", (event) => this.onPointerDown(event as PointerEvent));
    this.listen(canvas, "pointermove", (event) => this.onPointerMove(event as PointerEvent));
    this.listen(window, "pointerup", (event) => this.onPointerUp(event as PointerEvent));
    this.listen(window, "pointercancel", (event) => this.onPointerUp(event as PointerEvent));
    this.listen(window, "touchend", (event) => this.onTouchBoundary(event as TouchEvent));
    this.listen(window, "touchcancel", (event) => this.onTouchBoundary(event as TouchEvent));
    this.listen(window, "blur", () => this.reset());
    this.listen(document, "visibilitychange", () => { if (document.hidden) this.reset(); });
    document.querySelectorAll<HTMLElement>("[data-touch-action]").forEach((button) => {
      this.listen(button, "pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const action = button.dataset.touchAction;
        if (action === "jump") this.jump = true;
        if (action === "crouch") this.crouch = true;
        if (action === "sprint") this.sprint = true;
        if (action === "aim") this.aiming = true;
        if (action === "fire") this.firing = true;
        if (action === "reload" && !this.reloadPressed) this.reloadPressed = true;
        if (action === "pickup" && !this.pickupPressed) this.pickupPressed = true;
        if (action?.startsWith("slot")) this.slotPressed = Number(action.slice(-1));
        if (action === "medkit" && !this.medkitPressed) this.medkitPressed = true;
        button.setPointerCapture?.((event as PointerEvent).pointerId);
      });
      this.listen(button, "pointerup", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.releaseAction(button.dataset.touchAction, (event as PointerEvent).pointerId);
      });
      this.listen(button, "pointercancel", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.releaseAction(button.dataset.touchAction, (event as PointerEvent).pointerId);
      });
    });
  }

  snapshot(): InputSnapshot {
    // Mobile-only camera tuning: reverse horizontal swipe direction and amplify vertical look.
    // PC mouse values remain untouched in InputManager.
    const mobileYaw = -this.lookX;
    const mobilePitch = this.lookY * 2.05;
    const autoSprint = Math.hypot(this.moveX, this.moveY) >= 0.82;
    const snapshot: InputSnapshot = { forward: this.moveY, right: this.moveX, jump: this.jump, sprint: this.sprint || autoSprint, crouch: this.crouch, aiming: this.aiming, firing: this.firing, reloadPressed: this.reloadPressed, pickupPressed: this.pickupPressed, slotPressed: this.slotPressed, medkitPressed: this.medkitPressed, lookX: mobileYaw, lookY: mobilePitch };
    this.lookX = 0;
    this.lookY = 0;
    this.reloadPressed = false;
    this.pickupPressed = false;
    this.slotPressed = null;
    this.medkitPressed = false;
    return snapshot;
  }

  isActive() {
    return this.movementPointerId !== null || this.cameraPointerId !== null || Math.abs(this.moveX) > 0.01 || Math.abs(this.moveY) > 0.01 || this.jump || this.crouch || this.sprint || this.aiming || this.firing || this.reloadPressed || this.pickupPressed || this.slotPressed !== null || this.medkitPressed;
  }

  dispose() {
    this.reset();
    this.cleanup.forEach((off) => off());
    this.cleanup.length = 0;
  }

  private onPointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse") return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < rect.width * 0.48 && this.movementPointerId === null) {
      this.movementPointerId = event.pointerId;
      this.updateMove(x, y, rect);
      this.canvas.setPointerCapture?.(event.pointerId);
    } else if (x >= rect.width * 0.48 && this.cameraPointerId === null) {
      this.cameraPointerId = event.pointerId;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
      this.canvas.setPointerCapture?.(event.pointerId);
    }
  }

  private onPointerMove(event: PointerEvent) {
    if (event.pointerType === "mouse") return;
    const rect = this.canvas.getBoundingClientRect();
    if (event.pointerId === this.movementPointerId) this.updateMove(event.clientX - rect.left, event.clientY - rect.top, rect);
    if (event.pointerId === this.cameraPointerId) {
      this.lookX += event.clientX - this.lastLookX;
      this.lookY += event.clientY - this.lastLookY;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
    }
  }

  private onPointerUp(event: PointerEvent) {
    if (event.pointerId === this.movementPointerId) {
      this.releaseCapture(event.pointerId);
      this.movementPointerId = null;
      this.resetMovement();
    }
    if (event.pointerId === this.cameraPointerId) {
      this.releaseCapture(event.pointerId);
      this.cameraPointerId = null;
    }
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

  public reset() {
    if (this.movementPointerId !== null) this.releaseCapture(this.movementPointerId);
    if (this.cameraPointerId !== null) this.releaseCapture(this.cameraPointerId);
    this.movementPointerId = null;
    this.cameraPointerId = null;
    this.resetMovement();
    this.lookX = 0;
    this.lookY = 0;
    this.jump = false;
    this.crouch = false;
    this.sprint = false;
    this.aiming = false;
    this.firing = false;
    this.reloadPressed = false;
    this.pickupPressed = false;
    this.slotPressed = null;
    this.medkitPressed = false;
  }

  private resetMovement() {
    this.moveX = 0;
    this.moveY = 0;
    this.setKnob(0, 0);
  }

  private onTouchBoundary(event: TouchEvent) {
    if (event.touches.length === 0) this.reset();
  }

  private releaseCapture(pointerId: number) {
    try {
      if (this.canvas.hasPointerCapture?.(pointerId)) this.canvas.releasePointerCapture?.(pointerId);
    } catch { /* Pointer capture may already be released by the browser. */ }
  }

  private setKnob(x: number, y: number) {
    const knob = document.getElementById("touch-knob");
    if (knob) knob.style.transform = `translate(${x * 42}px, ${-y * 42}px)`;
  }

  private releaseAction(action?: string, pointerId?: number) {
    if (action === "jump") this.jump = false;
    if (action === "crouch") this.crouch = false;
    if (action === "sprint") this.sprint = false;
    if (action === "aim") this.aiming = false;
    if (action === "fire") this.firing = false;
    if (pointerId !== undefined) this.releaseCapture(pointerId);
  }

  private listen(target: EventTarget, name: string, handler: (event: Event) => void) {
    target.addEventListener(name, handler, { passive: false });
    this.cleanup.push(() => target.removeEventListener(name, handler));
  }
}
