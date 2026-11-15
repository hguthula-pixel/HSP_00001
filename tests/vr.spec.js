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

test('in VR: walk into a market shop, grab an item there, and leave with Exit VR', async ({ page }) => {
  await emulateQuest(page);
  await toModes(page);
  await page.locator('#mode-interact-vr').click();
  await expect.poll(() => page.evaluate(() => window.__liimy.inVR), { timeout: 60_000 }).toBe(true);

  // the on-screen Exit VR button shows only during the session
  await expect(page.locator('#vr-exit')).toBeVisible();
  await expect(page.locator('#vr-enter')).toBeHidden();

  // stand at a shop's door and walk in with the left thumbstick (shop doors face the court)
  const shop = await page.evaluate(async () => {
    const m = await import('/js/data/market.js');
    const s = m.SHOPS.find((x) => x.nx === -1 && x.open);
    return { door: s.door, i: s.index };
  });
  await page.evaluate((d) => {
    const THREE = window.AFRAME.THREE;
    const r = document.getElementById('rig').object3D;
    const cam = document.getElementById('cam').object3D;
    r.position.set(0, 0, 0);
    r.rotation.y = 0;
    r.updateMatrixWorld(true);
    // turn the rig so the emulated HEAD faces +X (into the shop), whatever its own yaw
    const back = cam.getWorldDirection(new THREE.Vector3());
    r.rotation.y = Math.PI / 2 - Math.atan2(-back.x, -back.z);
    r.updateMatrixWorld(true);
    // and line the head (not the rig) up with the doorway: the headset sits off the rig's centre
    const h = new THREE.Vector3();
    cam.getWorldPosition(h);
    r.position.set(d[0] - 1.2 - h.x, 0, d[1] - h.z);
  }, shop.door);
  await page.evaluate(() => window.__xr.controllers.left.updateAxes('thumbstick', 0, -1));
  // software WebGL runs at a few frames a second, so walk until the head is past the door
  const headX = () =>
    page.evaluate(() => {
      const h = new window.AFRAME.THREE.Vector3();
      document.getElementById('cam').object3D.getWorldPosition(h);
      return h.x;
    });
  await expect.poll(headX, { timeout: 60_000 }).toBeGreaterThan(shop.door[0] + 0.3); // inside the shop
  await page.evaluate(() => window.__xr.controllers.left.updateAxes('thumbstick', 0, 0));

  // grab the first item on the counter
  const id = `shop${shop.i}-0`;
  const rig = await page.evaluate(() => window.__liimy.rigPosition());
  await reachFor(page, id, rig);
  await squeeze(page, 'right', 1);
  // lift the hand 30 cm: a grabbed item comes along
  await page.evaluate(() => window.__xr.controllers.right.position.y += 0.3);
  await page.waitForTimeout(1500);
  const moved = await page.evaluate((i) => {
    const a = window.__liimy.itemWorld(i);
    const h = window.__liimy.homeWorld(i);
    return Math.hypot(a.x - h.x, a.y - h.y, a.z - h.z);
  }, id);
  expect(moved).toBeGreaterThan(0.2); // the item left the counter and follows the hand
  await squeeze(page, 'right', 0);

  // Exit VR with the floating in-headset button: touch it with the right controller and squeeze
  await page.evaluate(() => {
    const THREE = window.AFRAME.THREE;
    const btn = document.getElementById('rig').object3D.getObjectByName('vr-exit-button');
    const rig = document.getElementById('rig').object3D;
    const w = btn.getWorldPosition(new THREE.Vector3());
    const local = rig.worldToLocal(w);
    // the grab anchor sits 6 cm in front of the grip (−Z of the controller)
    window.__xr.controllers.right.quaternion.set(0, 0, 0, 1);
    window.__xr.controllers.right.position.set(local.x, local.y + 0.02, local.z + 0.06);
  });
  await page.waitForTimeout(1500);
  await squeeze(page, 'right', 1);
  await expect.poll(() => page.evaluate(() => window.__liimy.inVR)).toBe(false);
  await expect(page.locator('#vr-exit')).toBeHidden();
});
