import * as THREE from "three";
import { hex, type PaletteColor } from "./color";

type Particle = { velocity: THREE.Vector3; life: number };
type Burst = { points: THREE.Points; particles: Particle[]; age: number; lifespan: number };
type Pop = { object: THREE.Object3D; base: THREE.Vector3; age: number; duration: number; amount: number };

function glowTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "white");
  gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.85)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createFx(scene: THREE.Scene, camera: THREE.Camera) {
  const glow = glowTexture();
  const bursts: Burst[] = [];
  const pops: Pop[] = [];
  const shakeOffset = new THREE.Vector3();
  let trauma = 0;

  return {
    shake(amount: "light" | "medium" | "heavy" = "light") {
      trauma = Math.min(1, trauma + { light: 0.25, medium: 0.5, heavy: 0.9 }[amount]);
    },
    burst(position: THREE.Vector3, color: PaletteColor = "accent", count = 28, speed = 7) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        positions.set([position.x, position.y, position.z], i * 3);
        const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize();
        particles.push({ velocity: direction.multiplyScalar(speed * (0.4 + Math.random() * 0.8)), life: 1 });
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({ color: hex(color), map: glow, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      material.color.multiplyScalar(3);
      const points = new THREE.Points(geometry, material);
      scene.add(points);
      bursts.push({ points, particles, age: 0, lifespan: 0.8 });
    },
    pop(object: THREE.Object3D, amount = 0.3, duration = 0.22) {
      pops.push({ object, base: object.scale.clone(), age: 0, duration, amount });
    },
    update(dt: number) {
      camera.position.sub(shakeOffset);
      trauma = Math.max(0, trauma - dt * 1.6);
      const power = trauma * trauma * 0.6;
      shakeOffset.set((Math.random() - 0.5) * power, (Math.random() - 0.5) * power, (Math.random() - 0.5) * power);
      camera.position.add(shakeOffset);

      for (let i = bursts.length - 1; i >= 0; i--) {
        const burst = bursts[i];
        burst.age += dt;
        const positions = burst.points.geometry.getAttribute("position") as THREE.BufferAttribute;
        burst.particles.forEach((p, j) => {
          p.velocity.y -= 9 * dt;
          positions.setXYZ(j, positions.getX(j) + p.velocity.x * dt, positions.getY(j) + p.velocity.y * dt, positions.getZ(j) + p.velocity.z * dt);
        });
        positions.needsUpdate = true;
        (burst.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - burst.age / burst.lifespan);
        if (burst.age >= burst.lifespan) {
          scene.remove(burst.points);
          burst.points.geometry.dispose();
          (burst.points.material as THREE.Material).dispose();
          bursts.splice(i, 1);
        }
      }

      for (let i = pops.length - 1; i >= 0; i--) {
        const pop = pops[i];
        pop.age += dt;
        const t = Math.min(1, pop.age / pop.duration);
        pop.object.scale.copy(pop.base).multiplyScalar(1 + Math.sin(t * Math.PI) * pop.amount);
        if (t >= 1) {
          pop.object.scale.copy(pop.base);
          pops.splice(i, 1);
        }
      }
    },
  };
}

export type Fx = ReturnType<typeof createFx>;
