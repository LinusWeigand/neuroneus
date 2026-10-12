export type CaptureStage = "open" | "start" | "play" | "capture";
export type Shot = { name: string; url: string };
export type Capture = { url: string; status: number | null; shots: Shot[]; probe: Record<string, unknown> | null; errors: string[]; game: boolean };
export type Verdict = { works: boolean; problems: string[]; visualScore: number | null; notes: string[] };

const REAL_DEVICE_FPS = 20;

export function holdFor(fps: unknown) {
  const measured = typeof fps === "number" && fps > 0 ? fps : REAL_DEVICE_FPS;
  return Math.round(650 * Math.min(5, Math.max(1, REAL_DEVICE_FPS / measured)));
}

export function reviewFacts(c: Capture) {
  const opened = `Opened ${c.url} (HTTP ${c.status ?? "no response"}).`;
  const errors = `Console and page errors: ${c.errors.length ? c.errors.join(" | ") : "none"}.`;
  if (!c.game) return `${opened} Screenshots: the home page at 1280×720, up to two linked pages, and the home page on a phone (390 px).\n${errors}`;
  const state = Object.fromEntries(Object.entries(c.probe ?? {}).filter(([key]) => key !== "fps"));
  return `${opened} Screenshots: "title" after loading; then Space and a click to start; "play-early" and "play-late" after scripted arrow keys and Space for about 6 seconds. Game state reported by the game: ${JSON.stringify(state)}.
The preview runs in a headless browser with software rendering, far slower than any real device, so the game may have advanced only a little between screenshots. Never judge frame rate, smoothness or performance.
${errors}`;
}

export function verdictLog(verdict: Verdict, capture: Capture) {
  const lines = ["Verification in the preview found problems:", ...verdict.problems.map((p) => `- ${p}`)];
  if (capture.errors.length) lines.push("", "Console and page errors:", ...capture.errors.map((e) => `- ${e}`));
  return lines.join("\n");
}

export function polishLog(verdict: Verdict) {
  return [
    `It works, but the reviewer scored the look ${verdict.visualScore}/10 against the target. Make it look like the target screenshot and docs/ART-DIRECTION.md:`,
    ...verdict.notes.map((n) => `- ${n}`),
  ].join("\n");
}
