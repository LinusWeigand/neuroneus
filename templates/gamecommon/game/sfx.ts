import { ZZFX, zzfx } from "zzfx";
import { load, save } from "./storage";

const SOUNDS = {
  pickup: [1.2, , 1675, , 0.06, 0.24, 1, 1.82, , , 837, 0.06],
  hit: [1.4, , 90, 0.01, 0.05, 0.2, 4, 2.4, , , , , , 1.2, , 0.5, , 0.6, 0.05],
  explode: [1.6, , 333, 0.01, 0, 0.9, 4, 1.9, , , , , , 0.5, , 0.6],
  jump: [1, , 284, 0.02, 0.01, 0.18, 1, 1.57, 9.7, , , , , , , , , 0.62, 0.01],
  select: [1.1, , 264, , 0.02, 0.07, , 1.9, , , , , , , , , 0.03, 0.5, 0.02],
  powerup: [1, , 523, 0.03, 0.18, 0.36, 1, 1.7, , , , , 0.06, , , , 0.08, 0.61, 0.06],
  lose: [1.3, , 925, 0.04, 0.3, 0.6, 1, 0.3, , 6.27, -184, 0.09, 0.17],
  start: [1.1, , 400, 0.02, 0.12, 0.3, 1, 1.4, , , 300, 0.05, 0.05],
} satisfies Record<string, (number | undefined)[]>;

export type Sound = keyof typeof SOUNDS;

let muted = false;
let unlocked = false;

function unlock() {
  if (unlocked) return;
  unlocked = true;
  ZZFX.audioContext?.resume().catch(() => {});
}

export const sfx = {
  init() {
    muted = load("muted", false);
    ZZFX.volume = 0.35;
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  },
  play(sound: Sound, pitch = 1) {
    if (muted || !unlocked) return;
    const params = [...SOUNDS[sound]];
    if (pitch !== 1 && typeof params[2] === "number") params[2] *= pitch;
    zzfx(...params);
  },
  toggleMute() {
    muted = !muted;
    save("muted", muted);
    return muted;
  },
  get muted() {
    return muted;
  },
};
