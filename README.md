# Therapy — Desserts & More · Digital Menu

A fast, mobile-first menu web app for **Therapy — Desserts & More**. It's plain HTML/CSS/JS with no build step and no server code.

## Features
- Branded hero and a "Signatures" showcase row
- 13 categories and 52 items, with descriptions, prices and diet markers (veg / egg / non-veg)
- A sticky category bar that highlights the section you're reading
- Live search (e.g. "biscoff", "mango", "chocolate") plus a Veg / Egg / Non-veg filter
- A detail sheet for each item, with options such as Basque toppings, egg or eggless brownies, Magnum flavour, and London Berry double or triple chocolate (the price updates with the choice)
- An "Your order" list that is saved on the device and can be shared or copied. Guests can show it at the counter or send it on WhatsApp
- Deep links to any item, e.g. `index.html#basque`. These are handy for Instagram stories or QR codes
- Locations, franchise contact, Instagram and allergen fine print in the footer

## Live ordering (dine-in & takeaway)
Customers can order straight from the menu, and the cafe gets them instantly.

**Customer:** Add items → **Place order** → choose **Dine-in** (table number) or **Takeaway** (name) → add a note if needed → the order is sent.
A live tracker then shows **Sent → Preparing (with a ready-in time) → Ready → Enjoy**, with a sound and vibration when the order is ready. Payment happens at the counter.

**Cafe staff:**
1. Open **`/staff.html`** (e.g. `https://darshanhy1722-rgb.github.io/theropy/staff.html`) on the counter tablet or phone and tap **Start receiving orders**.
   New orders appear with a chime that repeats until someone accepts them. Staff tap *Accept · 10′* → *Mark ready* → *Served/Collected*, or *Cancel order* with a reason.
2. For alerts on phones, even when they're locked, install the free **ntfy** app ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iPhone](https://apps.apple.com/app/ntfy/id1625396347)) and subscribe to the topic shown in the staff page's ⚙️ setup.
3. **Table QR codes:** link each table to `https://darshanhy1722-rgb.github.io/theropy/?table=5`, which pre-fills table 5. For takeaway, use the plain link.

**Settings** live in `menu.js` → `THERAPY_CONFIG.orders`: turn dine-in or takeaway on and off, change the ETA choices, or set a new `topic` to reset the channel.

**Limits of this free setup:** it uses [ntfy.sh](https://ntfy.sh), so there's no server or login. The topic name is inside the public site code, so anyone technical could read or fake orders. That's why the app only asks for a table number or first name, and payment stays at the counter. ntfy.sh keeps orders for about 12 hours; the staff page keeps today's list on its own device. For online payments, delivery or accounts, move to a real backend such as Firebase or Supabase.

## Run locally
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Put it online (free)
**GitHub Pages:** go to repo Settings → Pages → Deploy from branch → pick the branch and `/ (root)`.
Print a QR code of the resulting URL for the tables.

## Editing the menu
Everything lives in **`menu.js`**:
- `THERAPY_CONFIG.orderWhatsApp` sets the outlet's WhatsApp number (e.g. `"919876543210"`) and turns on the "Order on WhatsApp" button
- Change `price`, `desc`, `diet` or `tags` (`signature`, `bestseller`, `new`, `seasonal`, `spicy`) on any item
- Add real photos by dropping them into an `images/` folder and setting `image: "images/your-photo.jpg"` on the item. Until then, a styled plate illustration is shown
