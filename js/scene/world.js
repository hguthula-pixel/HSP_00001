// Assembles Liimy Land in stages so the loading screen can report progress.
import { THREE, isMobile } from './kit.js';
import { loadFonts } from './toon.js';
import { buildStreet } from './street.js';
import { buildBuildings } from './buildings.js';
import { buildCarts } from './carts.js';
import { buildNeighborhood } from './neighborhood.js';
import { Lighting } from './lighting.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export async function buildWorld(sceneEl, { lite = false, onProgress = () => {} } = {}) {
  const renderer = sceneEl.renderer;
  // Cap resolution: phones render at ≤1.5× device pixels, desktops at ≤2×.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  // Toon shading with blob shadows instead of shadow maps keeps Quest at full frame rate.
  renderer.shadowMap.enabled = false;

  const root = new THREE.Group();
  root.name = 'liimy-land';
  sceneEl.object3D.add(root);

  onProgress('fonts', 0.1);
  await loadFonts();
  onProgress('street', 0.25);
  await nextFrame();
  const street = buildStreet(root, { lite });
  onProgress('buildings', 0.45);
  await nextFrame();
  buildBuildings(root);
  onProgress('shops', 0.65);
  await nextFrame();
  const carts = buildCarts(root);
  onProgress('town', 0.85);
  await nextFrame();
  const town = buildNeighborhood(root, { lite });
  const lighting = new Lighting(sceneEl.object3D, renderer);

  // Static scenery never moves: freeze matrices once. Pickables keep live matrices.
  const live = new Set();
  for (const p of carts.pickables) p.object.traverse((o) => live.add(o));
  if (carts.iceCream) carts.iceCream.pivot.traverse((o) => live.add(o));
  root.traverse((o) => {
    if ((o.isMesh || o.isPoints) && !live.has(o)) {
      o.updateMatrix();
      o.matrixAutoUpdate = false;
    }
  });
  root.updateMatrixWorld(true);

  if (renderer.compile) renderer.compile(sceneEl.object3D, sceneEl.camera);
  onProgress('ready', 1);
  return { root, floor: street.floor, lights: street.lights, hitboxes: carts.hitboxes, pickables: carts.pickables, iceCream: carts.iceCream, lighting, town };
}
