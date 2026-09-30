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
        return { authM, fsM, auth, db };
      })();
      ready.catch(() => { ready = null; }); // allow a retry after a network failure
    }
    return ready;
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
  };
})();
