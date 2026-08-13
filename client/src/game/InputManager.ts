// Stormfall: Last Horizon design contract — immediate, tactical third-person inputs that keep the world view unobstructed.
export type InputSnapshot = {
  forward: number;
  right: number;
  jump: boolean;
  sprint: boolean;
  firing: boolean;
  lookX: number;
  lookY: number;
};

export class InputManager {
  private readonly keys = new Set<string>();
  private firing = false;
  private lookX = 0;
  private lookY = 0;
  private dragging = false;
  private readonly cleanup: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.listen(window, "keydown", (event: Event) => {
      const key = (event as KeyboardEvent).key.toLowerCase();
      if (["w", "a", "s", "d", " ", "shift"].includes(key)) event.preventDefault();
      this.keys.add(key);
    });
    this.listen(window, "keyup", (event: Event) => this.keys.delete((event as KeyboardEvent).key.toLowerCase()));
    this.listen(canvas, "mousedown", () => {
      this.firing = true;
      this.dragging = true;
    });
    this.listen(window, "mouseup", () => {
      this.firing = false;
      this.dragging = false;
    });
    this.listen(window, "mousemove", (event: Event) => {
      const pointer = event as MouseEvent;
      if (document.pointerLockElement === this.canvas || this.dragging) {
        this.lookX += pointer.movementX;
        this.lookY += pointer.movementY;
      }
    });
  }

  snapshot(): InputSnapshot {
    const forward = (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) - (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0);
    const right = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    const result: InputSnapshot = {
      forward,
      right,
      jump: this.keys.has(" "),
      sprint: this.keys.has("shift"),
      firing: this.firing,
      lookX: this.lookX,
      lookY: this.lookY,
    };
    this.lookX = 0;
    this.lookY = 0;
    return result;
  }

  dispose() {
    this.cleanup.forEach((off) => off());
    this.cleanup.length = 0;
    this.keys.clear();
  }

  private listen(target: Window | HTMLCanvasElement, name: string, handler: (event: Event) => void) {
    target.addEventListener(name, handler);
    this.cleanup.push(() => target.removeEventListener(name, handler));
  }
}

