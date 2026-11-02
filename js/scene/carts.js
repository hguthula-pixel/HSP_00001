// The 16 hawker carts down the middle of the road: a shared push-cart base
// (big spoked wheels, metal frame, canopy, push handle), a cartoon hawker,
// an instanced display, and separate pickable items.
import { THREE, Batcher, InstanceSet, geo, matrix, rng, mergeGroup } from './kit.js';
import { CARTS } from '../data/hawkers.js';
import { toon, outlineMat, addOutline, signMesh, PALETTE, INK } from './toon.js';

const TRAY = 0.92; // display tray height
const tmpBox = new THREE.Box3();
const tmpSphere = new THREE.Sphere();

/** Every pickable: { id, label, kind, cartId, object, proxy, home: {parent, position, quaternion, scale} } */
export const pickables = [];

export function buildCarts(root) {
  const group = new THREE.Group();
  group.name = 'carts';
  root.add(group);
  const B = new Batcher({ outlineMaterial: outlineMat });
  const I = new InstanceSet({ addOutline });
  const hitboxes = [];
  let iceCream = null;

  for (const cart of CARTS) {
    const r = rng(500 + cart.index * 13);
    const s = cart.side;
    // local frame: u = metres toward the walkway the cart faces, w = along the street
    const X = (u) => s * u;
    const Z = (w) => cart.z + w;
    const at = (u, y, w, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => matrix(X(u), y, Z(w), sx, sy, sz, rx, ry, rz);
    const faceYaw = s * (Math.PI / 2); // turns a +Z-facing object toward the walkway
    const c = { cart, r, B, I, X, Z, at, faceYaw, group };

    cartBase(c);
    const hawker = figure(c, cart.index);
    const sign = signMesh(cart.sign, 1.7, { accent: cart.canopy, width: 900, height: 280 });
    // sign stands on top of the canopy so it never hides the hawker; a plain board backs it
    sign.position.set(X(0.74), 2.72, Z(0));
    sign.rotation.y = faceYaw;
    group.add(sign);
    B.box(toon(cart.canopy), X(0.71), 2.72, Z(0), 0.05, 0.58, 1.78, { outline: 0.015 });

    DISPLAY[cart.id](c);
    cart.items.forEach((spec, k) => {
      const n = cart.items.length;
      const w = -0.75 + (1.5 * (k + 0.5)) / n;
      const item = makeItem(spec.type, spec.color);
      item.position.set(X(0.42), TRAY + 0.02, Z(w));
      item.rotation.y = faceYaw;
      group.add(item);
      register(item, { id: `${cart.id}-${k}`, label: spec.label, kind: spec.kind, cartId: cart.id });
    });

    if (cart.id === 'icecream') iceCream = iceCreamCart(c, hawker);

    const hit = new THREE.Mesh(geo.box());
    hit.position.set(X(-0.1), 1.2, cart.z);
    hit.scale.set(2.2, 2.4, 2.4);
    hit.updateMatrixWorld(true);
    hit.userData.cartIndex = cart.index;
    hitboxes.push(hit);
  }

  B.flush(group);
  I.flush(group);
  return { hitboxes, pickables, iceCream };
}

/** Registers a pickable and gives it an invisible sphere for clicks and reach checks. */
export function register(object, info) {
  object.updateMatrixWorld(true);
  tmpBox.setFromObject(object);
  tmpBox.getBoundingSphere(tmpSphere);
  const proxy = new THREE.Mesh(geo.sphere(8, 6));
  proxy.visible = false;
  const local = object.worldToLocal(tmpSphere.center.clone());
  proxy.position.copy(local);
  const worldScale = object.getWorldScale(new THREE.Vector3()).x || 1;
  proxy.scale.setScalar(Math.max(0.18, tmpSphere.radius * 1.6) * 2 / worldScale);
  object.add(proxy);
  const rec = {
    ...info,
    object,
    proxy,
    radius: Math.max(0.12, tmpSphere.radius),
    home: { parent: object.parent, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() },
  };
  proxy.userData.pickable = rec;
  object.userData.pickable = rec;
  object.traverse((o) => {
    if (o.isMesh && o !== proxy) o.raycast = () => {};
  });
  pickables.push(rec);
  return rec;
}

// ------------------------------------------------------------------ cart base

function cartBase(c) {
  const { cart, B, I, at } = c;
  const frame = toon('#3FC1B0'); // the teal metal frame from the photo
  const steel = toon('#D9E2EA');
  const body = toon(cart.canopy, { crayon: true });
  const canopy = toon(cart.canopy);
  const ink = toon(INK);

  // lower cabinet and steel tray
  B.box(body, c.X(0), 0.62, c.Z(0), 1.25, 0.5, 2.0, { outline: 0.03 });
  B.box(steel, c.X(0), TRAY - 0.02, c.Z(0), 1.38, 0.06, 2.14, { outline: 0.02 });
  // tray lip
  for (const w of [-1.06, 1.06]) B.box(steel, c.X(0), TRAY + 0.04, c.Z(w), 1.38, 0.08, 0.04);
  B.box(steel, c.X(0.68), TRAY + 0.04, c.Z(0), 0.04, 0.08, 2.14);
  // frame legs and bottom rails
  for (const u of [-0.58, 0.58]) for (const w of [-0.95, 0.95]) B.box(frame, c.X(u), 0.2, c.Z(w), 0.06, 0.4, 0.06);
  for (const u of [-0.58, 0.58]) B.box(frame, c.X(u), 0.18, c.Z(0), 0.05, 0.05, 1.9);

  // two big spoked wheels on the long sides
  for (const u of [-0.78, 0.78]) {
    const wx = c.X(u);
    const wz = c.Z(-0.35);
    B.add(geo.torus(), ink, matrix(wx, 0.36, wz, 0.68, 0.68, 0.45, 0, Math.PI / 2, 0), { outline: 0.01 });
    B.add(geo.cyl(12), frame, matrix(wx, 0.36, wz, 0.12, 0.12, 0.12, 0, 0, Math.PI / 2));
    for (let k = 0; k < 6; k++) {
      B.box(frame, wx, 0.36, wz, 0.025, 0.62, 0.025, { rx: (k / 6) * Math.PI });
    }
  }
  // front stand leg and push handle
  B.box(frame, c.X(0), 0.2, c.Z(1.0), 0.6, 0.06, 0.06);
  B.box(frame, c.X(0), 0.95, c.Z(1.3), 1.0, 0.06, 0.06, { outline: 0.012 });
  for (const u of [-0.45, 0.45]) B.box(frame, c.X(u), 0.92, c.Z(1.17), 0.05, 0.05, 0.3);

  // canopy on four poles, tilted toward the walkway, with a scalloped edge
  for (const u of [-0.6, 0.6]) for (const w of [-0.98, 0.98]) B.add(geo.cyl(8), frame, at(u, 1.6, w, 0.05, 1.4, 0.05), { outline: 0.01 });
  B.box(canopy, c.X(0.05), 2.36, c.Z(0), 1.65, 0.07, 2.4, { rz: c.cart.side * -0.12, outline: 0.025 });
  const scallopMat = toon('#ffffff', { key: 'scallop' });
  for (let k = 0; k < 9; k++) {
    const w = -1.1 + k * 0.275;
    I.add(geo.cyl(12), scallopMat, matrix(c.X(0.86), 2.2, c.Z(w), 0.27, 0.02, 0.27, 0, 0, Math.PI / 2), k % 2 ? PALETTE.cream : cart.canopy, { outline: 0.008 });
  }
  // gold lantern hanging from a front corner
  I.add(geo.sphere(12, 10), toon('#FFD36E', { key: 'lantern', emissive: '#FFB43C', emissiveIntensity: 1.2 }), at(0.62, 1.95, 0.95, 0.2, 0.24, 0.2), undefined, { outline: 0.01 });
  // blob shadow under the cart (no real-time shadows, keeps Quest fast)
  const shadow = new THREE.Mesh(geo.plane(), blobMaterial());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(c.X(0), 0.025, c.Z(0));
  shadow.scale.set(2.2, 3.0, 1);
  shadow.renderOrder = 1;
  c.group.add(shadow);
}

let blob = null;
function blobMaterial() {
  if (blob) return blob;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(58,30,60,0.45)');
  g.addColorStop(1, 'rgba(58,30,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  blob = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return blob;
}

// ------------------------------------------------------------------ hawker figure

const SKIN = ['#F2C9A0', '#D9A273', '#B97F55', '#E8B88A'];
const APRON = ['#FF8FAB', '#7FD4F5', '#FFD95A', '#9BE07A', '#B79CFF', '#FF9A4D'];

/** A round, friendly cartoon hawker standing behind the cart. Returns the right-arm pivot. */
function figure(c, i) {
  const { B, X, Z, cart } = c;
  const u = -1.05;
  const x = X(u);
  const z = Z(0.15);
  const skin = toon(SKIN[i % SKIN.length]);
  const shirt = toon(APRON[i % APRON.length], { crayon: true });
  const pants = toon('#5B6B9A');
  const hair = toon(INK);
  const white = toon('#FFFFFF');
  const blush = toon('#FF9FB2');
  const f = cart.side; // the hawker faces +u (toward the walkway)

  B.add(geo.cyl(10), pants, matrix(x, 0.45, z - 0.1, 0.16, 0.9, 0.16), { outline: 0.012 });
  B.add(geo.cyl(10), pants, matrix(x, 0.45, z + 0.1, 0.16, 0.9, 0.16), { outline: 0.012 });
  B.add(geo.sphere(14, 12), shirt, matrix(x, 1.15, z, 0.62, 0.78, 0.55), { outline: 0.02 });
  // big round head with thick eyebrows, dot eyes and pink cheeks
  const hy = 1.78;
  B.add(geo.sphere(18, 14), skin, matrix(x, hy, z, 0.56, 0.5, 0.52), { outline: 0.02 });
  B.add(geo.sphere(16, 10), hair, matrix(x - f * 0.03, hy + 0.12, z, 0.56, 0.32, 0.53));
  const fx = x + f * 0.255;
  for (const dz of [-0.1, 0.1]) {
    B.add(geo.sphere(8, 6), hair, matrix(fx, hy + 0.02, z + dz, 0.05, 0.07, 0.05));
    B.box(hair, fx, hy + 0.11, z + dz, 0.04, 0.05, 0.13, { rz: 0 });
    B.add(geo.sphere(8, 6), blush, matrix(fx - f * 0.02, hy - 0.07, z + dz * 1.7, 0.03, 0.05, 0.08));
  }
  B.box(toon('#C0392B'), fx, hy - 0.12, z, 0.02, 0.025, 0.09);
  // cap
  B.add(geo.cyl(16), white, matrix(x, hy + 0.26, z, 0.4, 0.1, 0.4), { outline: 0.01 });
  B.box(white, x + f * 0.18, hy + 0.22, z, 0.22, 0.03, 0.3);
  // left arm resting on the cart
  B.add(geo.cyl(8), shirt, matrix(x + f * 0.2, 1.1, z - 0.32, 0.12, 0.5, 0.12, 0, 0, f * 0.9), { outline: 0.01 });
  // right arm on a pivot so the ice cream hawker can hold out a cone
  const pivot = new THREE.Group();
  pivot.position.set(x, 1.32, z + 0.3);
  pivot.rotation.y = c.faceYaw - Math.PI / 2;
  const arm = new THREE.Mesh(geo.cyl(8), shirt);
  arm.scale.set(0.12, 0.5, 0.12);
  arm.position.set(0, -0.22, 0);
  addOutline(arm, 0.01);
  const hand = new THREE.Mesh(geo.sphere(10, 8), skin);
  hand.scale.setScalar(0.12);
  hand.position.set(0, -0.48, 0);
  pivot.add(arm, hand);
  pivot.userData.hand = hand;
  c.group.add(pivot);
  return pivot;
}

// ------------------------------------------------------------------ ice cream

function iceCreamCart(c, armPivot) {
  const { X, Z, group, B } = c;
  // bell on a little post at the front corner
  const bell = new THREE.Group();
  const bellMesh = new THREE.Mesh(geo.cone(14), toon('#FFC93C'));
  bellMesh.scale.set(0.16, 0.16, 0.16);
  addOutline(bellMesh, 0.01);
  const knob = new THREE.Mesh(geo.sphere(8, 6), toon('#FFC93C'));
  knob.scale.setScalar(0.05);
  knob.position.y = 0.1;
  bell.add(bellMesh, knob);
  bell.position.set(X(0.55), TRAY + 0.28, Z(0.85));
  group.add(bell);
  B.add(geo.cyl(6), toon(INK), matrix(X(0.55), TRAY + 0.1, Z(0.85), 0.03, 0.2, 0.03));
  const bellRec = register(bell, { id: 'icecream-bell', label: 'Ice cream bell', kind: 'bell', cartId: 'icecream', action: true });

  // the cone the hawker hands over (hidden until the bell rings)
  const cone = makeItem('icecream');
  cone.visible = false;
  group.add(cone);
  const coneRec = register(cone, { id: 'icecream-cone', label: 'Ice cream cone', kind: 'icecream', cartId: 'icecream' });
  coneRec.available = false;

  const state = { given: 0, t: 1, raising: false };
  const handWorld = new THREE.Vector3();

  return {
    bell: bellRec,
    cone: coneRec,
    pivot: armPivot,
    /** Ring the bell: the hawker lifts a fresh cone toward the visitor. */
    ring() {
      if (coneRec.available) return false;
      state.raising = true;
      state.t = 0;
      return true;
    },
    tick(dt) {
      if (!state.raising) return;
      state.t = Math.min(1, state.t + dt / 0.8);
      const k = 1 - Math.pow(1 - state.t, 3);
      armPivot.rotation.z = k * 1.35;
      bell.rotation.z = Math.sin(state.t * 30) * 0.3 * (1 - state.t);
      if (state.t >= 1) {
        state.raising = false;
        armPivot.userData.hand.getWorldPosition(handWorld);
        cone.position.copy(group.worldToLocal(handWorld)).add(new THREE.Vector3(0, 0.06, 0));
        cone.quaternion.identity();
        coneRec.home.position.copy(cone.position);
        coneRec.home.quaternion.copy(cone.quaternion);
        cone.visible = true;
        coneRec.available = true;
      }
    },
    /** Called when the visitor takes the cone; the arm goes back down. */
    taken() {
      coneRec.available = false;
      state.given++;
      armPivot.rotation.z = 0;
    },
    get given() {
      return state.given;
    },
  };
}

// ------------------------------------------------------------------ displays (instanced, not pickable)

function pile(c, u, w, y, R, H, colors, size, geomFn = () => geo.sphere(8, 6), count) {
  const n = count || Math.round((Math.PI * R * R) / (size * size) * 1.4);
  const m = toon('#ffffff', { key: 'pile' });
  for (let i = 0; i < n; i++) {
    const rad = R * Math.sqrt(c.r());
    const a = c.r() * Math.PI * 2;
    const yy = y + H * (1 - (rad / R) ** 2) + size * 0.4;
    c.I.add(geomFn(), m, c.at(u + Math.cos(a) * rad, yy, w + Math.sin(a) * rad, size, size, size, 0, c.r() * 3, 0), colors[i % colors.length]);
  }
}

function crate(c, u, w, du = 0.5, dw = 0.5) {
  c.B.box(toon('#E6A15C', { crayon: true }), c.X(u), TRAY + 0.08, c.Z(w), du, 0.14, dw, { outline: 0.012 });
}

/** Hanging packets and strings from the canopy, like the snack cart photo. */
function hang(c, u, w, colors, n = 4, len = 0.5) {
  const m = toon('#ffffff', { key: 'hang' });
  for (let k = 0; k < n; k++) {
    c.I.add(geo.cyl(4), toon(INK), c.at(u, 2.2 - 0.12, w, 0.008, 0.24, 0.008));
    // thin strings along the canopy edge, spread wide so the hawker's face stays visible
    c.I.add(geo.box(), m, c.at(u, 2.2 - 0.3 - (k % 2) * 0.1, w + (k - (n - 1) / 2) * (1.8 / n), 0.04, len * 0.45, 0.06), colors[k % colors.length], { outline: 0.006 });
  }
}

const DISPLAY = {
  baskets(c) {
    // wooden rack with stacked baskets; the front ones are pickable
    const rack = toon('#E6A15C', { crayon: true });
    c.B.box(rack, c.X(-0.1), TRAY + 0.5, c.Z(0), 0.08, 1.0, 1.8, { outline: 0.015 });
    for (let k = 0; k < 4; k++) {
      for (let j = 0; j < 3; j++) {
        c.I.add(geo.cup(), toon('#ffffff', { key: 'basketdeco' }), c.at(-0.3, TRAY + 0.02 + j * 0.13, -0.75 + k * 0.5, 0.42, 0.28, 0.42), ['#FF8FAB', '#FFD95A', '#7FD4F5', '#9BE07A'][k], { outline: 0.01 });
      }
    }
    for (let k = 0; k < 3; k++) {
      const b = makeItem('basket', ['#FF8FAB', '#FFD95A', '#7FD4F5'][k]);
      b.position.set(c.X(0.35), TRAY + 0.02, c.Z(-0.6 + k * 0.6));
      b.rotation.y = c.faceYaw;
      c.group.add(b);
      register(b, { id: `basket-${k}`, label: 'Shopping basket', kind: 'basket', cartId: 'baskets' });
    }
  },
  icecream(c) {
    // white freezer box with blue trim and a stack of cones
    const white = toon('#FFFFFF');
    c.B.box(white, c.X(-0.1), TRAY + 0.22, c.Z(-0.2), 0.9, 0.42, 1.2, { outline: 0.02 });
    c.B.box(toon('#7FD4F5'), c.X(-0.1), TRAY + 0.46, c.Z(-0.2), 0.95, 0.06, 1.25);
    for (let k = 0; k < 6; k++) {
      c.I.add(geo.cone(10), toon('#ffffff', { key: 'conedeco' }), c.at(0.3, TRAY + 0.12, -0.6 + k * 0.18, 0.1, 0.22, 0.1, Math.PI, 0, 0), '#E3A857');
      c.I.add(geo.sphere(10, 8), toon('#ffffff', { key: 'scoopdeco' }), c.at(0.3, TRAY + 0.27, -0.6 + k * 0.18, 0.12, 0.12, 0.12), ['#FF8FAB', '#FFF4E0', '#8B5A3C', '#9BE07A', '#FFD95A', '#B79CFF'][k]);
    }
  },
  flowers(c) {
    for (let k = 0; k < 4; k++) {
      const w = -0.7 + k * 0.47;
      c.I.add(geo.cyl(12), toon('#ffffff', { key: 'bucket' }), c.at(-0.2, TRAY + 0.15, w, 0.32, 0.3, 0.32), ['#7FD4F5', '#FFD95A', '#FF8FAB', '#9BE07A'][k], { outline: 0.01 });
      pile(c, -0.2, w, TRAY + 0.35, 0.18, 0.12, [['#FF5A6E', '#FF8FAB'], ['#FFD23F', '#FF9A4D'], ['#FFFFFF', '#FFE6F0'], ['#C77DFF', '#FF6F91']][k], 0.07);
    }
    hang(c, 0.7, 0, ['#FF9A4D', '#FFD23F'], 6, 0.8);
  },
  vegetables(c) {
    const sets = [['#E8402F'], ['#FF8C1A'], ['#7B3FA0'], ['#8FD16A'], ['#5FA83A']];
    sets.forEach((cols, k) => {
      const w = -0.8 + k * 0.4;
      crate(c, -0.25, w, 0.6, 0.36);
      pile(c, -0.25, w, TRAY + 0.15, 0.17, 0.08, cols, 0.07);
    });
  },
  fruits(c) {
    const cols = [['#F7B500', '#FFCC33'], ['#E8402F', '#C62828'], ['#FF9A1F'], ['#8FD16A']];
    cols.forEach((cl, k) => {
      const w = -0.7 + k * 0.47;
      for (let l = 0; l < 3; l++) {
        const n = 3 - l;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          c.I.add(geo.sphere(10, 8), toon('#ffffff', { key: 'fruitdeco' }), c.at(-0.25 + (a - (n - 1) / 2) * 0.12, TRAY + 0.07 + l * 0.1, w + (b - (n - 1) / 2) * 0.12, 0.12, 0.12, 0.12), cl[(a + b) % cl.length]);
        }
      }
    });
    hang(c, 0.7, -0.4, ['#FFE14D'], 3, 0.6);
  },
  snacks(c) {
    // rows of jars with red lids, like the snack cart photo
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 6; k++) {
        const u = -0.4 + row * 0.28;
        const w = -0.8 + k * 0.32;
        c.I.add(geo.cyl(12), toon('#ffffff', { key: 'jarfill' }), c.at(u, TRAY + 0.13, w, 0.18, 0.2, 0.18), ['#E3A857', '#C98B4A', '#F2D16B', '#E07A5F'][(k + row) % 4]);
        c.I.add(geo.cyl(12), toon('#ffffff', { key: 'jarlid' }), c.at(u, TRAY + 0.28, w, 0.21, 0.05, 0.21), '#E63946', { outline: 0.006 });
      }
    }
    hang(c, 0.7, 0, ['#E3A857', '#F2D16B', '#C98B4A'], 8, 0.7);
  },
  pottery(c) {
    const clay = toon('#ffffff', { key: 'claydeco' });
    for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) {
      c.I.add(geo.pot(), clay, c.at(-0.45 + row * 0.3, TRAY, -0.75 + k * 0.5, 0.3 - row * 0.05, 0.3 - row * 0.05, 0.3 - row * 0.05), ['#D9744A', '#C8613A', '#E8875B'][(row + k) % 3], { outline: 0.008 });
    }
  },
  corn(c) {
    // little coal stove glowing orange, cobs heaped beside it
    c.B.box(toon('#3A3A3A'), c.X(-0.2), TRAY + 0.12, c.Z(-0.4), 0.6, 0.22, 0.6, { outline: 0.012 });
    pile(c, -0.2, -0.4, TRAY + 0.22, 0.24, 0.02, ['#FF6B1A', '#FFB020', '#E8402F'], 0.06, () => geo.ico(0));
    for (let k = 0; k < 10; k++) c.I.add(geo.capsule(), toon('#ffffff', { key: 'corndeco' }), c.at(-0.25 + (k % 3) * 0.12, TRAY + 0.05 + Math.floor(k / 3) * 0.05, 0.35 + (k % 2) * 0.05, 0.06, 0.12, 0.06, 0, 0, Math.PI / 2), '#F5C542');
  },
  sugarcane(c) {
    // the big crushing wheel and a bundle of canes
    c.B.add(geo.cyl(20), toon('#5B6B9A'), c.at(-0.3, TRAY + 0.4, -0.3, 0.7, 0.18, 0.7, 0, 0, Math.PI / 2), { outline: 0.015 });
    c.B.add(geo.cyl(12), toon('#FFC93C'), c.at(-0.3, TRAY + 0.4, -0.3, 0.12, 0.22, 0.12, 0, 0, Math.PI / 2));
    for (let k = 0; k < 8; k++) c.I.add(geo.cyl(6), toon('#ffffff', { key: 'cane' }), c.at(-0.5 + (k % 4) * 0.04, TRAY + 0.7, 0.6 + Math.floor(k / 4) * 0.05, 0.035, 1.4, 0.035, 0, 0, (k - 4) * 0.02), '#7BAA3C');
  },
  cottoncandy(c) {
    c.B.add(geo.cyl(20), toon('#C0C8D2'), c.at(-0.2, TRAY + 0.15, -0.3, 0.6, 0.3, 0.6), { outline: 0.012 });
    c.I.add(geo.ico(1), toon('#ffffff', { key: 'fluff' }), c.at(-0.2, TRAY + 0.42, -0.3, 0.5, 0.3, 0.5), '#FFB3DE');
    // finished candy floss on a tall holder
    c.B.add(geo.cyl(6), toon(INK), c.at(-0.4, TRAY + 0.7, 0.55, 0.03, 1.4, 0.03));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      c.I.add(geo.ico(1), toon('#ffffff', { key: 'fluff' }), c.at(-0.4 + Math.cos(a) * 0.2, TRAY + 1.15 + (k % 2) * 0.2, 0.55 + Math.sin(a) * 0.2, 0.22, 0.26, 0.22), k % 2 ? '#FFB3DE' : '#B3E5FF');
    }
  },
  panipuri(c) {
    // glass box of puris and steel pots of tangy water and potato
    c.B.box(toon('#D9E2EA'), c.X(-0.25), TRAY + 0.2, c.Z(-0.3), 0.7, 0.36, 0.8, { outline: 0.012 });
    pile(c, -0.25, -0.3, TRAY + 0.38, 0.3, 0.1, ['#E3B866', '#D9A24A'], 0.07);
    for (const w of [0.35, 0.75]) c.I.add(geo.cyl(16), toon('#ffffff', { key: 'steelpot' }), c.at(-0.25, TRAY + 0.13, w, 0.32, 0.24, 0.32), '#C8D0D8', { outline: 0.01 });
  },
  balloons(c) {
    const cols = ['#FF5A6E', '#FFD23F', '#5BC0EB', '#9BE07A', '#B79CFF', '#FF9A4D', '#FF8FAB'];
    for (let k = 0; k < 14; k++) {
      const a = c.r() * Math.PI * 2;
      const rad = 0.2 + c.r() * 0.35;
      const y = 2.7 + c.r() * 0.7;
      c.I.add(geo.sphere(12, 10), toon('#ffffff', { key: 'balloon' }), c.at(-0.1 + Math.cos(a) * rad, y, Math.sin(a) * rad, 0.3, 0.36, 0.3), cols[k % cols.length], { outline: 0.012 });
      c.I.add(geo.cyl(3), toon(INK), c.at(-0.1 + Math.cos(a) * rad * 0.5, (y + TRAY) / 2, Math.sin(a) * rad * 0.5, 0.006, y - TRAY, 0.006));
    }
  },
  toys(c) {
    const shelf = toon('#E6A15C', { crayon: true });
    c.B.box(shelf, c.X(-0.4), TRAY + 0.25, c.Z(0), 0.3, 0.5, 1.8, { outline: 0.012 });
    for (let k = 0; k < 6; k++) c.I.add(geo.sphere(12, 10), toon('#ffffff', { key: 'toyball' }), c.at(-0.4, TRAY + 0.58, -0.75 + k * 0.3, 0.16, 0.16, 0.16), ['#FF5A6E', '#5BC0EB', '#FFD23F'][k % 3], { outline: 0.008 });
  },
  bangles(c) {
    for (let k = 0; k < 5; k++) {
      const w = -0.8 + k * 0.4;
      c.B.add(geo.cyl(6), toon(INK), c.at(-0.35, TRAY + 0.35, w, 0.025, 0.7, 0.025));
      for (let j = 0; j < 10; j++) {
        c.I.add(geo.torus(), toon('#ffffff', { key: 'bangledeco' }), c.at(-0.35, TRAY + 0.1 + j * 0.055, w, 0.16, 0.16, 0.16, Math.PI / 2, 0, 0), ['#E63E6D', '#FFC93C', '#3FA9F5', '#7BD389', '#C77DFF'][(j + k) % 5]);
      }
    }
  },
  bamboo(c) {
    const cane = toon('#E2C27A', { crayon: true });
    for (let k = 0; k < 4; k++) {
      for (let j = 0; j < 2; j++) c.I.add(geo.cup(), cane, c.at(-0.35, TRAY + j * 0.14, -0.7 + k * 0.45, 0.36, 0.3, 0.36), undefined, { outline: 0.008 });
    }
    hang(c, 0.7, 0, ['#E2C27A', '#C9A85A'], 5, 0.6);
  },
  accessories(c) {
    // a pegboard with sparkly clips and chains, and a velvet tray of rings
    const board = toon('#6A4C93');
    c.B.box(board, c.X(-0.45), TRAY + 0.55, c.Z(0), 0.06, 1.0, 1.7, { outline: 0.015 });
    const cols = ['#FF8FAB', '#FFC93C', '#7FD4F5', '#FFFFFF', '#C77DFF'];
    for (let row = 0; row < 4; row++) for (let k = 0; k < 7; k++) {
      c.I.add(geo.box(), toon('#ffffff', { key: 'clipdeco', emissive: '#ffffff', emissiveIntensity: 0.15 }), c.at(-0.41, TRAY + 0.2 + row * 0.22, -0.72 + k * 0.24, 0.02, 0.05, 0.12), cols[(row + k) % 5]);
    }
    c.B.box(toon('#8E1B3B'), c.X(-0.1), TRAY + 0.03, c.Z(0.4), 0.4, 0.05, 0.6);
  },
};

