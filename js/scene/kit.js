// Shared building kit: seeded randomness, cached geometry/materials,
// procedural canvas textures and a static-geometry batcher.
// Everything here uses the THREE bundled with A-Frame.

const THREE = window.AFRAME.THREE;
export { THREE };

/** Deterministic PRNG (mulberry32) so the town looks the same on every load and in tests. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);

// ---------------------------------------------------------------- geometry

const geoCache = new Map();
export const geo = {
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  plane: () => cached('plane', () => new THREE.PlaneGeometry(1, 1)),
  cyl: (seg = 12) => cached(`cyl${seg}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, seg)),
  cone: (seg = 12) => cached(`cone${seg}`, () => new THREE.ConeGeometry(0.5, 1, seg)),
  sphere: (w = 10, h = 8) => cached(`sph${w}x${h}`, () => new THREE.SphereGeometry(0.5, w, h)),
  ico: (d = 0) => cached(`ico${d}`, () => new THREE.IcosahedronGeometry(0.5, d)),
  capsule: () => cached('capsule', () => new THREE.CapsuleGeometry(0.5, 1, 4, 10)),
  /** 8-triangle bead for flowers, buds and garland beads seen at a distance. */
  bead: () => cached('bead', () => new THREE.OctahedronGeometry(0.5, 0)),
  /** Flat 2-triangle petal lying on the ground. */
  petal: () =>
    cached('petal', () => {
      const g = new THREE.PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      return g;
    }),
  torus: () => cached('torus', () => new THREE.TorusGeometry(0.5, 0.12, 6, 16)),
  /** Clay pot (matka) profile, unit height. */
  pot: () =>
    cached('pot', () => {
      const pts = [
        [0, 0], [0.22, 0.02], [0.4, 0.22], [0.47, 0.45], [0.42, 0.68], [0.26, 0.84], [0.2, 0.9], [0.24, 0.96], [0.22, 1],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      return new THREE.LatheGeometry(pts, 14);
    }),
  /** Small cup / lamp profile, unit height. */
  cup: () =>
    cached('cup', () => {
      const pts = [[0, 0], [0.32, 0], [0.42, 0.5], [0.5, 1], [0.46, 1], [0.38, 0.55], [0, 0.08]].map(
        ([x, y]) => new THREE.Vector2(x, y),
      );
      return new THREE.LatheGeometry(pts, 12);
    }),
};
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

// ---------------------------------------------------------------- textures

const texCache = new Map();

