(() => {
  "use strict";

  const CFG = window.THERAPY_CONFIG;
  const ORDERS = window.TherapyOrders || { enabled: false };
  const MENU = window.THERAPY_MENU;
  // Pristine copy of menu.js; staff edits (prices, sold out…) are layered on top.
  const BASE_MENU = JSON.parse(JSON.stringify(MENU));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => `${CFG.currency}${n.toLocaleString("en-IN")}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DIET_LABEL = { veg: "Vegetarian", egg: "Contains egg", nonveg: "Non-vegetarian" };
  const TAG_LABEL = { signature: "Signature", bestseller: "Bestseller", new: "New", seasonal: "Seasonal", spicy: "🌶 Spicy" };

  // Flat lookup: item id -> { item, cat }
  const INDEX = new Map();
  let liveKey = "";
  function applyLive(live) {
    if (ORDERS.mergeMenu && live) {
      const merged = ORDERS.mergeMenu(BASE_MENU, live);
      MENU.forEach((cat, i) => { cat.items = merged[i].items.filter((it) => !it.hidden); });
    }
    liveKey = JSON.stringify(live || null);
    INDEX.clear();
    MENU.forEach((cat) => cat.items.forEach((item) => INDEX.set(item.id, { item, cat })));
  }
  applyLive(ORDERS.cachedLiveMenu ? ORDERS.cachedLiveMenu() : null);

  /* ---------------- storage ---------------- */
  const STORE_KEY = "therapy-order-v1";
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
    },
    save(data) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
    },
  };

  /* ---------------- cart ---------------- */
  // line key = itemId|choice1|choice2  ->  { id, choices: [], qty }
  let cart = store.load();
  // Drop lines whose items are no longer on the menu or are sold out.
  function pruneCart() {
    const removed = [];
    Object.keys(cart).forEach((k) => {
      const hit = INDEX.get(cart[k].id);
      if (!hit || hit.item.soldOut) { removed.push(hit ? hit.item.name : "An item"); delete cart[k]; }
    });
    if (removed.length) store.save(cart);
    return removed;
  }
  pruneCart();

  const unitPrice = (item, choices = []) => {
    let price = item.price;
    (item.options || []).forEach((group, gi) => {
      const choice = group.choices.find((c) => c.name === choices[gi]);
      if (choice && choice.price != null) price = choice.price;
    });
    return price;
  };
  const lineKey = (id, choices) => [id, ...choices].join("|");
  const qtyOfItem = (id) => Object.values(cart).reduce((n, l) => n + (l.id === id ? l.qty : 0), 0);
  const cartCount = () => Object.values(cart).reduce((n, l) => n + l.qty, 0);
  const cartTotal = () => Object.values(cart).reduce((n, l) => n + l.qty * unitPrice(INDEX.get(l.id).item, l.choices), 0);

  function addLine(id, choices, qty = 1) {
    const key = lineKey(id, choices);
    cart[key] = cart[key] || { id, choices, qty: 0 };
    cart[key].qty += qty;
    if (cart[key].qty <= 0) delete cart[key];
    store.save(cart);
    refreshCart();
  }
  function lastLineOf(id) {
    return Object.keys(cart).reverse().find((k) => cart[k].id === id);
  }

  /* ---------------- rendering helpers ---------------- */
  function visual(item, cat, extraClass = "") {
    const [h1, h2] = cat.hue;
    const style = `--h1:${h1};--h2:${h2}`;
    if (item.image) {
      return `<div class="visual has-img ${extraClass}" style="${style}"><img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" /></div>`;
    }
    return `<div class="visual ${extraClass}" style="${style}" aria-hidden="true"><span class="emoji">${item.emoji || cat.emoji}</span></div>`;
  }
  const dietDot = (diet) => `<i class="dot ${diet}" title="${DIET_LABEL[diet]}" aria-label="${DIET_LABEL[diet]}"></i>`;
  const tags = (item) => (item.tags || []).map((t) => `<span class="tag ${t}">${TAG_LABEL[t] || t}</span>`).join("");
  const priceText = (item) => {
    const prices = item.options ? item.options.flatMap((g) => g.choices.map((c) => c.price ?? item.price)) : [item.price];
    const min = Math.min(item.price, ...prices);
    const max = Math.max(item.price, ...prices);
    return min === max ? money(min) : `<small>from</small>${money(min)}`;
  };
  const catName = (cat) => cat.nav || `${cat.title} ${cat.script || ""}`.trim();
  const isLight = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
  };

  function ctaHTML(item) {
    if (item.soldOut) return `<span class="soldout-pill">Sold out</span>`;
    const q = qtyOfItem(item.id);
    if (item.options) {
      return `<button class="add-btn" data-open="${item.id}">${q ? `${q} ADDED +` : "ADD +"}</button>`;
    }
    if (!q) return `<button class="add-btn" data-add="${item.id}" aria-label="Add ${esc(item.name)}">ADD</button>`;
    return `<div class="stepper"><button data-dec="${item.id}" aria-label="Remove one ${esc(item.name)}">−</button><span>${q}</span><button data-add="${item.id}" aria-label="Add one more ${esc(item.name)}">+</button></div>`;
  }

  /* ---------------- render menu ---------------- */
  function renderMenu() {
    const root = $("#menuRoot");
    root.innerHTML = MENU.map((cat) => {
      const light = isLight(cat.hue[0]) && isLight(cat.hue[1]);
      return `
      <section class="category" id="cat-${cat.id}" data-cat="${cat.id}" aria-labelledby="h-${cat.id}">
        <header class="cat-banner ${light ? "light" : ""}" style="--h1:${cat.hue[0]};--h2:${cat.hue[1]}">
          <span class="cat-emoji" aria-hidden="true">${cat.emoji}</span>
          <div>
            <h2 id="h-${cat.id}">${esc(cat.title)}${cat.script ? `<span class="script"> ${esc(cat.script)}</span>` : ""}</h2>
            <p>${esc(cat.blurb)}</p>
          </div>
          <span class="count">${cat.items.length} ${cat.items.length === 1 ? "item" : "items"}</span>
        </header>
        <div class="items">
          ${cat.items.map((item, i) => `
            <article class="item ${item.soldOut ? "is-soldout" : ""}" data-item="${item.id}" style="animation-delay:${Math.min(i, 6) * 40}ms">
              <div class="item-main">
                <div class="item-top">${dietDot(item.diet)}${tags(item)}</div>
                <h3><a href="#${item.id}" data-open="${item.id}" style="text-decoration:none">${esc(item.name)}</a></h3>
                <p class="desc">${esc(item.desc)}</p>
                ${item.options ? `<p class="opts-hint">Customisable</p>` : ""}
                <div class="row">
                  <span class="price">${priceText(item)}</span>
                  <span class="item-cta" data-cta="${item.id}">${ctaHTML(item)}</span>
                </div>
              </div>
              <button class="visual-btn" data-open="${item.id}" aria-label="View details for ${esc(item.name)}" >
                ${visual(item, cat)}
              </button>
            </article>`).join("")}
        </div>
      </section>`;
    }).join("");

    $("#catNav").innerHTML = MENU.map((cat) =>
      `<a class="cat-link" href="#cat-${cat.id}" data-nav="${cat.id}"><span aria-hidden="true">${cat.emoji}</span>${esc(catName(cat))}</a>`
    ).join("");

    const sigs = MENU.flatMap((cat) => cat.items.filter((i) => (i.tags || []).includes("signature")).map((item) => ({ item, cat })));
    // Add one hero from the seasonal menu so the row always feels fresh.
    const seasonal = MENU.find((c) => c.id === "seasonal");
    if (seasonal) sigs.push(...seasonal.items.slice(0, 2).map((item) => ({ item, cat: seasonal })));
    $("#sigRow").innerHTML = sigs.map(({ item, cat }) => `
      <button class="sig-card" data-open="${item.id}">
        ${visual(item, cat)}
        <span class="price-medal sig-price">${item.options ? "<small>from</small>" : ""}${money(Math.min(item.price, ...(item.options || []).flatMap((g) => g.choices.map((c) => c.price ?? item.price))))}</span>
        <div class="sig-body">
          <p class="eyebrow" style="color:var(--gold-light);margin-bottom:4px">${esc(catName(cat))}</p>
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.desc)}</p>
        </div>
      </button>`).join("");

    $("#factItems").textContent = INDEX.size;
  }

  function refreshCTA(id) {
    const el = $(`[data-cta="${id}"]`);
    if (el) el.innerHTML = ctaHTML(INDEX.get(id).item);
  }

  /* ---------------- filters ---------------- */
  let dietFilter = "all";
  let query = "";
  function applyFilters() {
    const q = query.trim().toLowerCase();
    let any = false;
    MENU.forEach((cat) => {
      let visible = 0;
      cat.items.forEach((item) => {
        const hay = `${item.name} ${item.desc} ${catName(cat)} ${(item.options || []).flatMap((g) => g.choices.map((c) => c.name)).join(" ")}`.toLowerCase();
        const matchQ = !q || q.split(/\s+/).every((w) => hay.includes(w));
        const matchD = dietFilter === "all" || item.diet === dietFilter;
        const show = matchQ && matchD;
        $(`[data-item="${item.id}"]`).hidden = !show;
        if (show) visible++;
      });
      $(`#cat-${cat.id}`).hidden = !visible;
      $(`[data-nav="${cat.id}"]`).hidden = !visible;
      if (visible) any = true;
    });
    $("#emptyState").hidden = any;
  }

  /* ---------------- item sheet ---------------- */
  const sheet = $("#itemSheet");
  let sheetItem = null;
  let sheetQty = 1;

  function sheetChoices() {
    return (sheetItem.options || []).map((_, gi) => {
      const checked = $(`input[name="opt-${gi}"]:checked`, sheet);
      return checked ? checked.value : null;
    });
  }
  function updateSheetPrice() {
    const unit = unitPrice(sheetItem, sheetChoices());
    $("#qtyVal").textContent = sheetQty;
    $("#sheetAdd").disabled = !!sheetItem.soldOut;
    $("#sheetAdd").textContent = sheetItem.soldOut ? "Sold out today" : `Add ${sheetQty > 1 ? sheetQty + " " : ""}to order · ${money(unit * sheetQty)}`;
  }

  function openSheet(id) {
    if (!INDEX.has(id)) return;
    const { item, cat } = INDEX.get(id);
    sheetItem = item;
    sheetQty = 1;
    $("#sheetVisual").innerHTML = visual(item, cat);
    $("#sheetCat").textContent = catName(cat);
    $("#sheetTitle").textContent = item.name;
    $("#sheetBadges").innerHTML = `<span class="diet-label">${dietDot(item.diet)}${DIET_LABEL[item.diet]}</span>${tags(item)}`;
    $("#sheetDesc").textContent = item.desc;
    $("#sheetOptions").innerHTML = (item.options || []).map((group, gi) => `
      <div class="opt-group"><fieldset>
        <legend>${esc(group.label)}</legend>
        <div class="opt-list">
          ${group.choices.map((c, ci) => `
            <label><input type="radio" name="opt-${gi}" value="${esc(c.name)}" ${ci === 0 ? "checked" : ""} />
            <span>${esc(c.name)}${c.price != null ? ` <em>${money(c.price)}</em>` : ""}</span></label>`).join("")}
        </div>
      </fieldset></div>`).join("");
    updateSheetPrice();
    sheet.showModal();
    history.replaceState(null, "", `#${id}`);
  }

  sheet.addEventListener("change", updateSheetPrice);
  sheet.addEventListener("close", () => {
    if (location.hash === `#${sheetItem?.id}`) history.replaceState(null, "", location.pathname + location.search);
  });
  $("#qtyMinus").addEventListener("click", () => { sheetQty = Math.max(1, sheetQty - 1); updateSheetPrice(); });
  $("#qtyPlus").addEventListener("click", () => { sheetQty = Math.min(20, sheetQty + 1); updateSheetPrice(); });
  $("#sheetAdd").addEventListener("click", () => {
    if (sheetItem.soldOut) return;
    addLine(sheetItem.id, sheetChoices(), sheetQty);
    toast(`Added ${sheetQty} × ${sheetItem.name}`);
    sheet.close();
  });

  // Close dialogs when tapping the backdrop.
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  /* ---------------- cart drawer ---------------- */
  const cartSheet = $("#cartSheet");

  function orderText() {
    const lines = Object.values(cart).map((l) => {
      const { item } = INDEX.get(l.id);
      const opts = l.choices.filter(Boolean).join(", ");
      return `${l.qty} × ${item.name}${opts ? ` (${opts})` : ""} — ${money(l.qty * unitPrice(item, l.choices))}`;
    });
    return `My ${CFG.brand} order:\n${lines.join("\n")}\n\nTotal: ${money(cartTotal())}`;
  }

  function renderCart() {
    const lines = Object.entries(cart);
    $("#cartList").innerHTML = lines.map(([key, l]) => {
      const { item } = INDEX.get(l.id);
      const opts = l.choices.filter(Boolean).join(" · ");
      return `<li>
        <span class="ci-name">${dietDot(item.diet)}${esc(item.name)}</span>
        <span class="ci-price">${money(l.qty * unitPrice(item, l.choices))}</span>
        <span class="ci-opt">${opts ? esc(opts) + " · " : ""}${money(unitPrice(item, l.choices))} each</span>
        <span class="stepper"><button type="button" data-line-dec="${esc(key)}" aria-label="Remove one">−</button><span>${l.qty}</span><button type="button" data-line-inc="${esc(key)}" aria-label="Add one">+</button></span>
      </li>`;
    }).join("");
    $("#cartEmpty").hidden = lines.length > 0;
    $("#cartFoot").hidden = lines.length === 0;
    $("#cartTotal").textContent = money(cartTotal());
    if (ORDERS.enabled) {
      $("#cartCheckout").hidden = false;
      $("#cartSub").textContent = "Order right here — we'll bring it to your table or pack it to go.";
    }
    const wa = $("#cartWhatsApp");
    if (CFG.orderWhatsApp) {
      wa.hidden = false;
      wa.href = `https://wa.me/${CFG.orderWhatsApp}?text=${encodeURIComponent(orderText())}`;
    }
  }

  let lastCount = cartCount();
  function refreshCart() {
    const count = cartCount();
    const badge = $("#cartCount");
    badge.hidden = !count;
    badge.textContent = count;
    if (count > lastCount) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
    lastCount = count;
    const bar = $("#orderBar");
    bar.hidden = !count;
    $("#orderBarCount").textContent = `${count} ${count === 1 ? "item" : "items"}`;
    $("#orderBarTotal").textContent = money(cartTotal());
    INDEX.forEach((_, id) => refreshCTA(id));
    const pill = $("#trackPill");
    if (pill) pill.classList.toggle("raised", !!count);
    if (cartSheet.open) renderCart();
  }

  function openCart() { renderCart(); cartSheet.showModal(); }
  $("#cartOpen").addEventListener("click", openCart);
  $("#orderBar").addEventListener("click", openCart);
  $("#cartClear").addEventListener("click", () => {
    if (!confirm("Clear your whole order?")) return;
    cart = {}; store.save(cart); refreshCart();
  });
  $("#cartShare").addEventListener("click", async () => {
    const text = orderText();
    try {
      if (navigator.share) { await navigator.share({ title: `${CFG.brand} order`, text }); return; }
      await navigator.clipboard.writeText(text);
      toast("Order copied to clipboard");
    } catch (e) {
      if (e && e.name !== "AbortError") toast("Couldn't share — try a screenshot instead");
    }
  });
  cartSheet.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-line-inc]");
    const dec = e.target.closest("[data-line-dec]");
    const key = (inc || dec)?.dataset[inc ? "lineInc" : "lineDec"];
    if (!key || !cart[key]) return;
    addLine(cart[key].id, cart[key].choices, inc ? 1 : -1);
  });


  /* ---------------- live ordering ---------------- */
  const checkoutSheet = $("#checkoutSheet");
  const trackSheet = $("#trackSheet");
  const ACTIVE_KEY = "therapy-active-order-v1";
  const OCFG = ORDERS.config || {};
  const tableFromUrl = (new URLSearchParams(location.search).get("table") || "").replace(/\D/g, "").slice(0, 4);
  let active = null;          // { order, status, eta, statusAt }
  let stopTracking = null;

  const loadActive = () => { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)); } catch { return null; } };
  const saveActive = () => { try { active ? localStorage.setItem(ACTIVE_KEY, JSON.stringify(active)) : localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ } };

  function orderType() { return ($("input[name=otype]:checked", checkoutSheet) || {}).value; }
  function syncOrderType() {
    const t = orderType();
    $("#fieldTable").hidden = t !== "dinein";
    $("#fieldName").hidden = t !== "takeaway";
  }

  function openCheckout() {
    if (!cartCount()) return;
    const form = $("#checkoutForm");
    const types = $$("input[name=otype]", form);
    types[0].closest("label").hidden = OCFG.dineIn === false;
    types[1].closest("label").hidden = OCFG.takeaway === false;
    if (!orderType()) {
      const preferred = OCFG.dineIn === false ? "takeaway" : "dinein";
      $(`input[name=otype][value=${preferred}]`, form).checked = true;
    }
    if (tableFromUrl && !form.table.value) form.table.value = tableFromUrl;
    syncOrderType();
    const count = cartCount();
    $("#checkoutSummary").innerHTML = `<span>${count} item${count > 1 ? "s" : ""}</span><strong>${money(cartTotal())}</strong>`;
    $("#checkoutError").hidden = true;
    cartSheet.close();
    checkoutSheet.showModal();
  }

  $("#cartCheckout").addEventListener("click", openCheckout);
  $("#orderType").addEventListener("change", syncOrderType);
  $("[data-close]", checkoutSheet).addEventListener("click", () => checkoutSheet.close());

  $("#checkoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const type = orderType();
    const err = $("#checkoutError");
    const table = form.table.value.replace(/\D/g, "");
    const name = form.name.value.trim();
    const fail = (msg, field) => { err.textContent = msg; err.hidden = false; field && field.focus(); };
    if (type === "dinein" && !table) return fail("Please enter your table number.", form.table);
    if (type === "takeaway" && !name) return fail("Please enter your name so we can call you.", form.name);

    const lines = Object.values(cart).map((l) => {
      const { item } = INDEX.get(l.id);
      const opts = l.choices.filter(Boolean).join(", ");
      return { n: item.name, o: opts || undefined, q: l.qty, p: unitPrice(item, l.choices), d: item.diet };
    });
    const btn = $("#checkoutSubmit");
    btn.disabled = true;
    btn.textContent = "Sending to the kitchen…";
    err.hidden = true;
    try {
      const order = await ORDERS.placeOrder({
        type,
        table: type === "dinein" ? table : undefined,
        name: type === "takeaway" ? name : undefined,
        note: form.note.value.trim() || undefined,
        lines,
        total: cartTotal(),
      });
      active = { order, status: "new", statusAt: order.at };
      saveActive();
      cart = {}; store.save(cart); refreshCart();
      form.note.value = "";
      checkoutSheet.close();
      startTracking();
      openTrack();
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    } catch (ex) {
      fail(`Couldn't send your order — check your internet and try again, or order at the counter. (${ORDERS.explain(ex)})`);
      console.error("Order failed:", ex);
    } finally {
      btn.disabled = false;
      btn.textContent = "Place order";
    }
  });

  const TRACK_MSG = {
    new: () => "Waiting for the cafe to confirm your order…",
    preparing: (a) => `Confirmed! We're preparing it${a.eta ? ` — ready in about ${a.eta} min` : ""}. 👩‍🍳`,
    ready: (a) => a.order.type === "dinein" ? "Your order is ready and on its way to your table! 🎉" : "Your order is ready — please collect it at the counter! 🎉",
    completed: () => "Enjoy your treats! Thank you for visiting Therapy. 💛",
    rejected: (a) => `Sorry, we couldn't take this order${a.reason ? `: ${a.reason}` : ""}. Please check with our team at the counter.`,
  };

  function renderTrack() {
    if (!active) return;
    const { order, status } = active;
    $("#trackTitle").textContent = order.code;
    $("#trackWhere").textContent = order.type === "dinein" ? `Dine-in · Table ${order.table}` : `Takeaway · ${order.name}`;
    const step = ORDERS.STATUS[status] ? ORDERS.STATUS[status].step : 0;
    $$("#trackSteps li").forEach((li) => {
      const n = +li.dataset.step;
      li.classList.toggle("done", step >= 0 && n < step);
      li.classList.toggle("current", n === step);
    });
    $("#trackSteps").classList.toggle("rejected", status === "rejected");
    $("#trackMsg").textContent = TRACK_MSG[status](active);
    $("#trackMsg").dataset.status = status;
    $("#trackLines").innerHTML = order.lines.map((l) =>
      `<li><span>${l.q} × ${esc(l.n)}${l.o ? ` <em>(${esc(l.o)})</em>` : ""}</span><b>${money(l.q * l.p)}</b></li>`).join("") +
      `<li class="total"><span>Total · pay at counter</span><b>${money(order.total)}</b></li>`;
    const finished = status === "completed" || status === "rejected";
    $("#trackDone").textContent = finished ? "Start a new order" : "Order more";
    $("#trackLive").hidden = finished;
    const pill = $("#trackPill");
    pill.hidden = finished;
    pill.dataset.status = status;
    $("#trackPillText").textContent = `${order.code} · ${ORDERS.STATUS[status].label}`;
    const bar = $("#orderBar");
    pill.classList.toggle("raised", !bar.hidden);
  }

  function openTrack() { renderTrack(); trackSheet.showModal(); }
  $("#trackPill").addEventListener("click", openTrack);
  $("#trackDone").addEventListener("click", () => {
    if (active && (active.status === "completed" || active.status === "rejected")) {
      stopTracking && stopTracking();
      active = null; saveActive();
      $("#trackPill").hidden = true;
    }
    trackSheet.close();
  });

  function alertCustomer(status) {
    const msg = TRACK_MSG[status](active);
    toast(status === "ready" ? "🎉 Your order is ready!" : msg);
    if (navigator.vibrate) navigator.vibrate(status === "ready" ? [200, 100, 200, 100, 400] : 200);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((t, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = i ? 1175 : 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.32);
      });
    } catch { /* audio blocked */ }
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try { new Notification(`Therapy · ${active.order.code}`, { body: msg, tag: active.order.code }); } catch { /* ignore */ }
    }
  }

  function startTracking() {
    if (!active || !ORDERS.enabled) return;
    stopTracking && stopTracking();
    renderTrack();
    stopTracking = ORDERS.watchOrder(active.order.id, (o) => {
      if (!ORDERS.STATUS[o.status]) return;
      $("#trackLive").textContent = "Live updates on — keep this page open.";
      const changed = o.status !== active.status;
      Object.assign(active, { status: o.status, statusAt: o.statusAt, eta: o.eta, reason: o.reason });
      saveActive();
      renderTrack();
      if (changed) alertCustomer(o.status);
    }, () => {
      $("#trackLive").textContent = "Reconnecting for live updates…";
    });
  }

  // Resume tracking after a reload (orders older than 12h are dropped).
  function resumeOrders() {
    active = loadActive();
    if (active && (!active.order || Date.now() - active.order.at > 12 * 3600e3)) { active = null; saveActive(); }
    if (active) startTracking();
    if (tableFromUrl && ORDERS.enabled) toast(`Welcome! Ordering for table ${tableFromUrl}`);
  }

  /* ---------------- global clicks ---------------- */
  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    const add = e.target.closest("[data-add]");
    const dec = e.target.closest("[data-dec]");
    if (add) {
      const hit = INDEX.get(add.dataset.add);
      if (!hit || hit.item.soldOut) return;
      const { item } = hit;
      addLine(item.id, []);
      if (qtyOfItem(item.id) === 1) toast(`${item.name} added`);
    } else if (dec) {
      const key = lastLineOf(dec.dataset.dec);
      if (key) addLine(cart[key].id, cart[key].choices, -1);
    } else if (open) {
      e.preventDefault();
      openSheet(open.dataset.open);
    }
  });

  /* ---------------- toolbar ---------------- */
  $("#search").addEventListener("input", (e) => {
    query = e.target.value;
    applyFilters();
  });
  $$(".diet-filter .chip").forEach((chip) => chip.addEventListener("click", () => {
    $$(".diet-filter .chip").forEach((c) => { c.classList.toggle("is-active", c === chip); c.setAttribute("aria-checked", c === chip); });
    dietFilter = chip.dataset.diet;
    applyFilters();
  }));

  /* ---------------- scroll effects ---------------- */
  const topbar = $("#topbar");
  const hero = $(".hero");
  const onScroll = () => topbar.classList.toggle("is-solid", window.scrollY > hero.offsetHeight - 80);
  window.addEventListener("scroll", onScroll, { passive: true });

  let spy = null;
  function setupScrollSpy() {
    if (spy) spy.disconnect();
    const links = new Map($$(".cat-link").map((a) => [a.dataset.nav, a]));
    const nav = $("#catNav");
    let current = null;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.dataset.cat;
        if (id === current) return;
        current = id;
        links.forEach((a, k) => a.classList.toggle("is-active", k === id));
        const a = links.get(id);
        nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: "smooth" });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$(".category").forEach((s) => obs.observe(s));
    spy = obs;
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  /* ---------------- footer ---------------- */
  function renderFooter() {
    $("#cities").innerHTML = CFG.cities.map(esc).join("<b>||</b>");
    $("#instaHandle").textContent = `@${CFG.instagram}`;
    $("#instaLink").href = `https://instagram.com/${CFG.instagram}`;
    $("#franchisePhone").textContent = CFG.franchisePhone;
    $("#franchiseLink").href = `tel:${CFG.franchisePhone.replace(/\s/g, "")}`;
    $("#year").textContent = new Date().getFullYear();
  }

  /* ---------------- live menu (staff edits) ---------------- */
  // Fetch the latest prices / sold-out flags; re-render only if something changed.
  async function refreshLiveMenu() {
    if (!ORDERS.fetchLiveMenu) return;
    let live;
    try { live = await ORDERS.fetchLiveMenu(); } catch { return; }
    if (!live || JSON.stringify(live) === liveKey) return;
    applyLive(live);
    renderMenu();
    applyFilters();
    const removed = pruneCart();
    refreshCart();
    setupScrollSpy();
    if (removed.length) toast(`${removed.join(", ")} ${removed.length > 1 ? "are" : "is"} sold out — removed from your order`);
  }
  // Pick up changes when a guest comes back to the tab.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshLiveMenu(); });

  /* ---------------- boot ---------------- */
  renderMenu();
  renderFooter();
  refreshCart();
  setupScrollSpy();
  onScroll();
  resumeOrders();
  refreshLiveMenu();

  // Deep link: /#basque opens that item.
  const hashId = location.hash.slice(1);
  if (INDEX.has(hashId)) openSheet(hashId);
})();
