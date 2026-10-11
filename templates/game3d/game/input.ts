export type Input = { x: number; y: number; action: boolean; dispose(): void };

const KEYS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
};

export function createInput(target: HTMLElement): Input {
  const held = new Set<string>();
  const stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  const input: Input = { x: 0, y: 0, action: false, dispose };
  const sync = () => {
    let x = 0;
    let y = 0;
    for (const key of held) {
      const dir = KEYS[key];
      if (dir) {
        x += dir[0];
        y += dir[1];
      }
    }
    const length = Math.hypot(x, y);
    input.x = length ? x / length : stick.x;
    input.y = length ? y / length : stick.y;
    input.action = held.has(" ") || held.has("enter") || held.has("z");
  };
  const onKey = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (e.type === "keydown") held.add(key);
    else held.delete(key);
    if (key in KEYS || key === " ") e.preventDefault();
    sync();
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || stick.id !== -1) return;
    Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== stick.id) return;
    const dx = e.clientX - stick.ox;
    const dy = e.clientY - stick.oy;
    const length = Math.max(1, Math.hypot(dx, dy));
    const k = Math.min(1, length / 70);
    stick.x = (dx / length) * k;
    stick.y = (dy / length) * k;
    sync();
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== stick.id) return;
    Object.assign(stick, { id: -1, x: 0, y: 0 });
    sync();
  };
  const onBlur = () => {
    held.clear();
    sync();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", onBlur);
  target.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  function dispose() {
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    window.removeEventListener("blur", onBlur);
    target.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  return input;
}
