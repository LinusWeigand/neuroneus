import * as Phaser from "phaser";
import { hex } from "./color";
import { LOOK } from "./palette";

export const HUD_DEPTH = 9_000;

type Layered = Phaser.GameObjects.GameObject & { depth: number };

export function applyLook(scene: Phaser.Scene) {
  const main = scene.cameras.main;
  const hud = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height, false, "hud");
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
    for (const child of scene.children.list as Layered[]) child.cameraFilter = child.depth >= HUD_DEPTH ? main.id : hud.id;
  });
  if (scene.sys.renderer.type !== Phaser.WEBGL) return;
  const grade = main.filters.internal.addColorMatrix();
  grade.colorMatrix.saturate(LOOK.saturation - 1, true);
  grade.colorMatrix.contrast(LOOK.contrast - 1, true);
  if (LOOK.bloom > 0) {
    Phaser.Actions.AddEffectBloom(main, { threshold: LOOK.bloomThreshold, blendAmount: LOOK.bloom, blurRadius: 3, blurSteps: 4, blurQuality: 1 });
  }
  if (LOOK.vignette > 0) main.filters.external.addVignette(0.5, 0.5, 0.9, LOOK.vignette, hex("outline"));
}
