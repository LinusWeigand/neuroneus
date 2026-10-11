import * as Phaser from "phaser";
import { hasImage } from "../assets";
import { backdrop } from "../backdrop";
import { hex } from "../color";
import { type Controls, createControls } from "../controls";
import { arrive, burst, flash, go, hitStop, popText, shake, squash, trail } from "../juice";
import { applyLook } from "../look";
import { probe } from "../probe";
import { sfx } from "../sfx";
import { TEXT } from "../text";
import { hudCounter } from "../ui";

const PLAYER_SIZE = 72;
const SPEED = 520;

export class PlayScene extends Phaser.Scene {
  private controls!: Controls;
  private player!: Phaser.Physics.Arcade.Image;
  private pickups!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private score = 0;
  private lives = 3;
  private combo = 0;
  private invulnerableUntil = 0;
  private elapsed = 0;
  private scoreHud!: ReturnType<typeof hudCounter>;
  private livesHud!: ReturnType<typeof hudCounter>;

  constructor() {
    super("play");
  }

  create() {
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.elapsed = 0;
    probe.set({ scene: "play", score: 0, lives: this.lives, over: false, paused: false });
    applyLook(this);
    backdrop(this);
    arrive(this);
    const { width, height } = this.scale;

    this.player = this.physics.add.image(width / 2, height * 0.7, hasImage("player") ? "player" : "diamond");
    if (!hasImage("player")) this.player.setTint(hex("primary"));
    this.player.setDisplaySize(PLAYER_SIZE, PLAYER_SIZE * (this.player.height / this.player.width));
    this.player.setCollideWorldBounds(true);
    this.player.body?.setCircle(this.player.width * 0.38, this.player.width * 0.12, this.player.height * 0.12);
    trail(this, this.player, "primary");

    this.pickups = this.physics.add.group();
    this.hazards = this.physics.add.group();
    this.physics.add.overlap(this.player, this.pickups, (_, pickup) => this.collect(pickup as Phaser.Physics.Arcade.Image));
    this.physics.add.overlap(this.player, this.hazards, (_, hazard) => this.hurt(hazard as Phaser.Physics.Arcade.Image));

    this.scoreHud = hudCounter(this, 32, 24, TEXT.score);
    this.livesHud = hudCounter(this, width - 32, 24, TEXT.lives, "right");
    this.livesHud.set(this.lives);

    this.controls = createControls(this);
    for (let i = 0; i < 3; i++) this.spawnPickup();
    this.time.addEvent({ delay: 900, loop: true, callback: () => this.spawnPickup() });
    this.time.addEvent({ delay: 1400, loop: true, callback: () => this.spawnHazard() });
    this.game.events.on(Phaser.Core.Events.BLUR, this.pause, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.BLUR, this.pause, this));
    this.input.keyboard?.on("keydown-M", () => sfx.toggleMute());
  }

  update(_: number, delta: number) {
    this.controls.update();
    if (this.controls.pausePressed) return this.pause();
    this.elapsed += delta;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const smoothing = 1 - Math.pow(0.0001, delta / 1000);
    body.setVelocity(
      Phaser.Math.Linear(body.velocity.x, this.controls.x * SPEED, smoothing),
      Phaser.Math.Linear(body.velocity.y, this.controls.y * SPEED, smoothing),
    );
    this.player.setRotation(Phaser.Math.Linear(this.player.rotation, body.velocity.x / SPEED / 4, 0.2));
    this.player.setAlpha(this.time.now < this.invulnerableUntil ? 0.45 + 0.4 * Math.sin(this.time.now / 40) : 1);
    for (const hazard of this.hazards.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (hazard.y > this.scale.height + 80) hazard.destroy();
    }
  }

  private spawnPickup() {
    const { width, height } = this.scale;
    const pickup = this.pickups.create(Phaser.Math.Between(80, width - 80), Phaser.Math.Between(120, height - 80), hasImage("pickup") ? "pickup" : "star") as Phaser.Physics.Arcade.Image;
    if (!hasImage("pickup")) pickup.setTint(hex("accent"));
    pickup.setDisplaySize(44, 44 * (pickup.height / pickup.width)).setScale(0);
    this.tweens.add({ targets: pickup, scale: 44 / pickup.width, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: pickup, angle: 360, duration: 4000, repeat: -1 });
    this.time.delayedCall(6000, () => pickup.active && this.tweens.add({ targets: pickup, scale: 0, duration: 200, onComplete: () => pickup.destroy() }));
  }

  private spawnHazard() {
    const { width } = this.scale;
    const speed = 160 + Math.min(320, this.elapsed / 120);
    const hazard = this.hazards.create(Phaser.Math.Between(40, width - 40), -60, hasImage("hazard") ? "hazard" : "diamond") as Phaser.Physics.Arcade.Image;
    if (!hasImage("hazard")) hazard.setTint(hex("danger"));
    hazard.setDisplaySize(58, 58 * (hazard.height / hazard.width)).setVelocity(Phaser.Math.Between(-60, 60), speed).setAngularVelocity(Phaser.Math.Between(-120, 120));
  }

  private collect(pickup: Phaser.Physics.Arcade.Image) {
    const points = 10 * (1 + Math.min(4, this.combo));
    this.combo += 1;
    this.score += points;
    this.scoreHud.set(this.score);
    probe.set({ score: this.score });
    sfx.play("pickup", 1 + Math.min(0.5, this.combo * 0.06));
    burst(this, pickup.x, pickup.y, { color: ["accent", "text"], count: 16 });
    popText(this, pickup.x, pickup.y - 20, `+${points}`);
    squash(this.player, 1.2, 0.85);
    pickup.destroy();
  }

  private hurt(hazard: Phaser.Physics.Arcade.Image) {
    if (this.time.now < this.invulnerableUntil) return;
    this.lives -= 1;
    this.combo = 0;
    this.livesHud.set(this.lives);
    probe.set({ lives: this.lives });
    burst(this, hazard.x, hazard.y, { color: ["danger", "accent"], count: 26, speed: [140, 420] });
    hazard.destroy();
    if (this.lives <= 0) return this.lose();
    this.invulnerableUntil = this.time.now + 1200;
    sfx.play("hit");
    shake(this, "medium");
    flash(this, "danger", 110);
    hitStop(this, 70);
  }

  private lose() {
    sfx.play("lose");
    shake(this, "heavy");
    flash(this, "danger", 200);
    burst(this, this.player.x, this.player.y, { color: ["primary", "danger", "text"], count: 60, speed: [160, 560], lifespan: 900 });
    this.player.setVisible(false);
    this.physics.pause();
    probe.set({ over: true });
    this.time.delayedCall(700, () => go(this, "over", { score: this.score }));
  }

  private pause() {
    if (!this.scene.isActive() || probe.state.over) return;
    probe.set({ paused: true });
    this.scene.pause();
    this.scene.launch("pause");
  }
}
