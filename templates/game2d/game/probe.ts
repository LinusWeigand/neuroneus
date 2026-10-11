import type * as Phaser from "phaser";

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
    __GAME__?: { state: ProbeState; game: Phaser.Game };
  }
}

export const probe = {
  attach(game: Phaser.Game) {
    window.__GAME__ = { state, game };
    game.events.on("step", () => {
      state.fps = Math.round(game.loop.actualFps);
    });
  },
  set(values: Partial<ProbeState>) {
    Object.assign(state, values);
  },
  get state(): Readonly<ProbeState> {
    return state;
  },
};
