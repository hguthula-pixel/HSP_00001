// Liimy Land boot and flow:
// start ("Let's go") → About popup → mode picker → Look around (360°) | Interact along,
// with VR on Meta Quest, plus recovery and no-WebGL fallbacks.
import { CARTS, SPOTS, BOUNDS } from './data/hawkers.js';
import { MusicController } from './audio/audio.js';
import { createUI } from './ui/ui.js';
import { setupHelp } from './ui/help.js';
import { createMinimap } from './ui/minimap.js';
import { Tour } from './nav/tour.js';

const params = new URLSearchParams(location.search);
const LITE = params.has('lite');
const CAPTURE = params.has('capture');
const LOAD_TIMEOUT = Number(params.get('timeout')) || 45000;
const MUSIC_SRC = 'assets/audio/market-theme.mp3';
const START = { x: -3.4, z: 1.5, yaw: 0 };
const HERO = { x: 0, z: 7, pitch: 0.12 };
const DRAG_TOLERANCE = 6;

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const ui = createUI();
const music = new MusicController(MUSIC_SRC, { onChange: (s) => ui.setSound(s) });
const help = setupHelp({ dialog: $('help'), openers: [$('help-open')], closeBtn: $('help-close') });
const about = setupHelp({ dialog: $('about'), openers: [$('about-again')], closeBtn: $('about-close') });

const app = {
  phase: 'start',
  ready: false,
  wantsGo: false,
  failed: false,
  xrSupported: false,
  sceneEl: null,
  nav: null,
  world: null,
  shopping: null,
  pano: null,
  minimap: null,
  tour: null,
};

function setPhase(p) {
  app.phase = p;
  document.body.dataset.state = p;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(s);
  });
}

function createScene() {
  const stage = $('stage');
  stage.innerHTML = `
    <a-scene embedded
      renderer="antialias: auto; colorManagement: true; toneMapping: ACESFilmic; exposure: 1; maxCanvasWidth: 1600; maxCanvasHeight: 1600; foveationLevel: 1; highRefreshRate: true"
      webxr="optionalFeatures: local-floor, hand-tracking"
      xr-mode-ui="enabled: false" loading-screen="enabled: false"
      device-orientation-permission-ui="enabled: false" keyboard-shortcuts="enterVR: false"
      light="defaultLightsEnabled: false" background="color: #FFB38A" frame-hooks>
      <a-entity id="rig" position="${HERO.x} 0 ${HERO.z}" market-nav="camera: #cam" vr-locomotion="camera: #cam">
        <a-entity id="cam" position="0 1.6 0" camera="near: 0.1; far: 450; fov: 70"
          look-controls="pointerLockEnabled: false; magicWindowTrackingEnabled: false; touchEnabled: true"></a-entity>
        <a-entity id="ctrl-left" meta-touch-controls="hand: left; model: false" vr-grabber="hand: left; rig: #rig"></a-entity>
        <a-entity id="ctrl-right" meta-touch-controls="hand: right; model: false" vr-grabber="hand: right; rig: #rig"></a-entity>
        <a-entity id="hand-left" hand-tracking-controls="hand: left; modelStyle: dots; modelColor: #FFC9A8" vr-grabber="hand: left; rig: #rig; tracking: true"></a-entity>
        <a-entity id="hand-right" hand-tracking-controls="hand: right; modelStyle: dots; modelColor: #FFC9A8" vr-grabber="hand: right; rig: #rig; tracking: true"></a-entity>
      </a-entity>
    </a-scene>`;
  return stage.querySelector('a-scene');
}

function whenLoaded(sceneEl) {
  return new Promise((resolve) => {
    if (sceneEl.hasLoaded && sceneEl.renderer) resolve();
    else sceneEl.addEventListener('loaded', () => resolve(), { once: true });
  });
}

