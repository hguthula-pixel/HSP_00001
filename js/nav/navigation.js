// Movement for the camera rig: bounded keyboard walking, ground-click gliding,
// shop picking, and programmatic glides used by the tour.
import { clampToBounds, STREET } from '../data/hawkers.js';

const THREE = window.AFRAME.THREE;
const WALK_SPEED = 3.0; // m/s
const TURN_SPEED = 1.6; // rad/s for keyboard turning
const DRAG_TOLERANCE = 6; // px of pointer travel before a click becomes a drag

const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'turnL', ArrowRight: 'turnR', KeyQ: 'turnL', KeyE: 'turnR',
};

function typingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function registerNavigation() {
  window.AFRAME.registerComponent('market-nav', {
    schema: { camera: { type: 'selector' } },

    init() {
      this.keys = new Set();
      this.enabled = false;
      this.glide = null;
      this.pickTargets = [];
      this.onPick = () => {};
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      this.raycaster = new THREE.Raycaster();
      this.ndc = new THREE.Vector2();
      this.fwd = new THREE.Vector3();

      this.onKeyDown = (e) => {
        if (!this.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
        if (typingTarget(e.target) || document.querySelector('dialog[open]')) return;
        const k = KEYMAP[e.code];
        if (!k) return;
        e.preventDefault();
        if (!this.keys.size) this.lastStep = performance.now();
        this.keys.add(k);
        this.glide = null;
      };
      this.onKeyUp = (e) => {
        const k = KEYMAP[e.code];
        if (!k || !this.keys.has(k)) return;
        // On slow devices a key can be released between frames: apply the time it was held.
        this.step((performance.now() - this.lastStep) / 1000);
        this.keys.delete(k);
      };
      this.onBlur = () => this.keys.clear();
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);

      const canvas = this.el.sceneEl.canvas;
      this.onPointerDown = (e) => {
        this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      };
      this.onPointerUp = (e) => {
        const d = this.down;
        this.down = null;
        if (!d || !this.enabled) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_TOLERANCE) return;
        if (performance.now() - d.t > 600) return;
        this.pickAt(e.clientX, e.clientY);
      };
      canvas.addEventListener('pointerdown', this.onPointerDown);
      canvas.addEventListener('pointerup', this.onPointerUp);
    },

    remove() {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      const canvas = this.el.sceneEl.canvas;
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointerup', this.onPointerUp);
    },

    lookControls() {
      return this.data.camera.components['look-controls'];
    },

    getYaw() {
      return this.lookControls() ? this.lookControls().yawObject.rotation.y : 0;
    },

    setView(yaw, pitch = 0) {
      const lc = this.lookControls();
      if (!lc) return;
      lc.yawObject.rotation.y = yaw;
      lc.pitchObject.rotation.x = pitch;
    },

    /**
     * Configure what a click can hit: the walk surface, cart hit boxes and
     * pickable items (`getItems` is called per click because items move).
     */
    setPickTargets(floor, hitboxes, onPick, getItems = () => []) {
      this.floor = floor;
      this.hitboxes = hitboxes;
      this.getItems = getItems;
      this.onPick = onPick;
    },

    pickAt(clientX, clientY) {
      const canvas = this.el.sceneEl.canvas;
      const rect = canvas.getBoundingClientRect();
      this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.ndc, this.el.sceneEl.camera);
      const items = this.getItems();
      const hits = this.raycaster.intersectObjects([this.floor, ...this.hitboxes, ...items], false);
      if (!hits.length) return;
      // Items sit inside their cart's hit box, so an item anywhere along the ray wins over the cart.
      const floorHit = hits.find((h) => h.object === this.floor);
      const itemHit = hits.find((h) => h.object.userData.pickable);
      if (itemHit && (!floorHit || itemHit.distance < floorHit.distance + 0.01)) {
        this.onPick({ type: 'item', item: itemHit.object.userData.pickable });
        return;
      }
      const hit = hits[0];
      if (hit.object.userData.cartIndex !== undefined) {
        this.onPick({ type: 'cart', index: hit.object.userData.cartIndex });
      } else if (hit.object === this.floor) {
        this.glideTo(hit.point.x, hit.point.z);
        this.onPick({ type: 'ground', point: { x: hit.point.x, z: hit.point.z } });
      }
    },

    /** Glide to a point (clamped to the walkable area), optionally turning to `yaw`. */
    glideTo(x, z, yaw) {
      const p = clampToBounds(x, z);
      const pos = this.el.object3D.position;
      const dist = Math.hypot(p.x - pos.x, p.z - pos.z);
      const fromYaw = this.getYaw();
      let toYaw = yaw;
      if (toYaw !== undefined) {
        // shortest rotation
        let d = toYaw - fromYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        toYaw = fromYaw + d;
      }
      if (this.reducedMotion.matches || dist < 0.01) {
        pos.set(p.x, 0, p.z);
        if (toYaw !== undefined) this.setView(toYaw, 0);
        this.glide = null;
        this.el.emit('navarrive');
        return;
      }
      this.glide = {
        from: { x: pos.x, z: pos.z, yaw: fromYaw, pitch: this.lookControls() ? this.lookControls().pitchObject.rotation.x : 0 },
        to: { x: p.x, z: p.z, yaw: toYaw },
        t: 0,
        dur: Math.min(2.6, Math.max(0.6, dist / 6)),
      };
    },

    teleport(x, z, yaw) {
      const p = clampToBounds(x, z);
      this.el.object3D.position.set(p.x, 0, p.z);
      if (yaw !== undefined) this.setView(yaw, 0);
      this.glide = null;
    },

    tick(time, dtMs) {
      const dt = Math.min(dtMs || 16, 250) / 1000;
      const pos = this.el.object3D.position;

      if (this.glide) {
        const g = this.glide;
        g.t = Math.min(1, g.t + dt / g.dur);
        const k = 1 - Math.pow(1 - g.t, 3);
        pos.x = g.from.x + (g.to.x - g.from.x) * k;
        pos.z = g.from.z + (g.to.z - g.from.z) * k;
        // slide around carts that sit on the straight line
        const c = clampToBounds(pos.x, pos.z);
        pos.x = c.x;
        pos.z = c.z;
        if (g.to.yaw !== undefined) {
          this.setView(g.from.yaw + (g.to.yaw - g.from.yaw) * k, g.from.pitch * (1 - k));
        }
        if (g.t >= 1) {
          this.glide = null;
          this.el.emit('navarrive');
        }
        return;
      }

      if (!this.enabled || !this.keys.size) return;
      this.step((performance.now() - this.lastStep) / 1000);
    },

    /** Applies walking and turning for `dt` seconds of held keys. */
    step(dt) {
      this.lastStep = performance.now();
      if (!this.enabled || !this.keys.size || dt <= 0) return;
      dt = Math.min(dt, 0.5);
      const pos = this.el.object3D.position;
      const lc = this.lookControls();
      if (this.keys.has('turnL') && lc) lc.yawObject.rotation.y += TURN_SPEED * dt;
      if (this.keys.has('turnR') && lc) lc.yawObject.rotation.y -= TURN_SPEED * dt;
      const yaw = this.getYaw();
      let f = 0;
      let s = 0;
      if (this.keys.has('fwd')) f += 1;
      if (this.keys.has('back')) f -= 1;
      if (this.keys.has('right')) s += 1;
      if (this.keys.has('left')) s -= 1;
      if (!f && !s) return;
      const len = Math.hypot(f, s);
      f /= len;
      s /= len;
      // forward is −Z rotated by yaw; right is +X rotated by yaw
      const dx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * WALK_SPEED * dt;
      const dz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * WALK_SPEED * dt;
      const p = clampToBounds(pos.x + dx, pos.z + dz);
      pos.x = p.x;
      pos.z = p.z;
    },

    /** Snapshot for tests and the UI. Direction comes from the look state, not the last rendered frame. */
    pose() {
      const lc = this.lookControls();
      const yaw = this.getYaw();
      const pitch = lc ? lc.pitchObject.rotation.x : 0;
      const pos = this.el.object3D.position;
      const dir = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
      return { x: pos.x, y: STREET.eyeHeight, z: pos.z, yaw, pitch, dir, gliding: !!this.glide };
    },
  });
}
