# Filip Gal | Portfolio

Black-and-white personal site for Filip Gal, CS student at Infotech High School.

## Run locally

No build step. Open the file in a browser:

```bash
open index.html
```

Or serve the folder (avoids some browser restrictions on local files):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Stack

- Static HTML, CSS, and a small amount of JavaScript
- [Cabinet Grotesk](https://www.fontshare.com/fonts/cabinet-grotesk) for UI and body
- [Pencerio](https://www.fontshare.com/fonts/pencerio) for script accents
- No framework, no icon CDN, no emojis

## GitHub Pages

Once this repository is public (Pages on a private repo needs GitHub Pro):

1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main`, folder: `/ (root)`

The site will be at `https://filipgal16.github.io/portfolio-or-sum/`.

## Icons

Hairline SVGs in [`assets/icons/`](assets/icons), drawn to match the black/white type. They use `currentColor` so they invert with the cubing band.
