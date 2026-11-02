// DOM helpers for Liimy Land: loader, screens, toast, checklist, cart card,
// item inspector, spot label, sound status.
import { ACTIVITIES } from '../data/hawkers.js';

const $ = (id) => document.getElementById(id);

const LOAD_STEPS = {
  start: 'Building the market…',
  engine: 'Waking up the 3D engine…',
  fonts: 'Painting the signs…',
  street: 'Laying the walkways…',
  buildings: 'Building the houses…',
  shops: 'Rolling in the carts…',
  town: 'Planting trees…',
  ready: 'The market is ready!',
};

const SOUND_TEXT = {
  idle: 'Music starts when you enter the market.',
  loading: 'Starting the music…',
  playing: 'Music is playing.',
  paused: 'Music is paused while this page is hidden.',
  muted: 'Music is muted.',
  blocked: 'Your browser held the music back. Press Mute twice to start it.',
  unavailable: 'Music file not found, so the market is quiet for now.',
};

export function createUI() {
  const el = {
    go: $('go'),
    goLabel: $('go-label'),
    loaderText: $('loader-text'),
    loaderFill: $('loader-fill'),
    start: $('start'),
    modes: $('modes'),
    hud: $('hud'),
    recovery: $('recovery'),
    recoveryTitle: $('recovery-title'),
    recoveryDetail: $('recovery-detail'),
    nowebgl: $('nowebgl'),
    nowebglList: $('nowebgl-list'),
    checklist: $('checklist'),
    checklistItems: $('checklist-items'),
    celebrate: $('celebrate'),
    cartCard: $('cart-card'),
    cartTitle: $('cart-card-title'),
    cartDesc: $('cart-card-desc'),
    cartHint: $('cart-card-hint'),
    inspector: $('inspector'),
    inspectorTitle: $('inspector-title'),
    inspectorHint: $('inspector-hint'),
    putBasket: $('put-basket'),
    putBack: $('put-back'),
    toast: $('toast'),
    spotLabel: $('spot-label'),
    select: $('cart-select'),
    sound: $('sound-toggle'),
    helpMute: $('help-mute'),
    volume: $('volume'),
    volumeOut: $('volume-out'),
    soundStatus: $('sound-status'),
    announcer: $('announcer'),
  };
  let toastTimer = 0;
  let celebrated = false;

  const ui = {
    el,

    populate(carts) {
      for (const c of carts) {
        const o = document.createElement('option');
        o.value = String(c.index);
        o.textContent = `${c.index + 1}. ${c.name}`;
        el.select.append(o);
      }
      el.nowebglList.replaceChildren(
        ...carts.map((c) => {
          const li = document.createElement('li');
          const h = document.createElement('h3');
          h.textContent = c.name;
          const p = document.createElement('p');
          p.textContent = c.description;
          li.append(h, p);
          return li;
        }),
      );
      el.checklistItems.replaceChildren(
        ...ACTIVITIES.map((a) => {
          const li = document.createElement('li');
          li.dataset.activity = a.id;
          li.innerHTML = '<span class="checklist__box" aria-hidden="true"><svg class="icon"><use href="#i-check"/></svg></span><span></span>';
          li.lastElementChild.textContent = a.label;
          return li;
        }),
      );
    },

    progress(step, frac) {
      el.loaderText.textContent = LOAD_STEPS[step] || LOAD_STEPS.start;
      el.loaderFill.style.width = `${Math.round(Math.max(0.04, frac) * 100)}%`;
    },

    setWaiting(waiting) {
      el.go.disabled = waiting;
      el.go.setAttribute('aria-busy', String(waiting));
      el.goLabel.textContent = waiting ? 'Almost ready…' : 'Let’s go!';
    },

    /** Shows exactly one top-level screen: start | modes | hud | recovery | nowebgl. */
    screen(name) {
      for (const k of ['start', 'modes', 'hud', 'recovery', 'nowebgl']) el[k].hidden = k !== name;
      document.body.style.overflow = name === 'nowebgl' ? 'auto' : '';
    },

    showRecovery(detail) {
      ui.screen('recovery');
      if (detail) el.recoveryDetail.textContent = detail;
      el.recoveryTitle.tabIndex = -1;
      el.recoveryTitle.focus();
    },

    toast(text, ms = 2600) {
      el.toast.textContent = text;
      el.toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), ms);
    },

    announce(text) {
      el.announcer.textContent = '';
      requestAnimationFrame(() => (el.announcer.textContent = text));
    },

    showCart(cart) {
      el.cartTitle.textContent = cart.name;
      el.cartDesc.textContent = cart.description;
      el.cartHint.textContent =
        cart.id === 'icecream'
          ? 'Click the gold bell to ask for an ice cream.'
          : cart.id === 'baskets'
            ? 'Click a basket to carry your shopping.'
            : cart.items.length
              ? `Click to pick up: ${cart.items.map((i) => i.label.toLowerCase()).join(', ')}.`
              : '';
      el.cartCard.hidden = false;
      el.select.value = String(cart.index);
      ui.announce(`${cart.name}. ${cart.description}`);
    },

    hideCart() {
      el.cartCard.hidden = true;
    },

    showInspector(rec, hasBasket) {
      el.inspectorTitle.textContent = rec.label;
      el.putBasket.disabled = !hasBasket;
      el.inspectorHint.textContent = hasBasket ? '' : 'Grab a basket at the first cart to keep things you like.';
      el.inspector.hidden = false;
      ui.hideCart();
      el.putBasket.focus({ preventScroll: true });
    },

    hideInspector() {
      el.inspector.hidden = true;
    },

    setChecklist(state) {
      for (const li of el.checklistItems.children) li.classList.toggle('is-done', !!state.done[li.dataset.activity]);
      el.celebrate.hidden = !state.complete;
      if (state.complete && !celebrated) {
        celebrated = true;
        confetti();
        ui.announce('All done! You are a super shopper.');
      }
    },

    setSpot(i, total, label) {
      el.spotLabel.textContent = `Spot ${i + 1} of ${total}: ${label}`;
    },

    setSound(state) {
      el.sound.setAttribute('aria-pressed', String(state.muted));
      el.helpMute.setAttribute('aria-pressed', String(state.muted));
      el.helpMute.textContent = state.muted ? 'Unmute music' : 'Mute music';
      const pct = Math.round(state.volume * 100);
      if (Number(el.volume.value) !== pct) el.volume.value = String(pct);
      el.volumeOut.textContent = `${pct}%`;
      el.soundStatus.textContent = SOUND_TEXT[state.status] || SOUND_TEXT.idle;
    },
  };
  return ui;
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cols = ['#FF8FAB', '#FFC93C', '#B79CFF', '#7FD4F5', '#9BE07A', '#FF9A4D'];
  for (let i = 0; i < 60; i++) {
    const d = document.createElement('i');
    d.className = 'confetti';
    d.style.left = `${Math.random() * 100}vw`;
    d.style.background = cols[i % cols.length];
    d.style.animationDelay = `${Math.random() * 0.6}s`;
    d.setAttribute('aria-hidden', 'true');
    document.body.append(d);
    setTimeout(() => d.remove(), 3200);
  }
}
