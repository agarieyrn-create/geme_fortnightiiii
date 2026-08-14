// Stormfall: Last Horizon — TPS input layer. Pointer-lock mouse look, keyboard movement, aim, crouch, reload, and a gamepad-ready snapshot shape.
export type InputSnapshot = {
  forward: number;
  right: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  aiming: boolean;
  firing: boolean;
  reloadPressed: boolean;
  lookX: number;
  lookY: number;
};

export class InputManager {
  private readonly keys = new Set<string>();
  private firing = false;
  private aiming = false;
  private reloadPressed = false;
  private lookX = 0;
  private lookY = 0;
  private readonly cleanup: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.listen(window, "keydown", (event: Event) => {
      const keyboard = event as KeyboardEvent;
      const key = keyboard.key.toLowerCase();
      if (["w", "a", "s", "d", " ", "shift", "control", "c", "r"].includes(key)) keyboard.preventDefault();
      this.keys.add(key);
      if (key === "r" && !keyboard.repeat) this.reloadPressed = true;
      if (document.pointerLockElement !== this.canvas && key === "enter") this.requestPointerLock();
    });
    this.listen(window, "keyup", (event: Event) => this.keys.delete((event as KeyboardEvent).key.toLowerCase()));
    this.listen(canvas, "mousedown", (event: Event) => {
      const mouse = event as MouseEvent;
      this.requestPointerLock();
      if (mouse.button === 0) this.firing = true;
      if (mouse.button === 2) this.aiming = true;
    });
    this.listen(window, "mouseup", (event: Event) => {
      const mouse = event as MouseEvent;
      if (mouse.button === 0) this.firing = false;
      if (mouse.button === 2) this.aiming = false;
    });
    this.listen(window, "blur", () => this.reset());
    this.listen(document, "visibilitychange", () => { if (document.hidden) this.reset(); });
    this.listen(canvas, "contextmenu", (event: Event) => event.preventDefault());
    this.listen(window, "mousemove", (event: Event) => {
      const pointer = event as MouseEvent;
      if (document.pointerLockElement === this.canvas) {
        this.lookX += pointer.movementX;
        this.lookY += pointer.movementY;
      }
    });
  }

  requestPointerLock() {
    if (document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock?.();
  }

  snapshot(): InputSnapshot {
    const forward = (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) - (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0);
    const right = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    const result: InputSnapshot = {
      forward,
      right,
      jump: this.keys.has(" "),
      sprint: this.keys.has("shift"),
      crouch: this.keys.has("c") || this.keys.has("control"),
      aiming: this.aiming || this.keys.has("q"),
      firing: this.firing,
      reloadPressed: this.reloadPressed,
      lookX: this.lookX,
      lookY: this.lookY,
    };
    this.lookX = 0;
    this.lookY = 0;
    this.reloadPressed = false;
    return result;
  }

  reset() {
    this.keys.clear();
    this.firing = false;
    this.aiming = false;
    this.reloadPressed = false;
    this.lookX = 0;
    this.lookY = 0;
  }

  dispose() {
    this.reset();
    this.cleanup.forEach((off) => off());
    this.cleanup.length = 0;
  }

  private listen(target: EventTarget, name: string, handler: (event: Event) => void) {
    target.addEventListener(name, handler);
    this.cleanup.push(() => target.removeEventListener(name, handler));
  }
}
