// The G+3 market block from the owner's plan, placed on the west (left) side
// of the hawker street. In the plan, Bowdara Road runs along the south facade;
// here the hawker street plays Bowdara Road, so the plan is turned 90° and its
// south facade (main entrance, MARKET sign) faces the street (+X).
// Plan units are drawing pixels: 7.75 px = 1 m.

export const K = 7.75;
const TX = -34; // puts the south stair core flush with the old building line
const TZ = -42; // centres the block along the street
/** Plan pixel → world [x, z]. */
export const W = (px, py) => [(py - 600) / K + TX, -(px - 610) / K + TZ];

export const FLOOR_H = 4;
export const FLOORS = 4; // G+3
export const SLAB = 0.2;

const FOOT_PLAN = [[357, 437], [497, 437], [497, 392], [863, 392], [863, 765], [357, 765]];
export const FOOT = FOOT_PLAN.map(([x, y]) => W(x, y));
export const FACADE_X = W(0, 765)[0]; // ≈ −12.7
export const SOUTH_EDGE = 4; // FOOT edge that faces the street
export const COURT = W(668, 577);
export const COURT_R = 8.1;
export const OCT = [...Array(8)].map((_, k) => {
  const a = Math.PI / 8 + (k * Math.PI) / 4;
  return [COURT[0] + COURT_R * Math.cos(a), COURT[1] + COURT_R * Math.sin(a)];
});

/** Main entrance along the street facade (metres along the south edge, as in the plan). */
export const ENTRANCE = { from: 16.5, to: 21.5 };

const ROWS = [
  [358, 437, 498, 462, 4], [358, 462, 383, 544, 3], [474, 462, 498, 544, 3], [498, 392, 637, 416, 4], [498, 424, 523, 541, 5], [614, 424, 637, 497, 2],
  [757, 392, 863, 420, 3], [838, 428, 863, 495, 2], [757, 497, 863, 532, 3], [358, 624, 492, 648, 4], [511, 624, 585, 648, 2], [358, 659, 391, 727, 2],
  [358, 729, 492, 764, 4], [511, 729, 646, 764, 4], [757, 624, 863, 648, 3], [838, 662, 863, 729, 2], [757, 729, 863, 764, 3],
];

/** What each shop sells. Items are pickable, like the hawker carts. */
export const SHOP_TYPES = [
  { name: 'Fruit Shop', accent: '#FFB84D', items: [['mango', 'Mango', 'fruit'], ['apple', 'Apple', 'fruit'], ['banana', 'Bananas', 'fruit']] },
  { name: 'Veggie Shop', accent: '#7BD389', items: [['tomato', 'Tomato', 'vegetable'], ['carrot', 'Carrot', 'vegetable'], ['brinjal', 'Brinjal', 'vegetable']] },
  { name: 'Flower Shop', accent: '#FF7EB6', items: [['rose', 'Rose bunch', 'flower'], ['sunflower', 'Sunflower', 'flower'], ['tulip', 'Pink tulip', 'flower']] },
  { name: 'Toy Shop', accent: '#5BC0EB', items: [['teddy', 'Teddy bear', 'toy'], ['ball', 'Bouncy ball', 'toy'], ['car', 'Toy car', 'toy']] },
  { name: 'Sweet Shop', accent: '#FF9A4D', items: [['candyjar', 'Candy jar', 'food'], ['packet', 'Snack packet', 'food'], ['jar', 'Pickle jar', 'food']] },
  { name: 'Pottery', accent: '#E07A4F', items: [['pot', 'Clay pot', 'craft'], ['diya', 'Diya lamp', 'craft'], ['kulhad', 'Clay cup', 'craft']] },
  { name: 'Bangle Shop', accent: '#FF6F91', items: [['bangles', 'Bangle stack', 'craft', '#E63E6D'], ['bangles', 'Gold bangles', 'craft', '#FFC93C'], ['bangles', 'Blue bangles', 'craft', '#5BC0EB']] },
  { name: 'Sparkles', accent: '#C77DFF', items: [['clip', 'Hair clip', 'accessory'], ['hairband', 'Hairband', 'accessory'], ['ring', 'Ring', 'accessory']] },
  { name: 'Bamboo Craft', accent: '#C9B26B', items: [['bamboobasket', 'Bamboo basket', 'craft'], ['fan', 'Hand fan', 'craft'], ['bamboobasket', 'Little basket', 'craft']] },
  { name: 'Balloon Shop', accent: '#B79CFF', items: [['balloon', 'Red balloon', 'toy', '#FF5A6E'], ['balloon', 'Yellow balloon', 'toy', '#FFD23F'], ['balloon', 'Green balloon', 'toy', '#7BD389']] },
];

