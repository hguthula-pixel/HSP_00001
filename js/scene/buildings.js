// Cartoon G+2 buildings on both sides of the street: pastel walls, chunky
// window frames, little balconies, ground-floor shopfronts, rooftop tanks.
import { THREE, Batcher, InstanceSet, geo, matrix, rng, canvasTexture } from './kit.js';
import { STREET } from '../data/hawkers.js';
import { toon, outlineMat, addOutline, signMesh, PALETTE, INK } from './toon.js';

export const FLOOR_H = 3.0;
export const ROOF = FLOOR_H * 3; // G+2

const WALLS = ['#FFD6E0', '#FFE7B8', '#D7F0E3', '#E3DBFF', '#FFD0B5', '#CFEFFF', '#FFF0C9', '#F6D2FF'];
const TRIMS = ['#FF8FAB', '#FF9A4D', '#7BC8A4', '#9D85FF', '#F08A5D', '#5BB8E8', '#E8B43A', '#C77DFF'];
const SHOPS = ['Bakery', 'Books', 'Toy House', 'Tailor', 'Milk Booth', 'Barber', 'Cycle Shop', 'Stationery', 'Photo Studio', 'Tiffins', 'Chemist', 'Sweets', 'Tea Point', 'Gifts', 'Shoes', 'Music'];

