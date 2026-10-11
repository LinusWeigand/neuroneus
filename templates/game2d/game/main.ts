import * as Phaser from "phaser";
import { HEIGHT, WIDTH } from "./config";
import { PALETTE, PIXEL_ART } from "./palette";
import { probe } from "./probe";
import { BootScene } from "./scenes/boot";
import { GameOverScene } from "./scenes/game-over";
import { PauseScene } from "./scenes/pause";
import { PlayScene } from "./scenes/play";
import { TitleScene } from "./scenes/title";
import { sfx } from "./sfx";

export function startGame(parent: HTMLElement) {
  sfx.init();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: PALETTE.background,
    pixelArt: PIXEL_ART,
    antialias: !PIXEL_ART,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    input: { activePointers: 3 },
    scene: [BootScene, TitleScene, PlayScene, PauseScene, GameOverScene],
  });
  probe.attach();
  return () => game.destroy(true);
}
