import { describe, expect, it } from "vitest";
import { compactNumber, DICTIONARIES } from "./dictionaries";

function shape(value: unknown, path = ""): string[] {
  if (typeof value === "function") return [`${path}()`];
  if (value && typeof value === "object") return Object.keys(value).sort().flatMap((k) => shape((value as Record<string, unknown>)[k], `${path}.${k}`));
  return [path];
}

describe("dictionaries", () => {
  it("has the same keys in English and German", () => {
    expect(shape(DICTIONARIES.de)).toEqual(shape(DICTIONARIES.en));
  });

  it("never leaves a German string empty", () => {
    const empty = shape(DICTIONARIES.de).filter((path) => {
      const value = path.split(".").filter(Boolean).reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k.replace("()", "")], DICTIONARIES.de);
      return value === "";
    });
    expect(empty).toEqual([]);
  });
});

describe("compactNumber", () => {
  it("formats token counts the same on server and client", () => {
    expect(compactNumber(950, "en")).toBe("950");
    expect(compactNumber(12_400, "en")).toBe("12k");
    expect(compactNumber(1_234_567, "en")).toBe("1.23M");
    expect(compactNumber(1_234_567, "de")).toBe("1,23M");
  });
});
