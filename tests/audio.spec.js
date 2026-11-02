import { test, expect } from '@playwright/test';
import { enterInteract, toModes, serveMusic, stubMedia } from './helpers.js';

const audio = (page) => page.evaluate(() => window.__liimy.audio());

test('music waits until a mode is entered, then fades in quietly', async ({ page }) => {
  await stubMedia(page);
  await serveMusic(page);
  await toModes(page);
  expect(await page.evaluate(() => window.__media.plays)).toBe(0);
  expect((await audio(page)).status).toBe('idle');
  await page.locator('#mode-look').click();
  await expect.poll(async () => (await audio(page)).status).toBe('playing');
  expect(await page.evaluate(() => window.__media.plays)).toBe(1);
  await expect.poll(async () => (await audio(page)).elementVolume, { timeout: 15_000 }).toBeCloseTo(0.25, 2);
});

test('mute and volume are remembered across visits', async ({ page }) => {
  await stubMedia(page);
  await serveMusic(page);
  await enterInteract(page);
  await expect.poll(async () => (await audio(page)).status).toBe('playing');
  await page.getByRole('button', { name: 'Help' }).click();
  await page.locator('#volume').fill('60');
  await expect(page.locator('#volume-out')).toHaveText('60%');
  await page.getByRole('button', { name: 'Close help' }).click();
  const mute = page.getByRole('button', { name: 'Mute', exact: true });
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  expect((await audio(page)).status).toBe('muted');

  await enterInteract(page);
  const s = await audio(page);
  expect(s.muted).toBe(true);
  expect(s.volume).toBeCloseTo(0.6, 5);
  expect(await page.evaluate(() => window.__media.plays)).toBe(0);
});

test('playback pauses while the page is hidden and resumes after', async ({ page }) => {
  await stubMedia(page);
  await serveMusic(page);
  await enterInteract(page);
  await expect.poll(async () => (await audio(page)).status).toBe('playing');
  const setVisibility = (state) =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  expect((await audio(page)).status).toBe('paused');
  await setVisibility('visible');
  await expect.poll(async () => (await audio(page)).status).toBe('playing');
});

test('a missing music file leaves the market fully usable', async ({ page }) => {
  await page.route('**/assets/audio/market-theme.mp3', (route) => route.fulfill({ status: 404, body: '' }));
  await enterInteract(page);
  await expect.poll(async () => (await audio(page)).status).toBe('unavailable');
  await page.getByRole('button', { name: 'Next cart' }).click();
  await expect(page.locator('#cart-card-title')).toHaveText('Basket stand');
  await page.getByRole('button', { name: 'Help' }).click();
  await expect(page.locator('#sound-status')).toContainText('Music file not found');
});
