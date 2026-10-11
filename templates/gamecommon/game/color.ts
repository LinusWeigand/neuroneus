import { PALETTE } from "./palette";

export type PaletteColor = keyof typeof PALETTE;

export function hex(name: PaletteColor): number {
  return parseInt(PALETTE[name].slice(1), 16);
}

export function css(name: PaletteColor): string {
  return PALETTE[name];
}

export function rgb(name: PaletteColor): [number, number, number] {
  const value = hex(name);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
