import * as Phaser from "phaser";
import { hex, type PaletteColor, rgb } from "./color";
import { font } from "./fonts";
import { LOOK, PALETTE } from "./palette";

export type Strength = "light" | "medium" | "heavy";

const SHAKE: Record<Strength, [number, number]> = { light: [90, 0.003], medium: [160, 0.007], heavy: [280, 0.013] };

export function shake(scene: Phaser.Scene, strength: Strength = "light") {
  const [duration, intensity] = SHAKE[strength];
  scene.cameras.main.shake(duration, intensity);
}

export function flash(scene: Phaser.Scene, color: PaletteColor = "text", duration = 90) {
  const [r, g, b] = rgb(color);
  scene.cameras.main.flash(duration, r, g, b);
}

export function hitStop(scene: Phaser.Scene, ms = 60) {
  if (scene.data.get("hitStop")) return;
  scene.data.set("hitStop", true);
  scene.physics.world.pause();
  scene.tweens.timeScale = 0;
  scene.time.timeScale = 0;
  window.setTimeout(() => {
    scene.physics.world.resume();
    scene.tweens.timeScale = 1;
    scene.time.timeScale = 1;
    scene.data.set("hitStop", false);
  }, ms);
}

export function popText(scene: Phaser.Scene, x: number, y: number, text: string, color: PaletteColor = "accent", size = 34) {
  const label = scene.add
    .text(x, y, text, { fontFamily: font("display"), fontSize: `${size}px`, fontStyle: "700", color: PALETTE[color] })
    .setOrigin(0.5)
    .setStroke(PALETTE.outline, Math.max(2, LOOK.outline))
    .setDepth(5_000)
    .setScale(0.4);
  scene.tweens.add({ targets: label, scale: 1, duration: 140, ease: "Back.easeOut" });
  scene.tweens.add({ targets: label, y: y - 70, alpha: 0, delay: 260, duration: 520, ease: "Quad.easeIn", onComplete: () => label.destroy() });
  return label;
}

export function squash(target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, x = 1.25, y = 0.8, duration = 90) {
  const scene = target.scene;
  const sx = target.scaleX;
  const sy = target.scaleY;
  scene.tweens.add({ targets: target, scaleX: sx * x, scaleY: sy * y, duration, yoyo: true, ease: "Quad.easeOut", onComplete: () => target.setScale(sx, sy) });
}

export type BurstOptions = { color?: PaletteColor | PaletteColor[]; count?: number; speed?: [number, number]; lifespan?: number; scale?: number; texture?: string; gravity?: number };

export function burst(scene: Phaser.Scene, x: number, y: number, options: BurstOptions = {}) {
  const colors = ([] as PaletteColor[]).concat(options.color ?? ["primary", "accent"]);
  const [min, max] = options.speed ?? [90, 320];
  const lifespan = options.lifespan ?? 520;
  const emitter = scene.add.particles(x, y, options.texture ?? "spark", {
    speed: { min, max },
    angle: { min: 0, max: 360 },
    lifespan: { min: lifespan * 0.6, max: lifespan },
    scale: { start: options.scale ?? 0.9, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: colors.map(hex),
    gravityY: options.gravity ?? 0,
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  });
  emitter.setDepth(4_000);
  emitter.explode(options.count ?? 18);
  scene.time.delayedCall(lifespan + 100, () => emitter.destroy());
  return emitter;
}

export function trail(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { x: number; y: number }, color: PaletteColor = "primary") {
  const emitter = scene.add.particles(0, 0, "spark", {
    follow: target,
    speed: { min: 0, max: 30 },
    lifespan: 380,
    scale: { start: 0.55, end: 0 },
    alpha: { start: 0.7, end: 0 },
    tint: hex(color),
    blendMode: Phaser.BlendModes.ADD,
    frequency: 24,
  });
  emitter.setDepth(-1);
  return emitter;
}

export function float(target: Phaser.GameObjects.GameObject & { y: number }, amount = 8, duration = 1600) {
  return target.scene.tweens.add({ targets: target, y: target.y - amount, duration, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

export function pulse(target: Phaser.GameObjects.GameObject, scale = 1.08, duration = 700) {
  return target.scene.tweens.add({ targets: target, scale, duration, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

export function go(scene: Phaser.Scene, key: string, data?: object, duration = 260) {
  const [r, g, b] = rgb("background");
  scene.cameras.main.fadeOut(duration, r, g, b);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

export function arrive(scene: Phaser.Scene, duration = 260) {
  const [r, g, b] = rgb("background");
  scene.cameras.main.fadeIn(duration, r, g, b);
}
