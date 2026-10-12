import * as THREE from "three";
import { hex } from "./color";
import type { Fx } from "./juice";
import { animator, type Animator, instance, type Models } from "./models";
import type { Input } from "./input";
import { sfx } from "./sfx";
import { recordScore } from "./storage";
import { store } from "./store";

const ARENA = 26;
const SPEED = 14;
const MAGNET = 3.5;

type Thing = { mesh: THREE.Object3D; velocity: THREE.Vector3; kind: "pickup" | "hazard" };

export class Play {
  private player: THREE.Object3D;
  private playerMotion: Animator | null;
  private things: Thing[] = [];
  private spawnPickup = 0;
  private spawnHazard = 0;
  private invulnerable = 0;
  private elapsed = 0;
  private readonly cameraOffset = new THREE.Vector3(0, 6.5, 11);
  private readonly move = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private models: Models,
    private input: Input,
    private fx: Fx,
  ) {
    this.player = instance(models, "player", 2.2) ?? this.fallbackPlayer();
    this.playerMotion = animator(models, "player", this.player);
    this.playerMotion?.play("idle");
    scene.add(this.player, arenaEdge());
    this.reset();
  }

  reset() {
    for (const thing of this.things) this.scene.remove(thing.mesh);
    this.things = [];
    this.player.position.set(0, 0, 0);
    this.player.visible = true;
    this.elapsed = 0;
    this.invulnerable = 0;
    this.spawnPickup = 0;
    this.spawnHazard = 1.5;
    for (let i = 0; i < 8; i++) this.addPickup((i / 8) * Math.PI * 2, 4.5);
    store.set({ score: 0, lives: 3, newBest: false });
    this.follow(1);
  }

  idle(dt: number) {
    this.elapsed += dt;
    this.player.rotation.y += dt * 0.6;
    this.playerMotion?.update(dt);
    const angle = this.elapsed * 0.15;
    this.camera.position.set(Math.sin(angle) * 22, 10, Math.cos(angle) * 22);
    this.camera.lookAt(0, 1, 0);
    this.animateThings(dt, false);
  }

  update(dt: number) {
    this.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    const move = this.move.set(this.input.x, 0, this.input.y);
    this.playerMotion?.play(move.lengthSq() > 0 ? "run" : "idle");
    this.playerMotion?.update(dt);
    if (move.lengthSq() > 0) {
      this.player.position.addScaledVector(move, SPEED * dt);
      this.player.rotation.y = turnToward(this.player.rotation.y, Math.atan2(move.x, move.z), 1 - Math.pow(0.0001, dt));
    }
    this.player.position.clampLength(0, ARENA);
    this.player.visible = this.invulnerable === 0 || Math.floor(this.invulnerable * 12) % 2 === 0;

    this.spawnPickup -= dt;
    this.spawnHazard -= dt;
    if (this.spawnPickup <= 0) {
      this.addPickup();
      this.spawnPickup = 1.1;
    }
    if (this.spawnHazard <= 0) {
      this.addHazard();
      this.spawnHazard = Math.max(0.5, 1.8 - this.elapsed / 60);
    }
    this.animateThings(dt, true);
    this.follow(dt);
  }

  private follow(dt: number) {
    this.cameraTarget.copy(this.player.position).add(this.cameraOffset);
    this.camera.position.lerp(this.cameraTarget, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(this.player.position.x, 1.2, this.player.position.z - 7);
  }

  private animateThings(dt: number, live: boolean) {
    for (let i = this.things.length - 1; i >= 0; i--) {
      const thing = this.things[i];
      const reach = Math.hypot(thing.mesh.position.x - this.player.position.x, thing.mesh.position.z - this.player.position.z);
      if (live && thing.kind === "pickup" && reach < MAGNET) {
        const pull = (1 - reach / MAGNET) * 18 * dt;
        thing.mesh.position.x += ((this.player.position.x - thing.mesh.position.x) / Math.max(reach, 0.001)) * pull;
        thing.mesh.position.z += ((this.player.position.z - thing.mesh.position.z) / Math.max(reach, 0.001)) * pull;
      }
      thing.mesh.position.addScaledVector(thing.velocity, dt);
      thing.mesh.rotation.y += dt * (thing.kind === "pickup" ? 2 : 1);
      if (thing.kind === "pickup") thing.mesh.position.y = 1 + Math.sin(this.elapsed * 3 + i) * 0.25;
      if (thing.mesh.position.length() > ARENA + 12) {
        this.scene.remove(thing.mesh);
        this.things.splice(i, 1);
        continue;
      }
      if (live && reach < 1.6) {
        this.scene.remove(thing.mesh);
        this.things.splice(i, 1);
        if (thing.kind === "pickup") this.collect(thing.mesh.position);
        else this.hit(thing.mesh.position);
      }
    }
  }

  private collect(at: THREE.Vector3) {
    const score = store.state.score + 10;
    store.set({ score });
    sfx.play("pickup", 1 + Math.min(0.5, score / 400));
    this.fx.burst(at, "accent", 24, 6);
    this.fx.pop(this.player, 0.25);
  }

  private hit(at: THREE.Vector3) {
    if (this.invulnerable > 0) return;
    const lives = store.state.lives - 1;
    store.set({ lives });
    this.fx.burst(at, "danger", 40, 9);
    this.fx.shake(lives > 0 ? "medium" : "heavy");
    if (lives <= 0) {
      sfx.play("lose");
      this.player.visible = false;
      const before = store.state.best;
      const best = recordScore(store.state.score);
      store.set({ screen: "over", best, newBest: store.state.score > before });
      return;
    }
    sfx.play("hit");
    this.invulnerable = 1.2;
  }

  private addPickup(angle = Math.random() * Math.PI * 2, radius = 4 + Math.random() * (ARENA - 6)) {
    const mesh =
      instance(this.models, "pickup", 1.2) ??
      new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: hex("accent"), emissive: hex("accent"), emissiveIntensity: 1.6, flatShading: true }));
    mesh.position.set(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
    this.scene.add(mesh);
    this.things.push({ mesh, velocity: new THREE.Vector3(), kind: "pickup" });
  }

  private addHazard() {
    const angle = Math.random() * Math.PI * 2;
    const start = new THREE.Vector3(Math.cos(angle) * (ARENA + 8), 1, Math.sin(angle) * (ARENA + 8));
    const aim = this.player.position.clone().setY(1).add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
    const speed = 7 + Math.min(10, this.elapsed / 8);
    const mesh =
      instance(this.models, "hazard", 1.8) ??
      new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: hex("danger"), emissive: hex("danger"), emissiveIntensity: 0.6, flatShading: true }));
    mesh.position.copy(start);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.things.push({ mesh, velocity: aim.sub(start).setY(0).normalize().multiplyScalar(speed), kind: "hazard" });
  }

  private fallbackPlayer() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1, 6, 16), new THREE.MeshStandardMaterial({ color: hex("primary"), roughness: 0.35 }));
    body.position.y = 1.2;
    body.castShadow = true;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 16), new THREE.MeshStandardMaterial({ color: hex("text") }));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.4, 0.8);
    group.add(body, nose);
    return group;
  }
}

function turnToward(current: number, target: number, amount: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}

function arenaEdge() {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA + 1.2, 0.12, 8, 128),
    new THREE.MeshStandardMaterial({ color: hex("primary"), emissive: hex("primary"), emissiveIntensity: 1.2 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  return ring;
}
