import type * as Phaser from "phaser";

function radial(scene: Phaser.Scene, key: string, size: number, stops: [number, number][]) {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, size, size);
  if (!texture) return;
  const ctx = texture.getContext();
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, alpha] of stops) gradient.addColorStop(at, `rgba(255,255,255,${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture.refresh();
}

function shape(scene: Phaser.Scene, key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, size, size);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.fillStyle = "white";
  draw(ctx, size);
  texture.refresh();
}

export function createProceduralTextures(scene: Phaser.Scene) {
  radial(scene, "spark", 64, [
    [0, 1],
    [0.25, 0.85],
    [1, 0],
  ]);
  radial(scene, "glow", 256, [
    [0, 0.55],
    [0.4, 0.18],
    [1, 0],
  ]);
  shape(scene, "dot", 16, (ctx, s) => {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
  });
  shape(scene, "star", 64, (ctx, s) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? s / 2 : s / 4.4;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  shape(scene, "diamond", 64, (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(s / 2, 2);
    ctx.lineTo(s - 2, s / 2);
    ctx.lineTo(s / 2, s - 2);
    ctx.lineTo(2, s / 2);
    ctx.closePath();
    ctx.fill();
  });
}
