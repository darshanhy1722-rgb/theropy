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
