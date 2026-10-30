# CyberChef Mobile

CyberChef Mobile adapts [GCHQ CyberChef](https://github.com/gchq/CyberChef)
for modern phone and tablet browsers. It is not a native app, a rewrite of the
recipe engine, or an official GCHQ release. Original copyright notices and the
Apache-2.0 licence are retained.

## What changes on small screens

- At viewport widths **1023 CSS pixels or less**, the four existing work areas
  (Input, Operations, Recipe, Output) are presented one at a time using a
  touch-friendly bottom navigation bar. At 1024px and above, the desktop
  split-pane interface remains in place.
- A single tap on a searched or listed operation adds it to the recipe.
- Each recipe step offers explicit move-up, move-down and remove controls.
  Desktop drag-and-drop and double-click controls remain available.
- The persistent Bake action opens Output. Recipe controls still provide
  stepping and Auto Bake.
- Mobile settings, about/help and download are available in the top-right menu.
- Editor surfaces, modal dialogs, hit targets and the bottom safe area adapt to
  smaller viewports. The bottom navigation hides while an editor has focus.

There is **one DOM and one set of editors**: switching panels does not copy user
input, recipes or output into separate mobile components. All existing CyberChef
operations, bookmarks, recipes and local storage behavior use the upstream code.

## Building

The build stays HTML, CSS and JavaScript (no mobile OS toolchain):

```sh
npm ci
npm run build
```

Serve `build/prod` with a static HTTP server, for example:

```sh
python3 -m http.server 8000 --directory build/prod
```

Visit `http://localhost:8000/index.html` in a browser. Production output does
not require a backend; some individual upstream CyberChef operations explicitly
make remote requests, as documented in the original README.

## Tests

Run `npm test` for the upstream operations and API tests. The browser smoke test
uses the already-declared Selenium/ChromeDriver dependencies and requires a
Chrome binary and the production build served on port 8000:

```sh
CYBERCHEF_CHROME_BIN=/path/to/chrome npm run test:mobile
```

The smoke test exercises operation search, single-tap adding, moving/removing
recipe steps, baking real input, the settings menu and responsiveness at
320px, 390px, 768px, 1023px and 1280px. It emulates touch at mobile widths.

Browser emulation is not a substitute for testing on actual iOS Safari and
Android Chrome hardware, particularly for keyboard behavior, file picking and
large-data performance.

## Updating from upstream

The mobile adaptation is isolated largely to `src/web/MobileLayout.mjs` and
`src/web/stylesheets/layout/_mobile.css`, with small hooks in the HTML and
recipe markup. Keep the original project as an `upstream` Git remote and merge
future CyberChef security fixes regularly. Review all changes to dependencies
and to the Web Worker path before distributing builds.
