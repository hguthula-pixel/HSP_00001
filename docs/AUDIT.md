# Audit and remaining limitations: Liimy Land

_Audit date: 2026-11-02._

## What was verified

### Automated (Playwright, Chromium with SwiftShader software WebGL)
| Area | Spec | Checks |
|---|---|---|
| Flow | `tests/flow.spec.js` | Start → "Let's go!" → About popup (college showcase text) → ✕ → mode picker, with focus on the first mode. About reopens and closes with Escape. Home returns to the mode picker. Help focus stays inside and returns to its opener; `?` opens it. axe finds no serious or critical issues on start, About, modes or HUD. Start and modes scroll and work at 375×480 and 640×360; touch targets are at least 44 px on a phone. |
| Look around | `tests/look.spec.js` | All 7 panoramas are served locally as JPEG. Previous/Next wrap 1 ↔ 7, and the label and map highlight follow. The camera stands at each spot. The map dot sits at the spot's position. Tapping a map number jumps there. Clicking the arrow on the ground moves to the next spot. |
| Interact along | `tests/interact.spec.js` | 16 carts, all required types present, alternating walkways, at least 3 fruit, vegetable and flower pickables. Walking and gliding stay on the walkways and out of carts; keyboard walking moves. Cart tour wraps 16 ↔ 1 and stops in front of each cart. The full shopping list works: a basket picked by clicking it in 3D, the bell rung, the cone handed over and taken, flowers, a vegetable and a fruit into the basket, and the celebration shows. An item can be inspected and put back exactly where it was. |
| Quest VR (emulated) | `tests/vr.spec.js` | Using Meta's IWER Quest 3 emulator: the "In VR" button appears and enters an immersive session. The grip button grabs a basket. A carrot grabbed with the other hand and released near the basket drops in. The left thumbstick walks forward. An item released away from the basket floats back to its cart. |
| Audio | `tests/audio.spec.js` | Music starts only after a mode is entered and fades in to 25%. Mute and volume persist across visits. Playback pauses while the page is hidden. A missing file leaves everything usable with a "Music file not found" status. |
| Loading | `tests/loading.spec.js` | A blocked engine shows recovery, with focus on its heading, and Try again recovers. A slow start times out into recovery, and lite mode loads 14 town buildings. Without WebGL, the 16 carts show as a list. The full scene has 28 town buildings, 4 roads and a sunset preset, makes no external requests, and loads Fredoka. |

The final pass/fail status is in the last section.

### Design review
- **impeccable detector:** flags bounce easing (title wobble, card and dialog pops) and the candy-stripe loader. Both are deliberate for a cute children's theme, and both switch off under `prefers-reduced-motion`.
- **Web Interface Guidelines:** ellipses on loading text, `translate="no"` on the brand, theme colour, tap highlight, overscroll and safe areas are handled. Native dialogs are used for About and Help.

### Performance
- **Draw calls:** about 136 per frame in the full market at 1280×800 (measured). Outlines are merged per batch, items are merged per colour, and repeated décor is instanced.
- **Triangles:** about 289k per frame. No shadow maps (blob shadows instead); toon materials only.
- **Quest settings:** foveation level 1, high refresh rate requested, and the canvas capped at 1600 px.

## Remaining limitations
1. **Not tested on a real Quest.** VR is verified in the IWER emulator only. Frame rate, comfort of thumbstick speed (1.8 m/s) and snap turn (30°), and hand-tracking pinch still need a check on the device. To test, use `adb reverse tcp:8080 tcp:8080` or an HTTPS host.
2. **Hand tracking is only partly tested.** Pinch-to-grab is implemented with A-Frame's `pinchstarted` and `pinchended` events but isn't exercised in automated tests. The hands draw as simple dots, which avoids downloading the official hand models.
3. **Panoramas are static images.** The 360° views show the market as rendered, so items you moved in Interact mode don't appear in them. Re-run `scripts/render-panos.mjs` after changing the scene. The JPEGs total about 5.7 MB.
4. **Music isn't included.** The owner must add `assets/audio/market-theme.mp3` and confirm the rights.
5. **Theme rights.** The cartoon style is inspired by Shinchan for a college showcase. No characters or logos are used, but publishing more widely should keep it that way.
6. **No screen-reader session.** Labels, live regions and focus order pass axe, but haven't been tried with NVDA, VoiceOver or TalkBack. The 3D view is decorative to assistive technology; carts and actions are reachable from the controls.
7. **Touch look is horizontal only** (A-Frame `look-controls`). Phone users turn left and right, not up and down.
8. **Only Chromium was automated.** Quest Browser, Safari and Firefox weren't run.

## Fixes made during review
- **A-Frame not loaded yet:** the UI module imported the shopping module before A-Frame was available. The activity list now lives in `js/data/hawkers.js`.
- **Hidden hawkers:** cart signs hid the hawkers' faces. Signs now sit on top of the canopy, with a plain board behind so no text reads mirrored from the far walkway.
- **Desktop basket:** it was too big and showed in the 360° view. It's now smaller, and hidden while looking around.
- **Ground arrows:** the next and previous arrows overlapped at the ends of the street. They now sit to either side, above the control bar.
- **Slow start in tests:** under software WebGL the start took longer than the app's limit. The app default is now 45 s, and tests pass `?timeout=150000`.

## Final run status
Last full run on 2026-11-02 (`npx playwright test`, both projects, one worker): **26 passed, 0 failed** in 8.8 minutes.
- **Desktop:** 24 tests, including VR emulation and review screenshots.
- **Mobile:** 2 tests (Pixel 7: touch targets and review screenshots).

Review screenshots are in `docs/screenshots/` (14 desktop, 14 mobile).
