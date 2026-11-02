// Liimy Land street: a centre road for the hawker carts, raised walkways on
// both sides, an entrance gate, benches, planters, cute lamps and gold fairy lights.
import { THREE, Batcher, InstanceSet, geo, mat, matrix, rng, canvasTexture } from './kit.js';
import { STREET } from '../data/hawkers.js';
import { toon, outlineMat, addOutline, signMesh, PALETTE, INK } from './toon.js';

const Z0 = 8;
const Z1 = -90;

export function buildStreet(root, { lite = false } = {}) {
  const group = new THREE.Group();
  group.name = 'street';
  root.add(group);
  const B = new Batcher({ outlineMaterial: outlineMat });
  const I = new InstanceSet({ addOutline });
  const r = rng(31);
  const len = Z0 - Z1;
  const midZ = (Z0 + Z1) / 2;

  // --- ground: one walk surface (used for click-to-walk), painted road + tiled walkways on top
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, len), toon('#E9C7A8'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, midZ);
  floor.name = 'walk-surface';
  group.add(floor);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(3.6, len), toon('#9C8AB8', { key: 'road', crayon: true }));
  road.material.map = roadTexture(len);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, midZ);
  group.add(road);

  for (const side of [-1, 1]) {
    // walkway tiles (pastel checker) on a low kerb
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(4.9, len), toon('#ffffff', { key: `walk${side}` }));
    walk.material.map = tileTexture(len);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(side * 4.35, 0.1, midZ);
    group.add(walk);
    B.box(toon('#FFE1C6'), side * 4.35, 0.045, midZ, 4.9, 0.09, len, { cast: false });
    B.box(toon(PALETTE.pink), side * 1.86, 0.06, midZ, 0.16, 0.12, len, { outline: 0.015 });
  }

  // --- entrance gate with the Liimy Land sign
  const gateZ = STREET.gateZ;
  const post = toon(PALETTE.lilac, { crayon: true });
  const band = toon(PALETTE.gold);
  for (const side of [-1, 1]) {
    B.box(post, side * 6.4, 2.6, gateZ, 0.9, 5.2, 0.9, { outline: 0.03 });
    B.add(geo.sphere(16, 12), band, matrix(side * 6.4, 5.6, gateZ, 1.1, 1.1, 1.1), { outline: 0.03 });
    // balloon clusters on the gate posts
    ['#FF5A6E', '#FFD23F', '#5BC0EB', '#FF8FAB', '#9BE07A'].forEach((col, k) => {
      const a = (k / 5) * Math.PI * 2;
      I.add(geo.sphere(12, 10), toon('#ffffff', { key: 'balloon' }), matrix(side * 6.4 + Math.cos(a) * 0.45, 6.6 + (k % 2) * 0.35, gateZ + Math.sin(a) * 0.45, 0.55, 0.65, 0.55), col, { outline: 0.03 });
    });
  }
  B.add(geo.cyl(24), band, matrix(0, 5.0, gateZ, 0.5, 13.2, 0.5, 0, 0, Math.PI / 2), { outline: 0.03 });
  const gateSign = signMesh('Liimy Land', 6.2, { accent: PALETTE.pink, bg: PALETTE.cream });
  gateSign.position.set(0, 6.3, gateZ + 0.05);
  group.add(gateSign);
  const gateBack = gateSign.clone();
  gateBack.position.z = gateZ - 0.05;
  gateBack.rotation.y = Math.PI;
  group.add(gateBack);

  // --- cute round lamp posts along the walkway edges
  const lampPole = toon('#5B4B8A');
  const glow = mat('lamp-glow', { basic: true, color: '#FFE08A', toneMapped: false });
  for (let z = -2; z > -84; z -= 10) {
    for (const side of [-1, 1]) {
      const x = side * 6.3;
      B.add(geo.cyl(10), lampPole, matrix(x, 1.6, z + side * 2.5, 0.14, 3.2, 0.14), { outline: 0.02 });
      I.add(geo.sphere(14, 10), glow, matrix(x, 3.4, z + side * 2.5, 0.55, 0.55, 0.55), undefined, {});
      B.add(geo.cone(12), lampPole, matrix(x, 3.75, z + side * 2.5, 0.7, 0.3, 0.7), { outline: 0.02 });
    }
  }

  // --- benches and round planters on the walkways
  const wood = toon('#E6A15C', { crayon: true });
  const pot = toon('#FF9A4D');
  const bush = toon('#7BD389');
  const flowerMat = toon('#ffffff', { key: 'planter-flower' });
  for (let i = 0; i < 8; i++) {
    const z = -7.5 - i * 10;
    const side = i % 2 ? 1 : -1;
    const x = side * 6.0;
    B.box(wood, x, 0.55, z, 0.6, 0.12, 1.8, { outline: 0.02 });
    B.box(wood, x + side * 0.25, 0.85, z, 0.1, 0.5, 1.8, { outline: 0.02 });
    for (const dz of [-0.75, 0.75]) B.box(lampPole, x, 0.3, z + dz, 0.5, 0.45, 0.12);
    const px = -side * 6.0;
    B.add(geo.cyl(16), pot, matrix(px, 0.45, z, 0.9, 0.7, 0.9), { outline: 0.02 });
    I.add(geo.ico(1), bush, matrix(px, 1.0, z, 0.95, 0.75, 0.95), undefined, { outline: 0.02 });
    for (let k = 0; k < 7; k++) {
      const a = r() * Math.PI * 2;
      I.add(geo.sphere(8, 6), flowerMat, matrix(px + Math.cos(a) * 0.35, 1.25 + r() * 0.1, z + Math.sin(a) * 0.35, 0.16, 0.16, 0.16), ['#FF5A6E', '#FFD23F', '#FFFFFF', '#FF8FAB'][k % 4]);
    }
  }

  const lights = buildFairyLights(group, I, r, lite);

  B.flush(group);
  I.flush(group);
  return { floor, lights };
}

