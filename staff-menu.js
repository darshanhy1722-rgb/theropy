/*
 * Staff menu editor: prices, sold out, hidden, text, labels, photos and new
 * dishes. Edits are saved to Firestore (menu/live) and layered over menu.js
 * for every customer. Photos are shrunk on the device, then stored in
 * Firebase Storage.
 */
(() => {
  "use strict";

  const CFG = window.THERAPY_CONFIG;
  const O = window.TherapyOrders;
  const BASE = JSON.parse(JSON.stringify(window.THERAPY_MENU)); // menu.js, untouched
  const BASE_IDS = new Set(BASE.flatMap((c) => c.items.map((i) => i.id)));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => `${CFG.currency}${Number(n || 0).toLocaleString("en-IN")}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let live = { items: {}, custom: {} };
  let merged = O.mergeMenu(BASE, live);
  let signedIn = false;
  let stopWatch = null;
  let query = "";

  /* ---------------- helpers ---------------- */
  const scopeOf = (id) => (BASE_IDS.has(id) ? "items" : "custom");
  const baseItem = (id) => { for (const c of BASE) { const it = c.items.find((i) => i.id === id); if (it) return it; } return null; };
  const find = (id) => { for (const c of merged) { const it = c.items.find((i) => i.id === id); if (it) return { item: it, cat: c }; } return null; };
  const pricedGroup = (item) => (item.options || []).find((g) => g.choices.some((c) => c.price != null));
  const sameArr = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
  }

  async function save(id, fields, okMsg) {
    try {
      await O.saveMenuFields(scopeOf(id), id, fields);
      if (okMsg) toast(okMsg);
      return true;
    } catch (err) {
      toast(`⚠️ Couldn't save (${O.explain(err)})`);
      render(); // put the controls back to the saved state
      return false;
    }
  }

  /* ---------------- photo: shrink on device ---------------- */
  async function shrinkPhoto(file, max = 900) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Not an image")); i.src = url; });
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.8));
      // Safari can't encode WebP and silently returns PNG — use JPEG there.
      if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function uploadPhoto(id, file) {
    if (!O.photosEnabled) throw Object.assign(new Error("Photo storage isn't set up yet"), { code: "no-default-bucket" });
    const blob = await shrinkPhoto(file);
    return O.uploadMenuImage(id, blob);
  }

  /* ---------------- list ---------------- */
  function thumb(item, cat) {
    return item.image
      ? `<img src="${esc(item.image)}" alt="" loading="lazy" />`
      : `<span class="m-emoji" style="--h1:${cat.hue[0]};--h2:${cat.hue[1]}">${item.emoji || cat.emoji}</span>`;
  }

  function row(item, cat) {
    const id = esc(item.id);
    const group = pricedGroup(item);
    const priceCtl = group
      ? `<button class="m-optprices" data-edit="${id}">${group.choices.map((c) => `${esc(c.name.split(" ")[0])} ${money(c.price ?? item.price)}`).join(" · ")} ›</button>`
      : `<label class="m-price"><span>₹</span><input type="number" inputmode="numeric" min="0" max="100000" step="1" value="${item.price}" data-price="${id}" aria-label="Price of ${esc(item.name)}" /></label>`;
    const badges = [
      item.custom ? `<span class="m-badge added">Added</span>` : item.edited ? `<span class="m-badge edited">Edited</span>` : "",
      item.hidden ? `<span class="m-badge hid">Hidden</span>` : "",
    ].join("");
    return `<div class="m-row ${item.soldOut ? "is-soldout" : ""} ${item.hidden ? "is-hidden" : ""}" data-row="${id}">
      <label class="m-thumb" title="Change photo">
        <input type="file" accept="image/*" data-photo="${id}" hidden />
        ${thumb(item, cat)}<span class="m-cam">📷</span>
      </label>
      <div class="m-info">
        <b><i class="dot ${esc(item.diet)}"></i>${esc(item.name)}</b>${badges}
        <small>${esc(item.desc)}</small>
      </div>
      ${priceCtl}
      <label class="m-switch"><input type="checkbox" data-soldout="${id}" ${item.soldOut ? "checked" : ""} /><span>Sold out</span></label>
      <label class="m-switch"><input type="checkbox" data-hidden="${id}" ${item.hidden ? "checked" : ""} /><span>Hidden</span></label>
      <button class="m-edit" data-edit="${id}" aria-label="Edit ${esc(item.name)}">Edit</button>
    </div>`;
  }

  function render() {
    const root = $("#mList");
    if (!signedIn) { root.innerHTML = `<p class="col-empty">Sign in (⚙️) to edit the menu.</p>`; return; }
    const q = query.trim().toLowerCase();
    const html = merged.map((cat) => {
      const items = cat.items.filter((i) => !q || `${i.name} ${i.desc}`.toLowerCase().includes(q));
      if (!items.length) return "";
      return `<section class="m-cat"><h3>${cat.emoji} ${esc(cat.nav || `${cat.title} ${cat.script || ""}`.trim())} <span>${items.length}</span></h3>
        ${items.map((i) => row(i, cat)).join("")}</section>`;
    }).join("");
    // Don't wipe a price the staff member is typing.
    const focused = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.price;
    root.innerHTML = html || `<p class="col-empty">No items match “${esc(query)}”.</p>`;
    if (focused) { const el = $(`[data-price="${CSS.escape(focused)}"]`); if (el) { el.focus(); el.select(); } }
  }

  /* ---------------- quick edits in the list ---------------- */
  $("#mList").addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset.price) {
      const id = t.dataset.price;
      const price = Math.round(Number(t.value));
      if (!(price >= 0 && price <= 100000) || t.value === "") { toast("Enter a valid price"); render(); return; }
      const base = baseItem(id);
      await save(id, { price: base && base.price === price ? null : price }, `✓ ${find(id).item.name}: ${money(price)}`);
    } else if (t.dataset.soldout) {
      const id = t.dataset.soldout;
      await save(id, { soldOut: t.checked || null }, `${find(id).item.name} is ${t.checked ? "sold out" : "available again"}`);
    } else if (t.dataset.hidden) {
      const id = t.dataset.hidden;
      await save(id, { hidden: t.checked || null }, `${find(id).item.name} is ${t.checked ? "hidden from" : "back on"} the menu`);
    } else if (t.dataset.photo && t.files[0]) {
      const id = t.dataset.photo;
      const rowEl = t.closest(".m-row");
      rowEl.classList.add("is-uploading");
      try {
        const old = find(id).item.image;
        const url = await uploadPhoto(id, t.files[0]);
        if (await save(id, { image: url }, "📷 Photo updated")) O.deleteMenuImage(old);
      } catch (err) {
        toast(`⚠️ Photo upload failed (${O.explain(err)})`);
      } finally {
        rowEl.classList.remove("is-uploading");
      }
    }
  });
  // Save price on Enter too.
  $("#mList").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.price) e.target.blur(); });
  $("#mList").addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b) openEdit(b.dataset.edit); });
  $("#mSearch").addEventListener("input", (e) => { query = e.target.value; render(); });

  /* ---------------- edit / add sheet ---------------- */
  const sheet = $("#editSheet");
  const form = $("#editForm");
  let editing = null; // { id, isNew, image }

  function setPreview(image, emoji) {
    $("#ePreview").innerHTML = image ? `<img src="${esc(image)}" alt="" />` : `<span>${emoji || "🍰"}</span>`;
    $("#eRemovePhoto").hidden = !image;
  }

  function openEdit(id) {
    const isNew = !id;
    const hit = isNew ? null : find(id);
    const item = hit ? hit.item : { name: "", desc: "", price: "", diet: "veg", tags: [] };
    editing = { id: id || `new-${Date.now().toString(36)}`, isNew, image: item.image || null, origImage: item.image || null };
    $("#editTitle").textContent = isNew ? "Add a new item" : "Edit item";
    $("#editSub").textContent = isNew ? "It appears on the menu as soon as you save." : `${hit.cat.nav || hit.cat.title}${item.custom ? " · added by staff" : ""}`;
    $("#eCatField").hidden = !isNew;
    $("#eCat").innerHTML = BASE.map((c) => `<option value="${esc(c.id)}">${c.emoji} ${esc(c.nav || `${c.title} ${c.script || ""}`.trim())}</option>`).join("");
    form.name.value = item.name;
    form.desc.value = item.desc || "";
    const group = pricedGroup(item);
    $("#ePriceField").hidden = !!group;
    form.price.value = item.price;
    $("#eOptionPrices").innerHTML = group ? `<fieldset class="e-group"><legend>Prices (₹) · ${esc(group.label)}</legend>
      ${group.choices.map((c) => `<label class="e-opt"><span>${esc(c.name)}</span><input type="number" inputmode="numeric" min="0" max="100000" step="1" data-opt="${esc(c.name)}" value="${c.price ?? item.price}" /></label>`).join("")}</fieldset>` : "";
    $$('input[name="diet"]', form).forEach((r) => { r.checked = r.value === (item.diet || "veg"); });
    $$('input[name="tags"]', form).forEach((c) => { c.checked = (item.tags || []).includes(c.value); });
    form.soldOut.checked = !!item.soldOut;
    form.hidden.checked = !!item.hidden;
    setPreview(editing.image, item.emoji || (hit ? hit.cat.emoji : "🍰"));
    $("#ePhotoNote").textContent = O.photosEnabled ? "" : "Photo upload needs Firebase Storage (see FIREBASE_SETUP.md).";
    $("#eReset").hidden = isNew || !!item.custom || !item.edited;
    $("#eDelete").hidden = isNew || !item.custom;
    $("#editError").hidden = true;
    sheet.showModal();
  }

  $("#mAdd").addEventListener("click", () => openEdit(null));
  $("[data-close]", sheet).addEventListener("click", () => sheet.close());

  $("#eFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    $("#ePhotoNote").textContent = "Uploading photo…";
    $("#eSave").disabled = true;
    try {
      editing.image = await uploadPhoto(editing.id, file);
      setPreview(editing.image);
      $("#ePhotoNote").textContent = "✓ Photo ready — tap Save to publish it.";
    } catch (err) {
      $("#ePhotoNote").textContent = `⚠️ Upload failed (${O.explain(err)})`;
    } finally {
      $("#eSave").disabled = false;
    }
  });
  $("#eRemovePhoto").addEventListener("click", () => { editing.image = null; setPreview(null); $("#ePhotoNote").textContent = "Photo will be removed when you save."; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#editError");
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    const name = form.name.value.trim();
    const desc = form.desc.value.trim();
    const price = Math.round(Number(form.price.value));
    const diet = ($('input[name="diet"]:checked', form) || {}).value || "veg";
    const tags = $$('input[name="tags"]:checked', form).map((c) => c.value);
    const optionPrices = Object.fromEntries($$("[data-opt]", form).map((i) => [i.dataset.opt, Math.round(Number(i.value))]));
    if (!name) return fail("Please enter a name.");
    const hasOpt = Object.keys(optionPrices).length > 0;
    if (!hasOpt && !(form.price.value !== "" && price >= 0 && price <= 100000)) return fail("Please enter a valid price.");
    if (hasOpt && Object.values(optionPrices).some((p) => !(p >= 0 && p <= 100000))) return fail("Please enter valid prices.");

    const btn = $("#eSave");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const { id, isNew } = editing;
      let fields;
      if (scopeOf(id) === "custom") {
        fields = { name, desc, price, diet, tags, image: editing.image, soldOut: form.soldOut.checked, hidden: form.hidden.checked };
        if (isNew) Object.assign(fields, { cat: form.cat.value, at: Date.now() });
      } else {
        // Store only what differs from menu.js, so "Reset" is always possible.
        const b = baseItem(id);
        const bOpt = pricedGroup(b);
        const diffOpt = hasOpt && bOpt && bOpt.choices.some((c) => optionPrices[c.name] !== (c.price ?? b.price));
        fields = {
          name: name !== b.name ? name : null,
          desc: desc !== (b.desc || "") ? desc : null,
          price: !hasOpt && price !== b.price ? price : null,
          optionPrices: diffOpt ? optionPrices : null,
          diet: diet !== b.diet ? diet : null,
          tags: sameArr(tags, b.tags) ? null : tags,
          image: editing.image || null,
          soldOut: form.soldOut.checked || null,
          hidden: form.hidden.checked || null,
        };
      }
      await O.saveMenuFields(scopeOf(id), id, fields);
      if (editing.origImage && editing.origImage !== editing.image) O.deleteMenuImage(editing.origImage);
      toast(isNew ? `✓ ${name} added to the menu` : `✓ ${name} saved`);
      sheet.close();
    } catch (ex) {
      fail(`Couldn't save (${O.explain(ex)})`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save";
    }
  });

  $("#eReset").addEventListener("click", async () => {
    const { id } = editing;
    if (!confirm("Reset this item to the original menu (price, text, labels, photo)?")) return;
    try {
      await O.removeMenuEntry("items", id);
      O.deleteMenuImage(editing.origImage);
      toast("↺ Back to the original");
      sheet.close();
    } catch (ex) { toast(`⚠️ ${O.explain(ex)}`); }
  });
  $("#eDelete").addEventListener("click", async () => {
    const { id } = editing;
    if (!confirm(`Delete “${form.name.value}” from the menu?`)) return;
    try {
      await O.removeMenuEntry("custom", id);
      O.deleteMenuImage(editing.origImage);
      toast("🗑 Item deleted");
      sheet.close();
    } catch (ex) { toast(`⚠️ ${O.explain(ex)}`); }
  });
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });

  /* ---------------- view tabs ---------------- */
  $$(".view-tab").forEach((tab) => tab.addEventListener("click", () => {
    $$(".view-tab").forEach((t) => { t.classList.toggle("is-active", t === tab); t.setAttribute("aria-selected", t === tab); });
    $("#viewOrders").hidden = tab.dataset.view !== "orders";
    $("#viewMenu").hidden = tab.dataset.view !== "menu";
  }));

  /* ---------------- live data ---------------- */
  if (!O.configured) return;
  O.onStaffAuth((user) => {
    signedIn = !!user;
    stopWatch && stopWatch();
    stopWatch = null;
    if (user) {
      stopWatch = O.watchLiveMenu((data) => {
        live = data;
        merged = O.mergeMenu(BASE, live);
        render();
      }, (err) => toast(`⚠️ Menu: ${O.explain(err)}`));
    }
    render();
  }).catch(() => {});
})();
