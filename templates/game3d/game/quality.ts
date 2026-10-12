import type * as THREE from "three";

const MIN_SCALE = 0.5;

export function createQuality(renderer: THREE.WebGLRenderer, onChange: () => void) {
  const base = Math.min(2, window.devicePixelRatio);
  let scale = 1;
  let frames = 0;
  let since = performance.now();
  renderer.setPixelRatio(base);

  return {
    tick(now: number) {
      frames += 1;
      const elapsed = now - since;
      if (elapsed < 1000) return;
      const fps = (frames * 1000) / elapsed;
      frames = 0;
      since = now;
      const next = fps < 40 ? Math.max(MIN_SCALE, scale * 0.8) : fps > 58 ? Math.min(1, scale * 1.1) : scale;
      if (Math.abs(next - scale) < 0.01) return;
      scale = next;
      renderer.setPixelRatio(base * scale);
      onChange();
    },
  };
}
