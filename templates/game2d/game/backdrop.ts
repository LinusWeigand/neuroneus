import * as Phaser from "phaser";
import { hasImage } from "./assets";
import { hex } from "./color";

export function backdrop(scene: Phaser.Scene, key = "background") {
  const { width, height } = scene.scale;
  if (hasImage(key)) {
    const image = scene.add.image(width / 2, height / 2, key).setScrollFactor(0).setDepth(-100);
    const scale = Math.max(width / image.width, height / image.height);
    image.setScale(scale);
    scene.tweens.add({ targets: image, scale: scale * 1.04, duration: 14_000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  } else {
    const g = scene.add.graphics().setScrollFactor(0).setDepth(-100);
    g.fillGradientStyle(hex("backgroundAlt"), hex("backgroundAlt"), hex("background"), hex("background"), 1).fillRect(0, 0, width, height);
    for (const [x, y, color] of [
      [0.18, 0.25, "primary"],
      [0.82, 0.7, "secondary"],
    ] as const) {
      const glow = scene.add.image(width * x, height * y, "glow").setTint(hex(color)).setBlendMode(Phaser.BlendModes.ADD).setScale(4).setAlpha(0.35).setDepth(-99);
      scene.tweens.add({ targets: glow, x: glow.x + 40, y: glow.y - 30, duration: 9_000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }
  scene.add
    .particles(0, 0, "dot", {
      x: { min: 0, max: width },
      y: height + 10,
      speedY: { min: -40, max: -12 },
      speedX: { min: -8, max: 8 },
      lifespan: 14_000,
      scale: { min: 0.15, max: 0.45 },
      alpha: { start: 0.55, end: 0 },
      tint: [hex("primary"), hex("secondary"), hex("text")],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 220,
      advance: 12_000,
    })
    .setDepth(-98)
    .setScrollFactor(0);
}
