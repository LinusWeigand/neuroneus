import * as Phaser from "phaser";
import { hasImage } from "../assets";
import { backdrop } from "../backdrop";
import { hex } from "../color";
import { arrive, float, flash, go, pulse, trail } from "../juice";
import { applyLook } from "../look";
import { probe } from "../probe";
import { sfx } from "../sfx";
import { bestScore } from "../storage";
import { TEXT } from "../text";
import { label } from "../ui";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create() {
    probe.set({ scene: "title", over: false, paused: false, best: bestScore() });
    applyLook(this);
    backdrop(this, hasImage("title") ? "title" : "background");
    arrive(this);
    const { width, height } = this.scale;

    const hero = hasImage("player") ? this.add.image(width * 0.5, height * 0.62, "player") : this.add.image(width * 0.5, height * 0.62, "diamond").setTint(hex("primary"));
    hero.setDisplaySize(120, 120 * (hero.height / hero.width));
    float(hero, 14, 1800);
    trail(this, hero, "primary");

    const title = label(this, width / 2, height * 0.28, TEXT.title, { size: 92 });
    title.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 600, ease: "Back.easeOut" });
    float(title, 6, 2400);
    if (TEXT.tagline) label(this, width / 2, height * 0.28 + 84, TEXT.tagline, { size: 26, role: "body", color: "textMuted", bold: false, stroke: false, wrap: width * 0.7 });

    const touch = this.sys.game.device.input.touch;
    const start = label(this, width / 2, height * 0.84, touch ? TEXT.tapToStart : TEXT.pressToStart, { size: 32, color: "accent" });
    pulse(start, 1.08, 650);
    const best = bestScore();
    if (best > 0) label(this, width / 2, height * 0.93, `${TEXT.best}: ${best}`, { size: 20, role: "body", color: "textMuted", stroke: false });

    let leaving = false;
    const begin = () => {
      if (leaving) return;
      leaving = true;
      sfx.play("start");
      flash(this, "text", 120);
      go(this, "play");
    };
    this.input.keyboard?.once("keydown-SPACE", begin);
    this.input.keyboard?.once("keydown-ENTER", begin);
    this.input.once("pointerdown", begin);
    this.input.keyboard?.on("keydown-M", () => sfx.toggleMute());
  }
}
