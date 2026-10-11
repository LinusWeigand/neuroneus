declare module "zzfx" {
  export function zzfx(...parameters: (number | undefined)[]): AudioBufferSourceNode;
  export const ZZFX: { volume: number; audioContext: AudioContext };
}
