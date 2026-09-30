/*
 * Live order channel, shared by the menu (index.html) and the staff
 * dashboard (staff.html). Built on ntfy's HTTP publish + SSE subscribe API.
 *
 * Topics (all derived from THERAPY_CONFIG.orders.topic):
 *   <topic>            human-readable alerts -> staff phones (ntfy app)
 *   <topic>-data       JSON events (new orders + status changes) -> dashboard
 *   <topic>-o-<key>    status updates for one order -> that customer's phone
 */
window.TherapyOrders = (() => {
  "use strict";

  const OCFG = (window.THERAPY_CONFIG && window.THERAPY_CONFIG.orders) || {};
  const server = (OCFG.server || "https://ntfy.sh").replace(/\/$/, "");
  const topics = {
    alerts: OCFG.topic,
    data: `${OCFG.topic}-data`,
    order: (key) => `${OCFG.topic}-o-${key}`,
  };

  const STATUS = {
    new: { label: "Sent to cafe", step: 0 },
    preparing: { label: "Preparing", step: 1 },
    ready: { label: "Ready", step: 2 },
    completed: { label: "Completed", step: 3 },
    rejected: { label: "Cancelled by cafe", step: -1 },
  };

  const rand = (n, alphabet = "abcdefghijkmnpqrstuvwxyz23456789") => {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  };

  // Short code the customer reads out at the counter, e.g. "D-4K7" / "T-9QM".
  const newCode = (type) => `${type === "dinein" ? "D" : "T"}-${rand(3, "23456789ABCDEFGHJKLMNPQRSTUVWXYZ")}`;
  // Unguessable key so only this customer's device follows its status topic.
  const newKey = () => rand(12);

  async function publish(topic, body) {
    // text/plain body keeps this a "simple" CORS request (no preflight).
    const res = await fetch(`${server}/`, { method: "POST", body: JSON.stringify({ topic, ...body }) });
    if (!res.ok) throw new Error(`ntfy ${res.status}`);
    return res.json();
  }

  /** Subscribe to a topic. Replays the server's cache (ntfy.sh keeps ~12h), then streams live. */
  function subscribe(topic, onMessage, { since = "12h", onStatus } = {}) {
    const seen = new Set();
    let es;
    let closed = false;
    let lastId = null;
    const open = () => {
      es = new EventSource(`${server}/${topic}/sse?since=${encodeURIComponent(lastId || since)}`);
      es.addEventListener("open", () => onStatus && onStatus("live"));
      es.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.event !== "message" || seen.has(msg.id)) return;
        seen.add(msg.id);
        lastId = msg.id;
        onMessage(msg);
      };
      es.onerror = () => {
        onStatus && onStatus("reconnecting");
        // EventSource retries by itself, but restart from the last id we saw
        // so nothing sent while we were offline is missed.
        es.close();
        if (!closed) setTimeout(open, 3000);
      };
    };
    open();
    return () => { closed = true; es && es.close(); };
  }

  /** Customer: send a new order. Returns the stored order record. */
  async function placeOrder(order) {
    const key = newKey();
    const code = newCode(order.type);
    const full = { ...order, code, key, at: Date.now() };
    const where = order.type === "dinein" ? `Table ${order.table}` : `Takeaway · ${order.name}`;
    const count = order.lines.reduce((n, l) => n + l.q, 0);

    // 1) Structured copy for the dashboard (must succeed).
    await publish(topics.data, { message: JSON.stringify({ kind: "order", order: full }) });
    // 2) Push alert for staff phones (best-effort).
    const lines = order.lines.map((l) => `${l.q} × ${l.n}${l.o ? ` (${l.o})` : ""}`).join("\n");
    const staffUrl = new URL("staff.html", location.href).href;
    publish(topics.alerts, {
      title: `🛎 New order ${code} · ${where}`,
      message: `${lines}${order.note ? `\n📝 ${order.note}` : ""}\n\nTotal ₹${order.total} · ${count} item${count > 1 ? "s" : ""}`,
      tags: ["cake"],
      priority: 5,
      click: staffUrl,
    }).catch(() => {});
    return full;
  }

  /** Staff: change an order's status; notifies the dashboard(s) and the customer. */
  async function setStatus(order, status, extra = {}) {
    const ev = { kind: "status", code: order.code, key: order.key, status, at: Date.now(), ...extra };
    await publish(topics.data, { message: JSON.stringify(ev) });
    await publish(topics.order(order.key), { message: JSON.stringify(ev) });
  }

  return { enabled: !!(OCFG.enabled && OCFG.topic), config: OCFG, topics, STATUS, publish, subscribe, placeOrder, setStatus };
})();
