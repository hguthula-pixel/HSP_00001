// The G+3 market block (from the owner's plan) in the Liimy Land cartoon style:
// pastel walls with chunky trims and ink outlines, arched shopfronts with striped
// awnings, gold fairy lights, rooftop chhatris, a central octagonal court with
// a fountain, and ground-floor shops you can walk into and shop in.
import { THREE, Batcher, InstanceSet, geo, mat, matrix, canvasTexture } from './kit.js';
import { toon, outlineMat, addOutline, signMesh, INK, PALETTE } from './toon.js';
import { makeItem, register } from './carts.js';
import {
  FOOT, FLOOR_H, FLOORS, SLAB, SOUTH_EDGE, ENTRANCE, OCT, COURT, SHOPS, CORES, STALLS, LOT,
  shopWalls, shopCounter, doorCuts, W, DOOR_H,
} from '../data/market.js';

const WALL = '#FFE7B8';
const WALL_IN = '#FFF4E0';
const TRIM = '#FF8FAB';
const BAND = '#FFFFFF';
const ACCENT = '#7BC8A4';
const SHOP_WALLS = ['#FFD6E0', '#D7F0E3', '#E3DBFF', '#CFEFFF', '#FFF0C9', '#FFD0B5'];
const GOODS = ['#FF5A6E', '#FFD23F', '#7BD389', '#5BC0EB', '#B79CFF', '#FF9A4D'];

let archGeo = null;
/** Unit arch head: a 1 × 0.5 block with a half-round cut out of its base, centred in x and z. */
function arch() {
  if (archGeo) return archGeo;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(0, 0.5);
  sh.lineTo(1, 0.5);
  sh.lineTo(1, 0);
  sh.absarc(0.5, 0, 0.5, 0, Math.PI, false);
  archGeo = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 10 });
  archGeo.translate(-0.5, 0, -0.5);
  return archGeo;
}

function awningMat(i) {
  const pairs = [[PALETTE.pink, '#FFFFFF'], [PALETTE.orange, '#FFF4E0'], ['#7BC8A4', '#FFFFFF'], [PALETTE.lilac, '#FFFFFF'], ['#5BC0EB', '#FFFFFF']];
  const m = toon('#ffffff', { key: `mk-awning-${i}` });
  if (!m.map) {
    const [a, b] = pairs[i % pairs.length];
    m.map = canvasTexture(`mk-awning-${i}`, 128, (ctx, w) => {
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = k % 2 ? b : a;
        ctx.fillRect((k * w) / 8, 0, w / 8, w);
      }
    });
  }
  return m;
}

/**
 * Builds the market. Returns its pickables and `update(x, z)`, which shows the
 * shop interiors only near the visitor so a Quest keeps its frame rate.
 */