function fitCamera() {
  const cam = $('cam');
  if (!cam) return;
  const aspect = innerWidth / innerHeight;
  cam.setAttribute('camera', 'fov', aspect < 0.8 ? 88 : aspect < 1.25 ? 78 : 70);
}

function fail(reason) {
  if (app.failed || app.ready) return;
  app.failed = true;
  clearTimeout(app.timer);
  setPhase('error');
  ui.showRecovery(
    reason === 'timeout'
      ? 'The 3D market took too long to start. A slow connection or a busy graphics card can cause this.'
      : reason === 'context'
        ? 'The graphics card stopped drawing the market. This can happen when a device is low on memory.'
        : 'The 3D market couldn’t start. A file may have failed to download.',
  );
}

// ------------------------------------------------------------ boot

async function boot() {
  ui.populate(CARTS);
  ui.setSound(music.state);
  if (!webglAvailable()) {
    setPhase('nowebgl');
    ui.screen('nowebgl');
    return;
  }
  app.timer = setTimeout(() => fail('timeout'), LOAD_TIMEOUT);
  try {
    ui.progress('engine', 0.05);
    await loadScript('vendor/aframe.min.js');
    window.AFRAME.registerComponent('frame-hooks', {
      init() {
        this.hooks = [];
      },
      tick(t, dt) {
        for (const h of this.hooks) h(Math.min(dt || 16, 250) / 1000);
      },
    });
    const [{ registerNavigation }, { registerVR }] = await Promise.all([import('./nav/navigation.js'), import('./vr/vr.js')]);
    registerNavigation();
    registerVR(vrHooks);
    const sceneEl = createScene();
    app.sceneEl = sceneEl;
    await whenLoaded(sceneEl);
    if (app.failed) return;
    sceneEl.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      app.ready = false;
      app.failed = false;
      fail('context');
    });
    fitCamera();
    addEventListener('resize', fitCamera);

    const [{ buildWorld }, { Shopping }, { PanoramaViewer, capturePanorama }] = await Promise.all([
      import('./scene/world.js'),
      import('./interact/shopping.js'),
      import('./look/panorama.js'),
    ]);
    const world = await buildWorld(sceneEl, { lite: LITE, onProgress: (s, f) => ui.progress(s, f) });
    if (app.failed) return;
    app.world = world;

    app.shopping = new Shopping({
      pickables: world.pickables,
      iceCream: world.iceCream,
      camera: sceneEl.camera,
      onChange: (s) => ui.setChecklist(s),
    });
    app.pano = new PanoramaViewer(sceneEl, {
      onChange: (i) => {
        ui.setSpot(i, SPOTS.length, SPOTS[i].label);
        app.minimap.setSpot(i);
      },
      onError: () => ui.toast('This 360° view isn’t available yet.'),
    });
    app.minimap = createMinimap($('minimap'), { onSpot: (i) => (app.phase === 'look' ? goSpot(i) : walkToSpot(i)) });
    app.tour = new Tour({ onStop: visitCart });

    app.nav = $('rig').components['market-nav'];
    app.nav.setView(0, HERO.pitch);
    app.nav.setPickTargets(world.floor, world.hitboxes, onPick, () => app.shopping.targets());

    let mapClock = 0;
    sceneEl.components['frame-hooks'].hooks.push((dt) => {
      app.shopping.tick(dt);
      app.pano.tick(dt);
      mapClock += dt;
      if (mapClock > 0.1 && app.phase !== 'start') {
        mapClock = 0;
        const head = new window.AFRAME.THREE.Vector3();
        sceneEl.camera.getWorldPosition(head);
        const dir = new window.AFRAME.THREE.Vector3();
        sceneEl.camera.getWorldDirection(dir);
        app.minimap.update(head.x, head.z, Math.atan2(-dir.x, -dir.z));
      }
    });
    sceneEl.addEventListener('enter-vr', () => {
      if (app.shopping.held) putBack();
      document.body.dataset.vr = 'true';
    });
    sceneEl.addEventListener('exit-vr', () => {
      delete document.body.dataset.vr;
    });

    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr
        .isSessionSupported('immersive-vr')
        .then((ok) => {
          app.xrSupported = ok;
          document.querySelectorAll('.vr-only').forEach((b) => (b.hidden = !ok));
        })
        .catch(() => {});
    }

    clearTimeout(app.timer);
    app.ready = true;
    document.body.dataset.ready = 'true';
    ui.progress('ready', 1);
    if (CAPTURE) window.__liimy.capture = (i, opts) => capturePanorama(sceneEl, i, opts);
    if (app.wantsGo) go();
  } catch (err) {
    console.error(err);
    fail('error');
  }
}

