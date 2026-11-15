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
  let exitBtn = null;
  const exitPos = new THREE.Vector3();
  const exitVR = (sceneEl) => {
    if (sceneEl.is('vr-mode')) sceneEl.exitVR();
  };
  /** True when a hand or controller tip is touching the floating Exit VR button. */
  const touchesExit = (p) => exitBtn && exitBtn.visible && exitBtn.getWorldPosition(exitPos).distanceTo(p) < 0.12;

  AFRAME.registerComponent('vr-locomotion', {
    schema: { camera: { type: 'selector' } },
    init() {
      this.move = { x: 0, y: 0 };
      this.turnReady = true;
      this.head = new THREE.Vector3();
      this.dir = new THREE.Vector3();
      this.yaw = null;
      exitBtn = makeExitButton();
      exitBtn.visible = false;
      this.el.object3D.add(exitBtn);
    },
    /** Keeps the Exit VR button floating low in front of the visitor, easing round as they turn. */
    placeExit() {
      const rig = this.el.object3D;
      const cam = this.data.camera.object3D;
      cam.getWorldPosition(this.head);
      cam.getWorldDirection(this.dir);
      let yaw = Math.atan2(this.dir.x, this.dir.z); // camera looks along −dir; this is the yaw of +Z
      if (this.yaw === null) this.yaw = yaw;
      let d = yaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 0.6) this.yaw += d * 0.08; // only follow big turns, so it stays put to press
      const wx = this.head.x - Math.sin(this.yaw) * 0.5;
      const wz = this.head.z - Math.cos(this.yaw) * 0.5;
      const local = rig.worldToLocal(new THREE.Vector3(wx, this.head.y - 0.5, wz));
      exitBtn.position.copy(local);
      exitBtn.rotation.set(-0.6, this.yaw - rig.rotation.y, 0, 'YXZ');
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
      const inVR = this.el.sceneEl.is('vr-mode');
      exitBtn.visible = inVR;
      if (inVR) this.placeExit();
      else this.yaw = null;
      if (!inVR || (!this.move.x && !this.move.y) || !hooks.canWalk()) return;
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
      if (touchesExit(this.worldPoint())) return exitVR(this.el.sceneEl);
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
      const targets = hooks.targets();
      if (exitBtn && exitBtn.visible) targets.push(exitBtn.userData.hit);
      const hit = this.raycaster.intersectObjects(targets, false)[0];
      if (!hit) return;
      if (hit.object.userData.exitVR) return exitVR(this.el.sceneEl);
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

/** A chunky "Exit VR" button in the market's sign style: point and pull the trigger, or touch it. */
function makeExitButton() {
  const g = new THREE.Group();
  g.name = 'vr-exit-button';
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = '#3A2A3A';
  x.beginPath();
  x.roundRect(4, 4, 504, 184, 60);
  x.fill();
  x.fillStyle = '#FF8FAB';
  x.beginPath();
  x.roundRect(14, 14, 484, 164, 52);
  x.fill();
  x.fillStyle = '#FFF4E0';
  x.font = '600 84px Fredoka, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('✕  Exit VR', 256, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  face.userData.exitVR = true;
  g.add(face);
  g.userData.hit = face;
  return g;
}
