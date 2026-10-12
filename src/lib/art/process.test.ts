import { describe, expect, it } from "vitest";
import { keyBackground, type Rgb } from "./process";

const SIZE = 64;

function image(paint: (x: number, y: number) => Rgb) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      data.set([...paint(x, y), 255], (y * SIZE + x) * 4);
    }
  }
  return data;
}

const alphaAt = (data: Uint8Array, x: number, y: number) => data[(y * SIZE + x) * 4 + 3];
const inBox = (x: number, y: number, from: number, to: number) => x >= from && x < to && y >= from && y < to;
const dustyPink = (x: number, y: number): Rgb => [198 + ((x * 7 + y * 3) % 9) - 4, 100 + ((x + y * 5) % 7) - 3, 128 + ((x * 3 + y) % 9) - 4];

describe("keyBackground", () => {
  it("removes a textured background that isn't the requested magenta and keeps the subject", () => {
    const data = image((x, y) => (inBox(x, y, 20, 44) ? [70, 72, 80] : dustyPink(x, y)));
    const result = keyBackground(data, SIZE, SIZE);
    expect(result.clear).toBe(1);
    expect(alphaAt(data, 2, 2)).toBe(0);
    expect(alphaAt(data, 32, 32)).toBe(255);
  });

  it("keeps pinks inside the subject that differ from the background", () => {
    const data = image((x, y) => (inBox(x, y, 24, 40) ? [244, 182, 200] : inBox(x, y, 18, 46) ? [40, 20, 30] : [255, 0, 255]));
    keyBackground(data, SIZE, SIZE);
    expect(alphaAt(data, 32, 32)).toBe(255);
    expect(alphaAt(data, 19, 32)).toBeGreaterThan(0);
  });

  it("removes a darker cast shadow of the background color attached to it", () => {
    const data = image((x, y) => (inBox(x, y, 20, 40) ? [90, 90, 95] : y >= 40 && y < 46 && x >= 20 && x < 44 ? [120, 0, 120] : [255, 0, 255]));
    keyBackground(data, SIZE, SIZE);
    expect(alphaAt(data, 30, 43)).toBe(0);
    expect(alphaAt(data, 30, 30)).toBe(255);
  });

  it("drops stray specks left in the background", () => {
    const data = image((x, y) => (inBox(x, y, 20, 44) ? [70, 72, 80] : x === 6 && y === 6 ? [250, 250, 250] : [255, 0, 255]));
    keyBackground(data, SIZE, SIZE);
    expect(alphaAt(data, 6, 6)).toBe(0);
    expect(alphaAt(data, 32, 32)).toBe(255);
  });

  it("reports a border it couldn't clear, so a full-bleed picture is rejected", () => {
    const data = image((x) => (x < SIZE / 2 ? [30, 60, 200] : [220, 180, 40]));
    expect(keyBackground(data, SIZE, SIZE).clear).toBeLessThan(0.9);
  });
});
