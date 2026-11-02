// Shopping state shared by desktop, mobile and VR: the basket, holding and
// inspecting items, putting them in the basket or back on the cart, the ice
// cream exchange and the activity checklist.
const THREE = window.AFRAME.THREE;

const INSPECT = { pos: new THREE.Vector3(0, -0.06, -0.55), scale: 2.2 };
const BASKET_VIEW = { pos: new THREE.Vector3(0.46, -0.42, -1.05), scale: 0.75 };
const BASKET_REACH = 0.4;

export { ACTIVITIES } from '../data/hawkers.js';

export class Shopping {
  constructor({ pickables, iceCream, camera, onChange = () => {} }) {
    this.pickables = pickables;
    this.iceCream = iceCream;
    this.camera = camera; // THREE camera (desktop holding happens in front of it)
    this.onChange = onChange;
    this.basket = null; // the basket record once taken
    this.contents = [];
    this.held = null; // desktop inspector item
    this.vrHeld = new Map(); // hand → record
    this.tweens = [];
    this.done = { basket: false, icecream: false, flowers: false, vegfruit: false };
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
  }

  /** Pickables a click or beam can currently target. */
  targets() {
    return this.pickables
      .filter((r) => !r.inBasket && r !== this.basket && r.object.visible && (r.kind !== 'icecream' || r.available) && r !== this.held)
      .map((r) => r.proxy);
  }

  get state() {
    const count = (k) => this.contents.filter((r) => r.kind === k).length;
    return {
      hasBasket: !!this.basket,
      held: this.held ? this.held.id : null,
      contents: this.contents.map((r) => r.id),
      flowers: count('flower'),
      vegetables: count('vegetable'),
      fruits: count('fruit'),
      done: { ...this.done },
      complete: Object.values(this.done).every(Boolean),
      iceCreamReady: !!(this.iceCream && this.iceCream.cone.available),
    };
  }

  // ---------------------------------------------------------- desktop / mobile

  /** Click or tap on an item. Returns a short result string for the UI. */
  pick(rec) {
    if (this.held && this.held !== rec) this.putBack();
    if (rec.action) return this.ringBell();
    if (rec.kind === 'basket') {
      if (this.basket) return 'has-basket';
      this.takeBasket(rec, this.camera, BASKET_VIEW.pos, BASKET_VIEW.scale);
      return 'basket';
    }
    if (rec.kind === 'icecream') {
      if (!rec.available) return 'none';
      this.iceCream.taken();
      this.mark('icecream');
    }
    this.held = rec;
    this.moveTo(rec, this.camera, INSPECT.pos, null, rec.home.scale.clone().multiplyScalar(INSPECT.scale), true);
    this.changed();
    return 'held';
  }

  /** Desktop: drop the inspected item into the basket. */
  putHeldInBasket() {
    const rec = this.held;
    if (!rec || !this.basket) return false;
    this.held = null;
    this.addToBasket(rec);
    return true;
  }

  /** Desktop: return the inspected item to its cart. */
  putBack() {
    const rec = this.held;
    if (!rec) return false;
    this.held = null;
    this.returnHome(rec);
    return true;
  }

  ringBell() {
    if (!this.iceCream) return 'none';
    return this.iceCream.ring() ? 'rang' : 'waiting';
  }

  // ---------------------------------------------------------- VR

  /** Nearest pickable within `reach` metres of a hand. */
  nearest(point, reach) {
    let best = null;
    let bestD = Infinity;
    for (const rec of this.pickables) {
      if (rec.inBasket || rec === this.basket || !rec.object.visible) continue;
      if (rec.kind === 'icecream' && !rec.available) continue;
      if ([...this.vrHeld.values()].includes(rec)) continue;
      rec.proxy.getWorldPosition(this._v);
      const d = this._v.distanceTo(point) - rec.radius;
      if (d < reach && d < bestD) {
        best = rec;
        bestD = d;
      }
    }
    return best;
  }