export function buildBuildings(root) {
  const group = new THREE.Group();
  group.name = 'market-buildings';
  root.add(group);
  const B = new Batcher({ outlineMaterial: outlineMat });
  const I = new InstanceSet({ addOutline });
  const r = rng(808);

  const lit = toon('#FFD36E', { key: 'window-lit', emissive: '#FFB43C', emissiveIntensity: 0.9 });
  const dark = toon('#6FA8DC', { key: 'window-dark' });
  const frame = toon('#FFFFFF');
  const shutter = toon('#ffffff', { key: 'shutter' });
  shutter.map = shutterTexture();
  const doorMat = toon('#8A5A44', { crayon: true });
  const tank = toon('#5DADE2');
  const railMat = toon(INK);
  let shop = 0;

  for (const side of [-1, 1]) {
    let z = 2.5;
    let b = side < 0 ? 0 : 3;
    while (z > -86) {
      const w = Math.min(7 + Math.floor(r() * 4), z + 86);
      const cz = z - w / 2;
      const wall = toon(WALLS[b % WALLS.length], { crayon: true });
      const trim = toon(TRIMS[b % TRIMS.length]);
      const face = side * STREET.buildingX;
      const depth = 9;
      const h = ROOF + (b % 3 === 1 ? 0.6 : 0);

      // body and parapet
      B.box(wall, face + side * depth / 2, h / 2, cz, depth, h, w - 0.08, { outline: 0.04 });
      B.box(trim, face + side * 0.1, h + 0.35, cz, 0.5, 0.7, w - 0.08, { outline: 0.03 });
      // floor bands
      for (let f = 1; f < 3; f++) B.box(trim, face - side * 0.06, f * FLOOR_H, cz, 0.22, 0.18, w - 0.1);

      // ground floor: shutter half up, door, striped awning and a shop sign
      const sw = Math.min(4.4, w - 2.4);
      B.box(toon('#4A3B52'), face - side * 0.02, 1.25, cz - 0.6, 0.06, 2.4, sw);
      B.box(shutter, face - side * 0.06, 2.15, cz - 0.6, 0.08, 0.9, sw, { outline: 0.015 });
      B.box(doorMat, face - side * 0.05, 1.05, cz + w / 2 - 1.0, 0.08, 2.1, 0.95, { outline: 0.015 });
      const aw = toon('#ffffff', { key: `awning-${b % 4}` });
      aw.map = awningTexture(b % 4);
      B.box(aw, face - side * 0.55, 2.75, cz - 0.6, 1.2, 0.08, sw + 0.4, { rz: side * 0.32, outline: 0.02 });
      const sign = signMesh(SHOPS[shop++ % SHOPS.length], 2.2, { accent: TRIMS[(b + 2) % TRIMS.length], width: 768, height: 220 });
      sign.position.set(face - side * 0.2, 3.36, cz - 0.6); // in front of the floor band
      sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(sign);

      // upper floors: chunky framed windows, some lit gold, balconies on the first floor
      const bays = Math.max(2, Math.floor(w / 2.6));
      for (let f = 1; f < 3; f++) {
        for (let k = 0; k < bays; k++) {
          const wz = z - (w / bays) * (k + 0.5);
          const wy = f * FLOOR_H + 1.45;
          B.box(frame, face - side * 0.05, wy, wz, 0.12, 1.5, 1.2, { outline: 0.02 });
          B.box(r() < 0.6 ? lit : dark, face - side * 0.12, wy, wz, 0.04, 1.2, 0.9, { cast: false });
          B.box(frame, face - side * 0.14, wy, wz, 0.04, 1.2, 0.08, { cast: false });
          B.box(trim, face - side * 0.25, wy + 0.85, wz, 0.5, 0.12, 1.45, { outline: 0.015 });
          if (f === 1 && (k + b) % 2 === 0) {
            B.box(trim, face - side * 0.55, f * FLOOR_H + 0.12, wz, 1.1, 0.16, 1.7, { outline: 0.02 });
            B.box(railMat, face - side * 1.07, f * FLOOR_H + 0.95, wz, 0.07, 0.07, 1.7);
            for (let j = -3; j <= 3; j++) B.box(railMat, face - side * 1.07, f * FLOOR_H + 0.55, wz + j * 0.26, 0.05, 0.8, 0.05);
            // a flower box on the railing
            B.box(toon('#FF9A4D'), face - side * 1.15, f * FLOOR_H + 1.05, wz, 0.22, 0.2, 0.9);
            for (let j = 0; j < 5; j++) I.add(geo.sphere(8, 6), toon('#ffffff', { key: 'bflower' }), matrix(face - side * 1.15, f * FLOOR_H + 1.22, wz - 0.36 + j * 0.18, 0.15, 0.15, 0.15), ['#FF5A6E', '#FFD23F', '#FF8FAB'][j % 3]);
          }
        }
      }

      // rooftop: water tank on a stand, antenna, a little stair room on some
      if (b % 2 === 0) {
        const tx = face + side * (4 + r() * 3);
        const tz = cz + (r() - 0.5) * (w - 3);
        B.box(toon('#C9B8A8'), tx, h + 0.35, tz, 1.3, 0.7, 1.3);
        B.add(geo.cyl(16), tank, matrix(tx, h + 1.35, tz, 1.2, 1.3, 1.2), { outline: 0.03 });
      }
      if (b % 3 === 0) B.box(wall, face + side * 6.5, h + 1.1, cz, 2.6, 2.2, 2.6, { outline: 0.03 });
      B.add(geo.cyl(6), railMat, matrix(face + side * 2.5, h + 1.4, cz + w * 0.3, 0.05, 2.8, 0.05));
      B.box(railMat, face + side * 2.5, h + 2.6, cz + w * 0.3, 0.05, 0.05, 1.2);

      z -= w;
      b++;
    }
  }

  B.flush(group);
  I.flush(group);
}

function shutterTexture() {
  return canvasTexture('shutter-stripes', [64, 128], (ctx, w, h) => {
    ctx.fillStyle = '#C9D3E0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(58,42,58,0.3)';
    for (let y = 0; y < h; y += 12) ctx.fillRect(0, y, w, 3);
  });
}

function awningTexture(i) {
  const pairs = [[PALETTE.pink, '#FFFFFF'], [PALETTE.orange, '#FFF4E0'], ['#7BC8A4', '#FFFFFF'], [PALETTE.lilac, '#FFFFFF']];
  const [a, b] = pairs[i];
  return canvasTexture(`bawning-${i}`, 128, (ctx, w, h) => {
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? b : a;
      ctx.fillRect(0, (k * h) / 8, w, h / 8);
    }
  });
}
