# KopiGolf

Low-poly 3D golf in the browser, styled after Golf Dreams. Runs on iPhone, Android and desktop.
Low-poly 3D golf in the browser. Play a hole with a swipe swing, then challenge friends.

## How to play
- **Swing:** drag down to pull the club back (further = more power), then flick up past where you started.
  A quick flick keeps full power; a slow push loses some. Flick straight up to hit straight; drifting
  left or right hooks or slices.
- **Aim:** drag sideways before swinging.
- On the green the putter takes over: pull back for distance, flick to roll.
- Water costs a penalty stroke and you replay from where you hit.
- Tap the club chip at the bottom to pick a club. The dotted arc shows a full-power, straight
  shot with that club (it ignores wind and hook/slice, so reading those is up to you).
- Practice: choose Day / Sunset / Night and Calm / Breezy / Windy on the home screen.
  The wind chip under the hole badge shows speed, and its arrow points where the wind blows
  (up = helping you).
- Locker (from the home screen): customise your golfer (body, face, hair, hat, glasses, top,
  bottoms, shoes, gloves) and your clubs (head finish, shaft, grip, ball colour). Drag the preview
  to spin it; Randomise for a surprise. Your look is saved on this device. In a round you see your
  gloves, sleeves, club colours and ball.

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
    src/game/controller.js  rules of a hole: shots, penalties, scoring
    src/input/swing.js    touch/mouse gesture -> aim, backswing, impact
    src/physics/          ball flight/bounce/roll, wind, guide arc, surfaces, terrain (no 3D code; testable)
    src/ui/home.js        home screen and practice options
    src/ui/locker.js      Locker screen + 3D preview
    src/avatar/looks.js   every customisation option and colour palette (add new ones here)
    src/avatar/avatar.js  builds the 3D golfer from a look
    src/courses/practice.js  the practice map (Practice mode only)
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

## Tuning the feel
All swing and physics numbers are in `src/config.js` (`CLUBS`, `SWING`, `PHYSICS`):
max carry, how far to drag for full power, flick speed, hook/slice strength, bounce and roll per surface.
