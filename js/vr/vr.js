// Meta Quest support: thumbstick walking and snap turning on the rig,
// grabbing with the grip button or a hand-tracking pinch, and a trigger
// beam that pulls far items into your hand or presses 360° arrows.
import { clampToWalk } from '../data/hawkers.js';

const THREE = window.AFRAME.THREE;
const WALK_SPEED = 1.8;
const SNAP = Math.PI / 6; // 30°
const REACH = 0.18; // metres from the hand to grab without the beam

/**
 * Registers the VR components. `hooks` connects them to the app:
 *   targets(): pickable proxies (and arrows) the beam can hit
 *   nearest(worldPos): the closest pickable within reach, or null
 *   grab(rec, anchor, handName) / release(rec, anchor, handName)
 *   press(object): called when the beam hits a non-pickable target such as a 360° arrow
 *   canWalk(): false while the 360° viewer is showing
 */
export function registerVR(hooks) {
  const AFRAME = window.AFRAME;

  AFRAME.registerComponent('vr-locomotion', {
    schema: { camera: { type: 'selector' } },
    init() {
      this.move = { x: 0, y: 0 };
      this.turnReady = true;
      this.head = new THREE.Vector3();
      this.dir = new THREE.Vector3();
    },
    setAxes(hand, x, y) {
      if (hand === 'left') {
        this.move.x = Math.abs(x) > 0.15 ? x : 0;
        this.move.y = Math.abs(y) > 0.15 ? y : 0;
      } else if (Math.abs(x) > 0.7 && this.turnReady) {
        this.turnReady = false;
        this.snapTurn(x > 0 ? -SNAP : SNAP);
      } else if (Math.abs(x) < 0.3) {
        this.turnReady = true;
      }
    },
    snapTurn(angle) {
      // rotate the rig around the head so the view turns in place
      const rig = this.el.object3D;
      this.data.camera.object3D.getWorldPosition(this.head);
      rig.position.sub(this.head).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle).add(this.head);
      rig.rotation.y += angle;
    },
    tick(t, dtMs) {
      if (!this.el.sceneEl.is('vr-mode') || (!this.move.x && !this.move.y) || !hooks.canWalk()) return;
      const dt = Math.min(dtMs || 16, 100) / 1000;
      const cam = this.data.camera.object3D;
      cam.getWorldDirection(this.dir); // camera looks down −Z; getWorldDirection returns +Z of the object
      this.dir.y = 0;
      this.dir.normalize().negate();
      const fwd = -this.move.y;
      const side = this.move.x;
      const dx = (this.dir.x * fwd - this.dir.z * side) * WALK_SPEED * dt;
      const dz = (this.dir.z * fwd + this.dir.x * side) * WALK_SPEED * dt;
      cam.getWorldPosition(this.head);
      const next = clampToWalk(this.head.x + dx, this.head.z + dz);
      this.el.object3D.position.x += next.x - this.head.x;
      this.el.object3D.position.z += next.z - this.head.z;
    },
  });

  AFRAME.registerComponent('vr-grabber', {
    schema: { hand: { default: 'right' }, rig: { type: 'selector' }, tracking: { default: false } },
    init() {
      this.held = null;
      this.anchor = new THREE.Object3D();
      this.anchor.name = `anchor-${this.data.hand}`;
      this.pos = new THREE.Vector3();
      this.raycaster = new THREE.Raycaster();
      this.raycaster.far = 8;
      const el = this.el;
      if (this.data.tracking) {
        // Hand tracking: the anchor follows the pinch point (reported in rig space).
        this.data.rig.object3D.add(this.anchor);
        el.addEventListener('pinchstarted', (e) => this.onPinch(e.detail, true));
        el.addEventListener('pinchmoved', (e) => this.onPinch(e.detail, null));
        el.addEventListener('pinchended', (e) => this.onPinch(e.detail, false));
      } else {
        el.object3D.add(this.anchor);
        this.anchor.position.set(0, -0.02, -0.06);
        this.addControllerModel();
        this.addBeam();
        el.addEventListener('gripdown', () => this.tryGrab());
        el.addEventListener('gripup', () => this.drop());
        el.addEventListener('triggerdown', () => this.beamGrab());
        el.addEventListener('triggerup', () => this.drop());
        el.addEventListener('thumbstickmoved', (e) => {
          const loco = this.data.rig.components['vr-locomotion'];
          if (loco) loco.setAxes(this.data.hand, e.detail.x, e.detail.y);
        });
      }
    },
    addControllerModel() {
      // A simple chunky controller instead of downloading the official model.
      const m = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.022, 0.08, 4, 10),
        new THREE.MeshToonMaterial({ color: this.data.hand === 'left' ? '#FF8FAB' : '#7FD4F5' }),
      );
      body.rotation.x = Math.PI / 2.6;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 20), new THREE.MeshToonMaterial({ color: '#FFC93C' }));
      ring.position.set(0, 0.02, -0.04);
      ring.rotation.x = Math.PI / 3;
      m.add(body, ring);
      this.el.object3D.add(m);
    },
    addBeam() {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
      this.beam = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#FFC93C', transparent: true, opacity: 0.8 }));
      this.beam.scale.z = 4;
      this.beam.visible = false;
      this.el.object3D.add(this.beam);
    },
    tick() {
      if (this.beam) this.beam.visible = this.el.sceneEl.is('vr-mode') && !this.held;
    },
    worldPoint() {
      return this.anchor.getWorldPosition(this.pos);
    },
    tryGrab() {
      if (this.held) return;
      const rec = hooks.nearest(this.worldPoint(), REACH);
      if (rec) this.held = hooks.grab(rec, this.anchor, this.data.hand) ? rec : null;
    },
    beamGrab() {
      if (this.held) return;
      const o = this.el.object3D;
      o.updateMatrixWorld(true);
      const origin = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      const dir = new THREE.Vector3(0, 0, -1).transformDirection(o.matrixWorld);
      this.raycaster.set(origin, dir);
      const hit = this.raycaster.intersectObjects(hooks.targets(), false)[0];
      if (!hit) return;
      const rec = hit.object.userData.pickable;
      if (rec) this.held = hooks.grab(rec, this.anchor, this.data.hand) ? rec : null;
      else hooks.press(hit.object);
    },
    drop() {
      if (!this.held) return;
      const rec = this.held;
      this.held = null;
      hooks.release(rec, this.anchor, this.data.hand);
    },
    onPinch(detail, start) {
      if (!detail || !detail.position) return;
      this.anchor.position.copy(detail.position);
      if (start === true) this.tryGrab();
      else if (start === false) this.drop();
    },
  });
}
