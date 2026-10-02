/*
 * Live order channel, shared by the menu (index.html) and the staff
 * desk (staff.html). Orders are stored in Firebase Cloud Firestore:
 *
 *   orders/{id}  { uid, code, type, table?, name?, note?, lines[], total,
 *                  status, createdAt, at, eta?, reason?, statusAt? }
 *
 * Customers are signed in anonymously and can only create orders and read
 * their own. Staff sign in with email + password and can see and update all
 * orders. See firestore.rules and FIREBASE_SETUP.md.
 *
 *   menu/live    { items: { <id>: overrides }, custom: { <id>: new item } }
 *                Staff edits to the menu (price, sold out, hidden, text,
 *                photo, new dishes), layered over menu.js. Anyone can read;
 *                only staff can write. Photos live in Cloud Storage under
 *                menu/<itemId>/.
 */
window.TherapyOrders = (() => {
  "use strict";

  const OCFG = (window.THERAPY_CONFIG && window.THERAPY_CONFIG.orders) || {};
  const FB = OCFG.firebase || {};
  const configured = !!(FB.apiKey && FB.projectId && FB.appId);
  const SDK = OCFG.sdkBase || "https://www.gstatic.com/firebasejs/10.12.2";

  const STATUS = {
    new: { label: "Sent to cafe", step: 0 },
    preparing: { label: "Preparing", step: 1 },
    ready: { label: "Ready", step: 2 },
    completed: { label: "Completed", step: 3 },
    rejected: { label: "Cancelled by cafe", step: -1 },
  };

  const rand = (n, alphabet) => {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  };
  // Short code the customer reads out at the counter, e.g. "D-4K7" / "T-9QM".
  const newCode = (type) => `${type === "dinein" ? "D" : "T"}-${rand(3, "23456789ABCDEFGHJKLMNPQRSTUVWXYZ")}`;
  // Firestore rejects `undefined`; drop those keys.
  const clean = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------- Firebase bootstrap (loaded on first use) ---------------- */
  let ready = null;
  function fb() {
    if (!configured) return Promise.reject(new Error("Online ordering isn't set up yet"));
    if (!ready) {
      ready = (async () => {
        const [appM, authM, fsM] = await Promise.all([
          import(`${SDK}/firebase-app.js`),
          import(`${SDK}/firebase-auth.js`),
          import(`${SDK}/firebase-firestore.js`),
        ]);
        const app = appM.initializeApp(FB);
        const auth = authM.getAuth(app);
        const db = fsM.getFirestore(app);
        if (OCFG.emulator) {
          authM.connectAuthEmulator(auth, `http://${OCFG.emulator.auth}`, { disableWarnings: true });
          const [host, port] = OCFG.emulator.firestore.split(":");
          fsM.connectFirestoreEmulator(db, host, +port);
        }
        await auth.authStateReady();
        return { app, authM, fsM, auth, db };
      })();
      ready.catch(() => { ready = null; }); // allow a retry after a network failure
    }
    return ready;
  }

  let storageReady = null;
  function storage() {
    if (!storageReady) {
      storageReady = (async () => {
        const f = await fb();
        const stM = await import(`${SDK}/firebase-storage.js`);
        const st = stM.getStorage(f.app);
        if (OCFG.emulator && OCFG.emulator.storage) {
          const [host, port] = OCFG.emulator.storage.split(":");
          stM.connectStorageEmulator(st, host, +port);
        }
        return { ...f, stM, st };
      })();
      storageReady.catch(() => { storageReady = null; });
    }
    return storageReady;
  }

  const fromDoc = (snap) => {
    const d = snap.data({ serverTimestamps: "estimate" });
    const ts = (t) => (t && t.toMillis ? t.toMillis() : t);
    return { ...d, id: snap.id, createdAt: ts(d.createdAt) || d.at, statusAt: ts(d.statusAt) || ts(d.createdAt) || d.at };
  };

  /* ---------------- customer ---------------- */
  async function ensureCustomer() {
    const f = await fb();
    if (!f.auth.currentUser) await f.authM.signInAnonymously(f.auth);
    return f;
  }

  /** Send a new order. Returns the stored order (with its id and code). */
  async function placeOrder(order) {
    const f = await ensureCustomer();
    const data = clean({ ...order, uid: f.auth.currentUser.uid, code: newCode(order.type), status: "new", at: Date.now() });
    const ref = await f.fsM.addDoc(f.fsM.collection(f.db, "orders"), { ...data, createdAt: f.fsM.serverTimestamp() });
    return { ...data, id: ref.id, createdAt: data.at };
  }

  /** Follow one order's status. Returns an unsubscribe function. */
  function watchOrder(id, onChange, onError) {
    let unsub = () => {};
    let stopped = false;
    ensureCustomer().then((f) => {
      if (stopped) return;
      unsub = f.fsM.onSnapshot(f.fsM.doc(f.db, "orders", id),
        (snap) => snap.exists() && onChange(fromDoc(snap)),
        (err) => onError && onError(err));
    }).catch((err) => onError && onError(err));
    return () => { stopped = true; unsub(); };
  }

  /* ---------------- staff ---------------- */
  async function staffSignIn(email, password) {
    const f = await fb();
    if (f.auth.currentUser && f.auth.currentUser.isAnonymous) await f.authM.signOut(f.auth);
    await f.authM.signInWithEmailAndPassword(f.auth, email.trim(), password);
    return f.auth.currentUser;
  }
  async function staffSignOut() { const f = await fb(); await f.authM.signOut(f.auth); }
  async function onStaffAuth(cb) {
    const f = await fb();
    return f.authM.onAuthStateChanged(f.auth, (u) => cb(u && !u.isAnonymous ? u : null));
  }

  /**
   * Stream orders from the last `hours`. cb(orders, changes, isFirstSnapshot),
   * where changes = [{ type: "added" | "modified" | "removed", order }].
   */
  function watchOrders(cb, onError, hours = 18) {
    let unsub = () => {};
    let stopped = false;
    let first = true;
    fb().then((f) => {
      if (stopped) return;
      const since = f.fsM.Timestamp.fromMillis(Date.now() - hours * 3600e3);
      const q = f.fsM.query(f.fsM.collection(f.db, "orders"), f.fsM.where("createdAt", ">=", since), f.fsM.orderBy("createdAt"));
      unsub = f.fsM.onSnapshot(q, (snap) => {
        const changes = snap.docChanges().map((c) => ({ type: c.type, order: fromDoc(c.doc) }));
        cb(snap.docs.map(fromDoc), changes, first);
        first = false;
      }, (err) => onError && onError(err));
    }).catch((err) => onError && onError(err));
    return () => { stopped = true; unsub(); };
  }

  async function setStatus(order, status, extra = {}) {
    const f = await fb();
    await f.fsM.updateDoc(f.fsM.doc(f.db, "orders", order.id), clean({ status, ...extra, statusAt: Date.now() }));
  }


  /* ---------------- live menu (staff edits) ---------------- */
  const LIVE_CACHE = "therapy-live-menu-v1";

  // Decode Firestore REST values ({ stringValue: "x" } → "x", …).
  function decode(v) {
    if (!v || typeof v !== "object") return undefined;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("nullValue" in v) return null;
    if ("timestampValue" in v) return Date.parse(v.timestampValue);
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
    if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
    return undefined;
  }

  /** Last known staff edits, instantly from this device (may be null). */
  function cachedLiveMenu() {
    try { return JSON.parse(localStorage.getItem(LIVE_CACHE)); } catch { return null; }
  }

  /**
   * Fetch staff edits for customers with one small REST call (no SDK needed).
   * Resolves to { items, custom } — empty if nothing has been edited yet.
   */
  async function fetchLiveMenu() {
    if (!configured) return null;
    const base = OCFG.emulator ? `http://${OCFG.emulator.firestore}` : "https://firestore.googleapis.com";
    const url = `${base}/v1/projects/${FB.projectId}/databases/(default)/documents/menu/live?key=${FB.apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    let data = { items: {}, custom: {} };
    if (res.ok) {
      const doc = await res.json();
      data = decode({ mapValue: { fields: doc.fields || {} } });
    } else if (res.status !== 404) {
      throw new Error(`menu ${res.status}`);
    }
    data = { items: data.items || {}, custom: data.custom || {} };
    try { localStorage.setItem(LIVE_CACHE, JSON.stringify(data)); } catch { /* ignore */ }
    return data;
  }


  /** Apply staff edits to a copy of the base menu (menu.js). Hidden items are kept but flagged. */
  function mergeMenu(base, live) {
    const L = live || {};
    const items = L.items || {};
    const apply = (it, ov) => {
      const item = { ...it, tags: it.tags ? [...it.tags] : [], options: it.options && it.options.map((g) => ({ ...g, choices: g.choices.map((c) => ({ ...c })) })) };
      if (!ov) return item;
      ["name", "desc", "diet", "image"].forEach((k) => { if (typeof ov[k] === "string" && ov[k]) item[k] = ov[k]; });
      if (typeof ov.price === "number" && ov.price >= 0) item.price = ov.price;
      if (Array.isArray(ov.tags)) item.tags = ov.tags.filter((t) => typeof t === "string");
      if (ov.optionPrices && item.options) {
        item.options.forEach((g) => g.choices.forEach((c) => { if (typeof ov.optionPrices[c.name] === "number") c.price = ov.optionPrices[c.name]; }));
        // The base price is the cheapest choice, so "from ₹…" stays right.
        const priced = item.options.flatMap((g) => g.choices).filter((c) => c.price != null).map((c) => c.price);
        if (priced.length) item.price = Math.min(...priced);
      }
      item.soldOut = !!ov.soldOut;
      item.hidden = !!ov.hidden;
      item.edited = true;
      return item;
    };
    const menu = base.map((cat) => ({ ...cat, items: cat.items.map((it) => apply(it, items[it.id])) }));
    Object.entries(L.custom || {})
      .sort((a, b) => (a[1].at || 0) - (b[1].at || 0))
      .forEach(([id, c]) => {
        const cat = menu.find((x) => x.id === c.cat);
        if (!cat || !c.name || typeof c.price !== "number") return;
        cat.items.push({
          id, name: c.name, desc: c.desc || "", price: c.price, diet: c.diet || "veg",
          tags: Array.isArray(c.tags) ? c.tags : [], image: c.image || undefined, emoji: c.emoji || undefined,
          soldOut: !!c.soldOut, hidden: !!c.hidden, custom: true,
        });
      });
    return menu;
  }

  /** Staff: live stream of menu/live. */
  function watchLiveMenu(cb, onError) {
    let unsub = () => {};
    let stopped = false;
    fb().then((f) => {
      if (stopped) return;
      unsub = f.fsM.onSnapshot(f.fsM.doc(f.db, "menu", "live"),
        (snap) => { const d = snap.exists() ? snap.data() : {}; cb({ items: d.items || {}, custom: d.custom || {} }); },
        (err) => onError && onError(err));
    }).catch((err) => onError && onError(err));
    return () => { stopped = true; unsub(); };
  }

  /**
   * Staff: change fields of one item. scope is "items" (edits to a menu.js
   * dish) or "custom" (a dish added by staff). A value of null removes the
   * field (i.e. back to the original).
   */
  async function saveMenuFields(scope, id, fields) {
    const f = await fb();
    const ref = f.fsM.doc(f.db, "menu", "live");
    const args = [];
    Object.entries(fields).forEach(([k, v]) => {
      args.push(new f.fsM.FieldPath(scope, id, k), v === null || v === undefined ? f.fsM.deleteField() : v);
    });
    args.push("updatedAt", f.fsM.serverTimestamp());
    try {
      await f.fsM.updateDoc(ref, ...args);
    } catch (err) {
      if (!String(err.code).includes("not-found")) throw err;
      await f.fsM.setDoc(ref, { items: {}, custom: {}, updatedAt: f.fsM.serverTimestamp() });
      await f.fsM.updateDoc(ref, ...args);
    }
  }

  /** Staff: remove a whole entry (reset a dish, or delete an added dish). */
  async function removeMenuEntry(scope, id) {
    const f = await fb();
    await f.fsM.updateDoc(f.fsM.doc(f.db, "menu", "live"), new f.fsM.FieldPath(scope, id), f.fsM.deleteField(), "updatedAt", f.fsM.serverTimestamp());
  }

  /** Staff: upload a (already compressed) photo; resolves to its public URL. */
  async function uploadMenuImage(itemId, blob) {
    const s = await storage();
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const ref = s.stM.ref(s.st, `menu/${itemId}/${Date.now()}.${ext}`);
    await s.stM.uploadBytes(ref, blob, { contentType: blob.type, cacheControl: "public, max-age=31536000, immutable" });
    return s.stM.getDownloadURL(ref);
  }

  /** Staff: best-effort delete of a photo we uploaded earlier. */
  async function deleteMenuImage(url) {
    if (!url || !/firebasestorage|127\.0\.0\.1|localhost/.test(url)) return;
    try { const s = await storage(); await s.stM.deleteObject(s.stM.ref(s.st, url)); } catch { /* already gone */ }
  }

  /** Is the signed-in staff member allowed to use Storage? (bucket configured) */
  const photosEnabled = !!FB.storageBucket;

  /* ---------------- optional phone alerts via ntfy ---------------- */
  // Sent by the staff desk (one device), so it counts against the cafe's own
  // internet connection's quota, not a shared mobile-network one.
  const PA = OCFG.phoneAlerts || {};
  async function phoneAlert(body) {
    if (!PA.topic) return;
    const server = (PA.server || "https://ntfy.sh").replace(/\/$/, "");
    const res = await fetch(`${server}/`, { method: "POST", body: JSON.stringify({ topic: PA.topic, ...body }) });
    if (!res.ok) throw new Error(`ntfy ${res.status}`);
  }

  /** Short, human text for Firebase / network errors. */
  function explain(err) {
    const code = (err && err.code) || "";
    if (code.includes("permission-denied")) return "permission denied";
    if (code.includes("unavailable") || code.includes("network")) return "no connection";
    if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("user-not-found") || code.includes("invalid-email")) return "wrong email or password";
    if (code.includes("admin-restricted-operation") || code.includes("operation-not-allowed")) return "sign-in method not enabled in Firebase";
    if (code.includes("too-many-requests")) return "too many attempts, wait a minute";
    if (code.includes("storage/unauthorized")) return "photo upload not allowed (check storage rules)";
    if (code.includes("storage/") || code.includes("no-default-bucket")) return "photo storage isn't set up yet";
    return (err && (err.code || err.message)) || "unknown error";
  }

  return {
    enabled: !!(OCFG.enabled && configured),
    configured,
    config: OCFG,
    STATUS,
    placeOrder,
    watchOrder,
    staffSignIn,
    staffSignOut,
    onStaffAuth,
    watchOrders,
    setStatus,
    phoneAlert,
    phoneAlertsTopic: PA.topic || "",
    explain,
    mergeMenu,
    cachedLiveMenu,
    fetchLiveMenu,
    watchLiveMenu,
    saveMenuFields,
    removeMenuEntry,
    uploadMenuImage,
    deleteMenuImage,
    photosEnabled,
  };
})();