  /** A hand closes on an item. Returns true if the hand now holds it. */
  grab(rec, anchor, hand) {
    if (rec.action) {
      this.ringBell();
      return false;
    }
    if (rec.kind === 'basket') {
      if (this.basket) return false;
      // the basket stays on this hand for the rest of the visit
      this.takeBasket(rec, anchor, new THREE.Vector3(0, -0.28, 0));
      return false;
    }
    if (rec.kind === 'icecream') {
      this.iceCream.taken();
      this.mark('icecream');
    }
    this.cancelTween(rec);
    anchor.attach(rec.object);
    this.vrHeld.set(hand, rec);
    this.changed();
    return true;
  }

  /** A hand opens: near the basket the item drops in, otherwise it floats home. */
  release(rec, anchor, hand) {
    this.vrHeld.delete(hand);
    if (this.basket) {
      rec.object.getWorldPosition(this._v);
      this.basket.object.getWorldPosition(this._w);
      if (this._v.distanceTo(this._w) < BASKET_REACH || rec.kind === 'icecream') {
        this.addToBasket(rec);
        return;
      }
    }
    this.returnHome(rec);
  }

  // ---------------------------------------------------------- shared

  takeBasket(rec, parent, localPos, scale = 1) {
    this.basket = rec;
    this.cancelTween(rec);
    this.moveTo(rec, parent, localPos, new THREE.Quaternion(), rec.home.scale.clone().multiplyScalar(scale), false);
    this.mark('basket');
  }

  /** The carried basket hides while the 360° view is showing. */
  setBasketVisible(v) {
    if (this.basket) this.basket.object.visible = v;
  }

  addToBasket(rec) {
    const i = this.contents.length;
    rec.inBasket = true;
    this.contents.push(rec);
    // fan items around the basket so a few stay visible above the rim
    const a = i * 2.4;
    const slot = new THREE.Vector3(Math.cos(a) * 0.07, 0.16 + Math.floor(i / 5) * 0.05, Math.sin(a) * 0.07);
    this.moveTo(rec, this.basket.object, slot, null, rec.home.scale.clone().multiplyScalar(0.6), false);
    if (rec.kind === 'flower') this.mark('flowers');
    const s = this.state;
    if (s.vegetables > 0 && s.fruits > 0) this.mark('vegfruit');
    this.changed();
  }

  returnHome(rec) {
    rec.inBasket = false;
    if (rec.kind === 'icecream') {
      // the hawker takes the cone back and can offer it again
      rec.available = true;
    }
    this.moveTo(rec, rec.home.parent, rec.home.position, rec.home.quaternion, rec.home.scale, false);
    this.changed();
  }

  mark(id) {
    if (this.done[id]) return;
    this.done[id] = true;
    this.changed();
  }

  changed() {
    this.onChange(this.state);
  }

  /** Re-parent keeping the world transform, then ease into the target local pose. */
  moveTo(rec, parent, pos, quat, scale, spin) {
    this.cancelTween(rec);
    const o = rec.object;
    parent.attach(o);
    const tw = {
      rec,
      from: { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() },
      to: { p: pos.clone(), q: quat ? quat.clone() : o.quaternion.clone(), s: scale.clone() },
      t: this.reducedMotion.matches ? 1 : 0,
      spin,
    };
    this.tweens.push(tw);
    if (tw.t === 1) this.applyTween(tw, 1);
  }

  cancelTween(rec) {
    this.tweens = this.tweens.filter((t) => t.rec !== rec);
  }

  applyTween(tw, k) {
    const o = tw.rec.object;
    o.position.lerpVectors(tw.from.p, tw.to.p, k);
    o.quaternion.slerpQuaternions(tw.from.q, tw.to.q, k);
    o.scale.lerpVectors(tw.from.s, tw.to.s, k);
  }

  tick(dt) {
    for (const tw of this.tweens) {
      if (tw.t < 1) {
        tw.t = Math.min(1, tw.t + dt / 0.45);
        this.applyTween(tw, 1 - Math.pow(1 - tw.t, 3));
      }
    }
    // the inspected item turns slowly so you can see all sides
    if (this.held && !this.reducedMotion.matches) this.held.object.rotation.y += dt * 0.9;
    this.tweens = this.tweens.filter((t) => t.t < 1 || t.spin);
    if (this.iceCream) this.iceCream.tick(dt);
  }
}
