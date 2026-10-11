import "server-only";
import sharp from "sharp";

const MAGENTA_HUE = 300;

function hue(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, v: max / 255 };
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: d / max, v: max / 255 };
}

export function magentaAlpha(r: number, g: number, b: number) {
  const { h, s, v } = hue(r, g, b);
  const distance = Math.abs(h - MAGENTA_HUE);
  if (distance > 32 || s < 0.35 || v < 0.25) return 255;
  const hueWeight = Math.min(1, Math.max(0, (32 - distance) / 16));
  const saturationWeight = Math.min(1, Math.max(0, (s - 0.35) / 0.25));
  return Math.round(255 * (1 - hueWeight * saturationWeight));
}

export async function cutOut(png: Buffer, maxSize = 512): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const raw = magentaAlpha(data[i], data[i + 1], data[i + 2]);
    const alpha = raw < 48 ? 0 : raw;
    if (alpha < 255) {
      data[i + 3] = Math.min(data[i + 3], alpha);
      const spill = Math.min(data[i], data[i + 2]) - data[i + 1];
      if (spill > 0 && alpha > 0) {
        data[i] -= spill * 0.6;
        data[i + 2] -= spill * 0.6;
      }
    }
  }
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