/** Gold bulbs strung in sagging zig-zags between the buildings; halos are one Points draw call. */
function buildFairyLights(group, I, r, lite) {
  const bulbMat = mat('fairy-bulb', { basic: true, color: '#FFD36E', toneMapped: false });
  const wire = toon(INK);
  const halos = [];
  const strands = [];
  for (let z = 1; z > -86; z -= 6) {
    strands.push([-7.2, 6.4, z, 7.2, 6.4, z - 3]); // zig
    strands.push([7.2, 6.4, z - 3, -7.2, 6.4, z - 6]); // zag
  }
  // and along each facade
  for (const side of [-1, 1]) strands.push([side * 7.25, 4.9, 2, side * 7.25, 4.9, -84]);
  for (const [x0, y0, z0, x1, y1, z1] of strands) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / (lite ? 0.8 : 0.45));
    const sag = Math.min(1.1, len * 0.06);
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const y = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t);
      I.add(geo.sphere(6, 5), bulbMat, matrix(x, y - 0.08, z, 0.1, 0.13, 0.1));
      halos.push(x, y - 0.08, z);
      if (prev) {
        const mx = (x + prev[0]) / 2;
        const my = (y + prev[1]) / 2;
        const mz = (z + prev[2]) / 2;
        const d = Math.hypot(x - prev[0], y - prev[1], z - prev[2]);
        const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...prev), new THREE.Vector3(x, y, z), new THREE.Vector3(0, 1, 0));
        m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        m.scale(new THREE.Vector3(0.012, d, 0.012));
        m.setPosition(mx, my, mz);
        I.add(geo.cyl(4), wire, m);
      }
      prev = [x, y, z];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(halos, 3));
  const points = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      size: 0.55,
      map: haloTexture(),
      color: '#FFC24A',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
      fog: false,
    }),
  );
  points.name = 'fairy-halos';
  points.renderOrder = 2;
  group.add(points);
  return { bulbs: halos.length / 3, halos: points };
}

function haloTexture() {
  return canvasTexture('halo', 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,230,160,0.6)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

function roadTexture(len) {
  return canvasTexture('road', [128, 512], (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    // dashed centre stripe and edge dots, chalk style
    ctx.fillStyle = '#FFF4E0';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 4, y + 8, 8, 34);
    for (let y = 16; y < h; y += 32) {
      ctx.beginPath();
      ctx.arc(10, y, 4, 0, Math.PI * 2);
      ctx.arc(w - 10, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [1, len / 8] });
}

function tileTexture(len) {
  return canvasTexture('tiles', 256, (ctx, w, h) => {
    const cols = ['#FFE3EC', '#FFF1D6', '#E7E0FF', '#DDF6EA'];
    const s = w / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      ctx.fillStyle = cols[(x + y * 2) % 4];
      ctx.fillRect(x * s, y * s, s, s);
    }
    ctx.strokeStyle = 'rgba(58,42,58,0.28)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, h);
      ctx.moveTo(0, i * s);
      ctx.lineTo(w, i * s);
      ctx.stroke();
    }
  }, { repeat: [2, len / 2.4] });
}
