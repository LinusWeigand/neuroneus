import * as Phaser from "phaser";
import { hex } from "../color";
import { probe } from "../probe";
import { TEXT } from "../text";
import { button, label, menu, panel } from "../ui";

export class PauseScene extends Phaser.Scene {
  constructor() {
    super("pause");
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, hex("background"), 0.6).setOrigin(0);
    panel(this, width / 2, height / 2, 520, 420);
    label(this, width / 2, height / 2 - 140, TEXT.paused, { size: 56 });
    const resume = () => {
      probe.set({ paused: false });
      this.scene.stop();
      this.scene.resume("play");
    };
    const buttons = [
      button(this, width / 2, height / 2 - 30, TEXT.resume, resume),
      button(this, width / 2, height / 2 + 60, TEXT.restart, () => {
        this.scene.stop();
        this.scene.stop("play");
        this.scene.start("play");
      }, { color: "secondary" }),
      button(this, width / 2, height / 2 + 150, TEXT.toTitle, () => {
        this.scene.stop("play");
        this.scene.start("title");
      }, { color: "surface" }),
    ];
    menu(this, buttons);
    this.input.keyboard?.once("keydown-ESC", resume);
    this.input.keyboard?.once("keydown-P", resume);
  }
}
