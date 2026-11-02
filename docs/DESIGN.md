# Design direction: Liimy Land

## Point of view
A toy town at sunset. Everything is chunky, rounded and outlined in "crayon" ink, like a cartoon frame. The street glows pink and orange, with gold fairy lights strung overhead. The interface looks like stickers stuck on top of the scene: thick ink borders, solid drop shadows and slightly tilted cards.

## Palette
| Token | Hex | Use |
|---|---|---|
| Sunset pink | `#FF8FAB` | Primary buttons, sky middle |
| Orange | `#FF9A4D` | Sky horizon, accents |
| Gold | `#FFC93C` | Buttons, lights, checkmarks |
| Lilac | `#B79CFF` | Sky top, pressed toggles |
| Cream / paper | `#FFF4E0` / `#FFFAF2` | Cards, signs |
| Ink | `#3A2A3A` | Outlines, text (contrast with paper ≈ 13:1) |

## Type
**Fredoka (variable)**, bundled locally. It's round and friendly; titles use weight 700 with a 4 px ink stroke and a pink drop. Body text is 500 weight at 16 px or larger.

## 3D style
- **Shading:** `MeshToonMaterial` with a three-step gradient for flat cartoon light.
- **Outlines:** inverted-hull ink outlines, merged into a single draw call per batch.
- **Textures:** crayon-stroke canvas textures on walls and cart bodies.
- **Buildings:** G+2, pastel walls, chunky white window frames, gold-lit windows, small balconies with flower boxes, striped awnings, cute shop signs (Bakery, Toy House, Tea Point…), and rooftop water tanks.
- **Street:**
  - a lilac road with a chalk-dashed centre line, where the 16 carts stand
  - pastel checker-tile walkways on low kerbs
  - an entrance gate with balloons and a "Liimy Land" sign
  - benches, round planters, purple lamp posts, and zig-zag strings of gold bulbs (bulbs instanced, halos drawn as one Points batch)
- **Carts:** modelled on the reference snack cart:
  - teal metal frame and big spoked wheels
  - steel tray, coloured cabinet, canopy with a scalloped edge, push handle and a lantern
  - a sticker sign on top of the canopy
  - a round cartoon hawker with thick eyebrows, dot eyes and pink cheeks (no real character)
- **Light:** a fixed sunset, made of a gradient sky shader with a low sun, warm pink fog, a hemisphere light, a warm directional light and three gold point lights. There are no shadow maps; blob shadows sit under the carts.

## Interface
- **Start:** a huge wobbling "Liimy Land" title over the live street, a tagline sticker, and a "Let's go!" button.
- **About:** a native `<dialog>` with an ✕ button. It pops in with a bounce and closes with Escape too.
- **Mode picker:** two tilted cards (Look around / Interact along), each with an "In VR" button when a headset is available.
- **Look around HUD:**
  - mini map with numbered spots
  - "Spot n of 7" label
  - previous/next arrows on screen and on the ground
- **Interact HUD:**
  - shopping-list checklist
  - mini map with a "you are here" dot and a view cone
  - cart card when you click a cart
  - item inspector (Put in basket / Put back)
  - toast messages
  - confetti when the list is complete (a static badge under reduced motion)
- **Controls:** large targets (≥ 48 px), visible gold-and-ink focus rings, reduced motion respected, and layouts that work on narrow and short screens.

## Skill usage record
- **frontend-design:** sticker/crayon visual system chosen for this brief (cute, children, cartoon), not the default SaaS kit.
- **impeccable:** PRODUCT.md updated; craft floor applied to focus, contrast and states; detector run on the new UI (see AUDIT.md).
- **uiux:** touch-target, focus and reduced-motion checks.
- **webguide:** guideline fixes carried over (ellipses on loading text, `translate="no"` on the brand, theme colour, overscroll, tap highlight).
- **3js:** toon materials, batching and instancing, WebXR input, panorama capture, performance budget for Quest.
