import * as Phaser from "phaser";
import { hex, type PaletteColor } from "./color";
import { font, type FontRole } from "./fonts";
import { squash } from "./juice";
import { LOOK, PALETTE } from "./palette";
import { sfx } from "./sfx";

export type LabelOptions = { size?: number; color?: PaletteColor; role?: FontRole; bold?: boolean; stroke?: boolean; shadow?: boolean; wrap?: number };

export function label(scene: Phaser.Scene, x: number, y: number, text: string, options: LabelOptions = {}) {
  const role = options.role ?? "display";
  const t = scene.add
    .text(x, y, text, {
      fontFamily: font(role),
      fontSize: `${options.size ?? 32}px`,
      fontStyle: options.bold === false ? "400" : "700",
      color: PALETTE[options.color ?? "text"],
      align: "center",
      wordWrap: options.wrap ? { width: options.wrap, useAdvancedWrap: true } : undefined,
    })
    .setOrigin(0.5);
  if (options.stroke !== false) t.setStroke(PALETTE.outline, LOOK.outline);
  if (options.shadow !== false && LOOK.shadow > 0) t.setShadow(0, Math.max(2, LOOK.outline), PALETTE.outline, 0, true, true);
  return t;
}

export function panel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color: PaletteColor = "surface") {
  const g = scene.add.graphics();
  const left = x - width / 2;
  const top = y - height / 2;
  if (LOOK.shadow > 0) g.fillStyle(hex("outline"), LOOK.shadow).fillRoundedRect(left, top + 10, width, height, LOOK.corner);
  g.fillStyle(hex(color), 0.92).fillRoundedRect(left, top, width, height, LOOK.corner);
  if (LOOK.outline > 0) g.lineStyle(LOOK.outline, hex("outline"), 1).strokeRoundedRect(left, top, width, height, LOOK.corner);
  return g;
}

export type Button = Phaser.GameObjects.Container & { focus(on: boolean): void; press(): void };

export function button(scene: Phaser.Scene, x: number, y: number, text: string, onPress: () => void, options: { width?: number; color?: PaletteColor; size?: number } = {}) {
  const width = options.width ?? Math.max(260, text.length * (options.size ?? 30) * 0.7 + 80);
  const height = (options.size ?? 30) * 2.2;
  const color = options.color ?? "primary";
  const base = scene.add.graphics();
  const draw = (focused: boolean) => {
    base.clear();
    if (LOOK.shadow > 0) base.fillStyle(hex("outline"), LOOK.shadow + 0.2).fillRoundedRect(-width / 2, -height / 2 + 8, width, height, LOOK.corner);
    base.fillStyle(hex(color), 1).fillRoundedRect(-width / 2, -height / 2, width, height, LOOK.corner);
    base.fillStyle(0xffffff, focused ? 0.22 : 0.1).fillRoundedRect(-width / 2 + 6, -height / 2 + 5, width - 12, height * 0.42, Math.max(0, LOOK.corner - 6));
    if (LOOK.outline > 0) base.lineStyle(LOOK.outline, hex("outline"), 1).strokeRoundedRect(-width / 2, -height / 2, width, height, LOOK.corner);
    if (focused) base.lineStyle(3, hex("text"), 0.9).strokeRoundedRect(-width / 2 - 8, -height / 2 - 8, width + 16, height + 16, LOOK.corner + 6);
  };
  const caption = label(scene, 0, -2, text, { size: options.size ?? 30, color: "outline", stroke: false, shadow: false });
  const container = scene.add.container(x, y, [base, caption]).setSize(width, height) as Button;
  draw(false);
  container.setInteractive({ useHandCursor: true });
  container.focus = (on: boolean) => {
    draw(on);
    scene.tweens.add({ targets: container, scale: on ? 1.06 : 1, duration: 120, ease: "Quad.easeOut" });
  };
  container.press = () => {
    sfx.play("select");
    squash(container, 0.92, 0.92, 70);
    scene.time.delayedCall(90, onPress);
  };
  container.on("pointerover", () => container.focus(true));
  container.on("pointerout", () => container.focus(false));
  container.on("pointerup", () => container.press());
  return container;
}

export function menu(scene: Phaser.Scene, buttons: Button[]) {
  let index = 0;
  const select = (next: number) => {
    buttons[index]?.focus(false);
    index = (next + buttons.length) % buttons.length;
    buttons[index]?.focus(true);
  };
  select(0);
  const keyboard = scene.input.keyboard;
  keyboard?.on("keydown-UP", () => select(index - 1));
  keyboard?.on("keydown-DOWN", () => select(index + 1));
  keyboard?.on("keydown-W", () => select(index - 1));
  keyboard?.on("keydown-S", () => select(index + 1));
  keyboard?.on("keydown-ENTER", () => buttons[index]?.press());
  keyboard?.on("keydown-SPACE", () => buttons[index]?.press());
  return { select };
}

export function hudCounter(scene: Phaser.Scene, x: number, y: number, title: string, align: "left" | "right" = "left") {
  const origin = align === "left" ? 0 : 1;
  const caption = label(scene, x, y, title.toUpperCase(), { size: 16, color: "textMuted", role: "body", stroke: false }).setOrigin(origin, 0);
  const value = label(scene, x, y + 20, "0", { size: 38 }).setOrigin(origin, 0);
  const group = scene.add.container(0, 0, [caption, value]).setScrollFactor(0).setDepth(9_000);
  return {
    group,
    set(n: number | string) {
      if (value.text === String(n)) return;
      value.setText(String(n));
      squash(value, 1.18, 1.18, 80);
    },
  };
}
