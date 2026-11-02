// Review screenshots into docs/screenshots (desktop and mobile).
import { test, expect } from '@playwright/test';
import { openReady, toModes, settle } from './helpers.js';

test.use({ reducedMotion: 'reduce' });
const out = (info, name) => `docs/screenshots/${info.project.name}-${name}.png`;

test('@both review screenshots', async ({ page }, info) => {
  test.setTimeout(600_000);
  await openReady(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: out(info, '01-start') });
  await page.getByRole('button', { name: 'Let’s go!' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out(info, '02-about') });
  await page.getByRole('button', { name: 'Close about' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: out(info, '03-modes') });

  await page.locator('#mode-look').click();
  await page.waitForFunction(() => window.__liimy.panoLoaded().includes(0), null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out(info, '04-look-around') });
  await page.getByRole('button', { name: 'Next spot' }).click();
  await page.waitForFunction(() => window.__liimy.panoLoaded().includes(1), null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out(info, '05-look-spot-2') });
  await page.getByRole('button', { name: 'Home' }).click();

  await page.locator('#mode-interact').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: out(info, '06-interact-start') });
  await page.evaluate(() => {
    window.__liimy.visit(0);
    window.__liimy.pick('basket-1');
    window.__liimy.visit(2);
  });
  await settle(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: out(info, '07-flower-cart') });
  await page.evaluate(() => window.__liimy.pick('flowers-1'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: out(info, '08-holding-flowers') });
  await page.getByRole('button', { name: 'Put in basket' }).click();
  await page.evaluate(() => {
    window.__liimy.pick('icecream-bell');
    window.__liimy.visit(1);
  });
  await expect.poll(() => page.evaluate(() => window.__liimy.shopping().iceCreamReady), { timeout: 60_000 }).toBe(true);
  await settle(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: out(info, '09-ice-cream-offered') });
  await page.evaluate(() => {
    window.__liimy.pick('icecream-cone');
    window.__liimy.putInBasket();
    window.__liimy.pick('vegetables-0');
    window.__liimy.putInBasket();
    window.__liimy.pick('fruits-0');
    window.__liimy.putInBasket();
    document.getElementById('cart-card').hidden = true;
    window.__liimy.teleport(3.4, -40, 0);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out(info, '10-all-done') });
  for (const [i, name] of [[5, '11-snacks'], [9, '12-cotton-candy'], [11, '13-balloons'], [15, '14-accessories']]) {
    await page.evaluate((k) => {
      window.__liimy.visit(k);
      document.getElementById('cart-card').hidden = true;
    }, i);
    await settle(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: out(info, name) });
  }
  void toModes;
});
