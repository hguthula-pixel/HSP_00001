import { test, expect } from '@playwright/test';
import { enterInteract, settle } from './helpers.js';

test.use({ reducedMotion: 'reduce' }); // instant glides and moves keep checks deterministic

const L = (page, fn, arg) => page.evaluate(fn, arg);

test('16 carts sit in the middle of the road, alternating walkways, with pickable items', async ({ page }) => {
  await enterInteract(page);
  const carts = await L(page, () => window.__liimy.carts);
  expect(carts).toHaveLength(16);
  for (const c of carts) {
    expect(Math.sign(c.view.x)).toBe(c.side);
  }
  const ids = carts.map((c) => c.id);
  for (const id of ['icecream', 'flowers', 'vegetables', 'fruits', 'snacks', 'pottery', 'corn', 'sugarcane', 'cottoncandy', 'panipuri', 'balloons', 'toys', 'bangles', 'bamboo', 'accessories', 'baskets']) {
    expect(ids).toContain(id);
  }
  const picks = await L(page, () => window.__liimy.pickables());
  expect(picks.filter((p) => p.kind === 'fruit').length).toBeGreaterThanOrEqual(3);
  expect(picks.filter((p) => p.kind === 'vegetable').length).toBeGreaterThanOrEqual(3);
  expect(picks.filter((p) => p.kind === 'flower').length).toBeGreaterThanOrEqual(3);
  expect(picks.filter((p) => p.kind === 'pottery').length).toBeGreaterThanOrEqual(2);
});

test('walking stays on the walkways and never inside a cart', async ({ page }) => {
  await enterInteract(page);
  const b = await L(page, () => window.__liimy.bounds);
  await L(page, () => window.__liimy.teleport(0, -15, 0)); // the middle of the flower cart
  let p = await L(page, () => window.__liimy.pose());
  expect(Math.abs(p.x) >= 1.7 || Math.abs(p.z + 15) >= 1.5).toBe(true);
  await L(page, () => window.__liimy.glideTo(40, -500));
  await settle(page);
  p = await L(page, () => window.__liimy.pose());
  expect(p.x).toBeLessThanOrEqual(b.maxX);
  expect(p.z).toBeGreaterThanOrEqual(b.minZ);

  await L(page, () => window.__liimy.teleport(-3.4, -20, 0));
  await page.locator('#cart-next').focus();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  p = await L(page, () => window.__liimy.pose());
  expect(p.z).toBeLessThan(-20.3);
});

test('Next and Previous visit the carts with wraparound', async ({ page }) => {
  await enterInteract(page);
  await page.getByRole('button', { name: 'Previous cart' }).click();
  await expect.poll(() => L(page, () => window.__liimy.stop())).toBe(15);
  await expect(page.locator('#cart-card-title')).toHaveText('Accessories');
  await page.getByRole('button', { name: 'Next cart' }).click();
  await expect.poll(() => L(page, () => window.__liimy.stop())).toBe(0);
  await expect(page.locator('#cart-card-title')).toHaveText('Basket stand');
  await settle(page);
  const p = await L(page, () => window.__liimy.pose());
  const c = await L(page, () => window.__liimy.carts[0]);
  expect(p.x).toBeCloseTo(c.view.x, 1);
  expect(p.z).toBeCloseTo(c.view.z, 1);
});

test('the shopping list: basket by clicking it, ice cream, flowers, veg and fruit', async ({ page }) => {
  await enterInteract(page);
  // Pick up a real basket by clicking it in the 3D view
  await page.locator('#cart-select').selectOption({ label: '1. Basket stand' });
  await settle(page);
  await page.locator('#cart-card-close').click();
  const w = await L(page, () => window.__liimy.itemWorld('basket-1'));
  const s = await L(page, (p) => window.__liimy.project(p.x, p.y + 0.12, p.z), w);
  await page.mouse.click(s.x, s.y);
  await expect.poll(() => L(page, () => window.__liimy.shopping().hasBasket)).toBe(true);
  await expect(page.locator('#checklist li[data-activity="basket"]')).toHaveClass(/is-done/);

  // Ice cream: ring the bell, the hawker holds out a cone, take it
  expect(await L(page, () => window.__liimy.pick('icecream-bell'))).toBe('rang');
  await expect.poll(() => L(page, () => window.__liimy.shopping().iceCreamReady), { timeout: 30_000 }).toBe(true);
  expect(await L(page, () => window.__liimy.pick('icecream-cone'))).toBe('held');
  await expect(page.getByRole('heading', { name: 'Ice cream cone' })).toBeVisible();
  await page.getByRole('button', { name: 'Put in basket' }).click();
  await expect(page.locator('#checklist li[data-activity="icecream"]')).toHaveClass(/is-done/);

  // Flowers
  expect(await L(page, () => window.__liimy.pick('flowers-1'))).toBe('held');
  await page.getByRole('button', { name: 'Put in basket' }).click();
  await expect(page.locator('#checklist li[data-activity="flowers"]')).toHaveClass(/is-done/);

  // A vegetable and a fruit
  await L(page, () => window.__liimy.pick('vegetables-0'));
  await page.getByRole('button', { name: 'Put in basket' }).click();
  await L(page, () => window.__liimy.pick('fruits-2'));
  await page.getByRole('button', { name: 'Put in basket' }).click();
  await expect(page.locator('#checklist li[data-activity="vegfruit"]')).toHaveClass(/is-done/);
  await expect(page.locator('#celebrate')).toBeVisible();
  const st = await L(page, () => window.__liimy.shopping());
  expect(st.complete).toBe(true);
  expect(st.contents).toEqual(expect.arrayContaining(['icecream-cone', 'flowers-1', 'vegetables-0', 'fruits-2']));
});

test('an item can be inspected and put back where it came from', async ({ page }) => {
  await enterInteract(page);
  const home = await L(page, () => window.__liimy.homeWorld('pottery-0'));
  expect(await L(page, () => window.__liimy.pick('pottery-0'))).toBe('held');
  await expect(page.getByRole('heading', { name: 'Clay pot' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Put in basket' })).toBeDisabled(); // no basket yet
  await page.getByRole('button', { name: 'Put back' }).click();
  await expect(page.locator('#inspector')).toBeHidden();
  await page.waitForTimeout(300);
  const now = await L(page, () => window.__liimy.itemWorld('pottery-0'));
  expect(Math.hypot(now.x - home.x, now.y - home.y, now.z - home.z)).toBeLessThan(0.01);
});
