// Shared helpers for the Liimy Land regression tests.
import { expect } from '@playwright/test';

/** A tiny valid WAV (0.25 s of silence) served in place of the owner's music file. */
export function silentWav() {
  const rate = 8000;
  const samples = rate / 4;
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);
  return buf;
}

/** Stubs HTMLMediaElement.play/pause so tests don't depend on audio hardware. */
export async function stubMedia(page, { reject = null } = {}) {
  await page.addInitScript((rejectName) => {
    window.__media = { plays: 0, pauses: 0 };
    const proto = HTMLMediaElement.prototype;
    Object.defineProperty(proto, 'paused', {
      configurable: true,
      get() {
        return !this.__playing;
      },
    });
    proto.play = function () {
      window.__media.plays++;
      if (rejectName) {
        const e = new Error('refused');
        e.name = rejectName;
        return Promise.reject(e);
      }
      this.__playing = true;
      return Promise.resolve();
    };
    proto.pause = function () {
      window.__media.pauses++;
      this.__playing = false;
    };
  }, reject);
}

export async function serveMusic(page) {
  await page.route('**/assets/audio/market-theme.mp3', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() }));
}

/** Installs Meta's IWER emulator as a Quest 3 before the page loads. */
export async function emulateQuest(page) {
  await page.addInitScript({ path: 'node_modules/iwer/build/iwer.min.js' });
  await page.addInitScript(() => {
    const d = new window.IWER.XRDevice(window.IWER.metaQuest3);
    d.installRuntime({ forceInstall: true });
    window.__xr = d;
  });
}

/** Software WebGL in CI is far slower than a real device, so tests allow a longer start. */
export const TEST_URL = '/?timeout=150000';

export async function openReady(page, url = TEST_URL) {
  await page.goto(url);
  await page.waitForFunction(() => window.__liimy && window.__liimy.ready === true, null, { timeout: 90_000 });
}

/** Start → About → mode picker. */
export async function toModes(page, url = TEST_URL) {
  await openReady(page, url);
  await page.getByRole('button', { name: 'Let’s go!' }).click();
  await expect(page.getByRole('dialog', { name: 'About Liimy Land' })).toBeVisible();
  await page.getByRole('button', { name: 'Close about' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'modes');
}

export async function enterInteract(page, url = TEST_URL) {
  await toModes(page, url);
  await page.locator('#mode-interact').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'interact');
}

export async function enterLook(page, url = TEST_URL) {
  await toModes(page, url);
  await page.locator('#mode-look').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'look');
}

export async function settle(page) {
  await page.waitForFunction(() => {
    const p = window.__liimy.pose();
    return p && !p.gliding;
  }, null, { timeout: 30_000 });
}
