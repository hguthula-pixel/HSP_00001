// Small top-down map of the street: carts, 360° spots, and a "you are here"
// dot with a view cone that turns with the camera.
import { CARTS, SPOTS, STREET } from '../data/hawkers.js';

const W = 320;
const H = 64;
const Z_NEAR = 6;
const Z_FAR = -86;
const px = (z) => ((Z_NEAR - z) / (Z_NEAR - Z_FAR)) * W;
const py = (x) => ((x + 8) / 16) * H;
const NS = 'http://www.w3.org/2000/svg';

export function createMinimap(container, { onSpot = () => {} } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'minimap__svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Street map');
  const el = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.append(n);
    return n;
  };
  // buildings, walkways and the cart row
  el('rect', { x: 0, y: 0, width: W, height: py(-STREET.buildingX), class: 'mm-building' });
  el('rect', { x: 0, y: py(STREET.buildingX), width: W, height: H - py(STREET.buildingX), class: 'mm-building' });
  el('rect', { x: 0, y: py(-STREET.walkInner), width: W, height: py(STREET.walkInner) - py(-STREET.walkInner), class: 'mm-road' });
  el('rect', { x: px(STREET.gateZ) - 2, y: py(-STREET.buildingX), width: 4, height: py(STREET.buildingX) - py(-STREET.buildingX), class: 'mm-gate' });
  for (const c of CARTS) {
    el('rect', { x: px(c.z + 1) , y: py(-0.7), width: px(c.z - 1) - px(c.z + 1), height: py(0.7) - py(-0.7), rx: 2, fill: c.canopy, class: 'mm-cart' });
  }
  const spots = SPOTS.map((s, i) => {
    const g = el('g', { class: 'mm-spot', transform: `translate(${px(s.z)} ${py(s.x)})` });
    el('circle', { r: 6 }, g);
    const t = el('text', { 'text-anchor': 'middle', y: 3 }, g);
    t.textContent = String(i + 1);
    g.addEventListener('click', () => onSpot(i));
    return g;
  });
  const me = el('g', { class: 'mm-me' });
  el('path', { d: 'M0 0 L22 -9 A24 24 0 0 1 22 9 Z', class: 'mm-cone' }, me);
  el('circle', { r: 4.5, class: 'mm-dot' }, me);
  container.replaceChildren(svg);

  return {
    /** Moves the dot; yaw 0 looks down the street (−Z), which is to the right on the map. */
    update(x, z, yaw) {
      me.setAttribute('transform', `translate(${px(z).toFixed(1)} ${py(x).toFixed(1)}) rotate(${((-yaw * 180) / Math.PI).toFixed(1)})`);
    },
    setSpot(i) {
      spots.forEach((g, k) => g.classList.toggle('is-current', k === i));
    },
    showSpots(v) {
      spots.forEach((g) => (g.style.display = v ? '' : 'none'));
    },
  };
}
