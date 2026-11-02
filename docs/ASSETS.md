# Asset provenance

Everything the page loads is served from this repository. At runtime there are no CDN, font-service or analytics requests; `tests/loading.spec.js` checks this.

| Asset | Path | Source | License |
|---|---|---|---|
| A-Frame 1.8.0 (bundles three.js r184) | `vendor/aframe.min.js` | npm `aframe@1.8.0`, copied by `npm run vendor` | MIT (`vendor/AFRAME-LICENSE.txt`) |
| Fredoka Variable (Latin) | `assets/fonts/fredoka-latin-wght.woff2` | npm `@fontsource-variable/fredoka@5.3.0` | SIL OFL 1.1 (`assets/fonts/FREDOKA-OFL.txt`) |
| 360° panoramas | `assets/pano/spot-1.jpg` … `spot-7.jpg` | Rendered from this project's 3D scene by `scripts/render-panos.mjs` | Project's own |
| Site icon, UI icons | `assets/icon.svg`, inline SVG | Drawn for this project | Project's own |
| Textures (crayon strokes, tiles, road, shutters, awnings, halos) | none on disk | Generated on `<canvas>` at load | Project's own |
| Signs | none on disk | Drawn to canvas in Fredoka at load | Project's own |
| 3D models (buildings, carts, hawkers, items) | none on disk | Built from primitives in `js/scene/*.js` | Project's own |
| Background music | `assets/audio/market-theme.mp3` | **Owner-supplied, not included yet** | Owner confirms rights before publishing |

## Theme note
The look is inspired by the Shinchan cartoon style: thick outlines, bright flat colours, and round, simple figures. It uses no characters, names, logos or artwork from the series. The hawker figures are generic and drawn for this project.

## Dev-only tools (not shipped to visitors)
- `@playwright/test` and `@axe-core/playwright` for tests.
- `iwer@2.6.0` (Meta's Immersive Web Emulation Runtime, MIT), which emulates a Quest 3 in the VR tests.

## Regenerating the panoramas
After changing the scene, run `node scripts/render-panos.mjs`. It starts a temporary local server, renders the 7 spots at 4096×2048 and overwrites `assets/pano/`.

## Unused runtime paths in A-Frame
- **Hand models:** A-Frame can download controller and hand models from `cdn.aframe.io`. This site turns those off: `model: false` on controllers, and `modelStyle: dots` for hands.
- **Inspector:** the inspector (Ctrl+Alt+I) would load from unpkg. It's never triggered by the site.
