# Icons

Drop monochrome SVGs into this folder, then place them inside the matching `.icon[data-icon]` frames in `index.html`.

Use 24x24 or 32x32 SVGs that inherit `currentColor` so they work on both the black canvas and the inverted cubing band.

## Needed files

| `data-icon` | Use | Suggested filename |
| --- | --- | --- |
| `github` | Nav, contact, project links | `github.svg` |
| `mail` | Hero and contact | `mail.svg` |
| `external` | Outbound project links | `external.svg` |
| `arrow` | Section CTAs | `arrow.svg` |
| `menu` | Mobile nav open | `menu.svg` |
| `close` | Mobile nav close | `close.svg` |
| `cube` | Cubing section | `cube.svg` |
| `code` | About / software | `code.svg` |
| `chip` | About / embedded, RP2350 project | `chip.svg` |

Example:

```html
<span class="icon" data-icon="github" aria-hidden="true">
  <img src="assets/icons/github.svg" alt="">
</span>
```

When an image or SVG is inside `.icon`, the empty hairline frame hides automatically.
