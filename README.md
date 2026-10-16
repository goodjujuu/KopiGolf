# KopiGolf — Step 1: Foundation

Low-poly 3D golf in the browser, styled after Golf Dreams. Runs on iPhone, Android and desktop.
This step: project structure, screen scaling, and the idle scene (club waggling at the ball).

## Run it locally
Browsers block ES modules from file://, so serve the folder:
    python3 -m http.server 8000
Then open http://localhost:8000. To try it on your phone, use your Mac's local IP on the same
Wi-Fi (e.g. http://192.168.1.20:8000).

## Host it for free (GitHub Pages)
1. Create a GitHub repo and upload everything in this folder (index.html, styles.css, src/).
2. Repo → Settings → Pages → Source: "Deploy from a branch", branch: main, folder: / (root).
3. After a minute your game is at https://<username>.github.io/<repo>/
Friends open the link; on iPhone, Share → "Add to Home Screen" makes it full-screen like an app.

## Structure
    index.html            markup for the stage + HUD
    styles.css            HUD styling, safe areas, 44pt touch targets
    src/main.js           entry: wires state, scene, HUD; resize + pause handling
    src/state.js          the single game-state store (multiplayer/wagers extend this)
    src/config.js         every scaling number and colour palette
    src/scene.js          renderer, camera framing, lights, loop
    src/hud.js            badge, buttons, overhead map
    src/entities/         club.js (main sprite, idle waggle), ball.js
    src/world/            builder.js (hole data -> 3D), palm.js, materials.js
    src/courses/          catalog.js + pack01.js (hole data)
    build.py              optional: bundles everything into one HTML file in dist/

## 100+ holes
A hole is data (tee, pin, fairway width, green, hills, palms, theme). Add holes to a pack file;
add packs in src/courses/catalog.js. No new 3D code needed per hole.

## Screen scaling
- Stage is full-bleed on phones, capped at 3:4 and centred on wide screens.
- Horizontal field of view is locked (42°), so every phone sees the same fairway width.
- Camera tilt is solved per screen so the ball always sits 74% down the screen.
- HUD respects notch / Dynamic Island / home-indicator safe areas; buttons 48px (min 44).
- Render resolution capped at 2x; rendering pauses when the tab is hidden.
