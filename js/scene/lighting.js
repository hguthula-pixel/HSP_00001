// A single pink-orange sunset for Liimy Land: gradient sky with a low sun,
// warm fog, soft cartoon fill light and a few gold point lights.
// No real-time shadows: toon shading plus blob shadows stay fast on Quest.
import { THREE } from './kit.js';

export const SUNSET = {
  skyTop: '#7A6BC9', // lilac
  skyMid: '#FF8FAB', // pink
  skyHorizon: '#FFB36B', // orange
  skyBottom: '#FFD7A8',
  sunGlow: '#FFE7A3',
  sunDir: [0, 0.12, -1], // sun sits low at the far end of the street
  fog: '#F7A9A0',
  fogNear: 30,
  fogFar: 170,
  hemiSky: '#FFD9E6',
  hemiGround: '#B07A6A',
  hemiIntensity: 1.6,
  sunColor: '#FFC48A',
  sunIntensity: 1.8,
  goldIntensity: 14,
  exposure: 1.0,
};

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 bottom;
  uniform vec3 sunGlow; uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 c = h > 0.0
      ? (h < 0.18 ? mix(horizon, mid, smoothstep(0.0, 0.18, h)) : mix(mid, top, smoothstep(0.18, 0.75, h)))
      : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
    vec3 sd = normalize(sunDir);
    float s = max(dot(vDir, sd), 0.0);
    c += sunGlow * (pow(s, 600.0) * 1.4 + pow(s, 30.0) * 0.35 + pow(s, 5.0) * 0.12);
    // a few soft cartoon clouds as horizontal bands
    float band = smoothstep(0.02, 0.0, abs(h - 0.22 - 0.03 * sin(vDir.x * 6.0))) * 0.25;
    c = mix(c, vec3(1.0, 0.85, 0.9), band);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

export class Lighting {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    const p = SUNSET;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: {
          top: { value: new THREE.Color(p.skyTop) },
          mid: { value: new THREE.Color(p.skyMid) },
          horizon: { value: new THREE.Color(p.skyHorizon) },
          bottom: { value: new THREE.Color(p.skyBottom) },
          sunGlow: { value: new THREE.Color(p.sunGlow) },
          sunDir: { value: new THREE.Vector3(...p.sunDir) },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    sky.name = 'sky';
    scene.add(sky);
    this.sky = sky;

    scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);
    this.hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(p.sunColor, p.sunIntensity);
    this.sun.position.set(-20, 18, -120);
    this.sun.target.position.set(0, 0, -30);
    scene.add(this.sun, this.sun.target);

    // A few warm gold lights over the cart row so the street glows.
    this.points = [-12, -36, -60].map((z) => {
      const l = new THREE.PointLight('#FFC24A', p.goldIntensity, 22, 2);
      l.position.set(0, 4.5, z);
      scene.add(l);
      return l;
    });
    if (renderer) renderer.toneMappingExposure = p.exposure;
  }

  get state() {
    return {
      mode: 'sunset',
      skyTop: '#' + this.sky.material.uniforms.top.value.getHexString(),
      fog: '#' + this.scene.fog.color.getHexString(),
      pointLights: this.points.length,
      lampsOn: true,
    };
  }

  /** Hide the 3D sky while the 360° panorama is showing (the panorama ignores fog). */
  setVisible(v) {
    this.sky.visible = v;
  }

  tick() {}
}
