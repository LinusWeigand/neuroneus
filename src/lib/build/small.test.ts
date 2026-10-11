import { describe, expect, it } from "vitest";
import { decodeBlob, encodeBlob } from "./blob-codec";
import { deployStage } from "./deploy-stage";
import { humanLanguage } from "./language";

describe("blob codec", () => {
  it("round-trips through gzip and still reads plain JSON from the migration", async () => {
    const value = { files: { "a.ts": "export {}" } };
    expect(await decodeBlob(await encodeBlob(value))).toEqual(value);
    expect(await decodeBlob(Buffer.from(JSON.stringify(value)))).toEqual(value);
  });
});

describe("deployStage", () => {
  it("names the stage from the newest log lines", () => {
    expect(deployStage("QUEUED", [])).toBe("queued");
    expect(deployStage("BUILDING", ["Running TypeScript ..."])).toBe("checking");
    expect(deployStage("BUILDING", ["Collecting page data"])).toBe("pages");
    expect(deployStage("BUILDING", ["added 312 packages in 9s"])).toBe("installing");
  });
});

describe("humanLanguage", () => {
  it("lets the newest message with a clear signal decide", () => {
    expect(humanLanguage(["ok", "Wir sind zu viert in der WG und wollen das einfach halten", "We are four"])).toBe("German");
    expect(humanLanguage(["Please make it simple for all of us"])).toBe("English");
    expect(humanLanguage(["👍"])).toBe("English");
  });
});
