# Switching on online play

Online play ("Play online" in Play with friends) needs somewhere for everyone's phones to share
the room: a free **Firebase Realtime Database**. It takes about 5 minutes, once.

1. Go to <https://console.firebase.google.com>, sign in with a Google account and click
   **Create a project**. Call it `kopigolf`. You can turn Google Analytics off.
2. In the left menu open **Build → Realtime Database** and click **Create Database**.
   - Location: **Singapore (asia-southeast1)**, the closest to you.
   - Security rules: choose **Start in locked mode**.
3. Open the database's **Rules** tab, replace everything with the contents of
   [`database.rules.json`](database.rules.json) from this repo, and click **Publish**.
   (Rooms are readable and writable by anyone with the game, but only under 4-letter room
   codes, with names up to 14 characters and scores from 1 to 10.)
4. Click the gear icon → **Project settings** → **General**. Under **Your apps**, click the web
   icon `</>`, name the app `KopiGolf` and click **Register app** (skip Firebase Hosting:
   the game stays on GitHub Pages).
5. Firebase shows a `firebaseConfig = { … }` block. Copy it into
   [`src/net/firebaseConfig.js`](src/net/firebaseConfig.js), replacing
   `export const FIREBASE_CONFIG = null;` with
   `export const FIREBASE_CONFIG = { apiKey: …, authDomain: …, databaseURL: …, projectId: …, appId: … };`
   Make sure it includes `databaseURL` (if not, copy the URL shown at the top of the
   Realtime Database page).
6. Commit and push. Once GitHub Pages updates, **Create a room** works on any phone.

These config values are not secret: every Firebase web app sends them to the browser.

## Trying it without Firebase

Add `?net=local` to the address (for example `http://localhost:8000/?net=local`) and open
the game in several tabs of the same browser. Each tab is a separate player, and they talk
through the browser itself. It's handy for testing; it can't reach other devices.

## Limits of the free plan

The free Spark plan allows 100 phones connected at once and 1 GB of stored data, far more
than friends' matches need. Old rooms stay in the database but are tiny. You can delete the
`rooms` node in the Firebase console whenever you like.