/** Draws into a canvas once and returns a cached, sRGB, repeat-wrapped texture. */
export function canvasTexture(key, size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const k = `${key}@${repeat.join('x')}`;
  if (texCache.has(k)) return texCache.get(k);
  let base = texCache.get(`${key}#base`);
  if (!base) {
    const c = document.createElement('canvas');
    c.width = Array.isArray(size) ? size[0] : size;
    c.height = Array.isArray(size) ? size[1] : size;
    draw(c.getContext('2d'), c.width, c.height);
    base = c;
    texCache.set(`${key}#base`, base);
  }
  const t = new THREE.CanvasTexture(base);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = isMobile ? 2 : 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

function noise(ctx, w, h, rand, alpha, count, sizeMax = 2) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rand() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    const s = 1 + rand() * sizeMax;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

export const tex = {
  plaster: (repeat) =>
    canvasTexture('plaster', 256, (ctx, w, h) => {
      const r = rng(11);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, r, 0.05, 5000, 3);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(120,100,80,${0.02 + r() * 0.03})`;
        ctx.beginPath();
        ctx.ellipse(r() * w, r() * h, 10 + r() * 40, 6 + r() * 30, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }, { repeat }),
  pavers: (repeat) =>
    canvasTexture('pavers', 512, (ctx, w, h) => {
      const r = rng(5);
      ctx.fillStyle = '#5a5047';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const rh = h / rows;
      for (let y = 0; y < rows; y++) {
        const off = (y % 2) * (w / 8);
        for (let x = -1; x < 4; x++) {
          const tone = 128 + r() * 34;
          ctx.fillStyle = `rgb(${tone + 14},${tone + 2},${tone - 16})`;
          ctx.fillRect(x * (w / 4) + off + 3, y * rh + 3, w / 4 - 6, rh - 6);
        }
      }
      noise(ctx, w, h, r, 0.06, 9000, 2);
    }, { repeat }),
  asphalt: (repeat) =>
    canvasTexture('asphalt', 256, (ctx, w, h) => {
      const r = rng(9);
      ctx.fillStyle = '#4a4744';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, r, 0.12, 9000, 2);
    }, { repeat }),
  shutter: (repeat) =>
    canvasTexture('shutter', [64, 256], (ctx, w, h) => {
      ctx.fillStyle = '#9aa1a3';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) {
        ctx.fillStyle = 'rgba(40,44,48,0.45)';
        ctx.fillRect(0, y, w, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(0, y + 2, w, 1);
      }
    }, { repeat }),
  woven: (repeat) =>
    canvasTexture('woven', 128, (ctx, w, h) => {
      ctx.fillStyle = '#d8bf86';
      ctx.fillRect(0, 0, w, h);
      const s = 16;
      for (let y = 0; y < h; y += s) {
        for (let x = 0; x < w; x += s) {
          const horiz = ((x + y) / s) % 2 === 0;
          const g = ctx.createLinearGradient(x, y, horiz ? x : x + s, horiz ? y + s : y);
          g.addColorStop(0, '#b89a5c');
          g.addColorStop(0.5, '#ead3a0');
          g.addColorStop(1, '#b0915a');
          ctx.fillStyle = g;
          ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        }
      }
    }, { repeat }),
  wood: (repeat) =>
    canvasTexture('wood', [64, 256], (ctx, w, h) => {
      const r = rng(3);
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(${50 + r() * 30},${28 + r() * 20},14,${0.15 + r() * 0.2})`;
        ctx.lineWidth = 1 + r() * 2;
        ctx.beginPath();
        const x = r() * w;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + r() * 6 - 3, h / 3, x + r() * 6 - 3, (2 * h) / 3, x + r() * 4 - 2, h);
        ctx.stroke();
      }
    }, { repeat }),
  awning: (key, a, b) =>
    canvasTexture(`awning-${key}`, 128, (ctx, w, h) => {
      const n = 8;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? b : a;
        ctx.fillRect((i * w) / n, 0, w / n, h);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    }),
  rangoli: (key, colors) =>
    canvasTexture(`rangoli-${key}`, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      const rings = colors.length;
      for (let ring = rings; ring > 0; ring--) {
        const rad = (ring / rings) * (w * 0.46);
        const petals = 8 + ring * 4;
        ctx.fillStyle = colors[ring - 1];
        for (let p = 0; p < petals; p++) {
          ctx.save();
          ctx.rotate((p / petals) * Math.PI * 2);
          ctx.beginPath();
          ctx.ellipse(0, -rad * 0.78, rad * 0.12, rad * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      // dotted kolam border
      ctx.fillStyle = '#f7f1e3';
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * w * 0.48, Math.sin(a) * w * 0.48, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }, { srgb: true }),
  cloth: (key, base, accent) =>
    canvasTexture(`cloth-${key}`, 128, (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent;
      ctx.fillRect(0, h - 22, w, 14);
      ctx.fillRect(0, 6, w, 4);
      for (let x = 4; x < w; x += 12) {
        ctx.beginPath();
        ctx.arc(x, h - 15, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f2c94c';
        ctx.fill();
      }
    }),
};

// ---------------------------------------------------------------- materials

const matCache = new Map();

/**
 * Cached MeshStandardMaterial keyed by name. Pass options only on first use.
 * Lighting presets look materials up by key to change emissive glow.
 */
export function mat(key, opts = {}) {
  if (!matCache.has(key)) {
    const { basic, ...rest } = opts;
    const m = basic ? new THREE.MeshBasicMaterial(rest) : new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...rest });
    m.name = key;
    matCache.set(key, m);
  }
  return matCache.get(key);
}
export const getMat = (key) => matCache.get(key);

/** Decals sit just above the paving; polygonOffset removes any residual z-fighting. */
export function decalMat(key, map, opacity = 1) {
  return mat(key, {
    map,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 1,
  });
}

