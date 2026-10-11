import { probe } from "./probe";

export type Screen = "loading" | "title" | "play" | "paused" | "over";

export type GameState = { screen: Screen; score: number; lives: number; best: number; newBest: boolean; progress: number };

export type Actions = { start(): void; pause(): void; resume(): void; restart(): void; toTitle(): void };

let state: GameState = { screen: "loading", score: 0, lives: 3, best: 0, newBest: false, progress: 0 };
const listeners = new Set<() => void>();
const noop = () => {};

export const actions: Actions = { start: noop, pause: noop, resume: noop, restart: noop, toTitle: noop };

export const store = {
  get state() {
    return state;
  },
  set(values: Partial<GameState>) {
    state = { ...state, ...values };
    probe.set({ scene: state.screen === "loading" ? "boot" : state.screen === "paused" ? "play" : state.screen, score: state.score, lives: state.lives, best: state.best, paused: state.screen === "paused", over: state.screen === "over" });
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  bind(next: Actions) {
    Object.assign(actions, next);
  },
};
