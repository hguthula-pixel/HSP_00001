// Background music: starts only after the visitor enters, fades in quietly,
// loops, remembers mute/volume, pauses while the page is hidden, and never
// blocks the market if the file is missing or playback is refused.

const STORE_KEY = 'poorna.sound';
const DEFAULT_VOLUME = 0.25;
const FADE_MS = 3000;

function readPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return {
      muted: p.muted === true,
      volume: typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1 ? p.volume : DEFAULT_VOLUME,
    };
  } catch {
    return { muted: false, volume: DEFAULT_VOLUME };
  }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private mode, blocked): preferences last for this visit only */
  }
}

export class MusicController {
  constructor(src, { onChange = () => {} } = {}) {
    this.src = src;
    this.onChange = onChange;
    this.prefs = readPrefs();
    this.audio = null;
    /** idle | loading | playing | paused | muted | blocked | unavailable */
    this.status = 'idle';
    this.reason = '';
    this.fadeRaf = 0;
    this.wasPlayingBeforeHide = false;
    this.onVisibility = () => this.handleVisibility();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get state() {
    return {
      status: this.status,
      reason: this.reason,
      muted: this.prefs.muted,
      volume: this.prefs.volume,
      elementVolume: this.audio ? this.audio.volume : 0,
      paused: this.audio ? this.audio.paused : true,
    };
  }

  set(status, reason = '') {
    this.status = status;
    this.reason = reason;
    this.onChange(this.state);
  }

  /** Call from the "Enter the market" click so the browser treats playback as user-initiated. */
  start() {
    if (this.audio) return;
    try {
      const a = new Audio();
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      a.addEventListener('error', () => {
        this.cancelFade();
        this.set('unavailable', 'missing');
      });
      a.src = this.src;
      this.audio = a;
    } catch {
      this.set('unavailable', 'unsupported');
      return;
    }
    if (this.prefs.muted) {
      this.set('muted');
      return;
    }
    this.play();
  }

  play() {
    const a = this.audio;
    if (!a || this.status === 'unavailable') return;
    this.set('loading');
    let p;
    try {
      p = a.play();
    } catch {
      this.set('unavailable', 'unsupported');
      return;
    }
    Promise.resolve(p)
      .then(() => {
        if (this.status === 'unavailable') return;
        this.set('playing');
        this.fadeTo(this.prefs.volume, FADE_MS);
      })
      .catch((err) => {
        if (this.status === 'unavailable') return;
        // NotAllowedError: autoplay policy; anything else: file could not be decoded.
        this.set(err && err.name === 'NotAllowedError' ? 'blocked' : 'unavailable', err && err.name === 'NotAllowedError' ? 'blocked' : 'missing');
      });
  }

  fadeTo(target, ms) {
    this.cancelFade();
    const a = this.audio;
    if (!a) return;
    const from = a.volume;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) this.fadeRaf = requestAnimationFrame(step);
      else this.fadeRaf = 0;
    };
    // rAF stops in hidden tabs; fall back to a direct set if the page is hidden.
    if (document.visibilityState === 'hidden') a.volume = target;
    else this.fadeRaf = requestAnimationFrame(step);
  }

  cancelFade() {
    if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf);
    this.fadeRaf = 0;
  }

  setMuted(muted) {
    this.prefs.muted = muted;
    writePrefs(this.prefs);
    if (!this.audio) {
      this.onChange(this.state);
      return;
    }
    if (this.status === 'unavailable') {
      this.onChange(this.state);
      return;
    }
    if (muted) {
      this.cancelFade();
      this.audio.pause();
      this.set('muted');
    } else {
      this.audio.volume = 0;
      this.play();
    }
  }

  toggleMuted() {
    this.setMuted(!this.prefs.muted);
  }

  setVolume(v) {
    this.prefs.volume = Math.max(0, Math.min(1, v));
    writePrefs(this.prefs);
    if (this.audio && this.status === 'playing') {
      this.cancelFade();
      this.audio.volume = this.prefs.volume;
    }
    this.onChange(this.state);
  }

  handleVisibility() {
    const a = this.audio;
    if (!a) return;
    if (document.visibilityState === 'hidden') {
      this.wasPlayingBeforeHide = this.status === 'playing';
      if (this.wasPlayingBeforeHide) {
        this.cancelFade();
        a.pause();
        this.set('paused');
      }
    } else if (this.wasPlayingBeforeHide && !this.prefs.muted) {
      this.wasPlayingBeforeHide = false;
      this.play();
    }
  }
}
