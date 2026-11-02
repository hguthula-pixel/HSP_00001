// Renders the "Look around" panoramas from the 3D market.
// Usage: node scripts/render-panos.mjs   → writes assets/pano/spot-1.jpg … spot-7.jpg
// Uses Playwright's Chromium (software WebGL), a temporary local server and ?capture mode.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4179;
const WIDTH = Number(process.env.PANO_WIDTH) || 4096;

const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Preview server did not start');
}

await waitForServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?capture=1`);
await page.waitForFunction(() => window.__liimy && window.__liimy.ready && window.__liimy.capture, null, { timeout: 180_000 });
const count = await page.evaluate(() => window.__liimy.spots.length);
mkdirSync(join(root, 'assets/pano'), { recursive: true });
for (let i = 0; i < count; i++) {
  const url = await page.evaluate(([idx, width]) => window.__liimy.capture(idx, { width }), [i, WIDTH]);
  const file = join(root, `assets/pano/spot-${i + 1}.jpg`);
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`wrote ${file}`);
}
await browser.close();
stop();
