import "server-only";
import sharp from "sharp";

export type Rgb = [number, number, number];

export class CutoutError extends Error {}

function distance(data: Uint8Array, i: number, [r, g, b]: Rgb) {
  const dr = data[i] - r;
  const dg = data[i + 1] - g;
  const db = data[i + 2] - b;
  const mean = (data[i] + r) / 2;
  return Math.sqrt((2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db) / 3;
}

function chroma(data: Uint8Array, i: number): Rgb {
  const sum = Math.max(1, data[i] + data[i + 1] + data[i + 2]);
  return [data[i] / sum, data[i + 1] / sum, data[i + 2] / sum];
}

function shadowOf(data: Uint8Array, i: number, background: Rgb, backgroundChroma: Rgb) {
  const sum = data[i] + data[i + 1] + data[i + 2];
  if (sum < 60 || sum >= background[0] + background[1] + background[2]) return false;
  const [r, g, b] = chroma(data, i);
  return Math.hypot(r - backgroundChroma[0], g - backgroundChroma[1], b - backgroundChroma[2]) < 0.05;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function borderIndexes(width: number, height: number, ring: number) {
  const pixels: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < ring || y < ring || x >= width - ring || y >= height - ring) pixels.push(y * width + x);
    }
  }
  return pixels;
}

export function keyBackground(data: Uint8Array, width: number, height: number) {
  const ring = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  const border = borderIndexes(width, height, ring);
  const background: Rgb = [0, 1, 2].map((c) => median(border.map((p) => data[p * 4 + c]))) as Rgb;
  const spread = border.map((p) => distance(data, p * 4, background)).sort((a, b) => a - b)[Math.floor(border.length * 0.9)];
  const tolerance = Math.min(110, Math.max(28, spread * 1.6 + 16));

  const backgroundChroma: Rgb = (() => {
    const sum = Math.max(1, background[0] + background[1] + background[2]);
    return [background[0] / sum, background[1] / sum, background[2] / sum];
  })();
  const isBackground = (p: number) => distance(data, p * 4, background) <= tolerance || shadowOf(data, p * 4, background, backgroundChroma);

  const removed = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (const p of border) {
    if (!removed[p] && isBackground(p)) {
      removed[p] = 1;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;
    for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
      if (n >= 0 && !removed[n] && isBackground(n)) {
        removed[n] = 1;
        queue[tail++] = n;
      }
    }
  }

  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (removed[p]) {
      data[i + 3] = 0;
      continue;
    }
    const d = distance(data, i, background);
    if (d <= tolerance * 0.5) {
      data[i + 3] = 0;
      continue;
    }
    const x = p % width;
    const touchesBackground = (x > 0 && removed[p - 1]) || (x < width - 1 && removed[p + 1]) || removed[p - width] || removed[p + width];
    if (!touchesBackground) continue;
    const alpha = Math.min(1, Math.max(0.15, (d - tolerance) / tolerance));
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(Math.min(255, Math.max(0, (data[i + c] - background[c] * (1 - alpha)) / alpha)));
    data[i + 3] = Math.min(data[i + 3], Math.round(alpha * 255));
  }

  dropSpecks(data, width, height);

  const clear = border.filter((p) => data[p * 4 + 3] === 0).length / border.length;
  return { background, tolerance, clear };
}

function dropSpecks(data: Uint8Array, width: number, height: number) {
  const label = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < width * height; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] === 0) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % width;
      for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (n >= 0 && n < width * height && label[n] === -1 && data[n * 4 + 3] > 0) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    sizes.push(size);
  }
  const keep = Math.max(24, Math.max(0, ...sizes) * 0.02);
  for (let p = 0; p < width * height; p++) if (label[p] !== -1 && sizes[label[p]] < keep) data[p * 4 + 3] = 0;
}

export async function cutOut(png: Buffer, maxSize = 512): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { clear } = keyBackground(data, info.width, info.height);
  if (clear < 0.9) throw new CutoutError(`The sprite's background could not be removed (${Math.round(clear * 100)}% of the border cleared).`);
  const keyed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  const trimmed = await sharp(keyed).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 }).toBuffer({ resolveWithObject: true });
  const out = await sharp(trimmed.data)
    .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

export async function toBackground(png: Buffer, width = 1920, height = 1080) {
  return sharp(png).resize({ width, height, fit: "cover" }).webp({ quality: 86 }).toBuffer();
}

export async function toJpeg(png: Buffer, width = 1280) {
  return sharp(png).resize({ width, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
}

export async function contactSheet(images: { data: Buffer; label: string }[], cell = 256) {
  const columns = Math.min(4, images.length);
  const rows = Math.ceil(images.length / columns);
  const tiles = await Promise.all(
    images.map(async (image, i) => ({
      input: await sharp(image.data).resize({ width: cell - 16, height: cell - 16, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
      left: (i % columns) * cell + 8,
      top: Math.floor(i / columns) * cell + 8,
    })),
  );
  return sharp({ create: { width: columns * cell, height: rows * cell, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } })
    .composite(tiles)
    .png()
    .toBuffer();
}
