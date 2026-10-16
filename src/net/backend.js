import { FIREBASE_CONFIG } from './firebaseConfig.js';

// A tiny path-based realtime store, the only thing online play needs:
//   get(path) · set(path, value) · update(path, patch) · remove(path)
//   subscribe(path, cb) → unsubscribe       (cb fires now and on every change)
//   onDisconnectSet(path, value)           (applied by the server if this device drops off)
//   transaction(path, fn) → committed?     (fn(current) → next, or undefined to abort)
//
// Two implementations:
//   firebase — Firebase Realtime Database (real play across phones), loaded from Google's CDN
//   local    — this browser only, tabs talk through localStorage + BroadcastChannel. For trying
//              online play on one computer (?net=local) and for automated tests.

const FIREBASE_VERSION = '10.12.2';

export function onlineMode() {
  const params = new URLSearchParams(location.search);
  if (params.get('net') === 'local') return 'local';
  return FIREBASE_CONFIG ? 'firebase' : null;
}

export async function connectBackend() {
  const mode = onlineMode();
  if (mode === 'local') return localBackend();
  if (mode === 'firebase') return firebaseBackend(FIREBASE_CONFIG);
  return null;
}

// ---------- Firebase ----------
async function firebaseBackend(config) {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const appUrl = `${base}/firebase-app.js`;
  const dbUrl = `${base}/firebase-database.js`;
  const appMod = await import(appUrl);
  const fb = await import(dbUrl);
  const app = appMod.initializeApp(config);
  const db = fb.getDatabase(app);
  const ref = (path) => fb.ref(db, path);
  return {
    kind: 'firebase',
    async get(path) { return (await fb.get(ref(path))).val(); },
    // async so a value Firebase refuses comes back as a rejected promise, never a throw that
    // would break the shot that sent it.
    set: async (path, value) => fb.set(ref(path), value),
    update: async (path, patch) => fb.update(ref(path), patch),
    remove: (path) => fb.remove(ref(path)),
    subscribe: (path, cb) => fb.onValue(ref(path), (snap) => cb(snap.val())),
    onDisconnectSet: (path, value) => fb.onDisconnect(ref(path)).set(value),
    async transaction(path, fn) {
      const res = await fb.runTransaction(ref(path), (cur) => fn(cur ?? null));
      return res.committed;
    },
    serverTime: () => fb.serverTimestamp(),
  };
}

// ---------- local (one browser, many tabs) ----------
const LOCAL_KEY = 'kopigolf.localnet';

function localBackend() {
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('kopigolf-net') : null;
  const listeners = new Set();
  const read = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; } };
  const emit = () => listeners.forEach((l) => l());
  const write = (tree) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(tree));
    channel?.postMessage('change');
    emit();
  };
  channel?.addEventListener('message', emit);
  window.addEventListener('storage', (e) => { if (e.key === LOCAL_KEY) emit(); });
  const edit = (fn) => { const tree = read(); fn(tree); write(tree); };
  const disconnects = [];
  window.addEventListener('pagehide', () => { for (const [p, v] of disconnects) edit((t) => setAt(t, p, v)); });

  return {
    kind: 'local',
    async get(path) { return clone(getAt(read(), path)); },
    async set(path, value) { edit((t) => setAt(t, path, clone(value))); },
    async update(path, patch) { edit((t) => { for (const [k, v] of Object.entries(patch)) setAt(t, `${path}/${k}`, clone(v)); }); },
    async remove(path) { edit((t) => setAt(t, path, null)); },
    subscribe(path, cb) {
      let last;
      const fire = () => {
        const v = getAt(read(), path);
        const json = JSON.stringify(v ?? null);
        if (json === last) return;
        last = json;
        cb(clone(v));
      };
      listeners.add(fire);
      fire();
      return () => listeners.delete(fire);
    },
    onDisconnectSet(path, value) { disconnects.push([path, value]); },
    async transaction(path, fn) {
      let committed = false;
      edit((t) => {
        const next = fn(clone(getAt(t, path)) ?? null);
        if (next === undefined) return;
        setAt(t, path, clone(next));
        committed = true;
      });
      return committed;
    },
    serverTime: () => Date.now(),
  };
}

const clone = (v) => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v)));

function getAt(tree, path) {
  let node = tree;
  for (const key of path.split('/').filter(Boolean)) {
    if (node === null || typeof node !== 'object') return null;
    node = node[key];
  }
  return node ?? null;
}

function setAt(tree, path, value) {
  const keys = path.split('/').filter(Boolean);
  let node = tree;
  for (const key of keys.slice(0, -1)) {
    if (node[key] === null || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  const last = keys[keys.length - 1];
  if (value === null) delete node[last];
  else node[last] = value;
}
