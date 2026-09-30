/*
 * THERAPY — Desserts & More : menu data
 * ------------------------------------------------------------
 * Edit this file to change items, prices or descriptions.
 *
 * nav:    optional short label for the category bar.
 * diet:   "veg" | "egg" | "nonveg"
 * tags:   any of "signature", "bestseller", "new", "seasonal", "spicy"
 * image:  optional path, e.g. "images/basque-cheesecake.jpg".
 *         When missing, a styled illustration is shown instead.
 * options: optional choices shown in the item sheet.
 *          { label, choices: [{ name, price? }] } — a choice with a
 *          price overrides the base price.
 */
window.THERAPY_CONFIG = {
  brand: "Therapy",
  tagline: "Desserts & More",
  currency: "₹",
  // Put the outlet's WhatsApp number here (country code, digits only,
  // e.g. "919876543210") to let guests send their order on WhatsApp.
  // Leave empty to hide the WhatsApp button.
  orderWhatsApp: "",
  franchisePhone: "+91 96008 41622",

  // Live ordering. Orders are sent through ntfy (https://ntfy.sh), a free
  // push-notification service — no server or account needed.
  //  • Staff install the "ntfy" app and subscribe to `topic` to get alerts.
  //  • Staff open staff.html on the counter tablet/phone to manage orders.
  // Change `topic` to any new random string to "reset" the order channel.
  orders: {
    enabled: true,
    server: "https://ntfy.sh",
    topic: "therapy-hangova-g2br2nio6m18",
    dineIn: true,    // table orders (QR per table: https://hangova.in/?table=5)
    takeaway: true,  // parcel / pick-up at the counter
    etaChoices: [5, 10, 15, 20, 30], // minutes staff can pick when accepting
  },
  instagram: "therapy_dessertcart",
  cities: ["Chennai", "Bangalore", "Hyderabad", "Vizag", "Vijayawada", "Madurai", "Tirupur"],
};

