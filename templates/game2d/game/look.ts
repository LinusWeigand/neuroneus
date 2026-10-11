import * as Phaser from "phaser";
import { hex } from "./color";
import { LOOK } from "./palette";

export function applyLook(scene: Phaser.Scene) {
  if (scene.sys.renderer.type !== Phaser.WEBGL) return;
  const camera = scene.cameras.main;
  const grade = camera.filters.internal.addColorMatrix();
  grade.colorMatrix.saturate(LOOK.saturation - 1, true);
  grade.colorMatrix.contrast(LOOK.contrast - 1, true);
  if (LOOK.bloom > 0) {
    Phaser.Actions.AddEffectBloom(camera, { threshold: LOOK.bloomThreshold, blendAmount: LOOK.bloom, blurRadius: 3, blurSteps: 4, blurQuality: 1 });
  }
  if (LOOK.vignette > 0) camera.filters.external.addVignette(0.5, 0.5, 0.9, LOOK.vignette, hex("outline"));
}
