import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import * as THREE from "three";
import { LOOK } from "./palette";

export function createLook(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const effects = [
    new BloomEffect({ intensity: 0.4 + LOOK.bloom * 1.6, luminanceThreshold: LOOK.bloomThreshold, mipmapBlur: true, radius: 0.7 }),
    new VignetteEffect({ offset: 0.35, darkness: LOOK.vignette }),
    new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
    new SMAAEffect(),
  ];
  composer.addPass(new EffectPass(camera, ...effects));
  return {
    render(dt: number) {
      composer.render(dt);
    },
    setSize(width: number, height: number) {
      composer.setSize(width, height);
    },
    dispose() {
      composer.dispose();
    },
  };
}