window.THERAPY_MENU = [
  {
    id: "seasonal",
    nav: "Summer Special",
    title: "Summer",
    script: "special",
    blurb: "Alphonso-season treats and limited-run favourites — here only while they last.",
    emoji: "🥭",
    hue: ["#ffb347", "#ff7b29"],
    items: [
      { id: "mango-mousse", name: "Mango Mousse", price: 149, diet: "veg", tags: ["seasonal"], emoji: "🍮",
        desc: "Light, airy & packed with real mango goodness." },
      { id: "mango-cheesecake", name: "Mango Cheesecake", price: 219, diet: "veg", tags: ["seasonal"],
        desc: "Rich and creamy cheesecake with a tropical mango twist." },
      { id: "mango-madness-s", name: "Mango Madness", price: 159, diet: "egg", tags: ["seasonal"],
        desc: "Alphonso treat with layers of mango purée." },
      { id: "cookie-scoop", name: "Underbaked Cookie Scoop", price: 199, diet: "veg", tags: ["seasonal"], emoji: "🍪",
        desc: "Warm, gooey cookie scoop topped with vanilla ice cream." },
      { id: "london-berry", name: "London Berry", price: 179, diet: "veg", tags: ["seasonal"], emoji: "🍓",
        desc: "Our seasonal favourite — fresh strawberries layered with chocolate cake and cream in a cup.",
        options: [{ label: "Choose your chocolate", choices: [
          { name: "Double Chocolate", price: 179 },
          { name: "Triple Chocolate", price: 199 },
        ] }] },
    ],
  },
  {
    id: "tres-leches",
    nav: "Tres Leches",
    title: "Tres",
    script: "leches",
    blurb: "Sponge soaked in three milks until it's impossibly soft — our most-loved comfort dessert.",
    emoji: "🍰",
    hue: ["#f3e3c7", "#d9b27a"],
    items: [
      { id: "baileys-tres", name: "Baileys Irish Cream", price: 159, diet: "egg",
        desc: "Baileys-soaked vanilla sponge cake with Irish cream." },
      { id: "biscoff-tres", name: "Lotus Biscoff", price: 159, diet: "egg",
        desc: "Tres leches cake with Biscoff spread & crushed cookies." },
      { id: "milk-cake", name: "Signature Milk Cake", price: 149, diet: "egg", tags: ["signature"],
        desc: "Classic tres leches with soft sponge cake — where it all started." },
      { id: "kitkat-tres", name: "KitKat Tres Leches", price: 159, diet: "egg",
        desc: "Decadent tres leches with silky chocolate cream & KitKat shards." },
      { id: "berry-misu", name: "Berry Misu", price: 159, diet: "egg", emoji: "🍓",
        desc: "Real strawberry-infused tiramisu with mascarpone." },
    ],
  },
  {
    id: "cakes",
    title: "Cakes",
    script: "",
    blurb: "Generous slices, baked fresh — from our signature triple chocolate to a proper Italian tiramisu.",
    emoji: "🎂",
    hue: ["#6b3f2a", "#3b2418"],
    items: [
      { id: "triple-choc-cake", name: "Signature Triple Chocolate Cake", price: 169, diet: "veg", tags: ["signature"], emoji: "🍫",
        desc: "Moist, fluffy cake layered with rich chocolate ganache and finished with a generous coating of mixed chocolate." },
      { id: "basque", name: "Basque Cheesecake", price: 189, diet: "egg",
        desc: "Rich and creamy burnt Basque cheesecake with your choice of topping.",
        options: [{ label: "Pick a topping", choices: [
          { name: "Triple Chocolate" }, { name: "Blueberry" }, { name: "Nutella" },
          { name: "Biscoff" }, { name: "Strawberry" },
        ] }] },
      { id: "tiramisu", name: "OG Italian Tiramisu", price: 159, diet: "egg", emoji: "☕",
        desc: "Rum-infused tiramisu with mascarpone, dusted with rich cocoa powder." },
      { id: "choco-crunch", name: "Choco Crunch Cake", price: 199, diet: "egg", emoji: "🍫",
        desc: "Rich chocolate sponge layered with ganache, buttery crunch & a chocolate glaze." },
      { id: "kinder-joy", name: "Kinder Joy", price: 249, diet: "egg", emoji: "🍫",
        desc: "Chocolate sponge with hazelnut, white ganache, mascarpone cream & chocolate milk." },
      { id: "double-mousse", name: "Double Chocolate Mousse", price: 199, diet: "egg", emoji: "🍫",
        desc: "Silky smooth dark & milk chocolate layered mousse." },
      { id: "mango-madness", name: "Mango Madness", price: 159, diet: "egg", emoji: "🥭",
        desc: "Alphonso treat with layers of mango purée." },
    ],
  },
  {
    id: "brownies",
    nav: "Brownies",
    title: "Brownie",
    script: "cravings",
    blurb: "Fudgy, dense and unapologetically chocolatey. Available with or without egg.",
    emoji: "🟫",
    hue: ["#7a4a2e", "#2e1a10"],
    items: [
      { id: "brownie", name: "Brownie Indulgence", price: 139, diet: "egg",
        desc: "Fudgy brownie loaded with double chocolate.",
        options: [{ label: "Egg or eggless", choices: [{ name: "Eggless" }, { name: "With egg" }] }] },
      { id: "brownie-intense", name: "Brownie Intense Indulgence", price: 149, diet: "egg",
        desc: "Our fudgy brownie, drenched in the sauce of your choice.",
        options: [
          { label: "Choose your sauce", choices: [
            { name: "Triple Chocolate" }, { name: "Nutella" }, { name: "Biscoff" }, { name: "Pistachio" },
          ] },
          { label: "Egg or eggless", choices: [{ name: "Eggless" }, { name: "With egg" }] },
        ] },
    ],
  },
  {
    id: "laban",
    nav: "Laban",
    title: "Laban",
    script: "indulgence",
    blurb: "Egyptian-style layered cups — soaked sponge, custard and crispy kunafa in every spoon.",
    emoji: "🥛",
    hue: ["#e9d9b8", "#b8925a"],
    items: [
      { id: "biscoff-laban", name: "Exotic Egyptian Biscoff Laban", price: 249, diet: "veg",
        desc: "Vanilla sponge soaked in Biscoff milk, custard cream, crispy kunafa, chocolate sauce & biscuit crumble." },
      { id: "pistachio-laban", name: "Exotic Egyptian Pistachio Laban", price: 249, diet: "veg",
        desc: "Chocolate sponge with creamy custard, topped with crunchy kunafa, pistachio sauce & roasted nuts." },
    ],
  },
  {
    id: "malai",
    nav: "Malai",
    title: "Malai",
    script: "delights",
    blurb: "Soft vanilla sponge under a blanket of rich malai cream and fresh fruit.",
    emoji: "🍨",
    hue: ["#f7e6ec", "#c9738c"],
    items: [
      { id: "mulberry-malai", name: "Mulberry Malai Royale", price: 229, diet: "veg",
        desc: "Soft vanilla sponge cake with rich malai cream & sweet-tangy mulberry." },
      { id: "strawberry-malai", name: "Malai Strawberry", price: 209, diet: "veg",
        desc: "Soft vanilla sponge cake with rich malai cream & sweet-sour strawberry." },
    ],
  },
  {
    id: "croissants",
    title: "Croissants",
    script: "",
    blurb: "Buttery, flaky and filled to the edges — sweet or savoury.",
    emoji: "🥐",
    hue: ["#f5d9a8", "#c98a3c"],
    items: [
      { id: "magnum-croissant", name: "Magnum Croissant", price: 259, diet: "veg",
        desc: "Croissant filled with a creamy Magnum bar.",
        options: [{ label: "Choose your Magnum", choices: [{ name: "Truffle" }, { name: "Pistachio" }] }] },
      { id: "pistachio-croissant", name: "Pistachio Croissant", price: 249, diet: "veg",
        desc: "Buttery croissant layered with rich, velvety pistachio cream." },
      { id: "almond-croissant", name: "Almond Croissant", price: 249, diet: "veg",
        desc: "Buttery croissant layered with rich almond cream." },
      { id: "choc-croissant", name: "Classic Triple Chocolate Croissant", price: 179, diet: "veg",
        desc: "Served with vanilla ice cream and topped with a triple chocolate drizzle." },
      { id: "paneer-croissant", name: "Peri Peri Paneer Croissant", price: 249, diet: "veg", tags: ["spicy"],
        desc: "A spicy twist with a peri peri paneer filling." },
      { id: "chicken-croissant", name: "Peri Peri Chicken Croissant", price: 249, diet: "nonveg", tags: ["spicy"], emoji: "🍗",
        desc: "Flaky croissant stuffed with spicy peri peri chicken." },
    ],
  },
  {
    id: "buns",
    title: "Buns",
    script: "& mochi",
    blurb: "Soft, pillowy Korean-style buns — sweet, savoury and everything in between.",
    emoji: "🍞",
    hue: ["#f4dcc0", "#b86f3c"],
    items: [
      { id: "korean-bun", name: "Korean Cream Cheese Bun", price: 149, diet: "veg", emoji: "🧄",
        desc: "Soft garlic-butter bun, split and stuffed with sweet cream cheese." },
      { id: "paneer-mochi", name: "Seoul Paneer Filled Mochi", price: 119, diet: "veg", emoji: "🍡",
        desc: "Chewy mochi-style bun with a savoury paneer filling." },
      { id: "paneer-bun", name: "Peri Peri Paneer Bun", price: 129, diet: "veg", tags: ["spicy"],
        desc: "Soft bun filled with spicy peri peri paneer." },
      { id: "chicken-bun", name: "Spicy Chicken Bun", price: 129, diet: "nonveg", tags: ["spicy"], emoji: "🍗",
        desc: "Soft bun filled with spicy, saucy chicken." },
    ],
  },
  {
    id: "pizzas",
    title: "Pizzas",
    script: "",
    blurb: "Puffy, pillowy-crust pizzas with a peri peri kick.",
    emoji: "🍕",
    hue: ["#c9963f", "#8a5a1e"],
    items: [
      { id: "paneer-pizza", name: "Peri Peri Paneer Pizza", price: 249, diet: "veg", tags: ["spicy"],
        desc: "Puffy pizza with spicy peri peri paneer." },
      { id: "chicken-pizza", name: "Peri Peri Chicken Pizza", price: 249, diet: "nonveg", tags: ["spicy"],
        desc: "Puffy pizza with spicy peri peri chicken." },
    ],
  },
  {
    id: "waffles",
    title: "Waffles",
    script: "",
    blurb: "Golden, crisp-edged waffles made to order and loaded with toppings.",
    emoji: "🧇",
    hue: ["#d99a55", "#8a4f23"],
    items: [
      { id: "triple-waffle", name: "Triple Chocolate Waffle", price: 140, diet: "veg",
        desc: "Chocolate waffle drizzled with dark, milk & white chocolate." },
      { id: "nutella-waffle", name: "Nutella Waffle", price: 150, diet: "veg",
        desc: "Warm waffle generously spread with Nutella." },
      { id: "oreo-waffle", name: "Kiki and Oreo Waffle", price: 160, diet: "veg",
        desc: "Chocolate-drizzled waffle loaded with crushed Oreo cookies." },
      { id: "biscoff-waffle", name: "Biscoff Waffle", price: 170, diet: "veg",
        desc: "Waffle topped with melted Lotus Biscoff spread & cookie crumble." },
      { id: "kunafa-waffle", name: "Choco Kunafa Waffle", price: 180, diet: "veg",
        desc: "Chocolate waffle crowned with crispy kunafa and pistachio." },
    ],
  },
  {
    id: "sundaes",
    title: "Sundaes",
    script: "",
    blurb: "Ice cream meets cake — the best of both, in one glass.",
    emoji: "🍨",
    hue: ["#f0d8b0", "#9c6a38"],
    items: [
      { id: "english-tosca", name: "English Tosca", price: 199, diet: "veg", tags: ["signature"],
        desc: "Butterscotch scoop with Therapy's signature cake." },
      { id: "death-by-choc", name: "Death By Chocolate", price: 159, diet: "veg",
        desc: "Vanilla scoop with sponge cake, drenched in chocolate fudge." },
      { id: "biscoff-crumble", name: "Royal Biscoff Crumble", price: 199, diet: "veg",
        desc: "Vanilla scoop with crunchy Biscoff cookie." },
    ],
  },
  {
    id: "shakes",
    nav: "Thick Shakes",
    title: "Thick",
    script: "shakes",
    blurb: "Proper thick shakes — you'll need the spoon.",
    emoji: "🥤",
    hue: ["#c7a27a", "#5a3620"],
    items: [
      { id: "cold-milo", name: "Cold Milo", price: 169, diet: "veg", emoji: "🧋",
        desc: "Chilled, creamy Milo malt chocolate shake." },
      { id: "nutella-shake", name: "Nutella Thickshake", price: 169, diet: "veg",
        desc: "Thick, creamy shake blended with Nutella." },
      { id: "brownie-bomb", name: "Brownie Bomb", price: 179, diet: "veg",
        desc: "Chocolate shake blended with chunks of fudgy brownie." },
      { id: "biscoff-shake", name: "Biscoff Shake", price: 189, diet: "veg",
        desc: "Thick shake blended with Lotus Biscoff spread & cookies." },
    ],
  },
  {
    id: "quick-bites",
    nav: "Quick Bites",
    title: "Quick",
    script: "bites",
    blurb: "Something savoury to go with all that sweet.",
    emoji: "🍟",
    hue: ["#ffd15c", "#e08a1e"],
    items: [
      { id: "potato-shots", name: "Potato Cheese Shots", price: 120, diet: "veg", emoji: "🧀",
        desc: "Crispy golden potato bites with a molten cheese centre." },
      { id: "jalapeno-poppers", name: "Jalapeño Poppers", price: 130, diet: "veg", tags: ["spicy"], emoji: "🌶️",
        desc: "Cheesy jalapeño bites, fried crisp." },
      { id: "fries", name: "Fries", price: 140, diet: "veg",
        desc: "Classic salted french fries." },
      { id: "peri-fries", name: "Peri Peri Fries", price: 150, diet: "veg", tags: ["spicy"],
        desc: "Fries tossed in fiery peri peri seasoning." },
      { id: "cheese-fries", name: "Cheese Loaded Fries", price: 170, diet: "veg",
        desc: "Fries smothered in warm, gooey cheese sauce." },
    ],
  },
];
