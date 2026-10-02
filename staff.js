(() => {
  "use strict";

  const CFG = window.THERAPY_CONFIG;
  const O = window.TherapyOrders;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => `${CFG.currency}${Number(n || 0).toLocaleString("en-IN")}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- state ---------------- */
  let orders = {};        // id -> order (live from Firestore)
  let filter = "all";
  let soundOn = true;
  let started = false;
  let stopWatch = null;
  const FWD_KEY = "therapy-forward-alerts";
  let forwardAlerts = false;
  try { forwardAlerts = localStorage.getItem(FWD_KEY) === "1"; } catch { /* ignore */ }

  /* ---------------- rendering ---------------- */
  const ago = (t) => {
    const m = Math.floor((Date.now() - t) / 60e3);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  const where = (o) => o.type === "dinein"
    ? `<span class="where dinein">🍽️ Table <b>${esc(o.table)}</b></span>`
    : `<span class="where takeaway">🛍️ Takeaway · <b>${esc(o.name)}</b></span>`;
  const whereText = (o) => (o.type === "dinein" ? `Table ${o.table}` : `Takeaway · ${o.name}`);

  function actions(o) {
    const id = esc(o.id);
    if (o.status === "new") {
      const etas = (O.config.etaChoices || [10, 15, 20]).map((m) =>
        `<button class="eta" data-act="accept" data-id="${id}" data-eta="${m}">${m}′</button>`).join("");
      return `<div class="accept-row"><span>Accept · ready in (minutes)</span><div>${etas}</div></div>
              <button class="btn-reject" data-act="reject" data-id="${id}">Cancel order</button>`;
    }
    if (o.status === "preparing") return `<button class="big-act ready" data-act="ready" data-id="${id}">✅ Mark ready</button>`;
    if (o.status === "ready") return `<button class="big-act done" data-act="completed" data-id="${id}">${o.type === "dinein" ? "Served" : "Collected"} ✓</button>`;
    return "";
  }

  function timer(o) {
    if (o.status !== "preparing" || !o.eta) return "";
    const left = Math.round((o.statusAt + o.eta * 60e3 - Date.now()) / 60e3);
    return `<span class="timer ${left < 0 ? "late" : ""}">${left >= 0 ? `⏱ ${left} min left` : `⏱ ${-left} min late`}</span>`;
  }

  const lines = (o) => (Array.isArray(o.lines) ? o.lines : []);
  const itemCount = (o) => lines(o).reduce((n, l) => n + (+l.q || 0), 0);

  function card(o) {
    const count = itemCount(o);
    return `<article class="ocard s-${esc(o.status)} ${o.status === "new" ? "flash" : ""}">
      <header>
        <span class="code">${esc(o.code)}</span>
        ${where(o)}
        <span class="age">${ago(o.createdAt)}</span>
      </header>
      <ul class="lines">
        ${lines(o).map((l) => `<li><b class="q">${esc(l.q)}×</b><span>${l.d ? `<i class="dot ${esc(l.d)}"></i>` : ""}${esc(l.n)}${l.o ? `<em>${esc(l.o)}</em>` : ""}</span></li>`).join("")}
      </ul>
      ${o.note ? `<p class="note">📝 ${esc(o.note)}</p>` : ""}
      <div class="meta"><span>${count} item${count === 1 ? "" : "s"} · <b>${money(o.total)}</b> · pay at counter</span>${timer(o)}</div>
      <div class="acts">${actions(o)}</div>
    </article>`;
  }

  function render() {
    const list = Object.values(orders)
      .filter((o) => filter === "all" || o.type === filter)
      .sort((a, b) => a.createdAt - b.createdAt);
    const by = (s) => list.filter((o) => o.status === s);
    const fill = (id, arr, empty) => { $(id).innerHTML = arr.length ? arr.map(card).join("") : `<p class="col-empty">${empty}</p>`; };
    fill("#colNew", by("new"), "No new orders. Waiting… ☕");
    fill("#colPreparing", by("preparing"), "Nothing in the kitchen.");
    fill("#colReady", by("ready"), "Nothing waiting for pickup.");
    const done = list.filter((o) => o.status === "completed" || o.status === "rejected").sort((a, b) => b.statusAt - a.statusAt);
    $("#colDone").innerHTML = done.map((o) => `<div class="hrow ${esc(o.status)}">
        <b>${esc(o.code)}</b><span>${o.type === "dinein" ? `Table ${esc(o.table)}` : esc(o.name)}</span>
        <span>${itemCount(o)} items</span><span>${money(o.total)}</span>
        <span class="hstat">${o.status === "rejected" ? `Cancelled${o.reason ? ` · ${esc(o.reason)}` : ""}` : "Done"}</span>
        <span class="htime">${new Date(o.statusAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      </div>`).join("") || `<p class="col-empty">Nothing yet today.</p>`;

    $("#countNew").textContent = by("new").length;
    $("#countPreparing").textContent = by("preparing").length;
    $("#countReady").textContent = by("ready").length;
    $("#countDone").textContent = done.length;

    const all = Object.values(orders);
    const today = all.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString() && o.status !== "rejected");
    $("#statActive").textContent = all.filter((o) => ["new", "preparing", "ready"].includes(o.status)).length;
    $("#statToday").textContent = today.length;
    $("#statSales").textContent = money(today.reduce((n, o) => n + (+o.total || 0), 0));

    const pending = all.filter((o) => o.status === "new").length;
    document.title = pending ? `(${pending}) New order${pending > 1 ? "s" : ""} · Therapy` : "Therapy — Orders (Staff)";
  }
  setInterval(render, 30e3); // keep "x min ago" and timers fresh

  /* ---------------- live orders ---------------- */
  function startWatching() {
    stopWatch && stopWatch();
    setConn("connecting");
    stopWatch = O.watchOrders((list, changes, first) => {
      setConn("live");
      orders = Object.fromEntries(list.map((o) => [o.id, o]));
      if (!first) changes.filter((c) => c.type === "added" && c.order.status === "new").forEach((c) => announce(c.order));
      render();
    }, (err) => {
      setConn("reconnecting");
      if (O.explain(err) === "permission denied") {
        toast("⚠️ This account isn't on the staff list (firestore.rules)");
      }
    });
  }

  /* ---------------- actions ---------------- */
  async function change(id, status, extra = {}) {
    const o = orders[id];
    if (!o) return;
    try {
      await O.setStatus(o, status, extra);
    } catch (err) {
      toast(`⚠️ Couldn't update ${o.code} (${O.explain(err)})`);
    }
  }

  let rejectId = null;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.dataset.id;
    const act = b.dataset.act;
    if (act === "accept") change(id, "preparing", { eta: +b.dataset.eta });
    else if (act === "ready") change(id, "ready");
    else if (act === "completed") change(id, "completed");
    else if (act === "reject") {
      rejectId = id;
      $("#rejectCode").textContent = orders[id].code;
      $("#rejectReason").value = "";
      $("#rejectSheet").showModal();
    }
  });
  $("#reasonList").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (c) $("#rejectReason").value = c.textContent;
  });
  $("#rejectConfirm").addEventListener("click", () => {
    const reason = $("#rejectReason").value.trim();
    $("#rejectSheet").close();
    if (rejectId) change(rejectId, "rejected", reason ? { reason } : {});
  });

  $$(".s-filter .chip").forEach((c) => c.addEventListener("click", () => {
    $$(".s-filter .chip").forEach((x) => x.classList.toggle("is-active", x === c));
    filter = c.dataset.f;
    render();
  }));

  /* ---------------- alerts ---------------- */
  let audioCtx = null;
  function chime() {
    if (!soundOn || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    [659, 880, 1319].forEach((f, i) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = "triangle"; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      const t = t0 + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.start(t); o.stop(t + 0.5);
    });
  }

  function announce(order) {
    chime();
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    toast(`🛎 New order ${order.code} · ${whereText(order)}`);
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try { new Notification(`New order ${order.code}`, { body: `${whereText(order)} · ${money(order.total)}`, tag: order.code, requireInteraction: true }); } catch { /* ignore */ }
    }
    if (forwardAlerts && O.phoneAlertsTopic) {
      const items = lines(order).map((l) => `${l.q} × ${l.n}${l.o ? ` (${l.o})` : ""}`).join("\n");
      O.phoneAlert({
        title: `🛎 New order ${order.code} · ${whereText(order)}`,
        message: `${items}${order.note ? `\n📝 ${order.note}` : ""}\n\nTotal ₹${order.total}`,
        tags: ["cake"],
        priority: 5,
        click: location.href.split("#")[0],
      }).catch(() => toast("⚠️ Phone alert failed (ntfy)"));
    }
  }

  // Keep ringing every 20s while an order is still waiting to be accepted.
  setInterval(() => {
    if (Object.values(orders).some((o) => o.status === "new" && Date.now() - o.createdAt < 30 * 60e3)) chime();
  }, 20e3);

  $("#soundBtn").addEventListener("click", (e) => {
    soundOn = !soundOn;
    e.currentTarget.textContent = soundOn ? "🔔" : "🔕";
    e.currentTarget.setAttribute("aria-pressed", soundOn);
    if (soundOn) chime();
  });

  async function keepAwake() {
    try { await navigator.wakeLock.request("screen"); } catch { /* unsupported */ }
  }
  document.addEventListener("visibilitychange", () => { if (started && !document.hidden) keepAwake(); });

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 4000);
  }

  function setConn(state) {
    const el = $("#conn");
    el.dataset.state = state;
    $("span", el).textContent = { live: "Live", reconnecting: "Reconnecting…", connecting: "Connecting…", off: "Signed out" }[state];
  }

  /* ---------------- start / login ---------------- */
  const startSheet = $("#startSheet");

  async function unlockAlerts() {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); await audioCtx.resume(); } catch { /* no audio */ }
    if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch { /* ignore */ } }
    started = true;
    keepAwake();
    chime();
  }

  function showSignedIn(user) {
    $("#loginForm").hidden = !!user;
    $("#signedIn").hidden = !user;
    $("#startFoot").hidden = !user;
    if (user) $("#whoEmail").textContent = user.email;
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const err = $("#loginError");
    const btn = $("#loginBtn");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Signing in…";
    unlockAlerts(); // needs this tap to allow sound later
    try {
      await O.staffSignIn(form.email.value, form.password.value);
      form.password.value = "";
      startSheet.close();
    } catch (ex) {
      err.textContent = `Couldn't sign in: ${O.explain(ex)}`;
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in & start";
    }
  });
  $("#startBtn").addEventListener("click", async () => { await unlockAlerts(); startSheet.close(); });
  $("#setupBtn").addEventListener("click", () => startSheet.showModal());
  $("#signOutBtn").addEventListener("click", () => O.staffSignOut());

  // phone alerts (optional)
  $("#alertsSetup").hidden = !O.phoneAlertsTopic;
  $("#topicName").textContent = O.phoneAlertsTopic;
  $("#forwardToggle").checked = forwardAlerts;
  $("#forwardToggle").addEventListener("change", (e) => {
    forwardAlerts = e.target.checked;
    try { localStorage.setItem(FWD_KEY, forwardAlerts ? "1" : "0"); } catch { /* ignore */ }
  });
  $("#copyTopic").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(O.phoneAlertsTopic); toast("Topic copied"); } catch { toast(O.phoneAlertsTopic); }
  });
  $("#testBtn").addEventListener("click", async () => {
    try {
      await O.phoneAlert({ title: "✅ Therapy order alerts are working", message: "You'll get a notification like this for every new order.", tags: ["white_check_mark"], priority: 4 });
      toast("Test alert sent — check the ntfy app");
    } catch (ex) { toast(`⚠️ Couldn't send (${ex.message})`); }
  });
  $("#tableLink").textContent = new URL("./?table=5", location.href).href;

  /* ---------------- boot ---------------- */
  render();
  if (!O.configured) {
    $("#needSetup").hidden = false;
    setConn("off");
    startSheet.showModal();
    return;
  }
  O.onStaffAuth((user) => {
    showSignedIn(user);
    if (user) {
      startWatching();
    } else {
      stopWatch && stopWatch();
      stopWatch = null;
      orders = {};
      render();
      setConn("off");
      if (!startSheet.open) startSheet.showModal();
    }
  }).catch((err) => {
    setConn("reconnecting");
    toast(`⚠️ Couldn't load Firebase (${O.explain(err)})`);
  });
  startSheet.showModal();
})();