const planShops = ROWS.flatMap(([x1, y1, x2, y2, n]) => {
  const hz = x2 - x1 >= y2 - y1;
  return [...Array(n)].map((_, k) =>
    hz ? [x1 + ((x2 - x1) * k) / n, y1, x1 + ((x2 - x1) * (k + 1)) / n, y2] : [x1, y1 + ((y2 - y1) * k) / n, x2, y1 + ((y2 - y1) * (k + 1)) / n],
  );
});

/**
 * Ground-floor shops in world space: rect {x1,x2,z1,z2}, the door side's
 * outward normal (nx,nz) and the door centre. The door faces the central court.
 */
const rects = planShops.map((r) => {
  const [ax, az] = W(r[0], r[1]), [bx, bz] = W(r[2], r[3]);
  return { x1: Math.min(ax, bx), x2: Math.max(ax, bx), z1: Math.min(az, bz), z2: Math.max(az, bz) };
});
const inPoly = (x, z) => {
  let inside = false;
  for (let i = 0, j = FOOT.length - 1; i < FOOT.length; j = i++) {
    const [xi, zi] = FOOT[i], [xj, zj] = FOOT[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const coreRects = [[372, 580, 405, 628], [815, 533, 848, 575], [445, 765, 530, 808]].map((r) => {
  const [ax, az] = W(r[0], r[1]), [bx, bz] = W(r[2], r[3]);
  return { x1: Math.min(ax, bx), x2: Math.max(ax, bx), z1: Math.min(az, bz), z2: Math.max(az, bz) };
});
const inRect = (q, x, z) => x > q.x1 && x < q.x2 && z > q.z1 && z < q.z2;

/**
 * Ground-floor shops in world space: rect {x1,x2,z1,z2}, the door side's
 * outward normal (nx,nz) and the door centre. The door goes on the side
 * nearest the central court that opens onto free floor: not into a
 * neighbouring shop, a stair core, or through the outside wall.
 */
export const SHOPS = rects.map((q, i) => {
  const cx = (q.x1 + q.x2) / 2, cz = (q.z1 + q.z2) / 2;
  const sides = [
    { nx: 0, nz: -1, d: [cx, q.z1] }, { nx: 1, nz: 0, d: [q.x2, cz] },
    { nx: 0, nz: 1, d: [cx, q.z2] }, { nx: -1, nz: 0, d: [q.x1, cz] },
  ];
  const free = (sd) => {
    // probe a strip just outside the side, across the door's width
    const ax = sd.nz ? 1 : 0, az = sd.nx ? 1 : 0;
    for (const t of [-0.9, 0, 0.9]) {
      const px = sd.d[0] + sd.nx * 0.7 + ax * t, pz = sd.d[1] + sd.nz * 0.7 + az * t;
      if (!inPoly(px, pz)) return false;
      if (rects.some((o, j) => j !== i && inRect(o, px, pz))) return false;
      if (coreRects.some((o) => inRect(o, px, pz))) return false;
    }
    return true;
  };
  const dist = (sd) => Math.hypot(sd.d[0] - COURT[0], sd.d[1] - COURT[1]);
  const ok = sides.filter(free).sort((a, b) => dist(a) - dist(b));
  const pick = ok[0] || sides.sort((a, b) => dist(a) - dist(b))[0];
  return { index: i, ...q, cx, cz, nx: pick.nx, nz: pick.nz, door: pick.d, type: SHOP_TYPES[i % SHOP_TYPES.length], open: ok.length > 0 };
});

const box = (a, b, c, d) => {
  const [x1, z1] = W(a, b), [x2, z2] = W(c, d);
  return { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2) };
};
export const CORES = [box(372, 580, 405, 628), box(815, 533, 848, 575), box(445, 765, 530, 808)];
export const STALLS = [[415, 490, 440, 540], [558, 445, 580, 495], [758, 452, 808, 473], [410, 683, 460, 705], [487, 683, 537, 705], [560, 683, 610, 705], [758, 683, 808, 705]].map((r) => box(...r));

export const DOOR_W = 2;
export const DOOR_H = 2.4;

/** Wall segments [x1, z1, x2, z2] for one shop, leaving the door open. */
export function shopWalls(s) {
  const out = [];
  const edges = [
    [s.x1, s.z1, s.x2, s.z1, 0, -1], [s.x2, s.z1, s.x2, s.z2, 1, 0],
    [s.x2, s.z2, s.x1, s.z2, 0, 1], [s.x1, s.z2, s.x1, s.z1, -1, 0],
  ];
  for (const [ax, az, bx, bz, nx, nz] of edges) {
    if (nx === s.nx && nz === s.nz) {
      const len = Math.hypot(bx - ax, bz - az);
      const half = Math.min(DOOR_W, len - 0.6) / 2;
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      const m = len / 2;
      out.push({ seg: [ax, az, ax + ux * (m - half), az + uz * (m - half)], door: false });
      out.push({ seg: [ax + ux * (m + half), az + uz * (m + half), bx, bz], door: false });
      out.push({ seg: [ax + ux * (m - half), az + uz * (m - half), ax + ux * (m + half), az + uz * (m + half)], door: true });
    } else out.push({ seg: [ax, az, bx, bz], door: false });
  }
  return out;
}

/** All door openings, as segments, so a shared wall gets the same gap on both sides. */
export const DOORS = SHOPS.flatMap((s) => shopWalls(s).filter((w) => w.door).map((w) => w.seg));

/**
 * Openings [from, to] (metres along a→b) where another shop's door lies on
 * this wall. Used for collision and for drawing the matching gap.
 */
export function doorCuts(seg) {
  const [ax, az, bx, bz] = seg;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  const out = [];
  for (const [cx, cz, dx, dz] of DOORS) {
    // collinear: both door ends lie on the wall's line
    const off = (px, pz) => Math.abs((px - ax) * uz - (pz - az) * ux);
    if (off(cx, cz) > 0.05 || off(dx, dz) > 0.05) continue;
    let t1 = (cx - ax) * ux + (cz - az) * uz, t2 = (dx - ax) * ux + (dz - az) * uz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    t1 = Math.max(0, t1); t2 = Math.min(L, t2);
    if (t2 - t1 > 0.05) out.push([t1, t2]);
  }
  return out;
}

/** Splits a segment around the given cuts. */
export function splitSeg(seg, cuts) {
  const [ax, az, bx, bz] = seg;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  const out = [];
  let p = 0;
  for (const [t1, t2] of [...cuts].sort((u, v) => u[0] - v[0])) {
    if (t1 - p > 0.02) out.push([ax + ux * p, az + uz * p, ax + ux * t1, az + uz * t1]);
    p = Math.max(p, t2);
  }
  if (L - p > 0.02) out.push([ax + ux * p, az + uz * p, bx, bz]);
  return out;
}

/** Exterior wall segments with the street entrance left open. */
export function exteriorSegments() {
  const out = [];
  for (let e = 0; e < FOOT.length; e++) {
    const a = FOOT[e], b = FOOT[(e + 1) % FOOT.length];
    if (e !== SOUTH_EDGE) { out.push([a[0], a[1], b[0], b[1]]); continue; }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    out.push([a[0], a[1], a[0] + ux * ENTRANCE.from, a[1] + uz * ENTRANCE.from]);
    out.push([a[0] + ux * ENTRANCE.to, a[1] + uz * ENTRANCE.to, b[0], b[1]]);
  }
  return out;
}

// ------------------------------------------------------------ walking

const xs = FOOT.map((p) => p[0]);
const zs = FOOT.map((p) => p[1]);
/** The market lot: the forecourt between the walkway and the facade, plus the block. */
export const LOT = { minX: Math.min(...xs), maxX: -6.6, minZ: Math.min(...zs), maxZ: Math.max(...zs) };

const RADIUS = 0.28;
const SEGS = [];
const BOXES = [];
for (const s of exteriorSegments()) SEGS.push(s);
const seen = new Set();
for (const s of SHOPS) {
  for (const w of shopWalls(s)) {
    if (w.door) continue;
    const k = w.seg.map((v) => v.toFixed(2)).join();
    const k2 = [w.seg[2], w.seg[3], w.seg[0], w.seg[1]].map((v) => v.toFixed(2)).join();
    if (seen.has(k) || seen.has(k2)) continue;
    seen.add(k);
    SEGS.push(...splitSeg(w.seg, doorCuts(w.seg)));
  }
  const c = shopCounter(s);
  BOXES.push(c);
}
for (const c of CORES) BOXES.push(c);
for (const s of STALLS) BOXES.push(s);

/** The shop counter footprint (also used by the builder). */
export function shopCounter(s) {
  const depth = s.nx ? s.x2 - s.x1 : s.z2 - s.z1;
  const width = s.nx ? s.z2 - s.z1 : s.x2 - s.x1;
  const along = Math.min(width * 0.62, width - 1.2);
  const off = Math.min(1.5, depth * 0.42); // from the door wall inward
  const cx = s.nx ? s.door[0] - s.nx * off : s.cx;
  const cz = s.nz ? s.door[1] - s.nz * off : s.cz;
  const hx = s.nx ? 0.27 : along / 2;
  const hz = s.nz ? 0.27 : along / 2;
  return { x1: cx - hx, x2: cx + hx, z1: cz - hz, z2: cz + hz, cx, cz };
}

export function inLot(x, z) {
  return x < LOT.maxX && z > LOT.minZ - 3 && z < LOT.maxZ + 3;
}

/** Keeps a point inside the lot and out of walls, counters, cores, stalls and the fountain. */
export function clampToMarket(x, z) {
  let px = Math.max(LOT.minX + RADIUS, x);
  let pz = Math.min(LOT.maxZ - RADIUS, Math.max(LOT.minZ + RADIUS, z));
  for (let it = 0; it < 3; it++) {
    for (const [ax, az, bx, bz] of SEGS) {
      const dx = bx - ax, dz = bz - az;
      const L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
      const qx = ax + dx * t, qz = az + dz * t;
      const ex = px - qx, ez = pz - qz;
      const d = Math.hypot(ex, ez);
      if (d < RADIUS) {
        // pushed out to whichever side the point is already on
        const nx = d > 1e-6 ? ex / d : -dz / Math.sqrt(L2);
        const nz = d > 1e-6 ? ez / d : dx / Math.sqrt(L2);
        px = qx + nx * RADIUS;
        pz = qz + nz * RADIUS;
      }
    }
    for (const b of BOXES) {
      const qx = Math.max(b.x1, Math.min(b.x2, px));
      const qz = Math.max(b.z1, Math.min(b.z2, pz));
      const ex = px - qx, ez = pz - qz;
      const d = Math.hypot(ex, ez);
      if (d >= RADIUS) continue;
      if (d > 1e-6) {
        px = qx + (ex / d) * RADIUS;
        pz = qz + (ez / d) * RADIUS;
      } else {
        // inside the box: leave by the nearest face
        const opts = [[b.x1 - RADIUS - px, 0], [b.x2 + RADIUS - px, 0], [0, b.z1 - RADIUS - pz], [0, b.z2 + RADIUS - pz]];
        opts.sort((u, v) => Math.abs(u[0] + u[1]) - Math.abs(v[0] + v[1]));
        px += opts[0][0];
        pz += opts[0][1];
      }
    }
    const fx = px - COURT[0], fz = pz - COURT[1], fd = Math.hypot(fx, fz), fr = 3.6 + RADIUS;
    if (fd < fr) {
      px = COURT[0] + (fd ? fx / fd : 1) * fr;
      pz = COURT[1] + (fd ? fz / fd : 0) * fr;
    }
  }
  return { x: Math.min(LOT.maxX + 0.01, px), z: pz };
}