// ------------------------------------------------------------------ pickable items

/** Builds a small grabbable item (about hand size), origin at its base. */
export function makeItem(type, color) {
  const g = new THREE.Group();
  g.name = `item:${type}`;
  const add = (geometry, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, outline = 0) => {
    const m = new THREE.Mesh(geometry, toon(col));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    if (outline) addOutline(m, outline / Math.max(sx, sy, sz));
    g.add(m);
    return m;
  };
  switch (type) {
    case 'basket':
      add(geo.cup(), color || '#FF8FAB', 0, 0, 0, 0.34, 0.2, 0.34);
      add(geo.torus(), color || '#FF8FAB', 0, 0.26, 0, 0.18, 0.4, 0.18, 0, Math.PI / 2, 0);
      break;
    case 'icecream':
      add(geo.cone(12), '#E3A857', 0, 0.08, 0, 0.09, 0.18, 0.09, Math.PI, 0, 0);
      add(geo.sphere(12, 10), '#FF8FAB', 0, 0.2, 0, 0.12, 0.11, 0.12);
      add(geo.sphere(12, 10), '#FFF4E0', 0, 0.28, 0, 0.1, 0.09, 0.1);
      add(geo.sphere(6, 5), '#E63946', 0, 0.34, 0, 0.03, 0.03, 0.03, 0, 0, 0, 0);
      break;
    case 'rose':
      for (let k = 0; k < 3; k++) {
        add(geo.cyl(5), '#3F8A2A', (k - 1) * 0.03, 0.1, 0, 0.012, 0.2, 0.012, 0, 0, (k - 1) * 0.2, 0);
        add(geo.sphere(10, 8), '#E8344E', (k - 1) * 0.055, 0.22, 0, 0.06, 0.06, 0.06);
      }
      break;
    case 'sunflower':
      add(geo.cyl(5), '#3F8A2A', 0, 0.12, 0, 0.015, 0.24, 0.015, 0, 0, 0, 0);
      add(geo.cyl(16), '#FFD23F', 0, 0.26, 0, 0.16, 0.02, 0.16, Math.PI / 2, 0, 0);
      add(geo.cyl(12), '#6B3E1F', 0, 0.26, 0.012, 0.07, 0.02, 0.07, Math.PI / 2, 0, 0, 0);
      break;
    case 'marigold':
      for (let k = 0; k < 9; k++) add(geo.sphere(8, 6), k % 2 ? '#FF9A1F' : '#FFC93C', Math.cos(k * 0.7) * 0.08, 0.04 + k * 0.025, Math.sin(k * 0.7) * 0.08, 0.05, 0.045, 0.05, 0, 0, 0, 0);
      break;
    case 'tulip':
      add(geo.cyl(5), '#3F8A2A', 0, 0.1, 0, 0.012, 0.2, 0.012, 0, 0, 0, 0);
      add(geo.sphere(10, 8), '#FF7EB6', 0, 0.23, 0, 0.06, 0.08, 0.06);
      break;
    case 'tomato':
      add(geo.sphere(12, 10), '#E8402F', 0, 0.05, 0, 0.1, 0.09, 0.1);
      add(geo.cone(5), '#3F8A2A', 0, 0.1, 0, 0.04, 0.02, 0.04, 0, 0, 0, 0);
      break;
    case 'carrot':
      add(geo.cone(10), '#FF8C1A', 0, 0.03, 0, 0.05, 0.2, 0.05, 0, 0, Math.PI / 2);
      add(geo.cone(5), '#5FA83A', -0.12, 0.03, 0, 0.04, 0.06, 0.04, 0, 0, -Math.PI / 2, 0);
      break;
    case 'brinjal':
      add(geo.sphere(12, 10), '#7B3FA0', 0, 0.05, 0, 0.09, 0.09, 0.16, 0, 0, 0);
      add(geo.cyl(6), '#5FA83A', 0, 0.06, 0.09, 0.03, 0.04, 0.03, Math.PI / 2, 0, 0, 0);
      break;
    case 'cabbage':
      add(geo.ico(1), '#8FD16A', 0, 0.09, 0, 0.18, 0.16, 0.18);
      break;
    case 'mango':
      add(geo.sphere(12, 10), '#F7B500', 0, 0.06, 0, 0.1, 0.12, 0.08, 0, 0, 0.3);
      add(geo.sphere(8, 6), '#5FA83A', 0.02, 0.12, 0, 0.03, 0.015, 0.02, 0, 0, 0, 0);
      break;
    case 'banana':
      for (let k = 0; k < 3; k++) add(geo.capsule(), '#FFE14D', (k - 1) * 0.035, 0.05, 0, 0.035, 0.09, 0.035, 0, 0, (k - 1) * 0.3 + 0.6);
      break;
    case 'apple':
      add(geo.sphere(12, 10), '#E8402F', 0, 0.055, 0, 0.11, 0.1, 0.11);
      add(geo.cyl(4), '#6B3E1F', 0, 0.11, 0, 0.008, 0.03, 0.008, 0, 0, 0, 0);
      break;
    case 'watermelon':
      add(geo.cone(3), '#E8344E', 0, 0.07, 0, 0.18, 0.14, 0.04, 0, 0, Math.PI);
      add(geo.box(), '#3FA34D', 0, 0.005, 0, 0.18, 0.02, 0.04, 0, 0, 0);
      break;
    case 'jar':
    case 'candyjar':
      add(geo.cyl(12), type === 'jar' ? '#E3A857' : '#FF7EB6', 0, 0.08, 0, 0.12, 0.15, 0.12);
      add(geo.cyl(12), '#E63946', 0, 0.17, 0, 0.14, 0.04, 0.14);
      break;
    case 'packet':
      add(geo.box(), '#F2D16B', 0, 0.09, 0, 0.12, 0.18, 0.04);
      add(geo.box(), '#E63946', 0, 0.17, 0, 0.125, 0.03, 0.045, 0, 0, 0, 0);
      break;
    case 'pot':
      add(geo.pot(), '#D9744A', 0, 0, 0, 0.18, 0.18, 0.18);
      break;
    case 'diya':
      add(geo.cup(), '#C8613A', 0, 0, 0, 0.12, 0.05, 0.12);
      add(geo.cone(6), '#FFB020', 0, 0.07, 0, 0.02, 0.05, 0.02, 0, 0, 0, 0);
      break;
    case 'kulhad':
      add(geo.cup(), '#D9744A', 0, 0, 0, 0.08, 0.1, 0.08);
      break;
    case 'corn':
      add(geo.capsule(), '#F5C542', 0, 0.05, 0, 0.05, 0.12, 0.05, 0, 0, Math.PI / 2);
      add(geo.cone(5), '#7BAA3C', 0.13, 0.05, 0, 0.05, 0.08, 0.05, 0, 0, -Math.PI / 2, 0);
      break;
    case 'juice':
      add(geo.cyl(12), '#B5E07A', 0, 0.07, 0, 0.08, 0.14, 0.08);
      add(geo.cyl(4), '#FF5A6E', 0.02, 0.17, 0, 0.008, 0.12, 0.008, 0, 0, 0.2, 0);
      break;
    case 'candyfloss':
      add(geo.cyl(5), '#FFFFFF', 0, 0.1, 0, 0.01, 0.2, 0.01, 0, 0, 0, 0);
      add(geo.ico(1), '#FFB3DE', 0, 0.26, 0, 0.18, 0.2, 0.18);
      break;
    case 'puriplate':
      add(geo.cyl(16), '#C8D0D8', 0, 0.01, 0, 0.22, 0.02, 0.22);
      for (let k = 0; k < 5; k++) add(geo.sphere(8, 6), '#E3B866', Math.cos(k * 1.26) * 0.06, 0.035, Math.sin(k * 1.26) * 0.06, 0.05, 0.04, 0.05, 0, 0, 0, 0);
      break;
    case 'balloon':
      add(geo.sphere(12, 10), color || '#FF5A6E', 0, 0.35, 0, 0.22, 0.26, 0.22);
      add(geo.cyl(3), INK, 0, 0.12, 0, 0.004, 0.24, 0.004, 0, 0, 0, 0);
      break;
    case 'teddy':
      add(geo.sphere(12, 10), '#C68B59', 0, 0.07, 0, 0.13, 0.14, 0.11);
      add(geo.sphere(12, 10), '#C68B59', 0, 0.18, 0, 0.1, 0.1, 0.1);
      for (const s of [-1, 1]) add(geo.sphere(8, 6), '#C68B59', s * 0.04, 0.23, 0, 0.035, 0.035, 0.035, 0, 0, 0, 0);
      break;
    case 'ball':
      add(geo.sphere(14, 10), '#5BC0EB', 0, 0.07, 0, 0.14, 0.14, 0.14);
      break;
    case 'top':
      add(geo.cone(12), '#FF5A6E', 0, 0.05, 0, 0.1, 0.1, 0.1, Math.PI, 0, 0);
      add(geo.cyl(6), '#FFD23F', 0, 0.12, 0, 0.015, 0.05, 0.015, 0, 0, 0, 0);
      break;
    case 'car':
      add(geo.box(), '#E63946', 0, 0.04, 0, 0.18, 0.05, 0.09);
      add(geo.box(), '#E63946', -0.01, 0.08, 0, 0.09, 0.04, 0.08);
      for (const sx of [-0.06, 0.06]) for (const sz of [-0.045, 0.045]) add(geo.cyl(8), INK, sx, 0.02, sz, 0.035, 0.015, 0.035, Math.PI / 2, 0, 0, 0);
      break;
    case 'bangles':
      for (let k = 0; k < 4; k++) add(geo.torus(), color || '#E63E6D', 0, 0.01 + k * 0.018, 0, 0.1, 0.1, 0.1, Math.PI / 2, 0, 0, 0);
      break;
    case 'bamboobasket':
      add(geo.cup(), '#E2C27A', 0, 0, 0, 0.2, 0.12, 0.2);
      break;
    case 'fan':
      add(geo.cyl(16), '#E2C27A', 0, 0.16, 0, 0.18, 0.015, 0.18, Math.PI / 2, 0, 0);
      add(geo.cyl(5), '#8A5A44', 0, 0.04, 0, 0.012, 0.12, 0.012, 0, 0, 0, 0);
      break;
    case 'clip':
      add(geo.box(), '#FF8FAB', 0, 0.02, 0, 0.1, 0.03, 0.03);
      add(geo.sphere(8, 6), '#FFC93C', 0, 0.045, 0, 0.035, 0.035, 0.035, 0, 0, 0, 0);
      break;
    case 'hairband':
      add(geo.torus(), '#C77DFF', 0, 0.08, 0, 0.16, 0.16, 0.16, 0, 0, 0);
      break;
    case 'chain':
      for (let k = 0; k < 6; k++) add(geo.torus(), '#FFC93C', Math.cos(k) * 0.04, 0.02, Math.sin(k) * 0.04, 0.035, 0.035, 0.035, Math.PI / 2, k, 0, 0);
      break;
    case 'ring':
      add(geo.torus(), '#FFC93C', 0, 0.03, 0, 0.06, 0.06, 0.06, 0, 0, 0);
      add(geo.ico(0), '#7FD4F5', 0, 0.065, 0, 0.025, 0.025, 0.025, 0, 0, 0, 0);
      break;
    default:
      add(geo.box(), '#FFC93C', 0, 0.05, 0, 0.1, 0.1, 0.1);
  }
  // One mesh per colour keeps each item to a draw call or two (matters on Quest).
  return mergeGroup(g);
}
