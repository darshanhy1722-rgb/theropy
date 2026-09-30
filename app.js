(() => {
  "use strict";

  const CFG = window.THERAPY_CONFIG;
  const MENU = window.THERAPY_MENU;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => `${CFG.currency}${n.toLocaleString("en-IN")}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DIET_LABEL = { veg: "Vegetarian", egg: "Contains egg", nonveg: "Non-vegetarian" };
  const TAG_LABEL = { signature: "Signature", bestseller: "Bestseller", new: "New", seasonal: "Seasonal", spicy: "🌶 Spicy" };

  // Flat lookup: item id -> { item, cat }
  const INDEX = new Map();
  MENU.forEach((cat) => cat.items.forEach((item) => INDEX.set(item.id, { item, cat })));

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
  // Drop lines whose items no longer exist on the menu.
  Object.keys(cart).forEach((k) => { if (!INDEX.has(cart[k].id)) delete cart[k]; });

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
            <article class="item" data-item="${item.id}" style="animation-delay:${Math.min(i, 6) * 40}ms">
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
    $("#sheetAdd").textContent = `Add ${sheetQty > 1 ? sheetQty + " " : ""}to order · ${money(unit * sheetQty)}`;
  }

  function openSheet(id) {
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

  /* ---------------- global clicks ---------------- */
  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    const add = e.target.closest("[data-add]");
    const dec = e.target.closest("[data-dec]");
    if (add) {
      const { item } = INDEX.get(add.dataset.add);
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

  function setupScrollSpy() {
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

  /* ---------------- boot ---------------- */
  renderMenu();
  renderFooter();
  refreshCart();
  setupScrollSpy();
  onScroll();

  // Deep link: /#basque opens that item.
  const hashId = location.hash.slice(1);
  if (INDEX.has(hashId)) openSheet(hashId);
})();
