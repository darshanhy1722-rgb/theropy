(() => {
  "use strict";

  const CFG = window.THERAPY_CONFIG;
  const O = window.TherapyOrders;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => `${CFG.currency}${Number(n || 0).toLocaleString("en-IN")}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- state ---------------- */
  // Orders keyed by their secret key: { ...order, status, statusAt, eta, reason }
  const STORE = "therapy-staff-orders-v1";
  let orders = {};
  try { orders = JSON.parse(localStorage.getItem(STORE)) || {}; } catch { orders = {}; }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(orders)); } catch { /* ignore */ } };
  const DAY = 24 * 3600e3;
  Object.keys(orders).forEach((k) => { if (Date.now() - orders[k].at > DAY) delete orders[k]; });

  let filter = "all";
  let soundOn = true;
  let started = false;
  let initialLoad = true;

  /* ---------------- events from the channel ---------------- */
  function applyEvent(ev) {
    if (ev.kind === "order" && ev.order && ev.order.key && Array.isArray(ev.order.lines)) {
      if (orders[ev.order.key]) return false;
      orders[ev.order.key] = { ...ev.order, status: "new", statusAt: ev.order.at };
      return "new";
    }
    if (ev.kind === "status" && orders[ev.key] && O.STATUS[ev.status]) {
      const o = orders[ev.key];
      if (ev.at && ev.at < o.statusAt) return false;
      Object.assign(o, { status: ev.status, statusAt: ev.at || Date.now(), eta: ev.eta ?? o.eta, reason: ev.reason });
      return "status";
    }
    return false;
  }

  let renderQueued = false;
  function onMessage(msg) {
    let ev;
    try { ev = JSON.parse(msg.message); } catch { return; }
    const result = applyEvent(ev);
    if (!result) return;
    save();
    // Only ring for orders that arrive live (not the history replay on page load),
    // and only if they're recent.
    if (result === "new" && !initialLoad && Date.now() - ev.order.at < 10 * 60e3) announce(ev.order);
    if (!renderQueued) { renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
  }

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

  function actions(o) {
    const k = esc(o.key);
    if (o.status === "new") {
      const etas = (O.config.etaChoices || [10, 15, 20]).map((m) =>
        `<button class="eta" data-act="accept" data-k="${k}" data-eta="${m}">${m}′</button>`).join("");
      return `<div class="accept-row"><span>Accept · ready in (minutes)</span><div>${etas}</div></div>
              <button class="btn-reject" data-act="reject" data-k="${k}">Cancel order</button>`;
    }
    if (o.status === "preparing") {
      return `<button class="big-act ready" data-act="ready" data-k="${k}">✅ Mark ready</button>`;
    }
    if (o.status === "ready") {
      return `<button class="big-act done" data-act="completed" data-k="${k}">${o.type === "dinein" ? "Served" : "Collected"} ✓</button>`;
    }
    return "";
  }

  function timer(o) {
    if (o.status !== "preparing" || !o.eta) return "";
    const left = Math.round((o.statusAt + o.eta * 60e3 - Date.now()) / 60e3);
    return `<span class="timer ${left < 0 ? "late" : ""}">${left >= 0 ? `⏱ ${left} min left` : `⏱ ${-left} min late`}</span>`;
  }

  function card(o) {
    const count = o.lines.reduce((n, l) => n + l.q, 0);
    return `<article class="ocard s-${o.status} ${o.status === "new" ? "flash" : ""}" data-key="${esc(o.key)}">
      <header>
        <span class="code">${esc(o.code)}</span>
        ${where(o)}
        <span class="age" data-at="${o.at}">${ago(o.at)}</span>
      </header>
      <ul class="lines">
        ${o.lines.map((l) => `<li><b class="q">${l.q}×</b><span>${l.d ? `<i class="dot ${esc(l.d)}"></i>` : ""}${esc(l.n)}${l.o ? `<em>${esc(l.o)}</em>` : ""}</span></li>`).join("")}
      </ul>
      ${o.note ? `<p class="note">📝 ${esc(o.note)}</p>` : ""}
      <div class="meta"><span>${count} item${count > 1 ? "s" : ""} · <b>${money(o.total)}</b> · pay at counter</span>${timer(o)}</div>
      <div class="acts">${actions(o)}</div>
    </article>`;
  }

  function render() {
    const list = Object.values(orders)
      .filter((o) => filter === "all" || o.type === filter)
      .sort((a, b) => a.at - b.at);
    const by = (s) => list.filter((o) => o.status === s);
    const fill = (id, arr, empty) => { $(id).innerHTML = arr.length ? arr.map(card).join("") : `<p class="col-empty">${empty}</p>`; };
    fill("#colNew", by("new"), "No new orders. Waiting… ☕");
    fill("#colPreparing", by("preparing"), "Nothing in the kitchen.");
    fill("#colReady", by("ready"), "Nothing waiting for pickup.");
    const done = list.filter((o) => o.status === "completed" || o.status === "rejected").sort((a, b) => b.statusAt - a.statusAt);
    $("#colDone").innerHTML = done.map((o) => `<div class="hrow ${o.status}">
        <b>${esc(o.code)}</b><span>${o.type === "dinein" ? `Table ${esc(o.table)}` : esc(o.name)}</span>
        <span>${o.lines.reduce((n, l) => n + l.q, 0)} items</span><span>${money(o.total)}</span>
        <span class="hstat">${o.status === "rejected" ? `Cancelled${o.reason ? ` · ${esc(o.reason)}` : ""}` : "Done"}</span>
        <span class="htime">${new Date(o.statusAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      </div>`).join("") || `<p class="col-empty">Nothing yet today.</p>`;

    $("#countNew").textContent = by("new").length;
    $("#countPreparing").textContent = by("preparing").length;
    $("#countReady").textContent = by("ready").length;
    $("#countDone").textContent = done.length;

    const all = Object.values(orders);
    const today = all.filter((o) => new Date(o.at).toDateString() === new Date().toDateString());
    $("#statActive").textContent = all.filter((o) => ["new", "preparing", "ready"].includes(o.status)).length;
    $("#statToday").textContent = today.filter((o) => o.status !== "rejected").length;
    $("#statSales").textContent = money(today.filter((o) => o.status !== "rejected").reduce((n, o) => n + o.total, 0));

    const pending = all.filter((o) => o.status === "new").length;
    document.title = pending ? `(${pending}) New order${pending > 1 ? "s" : ""} · Therapy` : "Therapy — Orders (Staff)";
  }

  // Keep "x min ago" and timers fresh.
  setInterval(render, 30e3);

  /* ---------------- actions ---------------- */
  async function change(key, status, extra = {}) {
    const o = orders[key];
    if (!o) return;
    const prev = { status: o.status, statusAt: o.statusAt, eta: o.eta, reason: o.reason };
    Object.assign(o, { status, statusAt: Date.now(), ...extra });
    save(); render();
    try {
      await O.setStatus(o, status, extra);
    } catch {
      Object.assign(o, prev); save(); render();
      toast("⚠️ Couldn't send update — check the internet and try again");
    }
  }

  let rejectKey = null;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const key = b.dataset.k;
    const act = b.dataset.act;
    if (act === "accept") change(key, "preparing", { eta: +b.dataset.eta });
    else if (act === "ready") change(key, "ready");
    else if (act === "completed") change(key, "completed");
    else if (act === "reject") {
      rejectKey = key;
      $("#rejectCode").textContent = orders[key].code;
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
    if (rejectKey) change(rejectKey, "rejected", reason ? { reason } : {});
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
    const w = order.type === "dinein" ? `Table ${order.table}` : `Takeaway · ${order.name}`;
    toast(`🛎 New order ${order.code} · ${w}`);
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try { new Notification(`New order ${order.code}`, { body: `${w} · ${money(order.total)}`, tag: order.code, requireInteraction: true }); } catch { /* ignore */ }
    }
  }

  // Keep ringing every 20s while any order is still waiting to be accepted.
  setInterval(() => {
    if (Object.values(orders).some((o) => o.status === "new" && Date.now() - o.at < 30 * 60e3)) chime();
  }, 20e3);

  $("#soundBtn").addEventListener("click", (e) => {
    soundOn = !soundOn;
    e.currentTarget.textContent = soundOn ? "🔔" : "🔕";
    e.currentTarget.setAttribute("aria-pressed", soundOn);
    if (soundOn) chime();
  });

  let wakeLock = null;
  async function keepAwake() {
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch { /* unsupported */ }
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

  /* ---------------- setup / start ---------------- */
  const startSheet = $("#startSheet");
  $("#topicName").textContent = O.topics.alerts;
  $("#tableLink").textContent = new URL("./?table=5", location.href).href;
  $("#copyTopic").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(O.topics.alerts); toast("Topic copied"); } catch { toast(O.topics.alerts); }
  });
  $("#testBtn").addEventListener("click", async () => {
    try {
      await O.publish(O.topics.alerts, { title: "✅ Therapy order alerts are working", message: "You'll get a notification like this for every new order.", tags: ["white_check_mark"], priority: 4 });
      toast("Test alert sent — check the ntfy app");
    } catch { toast("⚠️ Couldn't send — check the internet connection"); }
  });
  $("#setupBtn").addEventListener("click", () => startSheet.showModal());
  $("#startBtn").addEventListener("click", async () => {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); await audioCtx.resume(); } catch { /* no audio */ }
    if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch { /* ignore */ } }
    started = true;
    keepAwake();
    chime();
    startSheet.close();
    $("#startBtn").textContent = "Done";
  });

  /* ---------------- connect ---------------- */
  function setConn(state) {
    const el = $("#conn");
    el.dataset.state = state;
    $("span", el).textContent = state === "live" ? "Live" : state === "reconnecting" ? "Reconnecting…" : "Connecting…";
  }

  if (!O.enabled) {
    document.body.innerHTML = `<p style="padding:40px;text-align:center">Online ordering is turned off in <code>menu.js</code> (THERAPY_CONFIG.orders).</p>`;
    return;
  }

  render();
  O.subscribe(O.topics.data, onMessage, { since: "12h", onStatus: setConn });
  // The history replay arrives in a burst right after connecting; after that, orders are live.
  setTimeout(() => { initialLoad = false; }, 2500);
  startSheet.showModal();
})();
