import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MODEL_ENTRIES } from "./assets";

export type Models = Record<string, THREE.Object3D>;

export async function loadModels(onProgress: (value: number) => void): Promise<Models> {
  const loader = new GLTFLoader();
  const models: Models = {};
  let done = 0;
  await Promise.all(
    MODEL_ENTRIES.map(async ([key, url]) => {
      try {
        const gltf = await loader.loadAsync(url);
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        models[key] = gltf.scene;
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
  const copy = source.clone(true);
  const box = new THREE.Box3().setFromObject(copy);
  const extent = box.getSize(new THREE.Vector3());
  copy.scale.multiplyScalar(size / Math.max(extent.x, extent.y, extent.z, 0.001));
  const sized = new THREE.Box3().setFromObject(copy);
  copy.position.y -= sized.min.y;
  const holder = new THREE.Group();
  holder.add(copy);
  return holder;
}