// ------------------------------------------------------------ flow

function go() {
  if (!app.ready) {
    app.wantsGo = true;
    setPhase('loading');
    ui.setWaiting(true);
    return;
  }
  ui.setWaiting(false);
  setPhase('about');
  about.open($('go'));
}

function showModes() {
  setPhase('modes');
  ui.screen('modes');
  $('mode-look').focus({ preventScroll: true });
}

$('about').addEventListener('close', () => {
  if (app.phase === 'about') showModes();
});
$('about-ok').addEventListener('click', () => about.close());

function enterVR() {
  if (app.sceneEl && app.xrSupported && !app.sceneEl.is('vr-mode')) app.sceneEl.enterVR();
}

function enterLook({ vr = false } = {}) {
  setPhase('look');
  ui.screen('hud');
  $('checklist').hidden = true;
  ui.hideCart();
  ui.hideInspector();
  app.world.root.visible = false;
  app.world.lighting.setVisible(false);
  app.pano.show(true);
  app.shopping.setBasketVisible(false);
  app.minimap.showSpots(true);
  app.nav.enabled = false;
  goSpot(0);
  music.start();
  if (vr) enterVR();
  $('spot-next').focus({ preventScroll: true });
  ui.announce('Look around. Use the arrows or the map to move between the 7 spots.');
}

function goSpot(i) {
  const idx = ((i % SPOTS.length) + SPOTS.length) % SPOTS.length;
  const s = SPOTS[idx];
  app.nav.teleport(s.x, s.z);
  app.nav.setView(app.nav.getYaw(), 0);
  app.pano.go(idx);
}

function enterInteract({ vr = false } = {}) {
  setPhase('interact');
  ui.screen('hud');
  $('checklist').hidden = false;
  app.pano.show(false);
  app.shopping.setBasketVisible(true);
  app.world.root.visible = true;
  app.world.lighting.setVisible(true);
  app.minimap.showSpots(false);
  app.nav.enabled = true;
  app.nav.teleport(START.x, START.z, START.yaw);
  music.start();
  if (vr) enterVR();
  ui.setChecklist(app.shopping.state);
  ui.toast(app.shopping.state.hasBasket ? 'Welcome back!' : 'Start at the basket stand, just ahead of you!', 3500);
  $('cart-next').focus({ preventScroll: true });
}

function walkToSpot(i) {
  const s = SPOTS[i];
  app.nav.glideTo(s.x, s.z);
}

function home() {
  if (app.sceneEl && app.sceneEl.is('vr-mode')) app.sceneEl.exitVR();
  if (app.shopping.held) putBack();
  ui.hideCart();
  ui.hideInspector();
  app.nav.enabled = false;
  app.pano.show(false);
  app.world.root.visible = true;
  app.world.lighting.setVisible(true);
  app.nav.teleport(HERO.x, HERO.z, 0);
  app.nav.setView(0, HERO.pitch);
  showModes();
}

// ------------------------------------------------------------ interact

function visitCart(cart) {
  app.nav.glideTo(cart.view.x, cart.view.z, cart.view.yaw);
  ui.showCart(cart);
}

