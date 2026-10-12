import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { MODEL_ENTRIES } from "./assets";

export type Model = { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
export type Models = Record<string, Model>;

export type Animator = { names: string[]; play(name: string, fade?: number): void; update(dt: number): void };

function matte(material: THREE.Material) {
  if (material instanceof THREE.MeshStandardMaterial && !material.metalnessMap && material.metalness > 0.5) material.metalness = 0;
}

export async function loadModels(onProgress: (value: number) => void): Promise<Models> {
  const loader = new GLTFLoader();
  const models: Models = {};
  let done = 0;
  await Promise.all(
    MODEL_ENTRIES.map(async ([key, url]) => {
      try {
        const gltf = await loader.loadAsync(url);
        gltf.scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          for (const material of [mesh.material].flat()) matte(material);
        });
        models[key] = { scene: gltf.scene, clips: gltf.animations };
      } catch {}
      done += 1;
      onProgress(done / Math.max(1, MODEL_ENTRIES.length));
    }),
  );
  return models;
}

export function instance(models: Models, key: string, size: number): THREE.Object3D | null {
  const source = models[key];
  if (!source) return null;
  const copy = clone(source.scene);
  const box = new THREE.Box3().setFromObject(copy);
  const extent = box.getSize(new THREE.Vector3());
  copy.scale.multiplyScalar(size / Math.max(extent.x, extent.y, extent.z, 0.001));
  const sized = new THREE.Box3().setFromObject(copy);
  copy.position.y -= sized.min.y;
  const holder = new THREE.Group();
  holder.name = key;
  holder.add(copy);
  return holder;
}

export function animator(models: Models, key: string, object: THREE.Object3D): Animator | null {
  const clips = models[key]?.clips ?? [];
  if (!clips.length) return null;
  const mixer = new THREE.AnimationMixer(object);
  let current: THREE.AnimationAction | null = null;
  return {
    names: clips.map((clip) => clip.name),
    play(name, fade = 0.2) {
      const clip = clips.find((c) => c.name === name);
      if (!clip) return;
      const next = mixer.clipAction(clip);
      if (next === current) return;
      next.reset().fadeIn(fade).play();
      current?.fadeOut(fade);
      current = next;
    },
    update(dt) {
      mixer.update(dt);
    },
  };
}
