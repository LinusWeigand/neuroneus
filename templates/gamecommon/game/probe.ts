export type ProbeState = {
  scene: string;
  score: number;
  best: number;
  lives: number | null;
  paused: boolean;
  over: boolean;
  fps: number;
  [key: string]: string | number | boolean | null;
};

const state: ProbeState = { scene: "boot", score: 0, best: 0, lives: null, paused: false, over: false, fps: 0 };

declare global {
  interface Window {
    __GAME__?: { state: ProbeState };
  }
}

let attached = false;

export const probe = {
  attach() {
    window.__GAME__ = { state };
    if (attached) return;
    attached = true;
    let frames = 0;
    let since = performance.now();
    const count = (now: number) => {
      frames += 1;
      if (now - since >= 1000) {
        state.fps = frames;
        frames = 0;
        since = now;
      }
      requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
  },
  set(values: Partial<ProbeState>) {
    Object.assign(state, values);
  },
  get state(): Readonly<ProbeState> {
    return state;
  },
};