const TOASTS = {
  rang: 'Ding ding! The ice cream uncle is scooping a cone…',
  waiting: 'Your cone is ready. Take it from his hand!',
  basket: 'You got a basket! Now go shopping.',
  'has-basket': 'You already have a basket.',
};

function onPick(hit) {
  if (app.phase !== 'interact') return;
  if (hit.type === 'item') pickItem(hit.item);
  else if (hit.type === 'cart') ui.showCart(CARTS[hit.index]);
  else ui.hideCart();
}

function pickItem(rec) {
  const result = app.shopping.pick(rec);
  if (result === 'held') {
    ui.showInspector(rec, app.shopping.state.hasBasket);
    ui.announce(`You picked up the ${rec.label.toLowerCase()}.`);
  } else if (TOASTS[result]) {
    ui.toast(TOASTS[result]);
    ui.announce(TOASTS[result]);
  }
  return result;
}

function putInBasket() {
  const rec = app.shopping.held;
  if (!rec || !app.shopping.putHeldInBasket()) return;
  ui.hideInspector();
  ui.toast(`${rec.label} is in your basket.`);
  $('cart-next').focus({ preventScroll: true });
}

function putBack() {
  const rec = app.shopping.held;
  if (!rec || !app.shopping.putBack()) return;
  ui.hideInspector();
  $('cart-next').focus({ preventScroll: true });
}

// ------------------------------------------------------------ VR hooks

const vrHooks = {
  canWalk: () => app.phase === 'interact',
  targets: () => (app.phase === 'look' ? app.pano.targets() : app.phase === 'interact' ? app.shopping.targets() : []),
  nearest: (p, reach) => (app.phase === 'interact' ? app.shopping.nearest(p, reach) : null),
  grab: (rec, anchor, hand) => {
    if (app.phase !== 'interact') return false;
    const ok = app.shopping.grab(rec, anchor, hand);
    if (rec.action) ui.toast(TOASTS.rang);
    else if (rec.kind === 'basket') ui.toast(TOASTS.basket);
    return ok;
  },
  release: (rec, anchor, hand) => app.shopping.release(rec, anchor, hand),
  press: (obj) => {
    if (app.phase === 'look' && obj.userData.panoStep) goSpot(app.pano.index + obj.userData.panoStep);
  },
};

// ------------------------------------------------------------ events

ui.el.go.addEventListener('click', go);
$('mode-look').addEventListener('click', () => enterLook());
$('mode-interact').addEventListener('click', () => enterInteract());
$('mode-look-vr').addEventListener('click', () => enterLook({ vr: true }));
$('mode-interact-vr').addEventListener('click', () => enterInteract({ vr: true }));
$('vr-enter').addEventListener('click', enterVR);
$('home').addEventListener('click', home);
$('retry').addEventListener('click', () => location.reload());
$('lite').addEventListener('click', () => {
  const u = new URL(location.href);
  u.searchParams.set('lite', '1');
  u.searchParams.delete('timeout');
  location.href = u.toString();
});
$('spot-prev').addEventListener('click', () => goSpot(app.pano.index - 1));
$('spot-next').addEventListener('click', () => goSpot(app.pano.index + 1));
$('cart-prev').addEventListener('click', () => app.tour.prev());
$('cart-next').addEventListener('click', () => app.tour.next());
ui.el.select.addEventListener('change', () => {
  const v = ui.el.select.value;
  if (v !== '') app.tour.go(Number(v));
});
$('cart-card-close').addEventListener('click', () => ui.hideCart());
ui.el.putBasket.addEventListener('click', putInBasket);
ui.el.putBack.addEventListener('click', putBack);
ui.el.sound.addEventListener('click', () => music.toggleMuted());
ui.el.helpMute.addEventListener('click', () => music.toggleMuted());
ui.el.volume.addEventListener('input', () => {
  const v = Number(ui.el.volume.value) / 100;
  music.setVolume(v);
  if (v > 0 && music.prefs.muted) music.setMuted(false);
});

