// Cartoon look for Liimy Land: stepped (cel) shading, crayon outlines,
// crayon-stroke textures and chunky rounded signs.
import { THREE, canvasTexture, rng } from './kit.js';

export const INK = '#3A2A3A';

export const PALETTE = {
  pink: '#FF8FAB',
  orange: '#FF9A4D',
  gold: '#FFC93C',
  lilac: '#B79CFF',
  cream: '#FFF4E0',
  mint: '#9BE7C4',
  sky: '#8FD3FF',
  ink: INK,
};

let gradient = null;
/** Three-step light ramp gives the flat, hand-painted cartoon shading. */
export function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 170, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const toonCache = new Map();
/** Cached toon material. `crayon` adds a subtle crayon-stroke texture. */
export function toon(color, { crayon = false, emissive = null, emissiveIntensity = 0, side, key } = {}) {
  const k = key || `${color}|${crayon}|${emissive}|${side || 0}`;
  if (!toonCache.has(k)) {
    const m = new THREE.MeshToonMaterial({
      color,
      gradientMap: gradientMap(),
      map: crayon ? crayonTexture() : null,
      emissive: emissive || '#000000',
      emissiveIntensity,
      side: side || THREE.FrontSide,
    });
    m.name = `toon-${k}`;
    toonCache.set(k, m);
  }
  return toonCache.get(k);
}

const outlineCache = new Map();
/**
 * Inverted-hull outline: back faces pushed out along their normals and drawn in ink.
 * Works for plain, merged and instanced meshes alike.
 */
export function outlineMat(width = 0.03) {
  const k = width.toFixed(3);
  if (outlineCache.has(k)) return outlineCache.get(k);
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float outlineWidth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * outlineWidth;');
  };
  m.customProgramCacheKey = () => `outline-${k}`;
  m.name = `outline-${k}`;
  outlineCache.set(k, m);
  return m;
}

/** Adds an ink outline child to a mesh (shares geometry, and instancing if any). */
export function addOutline(mesh, width = 0.02) {
  let o;
  if (mesh.isInstancedMesh) {
    o = new THREE.InstancedMesh(mesh.geometry, outlineMat(width), mesh.count);
    o.instanceMatrix = mesh.instanceMatrix;
  } else {
    o = new THREE.Mesh(mesh.geometry, outlineMat(width));
  }
  o.name = 'outline';
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

/** Soft crayon strokes: white-ish so it tints with the material colour. */
export function crayonTexture() {
  return canvasTexture('crayon', 256, (ctx, w, h) => {
    const r = rng(77);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = r() * h;
      const x = r() * w;
      ctx.strokeStyle = `rgba(${200 + r() * 40},${190 + r() * 40},${190 + r() * 40},${0.18 + r() * 0.22})`;
      ctx.lineWidth = 2 + r() * 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 20 + r() * 50, y + (r() - 0.5) * 10);
      ctx.stroke();
    }
  }, { repeat: [1, 1] });
}

export const UI_FONT = '"Fredoka"';

export async function loadFonts() {
  if (!document.fonts) return;
  await Promise.all([document.fonts.load(`700 64px ${UI_FONT}`, 'Liimy Land'), document.fonts.load(`500 32px ${UI_FONT}`, 'Ice cream')]);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Chunky rounded sign with a crayon border, like a sticker. */
export function signTexture(text, { bg = PALETTE.cream, fg = INK, accent = PALETTE.pink, width = 1024, height = 320 } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  roundRect(ctx, 12, 12, width - 24, height - 24, 70);
  ctx.fillStyle = accent;
  ctx.fill();
  roundRect(ctx, 34, 34, width - 68, height - 68, 54);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  roundRect(ctx, 12, 12, width - 24, height - 24, 70);
  ctx.stroke();
  // little dots like stitched stickers
  ctx.fillStyle = accent;
  for (let x = 80; x < width - 60; x += 60) {
    ctx.beginPath();
    ctx.arc(x, 56, 6, 0, Math.PI * 2);
    ctx.arc(x, height - 56, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  let size = 150;
  do {
    ctx.font = `700 ${size}px ${UI_FONT}, system-ui, sans-serif`;
    size -= 4;
  } while (ctx.measureText(text).width > width - 160 && size > 30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, width / 2, height / 2 + 6);
  ctx.fillStyle = fg;
  ctx.fillText(text, width / 2, height / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function signMesh(text, width, opts) {
  const map = signTexture(text, opts);
  const aspect = (opts && opts.height ? opts.height : 320) / (opts && opts.width ? opts.width : 1024);
  const m = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  m.name = `sign-${text}`;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * aspect), m);
  mesh.name = `sign:${text}`;
  return mesh;
}