// ---------------------------------------------------------------- batching

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export function matrix(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/**
 * Collects static parts and merges them into one mesh per material, so a
 * whole building costs a handful of draw calls.
 */
export class Batcher {
  /** `outlineMaterial(width)` returns the ink material used for outlined parts (see toon.js). */
  constructor({ outlineMaterial = null } = {}) {
    this.groups = new Map();
    this.outlineMaterial = outlineMaterial;
  }
  add(geometry, material, m, { cast = true, receive = true, outline = 0 } = {}) {
    const key = `${material.uuid}|${cast ? 1 : 0}${receive ? 1 : 0}`;
    if (!this.groups.has(key)) this.groups.set(key, { material, cast, receive, parts: [] });
    this.groups.get(key).parts.push([geometry, m]);
    // Rounded shapes get a normal-pushed ink hull (smooth normals keep it closed).
    if (outline && this.outlineMaterial) this.add(geometry, this.outlineMaterial(outline), m, { cast: false, receive: false });
    return this;
  }
  /** Box helper: centre position, size, optional rotation. Outlined boxes use a slightly larger ink box. */
  box(material, x, y, z, w, h, d, opts = {}) {
    const { outline = 0, ...rest } = opts;
    this.add(geo.box(), material, matrix(x, y, z, w, h, d, opts.rx || 0, opts.ry || 0, opts.rz || 0), rest);
    if (outline && this.outlineMaterial) {
      const t = outline * 2;
      this.add(geo.box(), this.outlineMaterial(0), matrix(x, y, z, w + t, h + t, d + t, opts.rx || 0, opts.ry || 0, opts.rz || 0), { cast: false, receive: false });
    }
    return this;
  }
  flush(parent) {
    for (const { material, cast, receive, parts } of this.groups.values()) {
      const mesh = new THREE.Mesh(mergeParts(parts), material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (material.side === THREE.BackSide) mesh.raycast = () => {};
      parent.add(mesh);
    }
    this.groups.clear();
  }
}

/** Merges a group's direct child meshes into one mesh per material (children with children are kept). */
export function mergeGroup(group) {
  const byMat = new Map();
  const keep = [];
  for (const child of group.children) {
    if (!child.isMesh || child.children.length) {
      keep.push(child);
      continue;
    }
    child.updateMatrix();
    if (!byMat.has(child.material)) byMat.set(child.material, []);
    byMat.get(child.material).push([child.geometry, child.matrix.clone()]);
  }
  group.clear();
  for (const [material, parts] of byMat) group.add(new THREE.Mesh(mergeParts(parts), material));
  for (const k of keep) group.add(k);
  return group;
}

function mergeParts(parts) {
  let count = 0;
  const prepared = parts.map(([g, m]) => {
    const ng = g.index ? g.toNonIndexed() : g;
    count += ng.attributes.position.count;
    return [ng, m];
  });
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  let o = 0;
  for (const [g, m] of prepared) {
    nm.getNormalMatrix(m);
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const U = g.attributes.uv;
    // UVs scale with the part so tiled textures keep a consistent density.
    const sx = Math.hypot(m.elements[0], m.elements[1], m.elements[2]);
    const sy = Math.hypot(m.elements[4], m.elements[5], m.elements[6]);
    const sz = Math.hypot(m.elements[8], m.elements[9], m.elements[10]);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m);
      pos.set([v.x, v.y, v.z], (o + i) * 3);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      nor.set([v.x, v.y, v.z], (o + i) * 3);
      if (U) {
        const nx = Math.abs(N.getX(i));
        const ny = Math.abs(N.getY(i));
        const su = nx > 0.5 ? sz : sx;
        const sv = ny > 0.5 ? sz : sy;
        uv.set([U.getX(i) * su, U.getY(i) * sv], (o + i) * 2);
      }
    }
    o += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

/**
 * Builds an InstancedMesh from a list of {m: Matrix4, c?: hex}.
 * Used for flowers, produce, pots, trees and lamps.
 */
export function instanced(geometry, material, items, { cast = false, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const col = new THREE.Color();
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, it.m);
    if (it.c !== undefined) mesh.setColorAt(i, col.set(it.c));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Collects instances by geometry+material key and emits one InstancedMesh each. */
export class InstanceSet {
  /** `addOutline(mesh, width)` is called for sets added with `{ outline: width }`. */
  constructor({ addOutline = null } = {}) {
    this.sets = new Map();
    this.addOutline = addOutline;
  }
  add(geometry, material, m, c, opts = {}) {
    const key = `${geometry.uuid}|${material.uuid}`;
    if (!this.sets.has(key)) this.sets.set(key, { geometry, material, items: [], opts });
    this.sets.get(key).items.push({ m, c });
  }
  flush(parent) {
    for (const s of this.sets.values()) {
      const mesh = instanced(s.geometry, s.material, s.items, s.opts);
      if (s.opts && s.opts.outline && this.addOutline) this.addOutline(mesh, s.opts.outline);
      parent.add(mesh);
    }
    this.sets.clear();
  }
}
