import * as THREE from "three";
import { hex } from "./color";

export function createWorld(scene: THREE.Scene) {
  scene.background = new THREE.Color(hex("background"));
  scene.fog = new THREE.Fog(hex("background"), 35, 120);

  const hemisphere = new THREE.HemisphereLight(hex("backgroundAlt"), hex("surface"), 1.4);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.MeshStandardMaterial({ color: hex("surface"), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const rocks = new THREE.Group();
  const rockMaterial = new THREE.MeshStandardMaterial({ color: hex("secondary"), roughness: 0.8, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2 + Math.random() * 0.2;
    const radius = 34 + Math.random() * 30;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 3.5, 0), rockMaterial);
    rock.position.set(Math.cos(angle) * radius, 0.6, Math.sin(angle) * radius);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rocks.add(rock);
  }
  scene.add(rocks);

  return { sun, ground };
}