// Clicking the 360° arrows on the ground (desktop and touch).
let down = null;
$('stage').addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
$('stage').addEventListener('pointerup', (e) => {
  if (app.phase !== 'look' || !down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > DRAG_TOLERANCE) return;
  const THREE = window.AFRAME.THREE;
  const r = app.sceneEl.canvas.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), app.sceneEl.camera);
  const hit = ray.intersectObjects(app.pano.targets(), false)[0];
  if (hit) goSpot(app.pano.index + hit.object.userData.panoStep);
});

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  const exploring = app.phase === 'look' || app.phase === 'interact';
  if (e.key === '?' && !typing && exploring && !help.isOpen) {
    e.preventDefault();
    help.open($('help-open'));
    return;
  }
  if (!exploring || help.isOpen || typing) return;
  if (app.phase === 'interact') {
    if (e.key === ']') app.tour.next();
    else if (e.key === '[') app.tour.prev();
    else if (e.key === 'Escape') {
      if (app.shopping.held) putBack();
      else ui.hideCart();
    }
  } else if (app.phase === 'look') {
    if (e.key === ']' || e.key === 'PageDown') goSpot(app.pano.index + 1);
    else if (e.key === '[' || e.key === 'PageUp') goSpot(app.pano.index - 1);
  }
});

// ------------------------------------------------------------ test & debug hook

window.__liimy = {
  get phase() {
    return app.phase;
  },
  get ready() {
    return app.ready;
  },
  lite: LITE,
  bounds: BOUNDS,
  carts: CARTS.map((c) => ({ index: c.index, id: c.id, name: c.name, side: c.side, z: c.z, view: c.view, items: c.items.map((i) => i.label) })),
  spots: SPOTS,
  pose: () => (app.nav ? app.nav.pose() : null),
  stop: () => (app.tour ? app.tour.index : -1),
  spot: () => (app.pano ? app.pano.index : -1),
  panoLoaded: () => (app.pano ? [...app.pano.loaded] : []),
  shopping: () => (app.shopping ? app.shopping.state : null),
  lighting: () => (app.world ? app.world.lighting.state : null),
  audio: () => music.state,
  town: () => (app.world ? app.world.town : null),
  pickables: () => (app.shopping ? app.shopping.pickables.map((r) => ({ id: r.id, label: r.label, kind: r.kind, cartId: r.cartId, inBasket: !!r.inBasket, available: r.available !== false })) : []),
  pick: (id) => {
    const rec = app.shopping.pickables.find((r) => r.id === id);
    return rec ? pickItem(rec) : 'missing';
  },
  putInBasket,
  putBack,
  itemWorld: (id) => {
    const rec = app.shopping.pickables.find((r) => r.id === id);
    const v = new window.AFRAME.THREE.Vector3();
    rec.object.getWorldPosition(v);
    return { x: v.x, y: v.y, z: v.z };
  },
  homeWorld: (id) => {
    const rec = app.shopping.pickables.find((r) => r.id === id);
    const v = rec.home.position.clone();
    rec.home.parent.localToWorld(v);
    return { x: v.x, y: v.y, z: v.z };
  },
  glideTo: (x, z, yaw) => app.nav && app.nav.glideTo(x, z, yaw),
  teleport: (x, z, yaw) => app.nav && app.nav.teleport(x, z, yaw),
  visit: (i) => app.tour && app.tour.go(i),
  goSpot: (i) => goSpot(i),
  get inVR() {
    return !!(app.sceneEl && app.sceneEl.is('vr-mode'));
  },
  rigPosition: () => {
    const p = document.getElementById('rig').object3D.position;
    return { x: p.x, y: p.y, z: p.z };
  },
  project(x, y, z) {
    const cam = app.sceneEl && app.sceneEl.camera;
    if (!cam) return null;
    const v = new window.AFRAME.THREE.Vector3(x, y, z).project(cam);
    const r = app.sceneEl.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: v.z < 1 };
  },
};

boot();
