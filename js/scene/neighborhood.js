// The little town around Liimy Land, in the same cartoon style:
// background buildings, four connecting roads, footpaths, round trees and lamps.
// Kept lighter than the market itself so Quest headsets hold their frame rate.
import { THREE, Batcher, InstanceSet, geo, mat, matrix, rng } from './kit.js';
import { toon, outlineMat, addOutline } from './toon.js';

const WALLS = ['#FFD6E0', '#FFE7B8', '#D7F0E3', '#E3DBFF', '#FFD0B5', '#CFEFFF', '#FFF0C9', '#F6D2FF'];

/** Two cross roads beyond the gate and the far end, two side lanes behind the market blocks. */
export const ROADS = [
  { name: 'Front road', x: 0, z: 13, w: 150, d: 8 },
  { name: 'Back road', x: 0, z: -96, w: 150, d: 8 },
  { name: 'West lane', x: -28, z: -41.5, w: 7, d: 101 },
  { name: 'East lane', x: 28, z: -41.5, w: 7, d: 101 },
];

export function buildNeighborhood(root, { lite = false } = {}) {
  const group = new THREE.Group();
  group.name = 'neighborhood';
  root.add(group);
  const B = new Batcher({ outlineMaterial: outlineMat });
  const I = new InstanceSet({ addOutline });
  const r = rng(2025);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), toon('#C9E7A8'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.06, -40);
  group.add(ground);

  const asphalt = toon('#8C84A8', { crayon: true });
  const path = toon('#FFE1C6');
  const marking = toon('#FFF4E0');
  for (const rd of ROADS) {
    B.box(asphalt, rd.x, -0.02, rd.z, rd.w, 0.04, rd.d, { cast: false });
    const along = rd.w > rd.d;
    const len = along ? rd.w : rd.d;
    for (let t = -len / 2 + 2; t < len / 2 - 2; t += 5) {
      if (along) B.box(marking, rd.x + t, 0.005, rd.z, 2.2, 0.01, 0.18, { cast: false });
      else B.box(marking, rd.x, 0.005, rd.z + t, 0.18, 0.01, 2.2, { cast: false });
    }
  }
  const paths = [
    [-21.75, -42, 5.5, 100], [21.75, -42, 5.5, 100],
    [-34, -42, 5, 100], [34, -42, 5, 100],
    [-44, 18.5, 70, 3], [44, 18.5, 70, 3],
    [-12.5, 6, 10, 6], [12.5, 6, 10, 6],
  ];
  for (const [x, z, w, d] of paths) B.box(path, x, 0.06, z, w, 0.12, d, { cast: false, outline: 0.02 });

  // background buildings: a row behind each side lane, plus rows across the cross roads
  const lots = [];
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) lots.push({ x: side * 43, z: 3 - i * 11, w: 13, d: 10 });
  for (let i = 0; i < 5; i++) lots.push({ x: -26 + i * 13, z: 26, w: 11, d: 11 });
  for (let i = 0; i < 5; i++) lots.push({ x: -26 + i * 13, z: -109, w: 11, d: 11 });
  const use = lite ? lots.filter((_, i) => i % 2 === 0) : lots;

  const lit = toon('#FFD36E', { key: 'window-lit', emissive: '#FFB43C', emissiveIntensity: 0.9 });
  const dark = toon('#6FA8DC', { key: 'window-dark' });
  const tank = toon('#5DADE2');
  for (const L of use) {
    const floors = 2 + Math.floor(r() * 4);
    const fh = 3;
    const h = floors * fh;
    const wall = toon(WALLS[Math.floor(r() * WALLS.length)], { crayon: true });
    const w = L.w - r() * 2;
    const d = L.d - r() * 1.5;
    B.box(wall, L.x, h / 2, L.z, w, h, d, { outline: 0.05 });
    B.box(toon('#FFFFFF'), L.x, h + 0.3, L.z, w + 0.1, 0.6, d + 0.1, { outline: 0.03 });
    for (const [fx, fz, span] of [[0, 1, w], [0, -1, w], [1, 0, d], [-1, 0, d]]) {
      const n = Math.max(2, Math.floor(span / 3));
      for (let f = 0; f < floors; f++) {
        for (let k = 0; k < n; k++) {
          const t = -span / 2 + (span / n) * (k + 0.5);
          const wx = L.x + (fx ? fx * (w / 2 + 0.03) : t);
          const wz = L.z + (fz ? fz * (d / 2 + 0.03) : t);
          I.add(geo.box(), r() < 0.5 ? lit : dark, matrix(wx, f * fh + 1.6, wz, fx ? 0.05 : 1.2, 1.3, fz ? 0.05 : 1.2));
        }
      }
    }
    if (r() < 0.7) B.add(geo.cyl(14), tank, matrix(L.x + (r() - 0.5) * w * 0.5, h + 1.3, L.z + (r() - 0.5) * d * 0.5, 1.2, 1.4, 1.2), { outline: 0.03 });
  }

  // round cartoon trees
  const trunk = toon('#9C6B4A');
  const canopy = toon('#ffffff', { key: 'tree-canopy' });
  const greens = ['#7BD389', '#5FC27A', '#9BE07A', '#6FCF97'];
  const spots = [];
  for (let z = 0; z > -88; z -= 9) spots.push([-21.5, z], [21.5, z]);
  for (let x = -60; x <= 60; x += 12) if (Math.abs(x) > 20) spots.push([x, 18.5]);
  spots.push([-11, 4.5], [11, 4.5], [-14, 7.5], [14, 7.5]);
  const trees = lite ? spots.filter((_, i) => i % 2 === 0) : spots;
  for (const [x, z] of trees) {
    const s = 0.85 + r() * 0.4;
    I.add(geo.cyl(8), trunk, matrix(x, 1.3 * s, z, 0.4 * s, 2.6 * s, 0.4 * s), undefined, { outline: 0.03 });
    I.add(geo.sphere(14, 10), canopy, matrix(x, 3.8 * s, z, 3.6 * s, 3.2 * s, 3.6 * s), greens[Math.floor(r() * 4)], { outline: 0.04 });
  }

  // street lamps along the side lanes
  const pole = toon('#5B4B8A');
  const glow = mat('lamp-glow', { basic: true, color: '#FFE08A', toneMapped: false });
  const lamps = [];
  for (let z = -2; z > -88; z -= 14) lamps.push([-23.8, z], [23.8, z]);
  for (const [x, z] of lamps) {
    I.add(geo.cyl(8), pole, matrix(x, 2.4, z, 0.16, 4.8, 0.16), undefined, { outline: 0.02 });
    I.add(geo.sphere(12, 8), glow, matrix(x, 5.0, z, 0.7, 0.7, 0.7));
  }

  B.flush(group);
  I.flush(group);
  return { buildings: use.length, roads: ROADS.length, trees: trees.length, lamps: lamps.length };
}

