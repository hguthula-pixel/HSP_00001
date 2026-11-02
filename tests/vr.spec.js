// Meta Quest behaviour, driven by Meta's IWER emulator (an emulated Quest 3 inside Chromium).
import { test, expect } from '@playwright/test';
import { emulateQuest, toModes } from './helpers.js';

test.use({ reducedMotion: 'reduce' });
test.setTimeout(240_000);

/** Puts the rig next to a cart and the right controller's grab point on an item. */
async function reachFor(page, id, rig) {
  const w = await page.evaluate((i) => window.__liimy.itemWorld(i), id);
  await page.evaluate(
    ({ w, rig }) => {
      const r = document.getElementById('rig').object3D;
      r.position.set(rig.x, 0, rig.z);
      r.rotation.y = 0;
      // controller pose is in rig space; the grab anchor sits 6 cm in front of the grip
      window.__xr.controllers.right.position.set(w.x - rig.x, w.y + 0.05, w.z - rig.z + 0.06);
    },
    { w, rig },
  );
  await page.waitForTimeout(1200);
}

async function squeeze(page, hand, value) {
  await page.evaluate(({ hand, value }) => window.__xr.controllers[hand].updateButtonValue('squeeze', value), { hand, value });
  await page.waitForTimeout(1200);
}

test('enter VR, grab a basket, drop a vegetable into it, and walk with the thumbstick', async ({ page }) => {
  await emulateQuest(page);
  await toModes(page);
  await expect(page.locator('#mode-interact-vr')).toBeVisible();
  await page.locator('#mode-interact-vr').click();
  await expect.poll(() => page.evaluate(() => window.__liimy.inVR), { timeout: 60_000 }).toBe(true);

  // grip near a basket on the basket stand (cart 1, west walkway)
  await reachFor(page, 'basket-1', { x: -1.8, z: -5 });
  await squeeze(page, 'right', 1);
  await squeeze(page, 'right', 0);
  await expect.poll(() => page.evaluate(() => window.__liimy.shopping().hasBasket)).toBe(true);

  // the basket now hangs from the right hand; grab a carrot with the left hand
  await page.evaluate(() => {
    const r = document.getElementById('rig').object3D;
    r.position.set(-1.8, 0, -20);
  });
  const carrot = await page.evaluate(() => window.__liimy.itemWorld('vegetables-1'));
  await page.evaluate((w) => window.__xr.controllers.left.position.set(w.x + 1.8, w.y + 0.05, w.z + 20 + 0.06), carrot);
  await page.waitForTimeout(1200);
  await squeeze(page, 'left', 1);
  expect((await page.evaluate(() => window.__liimy.shopping())).contents).toEqual([]);
  // bring the carrot next to the basket and let go
  const basket = await page.evaluate(() => {
    const b = window.__liimy.pickables().find((p) => p.kind === 'basket' && window.__liimy.shopping().hasBasket);
    return b && window.__liimy.itemWorld('basket-1');
  });
  await page.evaluate((b) => window.__xr.controllers.left.position.set(b.x + 1.8, b.y + 0.1, b.z + 20), basket);
  await page.waitForTimeout(1200);
  await squeeze(page, 'left', 0);
  await expect.poll(() => page.evaluate(() => window.__liimy.shopping().contents)).toContain('vegetables-1');

  // left thumbstick forward walks down the walkway
  const before = await page.evaluate(() => window.__liimy.rigPosition());
  await page.evaluate(() => window.__xr.controllers.left.updateAxes('thumbstick', 0, -1));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__xr.controllers.left.updateAxes('thumbstick', 0, 0));
  const after = await page.evaluate(() => window.__liimy.rigPosition());
  expect(after.z).toBeLessThan(before.z - 0.3);
});

test('releasing an item away from the basket sends it back to its cart', async ({ page }) => {
  await emulateQuest(page);
  await toModes(page);
  await page.locator('#mode-interact-vr').click();
  await expect.poll(() => page.evaluate(() => window.__liimy.inVR), { timeout: 60_000 }).toBe(true);
  const home = await page.evaluate(() => window.__liimy.homeWorld('fruits-0'));
  await reachFor(page, 'fruits-0', { x: 1.8, z: -25 });
  await squeeze(page, 'right', 1);
  await page.evaluate(() => window.__xr.controllers.right.position.set(0.3, 1.4, -0.5));
  await page.waitForTimeout(1200);
  const held = await page.evaluate(() => window.__liimy.itemWorld('fruits-0'));
  expect(Math.hypot(held.x - home.x, held.z - home.z)).toBeGreaterThan(0.3); // it followed the hand
  await squeeze(page, 'right', 0);
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => window.__liimy.itemWorld('fruits-0'));
      return Math.hypot(now.x - home.x, now.y - home.y, now.z - home.z);
    })
    .toBeLessThan(0.01);
});
