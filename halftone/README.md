# Portfolio

A single-page portfolio with a procedurally drawn, 3D-lit halftone surface.
Vite + vanilla TypeScript, 2D canvas only, no image assets.

## Develop

Needs Node 20.19 or newer.

```sh
npm install
npm run dev
```

Vite prints a local URL (usually http://localhost:5173).

## Build

```sh
npm run build     # type-checks, then writes static files to dist/
npm run preview   # serves dist/ locally to check the build
```

## Deploy

The output in `dist/` is plain static files (one HTML file, one CSS file, one
JS file). Asset paths are relative (`base: './'` in `vite.config.ts`), so the
site works at a domain root or in any subfolder with no changes.

- **Your own server**: run `npm run build`, then copy everything inside
  `dist/` to the folder your web server serves (for example
  `/var/www/portfolio/` for nginx or Apache, or `public_html/` on shared
  hosting). No Node is needed on the server and no server config is required.
- **Vercel**: import the repository. `vercel.json` sets the build command
  (`npm run build`) and output folder (`dist`). Or run `npx vercel` in this
  folder.
- **Netlify**: connect the repository. `netlify.toml` already sets the build
  command (`npm run build`) and publish folder (`dist`). Or drag `dist/` onto
  app.netlify.com/drop.

## Fill in your details

Every personal detail in `index.html` is a `[PLACEHOLDER]`: name, year, intro,
project roles, years and descriptions, project links (`href="#"`), the about
statement, the disciplines and tools lists, and the email address (both the
`mailto:` link and its text).

## How it works

- `src/surface.ts`: the engine. `createSurface(canvas, heightFn, options)`
  samples a height field on a coarse grid, takes its gradient by forward
  differences, lights the normals with a light that follows the pointer, and
  draws a halftone dot grid (with an optional soft greyscale render layer
  underneath). It handles devicePixelRatio, resizing, visibility and adaptive
  quality, and reuses its typed arrays between frames.
- `src/fields.ts`: the height functions (fold, orbs, rings, the hero's masked
  fold with cursor bump and click ripples).
- `src/main.ts`: creates the surfaces and runs one shared animation loop,
  paused while the tab is hidden. With `prefers-reduced-motion`, each canvas
  paints one still frame and the loop never starts.
- `src/style.css`: layout and type.
