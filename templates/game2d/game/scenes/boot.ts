import * as Phaser from "phaser";
import { IMAGE_ENTRIES, SPRITESHEET_ENTRIES } from "../assets";
import { hex } from "../color";
import { loadFonts } from "../fonts";
import { probe } from "../probe";
import { createProceduralTextures } from "../textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    createProceduralTextures(this);
    const { width, height } = this.scale;
    const bar = this.add.graphics();
    this.load.on("progress", (value: number) => {
      bar.clear();
      bar.fillStyle(hex("surface"), 1).fillRoundedRect(width / 2 - 200, height / 2 - 8, 400, 16, 8);
      bar.fillStyle(hex("primary"), 1).fillRoundedRect(width / 2 - 200, height / 2 - 8, Math.max(16, 400 * value), 16, 8);
    });
    for (const [key, url] of IMAGE_ENTRIES) this.load.image(key, url);
    for (const [key, sheet] of SPRITESHEET_ENTRIES) {
      this.load.spritesheet(key, sheet.url, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
    }
  }

  create() {
    probe.set({ scene: "boot" });
    loadFonts().then(() => this.scene.start("title"));
  }
}