export function buildMarket(root) {
  const group = new THREE.Group();
  group.name = 'g3-market';
  root.add(group);
  const B = new Batcher({ outlineMaterial: outlineMat });
  const I = new InstanceSet({ addOutline });

  const wallM = toon(WALL, { crayon: true });
  const inM = toon(WALL_IN, { crayon: true });
  const trimM = toon(TRIM);
  const bandM = toon(BAND);
  const accentM = toon(ACCENT);
  const slabM = toon('#F3D9C4');
  const floorM = toon('#FFE1C6', { crayon: true });
  const inkM = toon(INK);
  const goldM = toon(PALETTE.gold);
  const lit = toon('#FFD36E', { key: 'window-lit', emissive: '#FFB43C', emissiveIntensity: 0.9 });
  const dark = toon('#6FA8DC', { key: 'window-dark' });
  const glow = mat('lamp-glow', { basic: true, color: '#FFE08A', toneMapped: false });
  const H = FLOOR_H;

  // centroid for "which way is outside"
  const cx0 = FOOT.reduce((s, p) => s + p[0], 0) / FOOT.length;
  const cz0 = FOOT.reduce((s, p) => s + p[1], 0) / FOOT.length;

  /** A wall from a to b with openings [from, to, sill, head] (metres along the wall). */
  function wall(y0, a, b, t, ops, m, h = H - SLAB) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx), ux = dx / L, uz = dz / L;
    const seg = (p, q, ya, yb) => {
      if (q - p < 0.01 || yb - ya < 0.01) return;
      const c = (p + q) / 2;
      B.box(m, a[0] + ux * c, y0 + (ya + yb) / 2, a[1] + uz * c, q - p, yb - ya, t, { ry, outline: 0.02 });
    };
    let p = 0;
    for (const [s, e, sill, head] of [...ops].sort((u, v) => u[0] - v[0])) {
      seg(p, s, 0, h);
      seg(s, e, 0, sill);
      seg(s, e, head, h);
      p = e;
    }
    seg(p, L, 0, h);
    return { ux, uz, ry, L };
  }

  // ------------------------------------------------------------ ground and forecourt
  const [fx1, fz1] = [LOT.minX, LOT.minZ];
  B.box(floorM, (fx1 + LOT.maxX) / 2 - 0.4, 0.015, (fz1 + LOT.maxZ) / 2, LOT.maxX - fx1 + 0.8, 0.03, LOT.maxZ - fz1 + 0.6, { cast: false });
  // court tiles
  {
    const sh = new THREE.Shape();
    OCT.forEach((p, k) => (k ? sh.lineTo(p[0], -p[1]) : sh.moveTo(p[0], -p[1])));
    const g = new THREE.ShapeGeometry(sh);
    g.rotateX(-Math.PI / 2);
    B.add(g, toon('#FFD6E0', { crayon: true }), matrix(0, 0.035, 0), { cast: false });
  }
  // fountain: octagonal basin, water, a tiered spout
  B.add(geo.cyl(8), toon('#B79CFF'), matrix(COURT[0], 0.3, COURT[1], 6.8, 0.6, 6.8), { outline: 0.03 });
  B.add(geo.cyl(8), toon('#8FD3FF', { emissive: '#5BC0EB', emissiveIntensity: 0.25 }), matrix(COURT[0], 0.58, COURT[1], 6.2, 0.06, 6.2), { cast: false });
  B.add(geo.cyl(12), toon('#FFF4E0'), matrix(COURT[0], 1.0, COURT[1], 0.6, 1.0, 0.6), { outline: 0.02 });
  B.add(geo.cyl(12), toon('#B79CFF'), matrix(COURT[0], 1.5, COURT[1], 2.0, 0.2, 2.0), { outline: 0.02 });
  B.add(geo.sphere(12, 8), toon('#8FD3FF'), matrix(COURT[0], 1.85, COURT[1], 0.6, 0.6, 0.6), { outline: 0.02 });

  // ------------------------------------------------------------ exterior walls, every floor
  for (let f = 0; f < FLOORS; f++) {
    const y = f * H;
    for (let e = 0; e < FOOT.length; e++) {
      const a = FOOT[e], b = FOOT[(e + 1) % FOOT.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const street = e === SOUTH_EDGE;
      const ops = [];
      for (let s = 0.9; s + 3 < L - 0.9; s += 3.6) {
        const w = f ? 1.6 : 3;
        const x = s + (f ? 0.7 : 0);
        if (street && f === 0 && x + w > ENTRANCE.from - 0.4 && x < ENTRANCE.to + 0.4) continue;
        ops.push([x, x + w, f ? 0.9 : 0, f ? 3.0 : 3.1]);
      }
      if (street && f === 0) ops.push([ENTRANCE.from, ENTRANCE.to, 0, 3.6]);
      const { ux, uz, ry } = wall(y, a, b, 0.25, ops, wallM);
      // outward normal
      let nx = uz, nz = -ux;
      if (nx * ((a[0] + b[0]) / 2 - cx0) + nz * ((a[1] + b[1]) / 2 - cz0) < 0) { nx = -nx; nz = -nz; }
      const P = (t, o) => [a[0] + ux * t + nx * o, a[1] + uz * t + nz * o];

      for (const [p, q, sill, head] of ops) {
        const w = q - p, r = w / 2, c = P((p + q) / 2, 0.02);
        // arched head trim
        B.add(arch(), trimM, matrix(c[0], y + head - r, c[1], w, w, 0.32, 0, ry, 0), { outline: 0.015 });
        if (f > 0) {
          // window: lit or dark pane, white frame, sill, flower box on the first floor
          const pane = P((p + q) / 2, -0.05);
          B.box((p * 7 + f) % 3 < 2 ? lit : dark, pane[0], y + (sill + head - r) / 2, pane[1], w, head - r - sill, 0.06, { ry, cast: false });
          B.box(bandM, pane[0], y + (sill + head - r) / 2, pane[1], 0.08, head - r - sill, 0.12, { ry });
          const s2 = P((p + q) / 2, 0.2);
          B.box(bandM, s2[0], y + sill - 0.05, s2[1], w + 0.4, 0.12, 0.42, { ry, outline: 0.015 });
          if (f === 1) {
            const fb = P((p + q) / 2, 0.38);
            B.box(toon('#FF9A4D'), fb[0], y + sill + 0.1, fb[1], w, 0.22, 0.24, { ry });
            for (let j = 0; j < 5; j++) {
              const fp = P(p + 0.2 + (j * (w - 0.4)) / 4, 0.38);
              I.add(geo.sphere(8, 6), toon('#ffffff', { key: 'bflower' }), matrix(fp[0], y + sill + 0.28, fp[1], 0.17, 0.17, 0.17), ['#FF5A6E', '#FFD23F', '#FF8FAB'][j % 3]);
            }
          }
        } else if (!(street && p === ENTRANCE.from)) {
          // shopfront: glass, a little sign board and a striped awning
          const g = P((p + q) / 2, -0.12);
          B.box(dark, g[0], y + 1.2, g[1], w - 0.1, 2.4, 0.06, { ry, cast: false });
          B.box(bandM, g[0], y + 1.2, g[1], 0.08, 2.4, 0.1, { ry });
          B.box(toon('#8A5A44', { crayon: true }), g[0], y + 0.3, g[1], w, 0.6, 0.14, { ry });
          const aw = P((p + q) / 2, 0.55);
          B.box(awningMat(Math.round(p) % 5), aw[0], y + 2.75, aw[1], w + 0.3, 0.07, 1.1, { ry, outline: 0.015 });
          const sb = P((p + q) / 2, 0.1);
          B.box(toon(GOODS[Math.round(p * 3) % GOODS.length]), sb[0], y + 3.3, sb[1], w * 0.8, 0.4, 0.06, { ry, outline: 0.015 });
        }
      }
      // floor band with fairy lights, and a parapet on the roof
      const m = P(L / 2, 0.18);
      B.box(bandM, m[0], y + H - 0.25, m[1], L + 0.4, 0.5, 0.45, { ry, outline: 0.025 });
      B.box(trimM, m[0], y + H - 0.55, m[1], L + 0.3, 0.12, 0.5, { ry });
      const lightsN = Math.floor(L / 0.9);
      for (let k = 0; k <= lightsN; k++) {
        const lp = P((k * L) / lightsN, 0.45);
        I.add(geo.sphere(8, 6), glow, matrix(lp[0], y + H - 0.62 - 0.12 * Math.sin((k / lightsN) * Math.PI * 8) ** 2, lp[1], 0.12, 0.12, 0.12));
      }
      if (f === FLOORS - 1) {
        wall(FLOORS * H, a, b, 0.3, [], wallM, 1.1);
        const cp = P(L / 2, 0.05);
        B.box(trimM, cp[0], FLOORS * H + 1.15, cp[1], L + 0.5, 0.18, 0.55, { ry, outline: 0.02 });
      }
    }
    // corner pilasters with gold caps
    for (const p of FOOT) {
      B.box(toon('#FFD0B5', { crayon: true }), p[0], y + H / 2, p[1], 0.8, H, 0.8, { outline: 0.025 });
      B.box(goldM, p[0], y + H - 0.1, p[1], 0.95, 0.2, 0.95);
    }
  }

  // ------------------------------------------------------------ entrance: canopy, columns, steps, big sign
  const sa = FOOT[SOUTH_EDGE], sb = FOOT[(SOUTH_EDGE + 1) % FOOT.length];
  const sL = Math.hypot(sb[0] - sa[0], sb[1] - sa[1]);
  const sux = (sb[0] - sa[0]) / sL, suz = (sb[1] - sa[1]) / sL;
  const entMid = (ENTRANCE.from + ENTRANCE.to) / 2;
  const SP = (t, o) => [sa[0] + sux * t + o, sa[1] + suz * t]; // outward is +X on this edge
  {
    const c = SP(entMid, 2.0);
    B.box(trimM, c[0], 3.9, c[1], 4.2, 0.3, 6.4, { outline: 0.03 });
    B.box(awningMat(0), c[0], 4.12, c[1], 4.0, 0.12, 6.2);
    for (const t of [-2.8, 2.8]) {
      const col = SP(entMid + t, 3.8);
      B.add(geo.cyl(12), bandM, matrix(col[0], 1.9, col[1], 0.4, 3.8, 0.4), { outline: 0.02 });
      B.add(geo.cyl(12), goldM, matrix(col[0], 3.7, col[1], 0.6, 0.2, 0.6));
      B.add(geo.cyl(12), goldM, matrix(col[0], 0.1, col[1], 0.6, 0.2, 0.6));
    }
    for (const t of [ENTRANCE.from - 0.3, ENTRANCE.to + 0.3]) {
      const pl = SP(t, 0.3);
      B.box(toon('#FFD0B5', { crayon: true }), pl[0], 1.9, pl[1], 0.6, 3.8, 0.6, { outline: 0.02 });
    }
    // marigold garland over the arch
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const g = SP(ENTRANCE.from + t * (ENTRANCE.to - ENTRANCE.from), 0.35);
      I.add(geo.bead(), toon('#ffffff', { key: 'garland' }), matrix(g[0], 3.45 - Math.sin(t * Math.PI) * 0.5, g[1], 0.2, 0.2, 0.2), k % 2 ? '#FF9A4D' : '#FFD23F');
    }
    const sign = signMesh('Liimy Market', 9, { accent: TRIM, width: 1024, height: 256 });
    const sp = SP(entMid, 0.35);
    sign.position.set(sp[0], FLOORS * H + 2.4, sp[1]);
    sign.rotation.y = Math.PI / 2;
    group.add(sign);
    for (const t of [-3.6, 3.6]) {
      const post = SP(entMid + t, 0.3);
      B.box(inkM, post[0], FLOORS * H + 1.6, post[1], 0.18, 1.6, 0.18);
    }
  }

  // ------------------------------------------------------------ rooftop chhatris (domed kiosks) at the corners
  const chhatri = (x, z, s) => {
    const y = FLOORS * H + 1.24;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(bandM, x + dx * 0.8 * s, y + 0.8 * s, z + dz * 0.8 * s, 0.24, 1.6 * s, 0.24, { outline: 0.015 });
    B.box(trimM, x, y + 1.7 * s, z, 2.1 * s, 0.22, 2.1 * s, { outline: 0.02 });
    B.add(geo.sphere(16, 10), toon('#FFF4E0'), matrix(x, y + 1.8 * s, z, 2.3 * s, 2.0 * s, 2.3 * s), { outline: 0.03 });
    B.add(geo.cone(8), goldM, matrix(x, y + 3.1 * s, z, 0.2 * s, 0.9 * s, 0.2 * s));
  };
  for (const p of FOOT) {
    const dx = Math.sign(cx0 - p[0]) * 1.4, dz = Math.sign(cz0 - p[1]) * 1.4;
    chhatri(p[0] + dx, p[1] + dz, 1);
  }
  { const c = SP(entMid, -1.4); chhatri(c[0], c[1], 1.3); }

  // ------------------------------------------------------------ slabs with the court opening
  for (let f = 1; f <= FLOORS; f++) {
    const sh = new THREE.Shape();
    FOOT.forEach((p, k) => (k ? sh.lineTo(p[0], -p[1]) : sh.moveTo(p[0], -p[1])));
    const hole = new THREE.Path();
    OCT.forEach((p, k) => (k ? hole.lineTo(p[0], -p[1]) : hole.moveTo(p[0], -p[1])));
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: SLAB, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    B.add(g, slabM, matrix(0, f * H - SLAB, 0), { cast: false });
    // court railing on the upper floors and the roof: gold top rail and balusters
    for (let k = 0; k < 8; k++) {
      const a = OCT[k], b = OCT[(k + 1) % 8];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      B.box(goldM, (a[0] + b[0]) / 2, f * H + 1.0, (a[1] + b[1]) / 2, L, 0.1, 0.12, { ry, outline: 0.01 });
      for (let t = 0.3; t < L; t += 0.6) {
        const u = t / L;
        B.box(bandM, a[0] + (b[0] - a[0]) * u, f * H + 0.5, a[1] + (b[1] - a[1]) * u, 0.08, 1.0, 0.08);
      }
      // inner gallery wall on upper floors, with lit shopfronts facing the court
      if (f < FLOORS) {
        const ca = [COURT[0] + (a[0] - COURT[0]) * 1.35, COURT[1] + (a[1] - COURT[1]) * 1.35];
        const cb = [COURT[0] + (b[0] - COURT[0]) * 1.35, COURT[1] + (b[1] - COURT[1]) * 1.35];
        const L2 = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
        wall(f * H, ca, cb, 0.2, [[L2 / 2 - 1.3, L2 / 2 + 1.3, 0.2, 2.6]], toon(SHOP_WALLS[k % SHOP_WALLS.length], { crayon: true }));
        const m = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2];
        const ry2 = -Math.atan2(cb[1] - ca[1], cb[0] - ca[0]);
        B.box(lit, m[0], f * H + 1.4, m[1], 2.6, 2.4, 0.05, { ry: ry2, cast: false });
        const aw = [COURT[0] + (m[0] - COURT[0]) * 0.93, COURT[1] + (m[1] - COURT[1]) * 0.93];
        B.box(awningMat(k), aw[0], f * H + 2.9, aw[1], 3.0, 0.07, 0.9, { ry: ry2 });
      }
    }
  }

  // ------------------------------------------------------------ stair / lift cores
  for (const c of CORES) {
    for (let f = 0; f < FLOORS; f++) B.box(toon('#E3DBFF', { crayon: true }), (c.x1 + c.x2) / 2, f * H + (H - SLAB) / 2, (c.z1 + c.z2) / 2, c.x2 - c.x1, H - SLAB, c.z2 - c.z1, { outline: 0.03 });
    B.box(trimM, (c.x1 + c.x2) / 2, FLOORS * H + 0.15, (c.z1 + c.z2) / 2, c.x2 - c.x1 + 0.3, 0.3, c.z2 - c.z1 + 0.3);
  }

  // ------------------------------------------------------------ court stalls with candy-striped roofs
  STALLS.forEach((s, n) => {
    const cx = (s.x1 + s.x2) / 2, cz = (s.z1 + s.z2) / 2, w = s.x2 - s.x1, d = s.z2 - s.z1;
    B.box(toon('#FFD6E0', { crayon: true }), cx, 0.5, cz, w, 1.0, d, { outline: 0.03 });
    B.box(toon(GOODS[n % GOODS.length]), cx, 1.05, cz, w - 0.2, 0.1, d - 0.2);
    B.box(awningMat(n), cx, 2.8, cz, w + 0.8, 0.14, d + 0.8, { outline: 0.03 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(inkM, cx + (sx * w) / 2, 1.4, cz + (sz * d) / 2, 0.1, 2.8, 0.1);
    for (let k = 0; k < 6; k++) I.add(geo.sphere(10, 8), toon('#ffffff', { key: 'stall-goods' }), matrix(cx + (k % 3 - 1) * w * 0.25, 1.25, cz + (k < 3 ? -0.25 : 0.25) * d, 0.3, 0.3, 0.3), GOODS[(n + k) % GOODS.length]);
  });

  // bunting from the court out along the aisles
  const flag = toon('#ffffff', { key: 'bunting' });
  for (let k = 0; k < 8; k++) {
    const a = [COURT[0], COURT[1]];
    const o = OCT[k];
    const b = [COURT[0] + (o[0] - COURT[0]) * 2.0, COURT[1] + (o[1] - COURT[1]) * 2.0];
    const n = 16;
    for (let j = 1; j < n; j++) {
      const t = j / n;
      const ry = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      I.add(geo.box(), flag, matrix(a[0] + (b[0] - a[0]) * t, 3.5 - 1.6 * t * (1 - t), a[1] + (b[1] - a[1]) * t, 0.3, 0.3, 0.02, 0, ry, Math.PI / 4), GOODS[(j + k) % GOODS.length]);
    }
  }

  // ------------------------------------------------------------ ground-floor shops
  const pickables = [];
  const interiors = [];
  const signCache = new Map();
  const doneWalls = new Set();
  for (const s of SHOPS) {
    const colour = toon(SHOP_WALLS[s.index % SHOP_WALLS.length], { crayon: true });
    for (const w of shopWalls(s)) {
      const [ax, az, bx, bz] = w.seg;
      const k = [ax, az, bx, bz].map((v) => v.toFixed(2)).join();
      const k2 = [bx, bz, ax, az].map((v) => v.toFixed(2)).join();
      if (doneWalls.has(k) || doneWalls.has(k2)) continue;
      doneWalls.add(k);
      if (w.door) {
        // lintel above the door, a trim frame and the shop's colour
        wall(0, [ax, az], [bx, bz], 0.14, [[0, Math.hypot(bx - ax, bz - az), 0, DOOR_H]], colour);
      } else wall(0, [ax, az], [bx, bz], 0.12, doorCuts(w.seg).map(([t1, t2]) => [t1, t2, 0, DOOR_H]), inM);
    }
    // tiled floor
    B.box(toon(['#FFE7B8', '#D7F0E3', '#FFD6E0'][s.index % 3]), s.cx, 0.04, s.cz, s.x2 - s.x1 - 0.15, 0.02, s.z2 - s.z1 - 0.15, { cast: false });

    // door frame outside, in the shop colour, and a little awning
    const along = s.nx ? [0, 1] : [1, 0];
    const dx = s.door[0], dz = s.door[1];
    const ry = s.nx ? Math.PI / 2 : 0;
    B.box(colour, dx + s.nx * 0.09, DOOR_H + 0.15, dz + s.nz * 0.09, 2.5, 0.3, 0.05, { ry, outline: 0.015 });
    for (const sd of [-1, 1]) B.box(colour, dx + along[0] * sd * 1.12 + s.nx * 0.09, DOOR_H / 2, dz + along[1] * sd * 1.12 + s.nz * 0.09, 0.22, DOOR_H, 0.05, { ry, outline: 0.015 });

    // counter and back shelf
    const c = shopCounter(s);
    const cw = c.x2 - c.x1, cd = c.z2 - c.z1;
    B.box(toon('#8A5A44', { crayon: true }), c.cx, 0.45, c.cz, cw, 0.9, cd, { outline: 0.02 });
    B.box(toon(s.type.accent), c.cx, 0.93, c.cz, cw + 0.08, 0.06, cd + 0.08);
    const backX = s.nx ? (s.nx > 0 ? s.x1 + 0.3 : s.x2 - 0.3) : s.cx;
    const backZ = s.nz ? (s.nz > 0 ? s.z1 + 0.3 : s.z2 - 0.3) : s.cz;
    const shelfLen = (s.nx ? s.z2 - s.z1 : s.x2 - s.x1) - 0.6;
    B.box(toon('#B07A55'), backX, 1.1, backZ, s.nx ? 0.4 : shelfLen, 2.2, s.nx ? shelfLen : 0.4, { outline: 0.02 });
    for (let row = 0; row < 3; row++) {
      for (let j = 0; j < Math.max(2, Math.floor(shelfLen / 0.45)); j++) {
        const t = -shelfLen / 2 + 0.25 + j * 0.45;
        if (t > shelfLen / 2 - 0.2) break;
        const gx = backX + (s.nx ? s.nx * 0.22 : t), gz = backZ + (s.nz ? s.nz * 0.22 : t);
        I.add(geo.box(), toon('#ffffff', { key: 'shop-goods' }), matrix(gx, 0.62 + row * 0.6, gz, 0.3, 0.32, 0.3), GOODS[(s.index + row + j) % GOODS.length]);
      }
    }
    // shopkeeper behind the counter
    const kx = c.cx - s.nx * 0.6, kz = c.cz - s.nz * 0.6;
    B.add(geo.capsule(), toon(GOODS[(s.index + 2) % GOODS.length]), matrix(kx, 0.85, kz, 0.42, 0.55, 0.42), { outline: 0.02 });
    B.add(geo.sphere(12, 10), toon('#F2C5A0'), matrix(kx, 1.55, kz, 0.42, 0.42, 0.42), { outline: 0.02 });
    B.add(geo.sphere(12, 8), inkM, matrix(kx, 1.66, kz, 0.44, 0.3, 0.44));

    // per-shop group: sign and pickable goods, shown only when close
    const shopGroup = new THREE.Group();
    shopGroup.name = `shop-${s.index}`;
    group.add(shopGroup);
    let sign = signCache.get(s.type.name);
    if (!sign) {
      sign = signMesh(s.type.name, 2.0, { accent: s.type.accent, width: 768, height: 220 });
      signCache.set(s.type.name, sign);
    } else sign = new THREE.Mesh(sign.geometry, sign.material);
    sign.position.set(dx + s.nx * 0.14, DOOR_H + 0.75, dz + s.nz * 0.14);
    sign.rotation.y = s.nx ? (s.nx > 0 ? Math.PI / 2 : -Math.PI / 2) : s.nz > 0 ? 0 : Math.PI;
    shopGroup.add(sign);

    const items = s.type.items;
    const len = s.nx ? cd : cw;
    items.forEach(([type, label, kind, color], j) => {
      const item = makeItem(type, color);
      const t = (j - (items.length - 1) / 2) * Math.min(0.55, len / (items.length + 0.5));
      item.position.set(c.cx + (s.nx ? 0 : t), 0.96, c.cz + (s.nz ? 0 : t));
      item.rotation.y = ry;
      shopGroup.add(item);
      const rec = register(item, { id: `shop${s.index}-${j}`, label, kind, cartId: `shop-${s.index}`, shop: s.type.name });
      pickables.push(rec);
    });
    interiors.push({ group: shopGroup, x: s.cx, z: s.cz });
  }

  B.flush(group);
  I.flush(group);

  // invisible walk surface so a click or tap inside the block glides there
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LOT.maxX - LOT.minX, LOT.maxZ - LOT.minZ),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((LOT.minX + LOT.maxX) / 2, 0.05, (LOT.minZ + LOT.maxZ) / 2);
  floor.name = 'market-walk-surface';
  group.add(floor);

  const NEAR = 16;
  let last = null;
  function update(x, z) {
    const key = `${Math.round(x)}|${Math.round(z)}`;
    if (key === last) return;
    last = key;
    const far = x > LOT.maxX + 8;
    for (const it of interiors) it.group.visible = !far && Math.hypot(it.x - x, it.z - z) < NEAR;
  }
  update(0, 0);
  return { group, floor, pickables, update, shops: SHOPS.length };
}

export { W };
