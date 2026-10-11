import * as Phaser from "phaser";
import { hex } from "./color";

type KeyName = "W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "SPACE" | "ENTER" | "Z" | "P" | "ESC";

export type Controls = {
  readonly x: number;
  readonly y: number;
  readonly action: boolean;
  readonly actionPressed: boolean;
  readonly pausePressed: boolean;
  readonly touch: boolean;
  update(): void;
};

const JOYSTICK_RADIUS = 70;

export function createControls(scene: Phaser.Scene): Controls {
  const keyboard = scene.input.keyboard;
  const keys = (keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,Z,P,ESC") ?? {}) as Partial<Record<KeyName, Phaser.Input.Keyboard.Key>>;
  const touch = scene.sys.game.device.input.touch;
  const down = (...names: KeyName[]) => names.some((n) => keys[n]?.isDown);
  const justDown = (...names: KeyName[]) => names.some((n) => (keys[n] ? Phaser.Input.Keyboard.JustDown(keys[n]) : false));

  const stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  let touchAction = false;
  let touchActionPressed = false;
  const { width, height } = scene.scale;
  const button = { x: width - 110, y: height - 110, r: 58 };
  const overlay = touch ? scene.add.graphics().setScrollFactor(0).setDepth(10_000) : null;

  if (touch) {
    scene.input.addPointer(2);
    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.x, p.y, button.x, button.y) < button.r * 1.4) {
        touchAction = true;
        touchActionPressed = true;
      } else if (p.x < width * 0.6 && stick.id === -1) {
        Object.assign(stick, { id: p.id, ox: p.x, oy: p.y, x: 0, y: 0 });
      }
    });
    scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.id !== stick.id) return;
      const dx = p.x - stick.ox;
      const dy = p.y - stick.oy;
      const length = Math.max(1, Math.hypot(dx, dy));
      const k = Math.min(1, length / JOYSTICK_RADIUS);
      stick.x = (dx / length) * k;
      stick.y = (dy / length) * k;
    });
    scene.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.id === stick.id) Object.assign(stick, { id: -1, x: 0, y: 0 });
      else touchAction = false;
    });
  }

  const state = { x: 0, y: 0, action: false, actionPressed: false, pausePressed: false };

  return {
    get x() {
      return state.x;
    },
    get y() {
      return state.y;
    },
    get action() {
      return state.action;
    },
    get actionPressed() {
      return state.actionPressed;
    },
    get pausePressed() {
      return state.pausePressed;
    },
    touch,
    update() {
      const kx = (down("RIGHT", "D") ? 1 : 0) - (down("LEFT", "A") ? 1 : 0);
      const ky = (down("DOWN", "S") ? 1 : 0) - (down("UP", "W") ? 1 : 0);
      const length = Math.hypot(kx, ky) || 1;
      state.x = kx ? kx / length : stick.x;
      state.y = ky ? ky / length : stick.y;
      state.action = down("SPACE", "Z", "ENTER") || touchAction;
      state.actionPressed = justDown("SPACE", "Z", "ENTER") || touchActionPressed;
      state.pausePressed = justDown("P", "ESC");
      touchActionPressed = false;
      if (overlay) {
        overlay.clear();
        overlay.fillStyle(hex("text"), touchAction ? 0.35 : 0.18).fillCircle(button.x, button.y, button.r);
        overlay.lineStyle(4, hex("text"), 0.5).strokeCircle(button.x, button.y, button.r);
        if (stick.id !== -1) {
          overlay.fillStyle(hex("text"), 0.12).fillCircle(stick.ox, stick.oy, JOYSTICK_RADIUS);
          overlay.fillStyle(hex("text"), 0.45).fillCircle(stick.ox + stick.x * JOYSTICK_RADIUS, stick.oy + stick.y * JOYSTICK_RADIUS, 30);
        }
      }
    },
  };
}
