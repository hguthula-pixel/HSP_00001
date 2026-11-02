// "Look around": 360° panoramas rendered from the 3D market, shown on a
// sphere around the viewer, with arrow hotspots to the next and previous spots.
// The same module captures the panoramas (scripts/render-panos.mjs).
import { SPOTS, STREET } from '../data/hawkers.js';

const THREE = window.AFRAME.THREE;

export const PANO_URL = (i) => `assets/pano/spot-${i + 1}.jpg`;
/** Ground arrows: metres ahead of and below the eye, so they sit above the control bar. */
export const ARROW = { dist: 3.2, drop: 1.05 };

// Equirectangular unwrap of a cube map. Matches THREE.SphereGeometry's UV layout,
// and applies the same ACES tone mapping + sRGB the live view uses.
const EQUI_FRAG = /* glsl */ `
  uniform samplerCube cube;
  uniform float exposure;
  varying vec2 vUv;
  const float PI = 3.141592653589793;
  vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 aces(vec3 c) {
    const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    c *= exposure / 0.6;
    c = outM * RRTAndODTFit(inM * c);
    return clamp(c, 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  void main() {
    float phi = vUv.x * 2.0 * PI;
    float theta = (1.0 - vUv.y) * PI;
    vec3 d = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
    vec3 c = textureCube(cube, vec3(-d.x, d.y, d.z)).rgb; // cube render targets are mirrored in x
    gl_FragColor = vec4(toSRGB(aces(c)), 1.0);
  }`;

/** Renders one spot to a JPEG data URL (used by the capture script). */
export function capturePanorama(sceneEl, spotIndex, { cubeSize = 1536, width = 4096, quality = 0.88 } = {}) {
  const renderer = sceneEl.renderer;
  const scene = sceneEl.object3D;
  const spot = SPOTS[spotIndex];
  const cubeRT = new THREE.WebGLCubeRenderTarget(cubeSize, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.15, 450, cubeRT);
  cubeCam.position.set(spot.x, STREET.eyeHeight, spot.z);
  scene.add(cubeCam);
  const xr = renderer.xr.enabled;
  renderer.xr.enabled = false;
  cubeCam.update(renderer, scene);
  scene.remove(cubeCam);

  const height = width / 2;
  const target = new THREE.WebGLRenderTarget(width, height);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { cube: { value: cubeRT.texture }, exposure: { value: renderer.toneMappingExposure } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: EQUI_FRAG,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(quadScene, ortho);
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  renderer.setRenderTarget(prev);
  renderer.xr.enabled = xr;

  // readPixels starts at the bottom row; canvases start at the top.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const row = width * 4;
  for (let y = 0; y < height; y++) img.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
  cubeRT.dispose();
  target.dispose();
  quad.geometry.dispose();
  quad.material.dispose();
  return canvas.toDataURL('image/jpeg', quality);
}

/** The panorama viewer: a sphere that follows the camera, plus arrow hotspots. */
export class PanoramaViewer {
  constructor(sceneEl, { onChange = () => {}, onError = () => {} } = {}) {
    this.sceneEl = sceneEl;
    this.onChange = onChange;
    this.onError = onError;
    this.index = 0;
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.root = new THREE.Group();
    this.root.name = 'panorama';
    this.root.visible = false;
    const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false, transparent: true, opacity: 1 });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 32), mat);
    this.sphere.renderOrder = -2;
    this.root.add(this.sphere);
    this.arrows = [this.makeArrow(1), this.makeArrow(-1)];
    this.arrows.forEach((a) => this.root.add(a));
    sceneEl.object3D.add(this.root);
    this.camPos = new THREE.Vector3();
    this.fade = 1;
    this.loaded = new Set();
  }

  makeArrow(step) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.45);
    shape.lineTo(0.38, 0);
    shape.lineTo(0.16, 0);
    shape.lineTo(0.16, -0.4);
    shape.lineTo(-0.16, -0.4);
    shape.lineTo(-0.16, 0);
    shape.lineTo(-0.38, 0);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: step > 0 ? '#FFC93C' : '#FF8FAB', fog: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    const rim = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: '#3A2A3A', side: THREE.BackSide, fog: false }));
    rim.scale.setScalar(1.12);
    rim.rotation.x = -Math.PI / 2;
    rim.position.z = 0.02;
    g.add(rim, m);
    m.userData.panoStep = step;
    g.userData.panoStep = step;
    g.userData.hit = m;
    return g;
  }

  /** Raycast targets for clicks and the VR beam. */
  targets() {
    return this.root.visible ? this.arrows.filter((a) => a.visible).map((a) => a.userData.hit) : [];
  }

  texture(i) {
    if (!this.cache.has(i)) {
      this.cache.set(
        i,
        new Promise((resolve, reject) => {
          this.loader.load(
            PANO_URL(i),
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              t.anisotropy = 4;
              this.loaded.add(i);
              resolve(t);
            },
            undefined,
            () => {
              this.cache.delete(i);
              reject(new Error(`Could not load ${PANO_URL(i)}`));
            },
          );
        }),
      );
    }
    return this.cache.get(i);
  }

  show(visible) {
    this.root.visible = visible;
  }

  async go(i) {
    const n = SPOTS.length;
    this.index = ((i % n) + n) % n;
    const idx = this.index;
    this.onChange(idx);
    this.placeArrows();
    try {
      const t = await this.texture(idx);
      if (idx !== this.index) return idx;
      this.sphere.material.map = t;
      this.sphere.material.needsUpdate = true;
      this.fade = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0;
      this.sphere.material.opacity = this.fade;
      // warm the neighbours so arrows feel instant
      this.texture((idx + 1) % n).catch(() => {});
      this.texture((idx - 1 + n) % n).catch(() => {});
    } catch (err) {
      this.onError(err);
    }
    return idx;
  }

  next() {
    return this.go(this.index + 1);
  }

  prev() {
    return this.go(this.index - 1);
  }

  /** Arrows sit on the ground, pointing toward the next and previous spots. */
  placeArrows() {
    const n = SPOTS.length;
    const here = SPOTS[this.index];
    this.arrows.forEach((a) => {
      const to = SPOTS[(this.index + a.userData.panoStep + n) % n];
      const dx = to.x - here.x;
      const dz = to.z - here.z;
      const len = Math.hypot(dx, dz) || 1;
      a.userData.dir = { x: dx / len, z: dz / len };
      a.rotation.y = Math.atan2(-dx, -dz);
    });
  }

  tick(dt) {
    if (!this.root.visible) return;
    const cam = this.sceneEl.camera;
    cam.getWorldPosition(this.camPos);
    this.sphere.position.copy(this.camPos);
    for (const a of this.arrows) {
      const d = a.userData.dir || { x: 0, z: -1 };
      // next sits a little right of its heading, previous a little left, so they never overlap
      const side = a.userData.panoStep > 0 ? 0.55 : -0.55;
      a.position.set(this.camPos.x + d.x * ARROW.dist - d.z * side, this.camPos.y - ARROW.drop, this.camPos.z + d.z * ARROW.dist + d.x * side);
    }
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 0.5);
      this.sphere.material.opacity = this.fade;
    }
  }
}
