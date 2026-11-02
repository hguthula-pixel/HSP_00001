import { test, expect } from '@playwright/test';
import { openReady } from './helpers.js';

test('a failed engine download shows recovery, and Try again recovers', async ({ page }) => {
  await page.route('**/vendor/aframe.min.js', (route) => route.abort());
  await page.goto('/');
  const heading = page.getByRole('heading', { name: 'Oops, the market didn’t finish loading' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await page.unroute('**/vendor/aframe.min.js');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.waitForFunction(() => window.__liimy && window.__liimy.ready === true, null, { timeout: 90_000 });
  await expect(page.getByRole('button', { name: 'Let’s go!' })).toBeVisible();
});

test('a slow start times out into recovery, and lite mode loads a lighter town', async ({ page }) => {
  await page.route('**/vendor/aframe.min.js', async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.goto('/?timeout=800');
  await expect(page.locator('#recovery-detail')).toContainText('took too long');
  await page.unroute('**/vendor/aframe.min.js');
  await page.getByRole('button', { name: 'Open lite mode' }).click();
  await expect(page).toHaveURL(/lite=1/);
  await page.waitForFunction(() => window.__liimy && window.__liimy.ready === true, null, { timeout: 90_000 });
  expect((await page.evaluate(() => window.__liimy.town())).buildings).toBe(14);
});

test('without WebGL the carts are listed as text', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (/webgl/i.test(type)) return null;
      return orig.call(this, type, ...rest);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'This browser can’t draw the 3D market' })).toBeVisible();
  await expect(page.locator('#nowebgl-list li')).toHaveCount(16);
  await expect(page.locator('#nowebgl-list')).toContainText('Ice cream');
});

test('the market loads only local files, with the town, roads and Fredoka font', async ({ page }) => {
  const external = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && !['data:', 'blob:'].includes(u.protocol)) external.push(req.url());
  });
  const failed = [];
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().endsWith('market-theme.mp3')) failed.push(`${res.status()} ${res.url()}`);
  });
  await openReady(page);
  const town = await page.evaluate(() => window.__liimy.town());
  expect(town.buildings).toBe(28);
  expect(town.roads).toBe(4);
  expect((await page.evaluate(() => window.__liimy.lighting())).mode).toBe('sunset');
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check('700 64px "Fredoka"', 'Liimy'))).toBe(true);
});
