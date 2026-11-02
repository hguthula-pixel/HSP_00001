import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openReady, toModes, enterInteract } from './helpers.js';

const freeze = (page) => page.evaluate(() => document.querySelector('a-scene').renderer.setAnimationLoop(null));
const serious = (r) => r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => v.id);

test('start → About popup → ✕ → mode picker, and Home comes back', async ({ page }) => {
  await openReady(page);
  await expect(page.getByRole('heading', { name: 'Liimy Land', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Let’s go!' }).click();
  const about = page.getByRole('dialog', { name: 'About Liimy Land' });
  await expect(about).toBeVisible();
  await expect(about).toContainText('college showcase');
  await page.getByRole('button', { name: 'Close about' }).click();
  await expect(about).toBeHidden();
  await expect(page.getByRole('heading', { name: 'How do you want to visit?' })).toBeVisible();
  await expect(page.locator('#mode-look')).toBeFocused();

  // About can be reopened and closed with Escape
  await page.getByRole('button', { name: 'About this project' }).click();
  await expect(about).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(about).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'modes');

  await page.locator('#mode-interact').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'interact');
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'modes');
});

test('Help opens with its button and ?, keeps focus inside, and restores focus', async ({ page }) => {
  await enterInteract(page);
  const opener = page.getByRole('button', { name: 'Help' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.getElementById('help').contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await page.locator('#cart-next').focus();
  await page.keyboard.press('Shift+Slash');
  await expect(dialog).toBeVisible();
});

test('no serious accessibility violations on start, About, modes and the HUD', async ({ page }) => {
  await openReady(page);
  await freeze(page);
  expect(serious(await new AxeBuilder({ page }).exclude('#stage').analyze())).toEqual([]);
  await page.getByRole('button', { name: 'Let’s go!' }).click();
  expect(serious(await new AxeBuilder({ page }).include('#about').analyze())).toEqual([]);
  await page.getByRole('button', { name: 'Close about' }).click();
  expect(serious(await new AxeBuilder({ page }).exclude('#stage').analyze())).toEqual([]);
  await page.locator('#mode-interact').click();
  await freeze(page);
  expect(serious(await new AxeBuilder({ page }).exclude('#stage').analyze())).toEqual([]);
});

for (const vp of [
  { width: 375, height: 480, label: 'short phone' },
  { width: 640, height: 360, label: '200% zoom' },
]) {
  test(`start and mode picker stay scrollable at ${vp.label}`, async ({ browser }) => {
    test.setTimeout(420_000);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await toModes(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
    const btn = page.locator('#mode-interact');
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeInViewport();
    await btn.click();
    await expect(page.locator('body')).toHaveAttribute('data-state', 'interact');
    await context.close();
  });
}

test('@touch controls are big enough on a phone', async ({ page }) => {
  await enterInteract(page);
  for (const name of ['Previous cart', 'Next cart', 'Help', 'Home']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box.height, name).toBeGreaterThanOrEqual(44);
    expect(box.width, name).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
