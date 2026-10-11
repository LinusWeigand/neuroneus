import "server-only";
import { generateText, Output, type UserContent } from "ai";
import { chromium, type Page } from "playwright-core";
import { z } from "zod";
import { callSettings, modelFor, structuredModelId } from "@/lib/ai";
import { putBlob, storageConfigured } from "@/lib/art/blob";
import { recordUsage, type UsageScope } from "@/lib/usage";
import type { BuildTask } from "@/lib/types";

export type CaptureStage = "open" | "start" | "play" | "capture";
export type Shot = { name: string; url: string };
export type Capture = { url: string; status: number | null; shots: Shot[]; probe: Record<string, unknown> | null; errors: string[]; game: boolean };
export type Verdict = { works: boolean; problems: string[]; visualScore: number | null; notes: string[] };

const LAUNCH_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const PLAY_KEYS = ["ArrowRight", "ArrowUp", "Space", "ArrowLeft", "ArrowDown", "Space", "ArrowRight", "ArrowUp", "Space", "ArrowLeft"];

export function verificationConfigured() {
  return Boolean(process.env.BROWSER_WS_ENDPOINT) && storageConfigured();
}

type ProbeWindow = Window & { __GAME__?: { state?: Record<string, unknown> } };

async function probeState(page: Page) {
  return page.evaluate(() => (window as ProbeWindow).__GAME__?.state ?? null).catch(() => null);
}

export async function capture(input: {
  url: string;
  game: boolean;
  evidencePrefix: string;
  onStage: (stage: CaptureStage) => Promise<void>;
}): Promise<Capture> {
  const browser = await chromium.connect(process.env.BROWSER_WS_ENDPOINT!, {
    timeout: 150_000,
    headers: { "x-playwright-launch-options": JSON.stringify({ args: LAUNCH_ARGS }) },
  });
  const shots: Shot[] = [];
  const errors: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 300)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    const shoot = async (name: string, target: Page = page) => {
      const data = await target.screenshot({ type: "jpeg", quality: 80 });
      const url = await putBlob("evidence", `${input.evidencePrefix}-${name}.jpg`, data, "image/jpeg");
      shots.push({ name, url });
    };

    await input.onStage("open");
    const response = await page.goto(input.url, { waitUntil: "load", timeout: 60_000 });
    let probe: Record<string, unknown> | null = null;
    if (input.game) {
      await page
        .waitForFunction(() => {
          const scene = (window as ProbeWindow).__GAME__?.state?.scene;
          return typeof scene === "string" && scene !== "boot";
        }, null, { timeout: 45_000 })
        .catch(() => {});
      await page.waitForTimeout(2000);
      await shoot("title");
      await input.onStage("start");
      await page.keyboard.press("Space");
      await page.mouse.click(640, 420);
      await page.waitForFunction(() => (window as ProbeWindow).__GAME__?.state?.scene === "play", null, { timeout: 15_000 }).catch(() => {});
      await input.onStage("play");
      for (const [i, key] of PLAY_KEYS.entries()) {
        await page.keyboard.down(key === "Space" ? " " : key);
        await page.waitForTimeout(650);
        await page.keyboard.up(key === "Space" ? " " : key);
        if (i === 3) await shoot("play-early");
      }
      await input.onStage("capture");
      await shoot("play-late");
      probe = await probeState(page);
    } else {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await shoot("desktop");
      const links = await page
        .$$eval("a[href^='/']", (anchors) => [...new Set(anchors.map((a) => a.getAttribute("href") ?? "/").filter((h) => h !== "/" && !h.startsWith("/_")))].slice(0, 2))
        .catch(() => [] as string[]);
      for (const [i, href] of links.entries()) {
        await page.goto(new URL(href, input.url).toString(), { waitUntil: "load", timeout: 30_000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await shoot(`page-${i + 1}`);
      }
      await input.onStage("capture");
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const mobile = await phone.newPage();
      await mobile.goto(input.url, { waitUntil: "load", timeout: 60_000 }).catch(() => {});
      await mobile.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await shoot("phone", mobile);
    }
    return { url: input.url, status: response?.status() ?? null, shots, probe, errors: [...new Set(errors)].slice(0, 12), game: input.game };
  } finally {
    await browser.close().catch(() => {});
  }
}

const verdictSchema = z.object({
  works: z.boolean(),
  problems: z.array(z.string()),
  visualScore: z.number(),
  notes: z.array(z.string()),
});

export async function judge(input: {
  scope: UsageScope;
  task: Pick<BuildTask, "title" | "detail">;
  spec: string;
  capture: Capture;
  conceptUrl: string | null;
  artDirection: string | null;
}): Promise<Verdict> {
  const { capture: c } = input;
  const model = structuredModelId();
  const content: Exclude<UserContent, string> = [];
  if (input.conceptUrl) {
    content.push({ type: "text", text: "TARGET: the concept screenshot the game must look like." });
    content.push({ type: "image", image: new URL(input.conceptUrl) });
  }
  for (const shot of c.shots) {
    content.push({ type: "text", text: `SCREENSHOT "${shot.name}"` });
    content.push({ type: "image", image: new URL(shot.url) });
  }
  content.push({
    type: "text",
    text: `Opened ${c.url} (HTTP ${c.status ?? "no response"}).${c.game ? ` Screenshots: "title" after loading; then Space and a click to start; "play-early" and "play-late" after scripted arrow keys and Space for about 6 seconds. Game state reported by the game: ${JSON.stringify(c.probe)}.` : ` Screenshots: the home page at 1280×720, up to two linked pages, and the home page on a phone (390 px).`}
Console and page errors: ${c.errors.length ? c.errors.join(" | ") : "none"}.`,
  });
  const { output, usage } = await generateText({
    model: modelFor(model),
    output: Output.object({ schema: verdictSchema }),
    ...callSettings(model, 2500),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(220_000),
    instructions: `You are the QA lead and art director who decides whether a change ships. You get the task the engineer just built, the product spec, screenshots of the deployed preview${input.conceptUrl ? ", and the target screenshot the game must look like" : ""}.

Task: ${input.task.title}
${input.task.detail}

Spec:
${input.spec}
${input.artDirection ? `\nArt direction:\n${input.artDirection}\n` : ""}
Decide:
- works: false only when something is clearly broken in what you can see: a blank, error or default page; the game not rendering, not starting or not reacting; errors that break use; the task's visible acceptance criteria clearly not met; layout broken (overlapping, cut off, unreadable). Things the scripted check couldn't reach are not failures.
- problems: when works is false, the concrete fixes for the engineer: what is wrong, where it shows, what to change. Empty when works is true.
- visualScore: 1 to 10, how polished and finished it looks${input.conceptUrl ? " compared with the target screenshot (10: as good as the target; 5: recognisably the game but plain or unpolished; 2: placeholder shapes)" : " for a modern product built to its design system (10: ready to show customers; 5: works but plain; 2: unstyled)"}.
- notes: up to 3 specific visual improvements that would raise the score most, in order of impact.
Write in English, briefly.`,
    messages: [{ role: "user", content }],
  });
  await recordUsage(input.scope, "build", model, usage);
  return {
    works: output.works,
    problems: output.problems.slice(0, 8),
    visualScore: Math.round(Math.min(10, Math.max(1, output.visualScore))),
    notes: output.notes.slice(0, 3),
  };
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
