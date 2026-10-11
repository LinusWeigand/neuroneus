import * as Phaser from "phaser";
import { backdrop } from "../backdrop";
import { arrive, burst, float, go } from "../juice";
import { applyLook } from "../look";
import { probe } from "../probe";
import { sfx } from "../sfx";
import { bestScore, recordScore } from "../storage";
import { TEXT } from "../text";
import { button, label, menu, panel } from "../ui";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("over");
  }

  create(data: { score?: number }) {
    const score = data.score ?? 0;
    const previous = bestScore();
    const best = recordScore(score);
    probe.set({ scene: "over", over: true, score, best });
    applyLook(this);
    backdrop(this);
    arrive(this);
    const { width, height } = this.scale;

    panel(this, width / 2, height / 2, 620, 520);
    float(label(this, width / 2, height / 2 - 190, TEXT.gameOver, { size: 72, color: "danger" }), 6, 2000);
    const shown = label(this, width / 2, height / 2 - 70, "0", { size: 96, color: "accent" });
    this.tweens.addCounter({
      from: 0,
      to: score,
      duration: Math.min(1200, 300 + score * 4),
      ease: "Quad.easeOut",
      onUpdate: (tween) => shown.setText(String(Math.round(tween.getValue() ?? 0))),
    });
    label(this, width / 2, height / 2 + 10, `${TEXT.best}: ${best}`, { size: 24, role: "body", color: "textMuted", stroke: false });
    if (score > previous && score > 0) {
      label(this, width / 2, height / 2 - 140, TEXT.newBest, { size: 28, color: "success" });
      this.time.delayedCall(500, () => {
        sfx.play("powerup");
        burst(this, width / 2, height / 2 - 70, { color: ["accent", "success", "text"], count: 50, speed: [160, 480], lifespan: 1000 });
      });
    }
    menu(this, [
      button(this, width / 2, height / 2 + 110, TEXT.playAgain, () => go(this, "play")),
      button(this, width / 2, height / 2 + 200, TEXT.toTitle, () => go(this, "title"), { color: "surface" }),
    ]);
  }
}
