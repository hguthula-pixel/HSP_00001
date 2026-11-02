import { test, expect } from '@playwright/test';
import { enterLook } from './helpers.js';

test.use({ reducedMotion: 'reduce' });

test('all seven panoramas are present as local images', async ({ request }) => {
  for (let i = 1; i <= 7; i++) {
    const r = await request.get(`/assets/pano/spot-${i}.jpg`);
    expect(r.status(), `spot-${i}.jpg`).toBe(200);
    expect(r.headers()['content-type']).toContain('image/jpeg');
  }
});

test('arrows step through the 7 spots with wraparound, and the map follows', async ({ page }) => {
  await enterLook(page);
  await page.waitForFunction(() => window.__liimy.panoLoaded().includes(0), null, { timeout: 60_000 });
  await expect(page.locator('#spot-label')).toHaveText('Spot 1 of 7: Gate');
  await expect(page.locator('.mm-spot.is-current text')).toHaveText('1');

  await page.getByRole('button', { name: 'Previous spot' }).click(); // 1 → 7
  await expect(page.locator('#spot-label')).toContainText('Spot 7 of 7');
  await expect(page.locator('.mm-spot.is-current text')).toHaveText('7');
  await page.getByRole('button', { name: 'Next spot' }).click(); // 7 → 1
  await expect(page.locator('#spot-label')).toContainText('Spot 1 of 7');
  await page.getByRole('button', { name: 'Next spot' }).click();
  await expect.poll(() => page.evaluate(() => window.__liimy.spot())).toBe(1);
  const spot = await page.evaluate(() => window.__liimy.spots[1]);
  const pose = await page.evaluate(() => window.__liimy.pose());
  expect(pose.x).toBeCloseTo(spot.x, 3);
  expect(pose.z).toBeCloseTo(spot.z, 3);

  // the "you are here" dot sits at the spot on the map
  await page.waitForTimeout(500);
  const t = await page.locator('.mm-me').getAttribute('transform');
  const [, mx] = t.match(/translate\(([-\d.]+)/);
  const expected = ((6 - spot.z) / 92) * 320;
  expect(Math.abs(Number(mx) - expected)).toBeLessThan(2);

  // tapping a number on the map jumps there
  await page.locator('.mm-spot').nth(4).click();
  await expect.poll(() => page.evaluate(() => window.__liimy.spot())).toBe(4);
  await page.waitForFunction(() => window.__liimy.panoLoaded().includes(4), null, { timeout: 60_000 });
});

test('clicking the arrow on the ground moves to the next spot', async ({ page }) => {
  await enterLook(page);
  await page.waitForFunction(() => window.__liimy.panoLoaded().includes(0), null, { timeout: 60_000 });
  // spot 1 → spot 2 lies down the street to the right; look toward it and slightly down
  const pt = await page.evaluate(() => {
    const L = window.__liimy;
    const a = L.spots[0];
    const b = L.spots[1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const d = { x: dx / len, z: dz / len };
    const side = 0.55;
    document.getElementById('cam').components['look-controls'].pitchObject.rotation.x = -0.5;
    document.getElementById('cam').components['look-controls'].yawObject.rotation.y = Math.atan2(-d.x, -d.z);
    return { x: a.x + d.x * 3.2 - d.z * side, y: 1.6 - 1.05, z: a.z + d.z * 3.2 + d.x * side };
  });
  await page.waitForTimeout(800);
  const s = await page.evaluate((p) => window.__liimy.project(p.x, p.y, p.z), pt);
  expect(s.visible).toBe(true);
  await page.mouse.click(s.x, s.y);
  await expect.poll(() => page.evaluate(() => window.__liimy.spot())).toBe(1);
});
