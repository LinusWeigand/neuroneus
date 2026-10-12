import * as THREE from "three";
import { createFx } from "./juice";
import { createInput } from "./input";
import { createLook } from "./look";
import { loadModels } from "./models";
import { createQuality } from "./quality";
import { Play } from "./play";
import { probe } from "./probe";
import { sfx } from "./sfx";
import { bestScore } from "./storage";
import { actions, store } from "./store";
import { createWorld } from "./world";

export function startGame(host: HTMLElement) {
  sfx.init();
  probe.attach();
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 300);
  createWorld(scene, renderer);
  const look = createLook(renderer, scene, camera);
  const fx = createFx(scene, camera);
  const input = createInput(host);
  let play: Play | null = null;

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = width / Math.max(1, height);
    camera.fov = fieldOfView(camera.aspect);
    camera.updateProjectionMatrix();
    look.setSize(width, height);
  };
  const quality = createQuality(renderer, resize);
  window.addEventListener("resize", resize);
  resize();

  store.set({ screen: "loading", best: bestScore() });
  loadModels((progress) => store.set({ progress })).then((models) => {
    play = new Play(scene, camera, models, input, fx);
    store.set({ screen: "title" });
  });

  store.bind({
    start() {
      if (!play) return;
      sfx.play("start");
      play.reset();
      store.set({ screen: "play" });
    },
    pause() {
      if (store.state.screen === "play") store.set({ screen: "paused" });
    },
    resume() {
      if (store.state.screen === "paused") store.set({ screen: "play" });
    },
    restart() {
      sfx.play("start");
      play?.reset();
      store.set({ screen: "play" });
    },
    toTitle() {
      play?.reset();
      store.set({ screen: "title" });
    },
  });

  let screenSince = performance.now();
  let lastScreen = store.state.screen;
  const unsubscribe = store.subscribe(() => {
    if (store.state.screen === lastScreen) return;
    lastScreen = store.state.screen;
    screenSince = performance.now();
  });
  const onKey = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if ((key === " " || key === "enter") && e.target instanceof HTMLButtonElement) return;
    const screen = store.state.screen;
    const settled = performance.now() - screenSince > 500;
    if (key === " " || key === "enter") {
      if (screen === "title") actions.start();
      else if (screen === "over" && settled) actions.restart();
    }
    if (key === "escape" || key === "p") {
      if (screen === "play") actions.pause();
      else if (screen === "paused") actions.resume();
    }
    if (key === "m") sfx.toggleMute();
  };
  const onBlur = () => {
    if (store.state.screen === "play") store.set({ screen: "paused" });
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("blur", onBlur);

  const clock = new THREE.Clock();
  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    if (play) {
      if (store.state.screen === "play") play.update(dt);
      else if (store.state.screen === "title") play.idle(dt);
    }
    fx.update(dt);
    look.render(dt);
    quality.tick(performance.now());
  };
  tick();

  return () => {
    cancelAnimationFrame(frame);
    unsubscribe();
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("blur", onBlur);
    input.dispose();
    look.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

function fieldOfView(aspect: number) {
  const minHorizontal = THREE.MathUtils.degToRad(62);
  const vertical = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minHorizontal / 2) / aspect));
  return THREE.MathUtils.clamp(vertical, 55, 85);
}
