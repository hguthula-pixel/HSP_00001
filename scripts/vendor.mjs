// Copies runtime dependencies from node_modules into the static site so the
// published page never reaches a CDN. Run after `npm install`.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');

const copies = [
  ['aframe/dist/aframe-v1.8.0.min.js', 'vendor/aframe.min.js'],
  ['aframe/LICENSE', 'vendor/AFRAME-LICENSE.txt'],
  ['@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2', 'assets/fonts/fredoka-latin-wght.woff2'],
  ['@fontsource-variable/fredoka/LICENSE', 'assets/fonts/FREDOKA-OFL.txt'],
];

let missing = 0;
for (const [from, to] of copies) {
  const src = join(nm, from);
  const dest = join(root, to);
  if (!existsSync(src)) {
    console.warn(`missing: ${from}`);
    missing++;
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`copied ${from} -> ${to}`);
}
process.exitCode = missing ? 1 : 0;
