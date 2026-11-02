// Previous/next touring across the 16 hawker carts, with wraparound.
import { CARTS as SHOPS } from '../data/hawkers.js';

export class Tour {
  constructor({ onStop }) {
    this.index = -1;
    this.onStop = onStop;
  }
  get count() {
    return SHOPS.length;
  }
  go(i) {
    const n = this.count;
    this.index = ((i % n) + n) % n;
    this.onStop(SHOPS[this.index]);
    return this.index;
  }
  next() {
    return this.go(this.index < 0 ? 0 : this.index + 1);
  }
  prev() {
    return this.go(this.index < 0 ? this.count - 1 : this.index - 1);
  }
}
