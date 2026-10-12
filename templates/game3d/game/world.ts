import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { hex } from "./color";

const FLAT_RADIUS = 30;
const SIZE = 240;

function hash(x: number, z: number) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r <= FLAT_RADIUS) return 0;
  const rise = Math.pow((r - FLAT_RADIUS) / 40, 1.6) * 12;
  const angle = Math.atan2(z, x);
  return rise * (0.65 + 0.35 * Math.sin(angle * 5 + r * 0.08)) + Math.sin(x * 0.21) * Math.cos(z * 0.17) * Math.min(1, (r - FLAT_RADIUS) / 10) * 1.5;
}

function terrain() {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, 96, 96).toNonIndexed();
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const jitter = (hash(Math.round(x * 10), Math.round(z * 10)) - 0.5) * (Math.hypot(x, z) <= FLAT_RADIUS ? 0.12 : 0.6);
    position.setY(i, heightAt(x, z) + jitter);
  }
  const low = new THREE.Color(hex("surface"));
  const high = new THREE.Color(hex("backgroundAlt"));
  const colors = new Float32Array(position.count * 3);
  const face = new THREE.Color();
  for (let i = 0; i < position.count; i += 3) {
    const cx = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
    const cz = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
    const outward = THREE.MathUtils.clamp((Math.hypot(cx, cz) - FLAT_RADIUS) / 50, 0, 1);
    face.copy(low).lerp(high, outward * 0.55 + hash(cx, cz) * 0.18);
    face.multiplyScalar(0.94 + hash(cz, cx) * 0.12);
    for (let v = 0; v < 3; v++) colors.set([face.r, face.g, face.b], (i + v) * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  ground.receiveShadow = true;
  return ground;
}

export function createWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  scene.background = new THREE.Color(hex("background"));
  const environment = new THREE.PMREMGenerator(renderer);
  scene.environment = environment.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  environment.dispose();
  scene.fog = new THREE.Fog(hex("background"), 40, 130);

  const hemisphere = new THREE.HemisphereLight(hex("backgroundAlt"), hex("surface"), 1.1);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
  scene.add(sun);

  const ground = terrain();
  scene.add(ground);

  const rocks = new THREE.Group();
  const rockMaterial = new THREE.MeshStandardMaterial({ color: hex("secondary"), roughness: 0.8, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2 + hash(i, 1) * 0.2;
    const radius = 34 + hash(i, 2) * 30;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + hash(i, 3) * 3.5, 0), rockMaterial);
    rock.position.set(x, heightAt(x, z) + 0.6, z);
    rock.rotation.set(hash(i, 4) * 3, hash(i, 5) * 3, hash(i, 6) * 3);
    rock.castShadow = true;
    rocks.add(rock);
  }
  scene.add(rocks);

  return { sun, ground };
}
