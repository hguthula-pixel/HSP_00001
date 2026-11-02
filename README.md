# Liimy Land

A cute miniature hawker market for children, in a Shinchan-inspired cartoon style.
- **Street:** G+2 buildings on both sides, 16 hawker carts down the middle of the road, and walkways on either side.
- **Mood:** pink-orange sunset and gold lights.
- **Two ways to visit:**
  - **Look around:** a 360° viewer with arrows and a mini map.
  - **Interact along:** walk the street and pick things up. Grab a basket, get an ice cream from the hawker, choose flowers, and bag vegetables and fruit.
- **Devices:** desktop, phone, or a Meta Quest in VR.

It's a static site: HTML, CSS and ES modules plus locally bundled A-Frame (three.js). There's no build step and no backend, and it runs on GitHub Pages.

## Preview locally
```bash
npm install
```
```bash
npm run vendor
```
```bash
npm start
```
Then open http://localhost:8080/. Lite mode for slow devices: http://localhost:8080/?lite=1.

## Try it on a Meta Quest
WebXR needs a secure page. Two options:
- **USB, with developer mode on:** connect the headset and forward the port:
  ```bash
  adb reverse tcp:8080 tcp:8080
  ```
  Then open `http://localhost:8080` in the Quest Browser.
- **HTTPS host:** any HTTPS host, for example GitHub Pages once you approve publishing.

On the headset, choose **In VR** on either mode card.

| Action | Control |
|---|---|
| Walk | Left thumbstick |
| Snap turn | Right thumbstick |
| Grab | Grip button near an item, or pinch with hand tracking |
| Grab from far / press arrows | Point the gold beam and pull the trigger |
| Put in basket | Let go of an item near the basket |

## Tests
```bash
npx playwright install chromium
```
```bash
npm test
```
- **What's covered:**
  - the flow: start → About ✕ → modes → Home
  - the 360° viewer: arrows with wraparound, map dot, tapping the map, ground arrows
  - Interact: walkway bounds and cart collisions, cart tour, the four activities, putting items back
  - VR, using Meta's IWER Quest 3 emulator: entering VR, grip grab, dropping into the basket, thumbstick walking, items returning home
  - audio, loading recovery, no-WebGL fallback, local-only assets, accessibility (axe), short screens
- **Speed:** tests use software WebGL, so a full run takes 15–25 minutes.
- **Screenshots:** `npx playwright test tests/screens.spec.js` writes review images to `docs/screenshots/`.

## Panoramas
`node scripts/render-panos.mjs` re-renders `assets/pano/spot-1…7.jpg` from the 3D scene. Run it after changing the market.

## Music
Add the owner-supplied track as `assets/audio/market-theme.mp3`. Without it, the market runs quietly.

## Code map
| Path | Responsibility |
|---|---|
| `js/data/hawkers.js` | 16 carts, items, walkway bounds and cart collision, 360° spots, activities |
| `js/scene/toon.js` | Toon materials, ink outlines, crayon texture, sticker signs |
| `js/scene/street.js` | Road, walkways, gate, lamps, benches, planters, gold fairy lights |
| `js/scene/buildings.js` | G+2 cartoon buildings with shopfronts and balconies |
| `js/scene/carts.js` | Push-cart builder, hawker figures, displays, pickable items, ice cream exchange |
| `js/scene/neighborhood.js` | 28 town buildings, 4 roads, trees, lamps |
| `js/scene/lighting.js` | Sunset sky, fog and lights |
| `js/look/panorama.js` | Panorama viewer and capture |
| `js/ui/minimap.js` | Street map with spots and "you are here" |
| `js/interact/shopping.js` | Basket, holding, put in basket / put back, checklist |
| `js/vr/vr.js` | Quest thumbstick walking, snap turn, grip/pinch grab, trigger beam |
| `js/nav/navigation.js`, `js/nav/tour.js` | Desktop walking, click-to-glide, picking, cart tour |
| `js/main.js` | Flow: start → About → modes → Look / Interact, recovery |

## Docs
- [docs/DESIGN.md](docs/DESIGN.md): design direction
- [docs/ASSETS.md](docs/ASSETS.md): asset provenance
- [docs/AUDIT.md](docs/AUDIT.md): audit and remaining limitations
- [PRODUCT.md](PRODUCT.md): product context
