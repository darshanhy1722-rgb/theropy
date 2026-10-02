# Turn on online ordering (Firebase), about 10 minutes

Orders are stored in **Firebase** (Google). The free "Spark" plan includes 20,000 orders and 50,000 order reads a day, so a cafe won't pay anything.

## 1. Create the project
1. Go to <https://console.firebase.google.com> and sign in with a Google account (use the cafe's, if it has one).
2. Click **Create a project** → name it e.g. `therapy-orders` → you can switch **Google Analytics off** → **Create**.

## 2. Create the database
1. In the left menu: **Build → Firestore Database → Create database**.
2. Location: **asia-south1 (Mumbai)**. This can't be changed later.
3. Choose **Start in production mode** → **Create**.

## 3. Turn on sign-in
1. **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, enable **Anonymous** (used silently by customers) and **Email/Password** (for staff).
3. On the **Users** tab, click **Add user** and create a login for the cafe staff, e.g. `orders@yourcafe.com` with a strong password. Add one per staff member, or share one account.
4. On the **Settings** tab, open **Authorized domains** → **Add domain** → `darshanhy1722-rgb.github.io` (plus your own domain if you add one later).

## 4. Paste the security rules
1. **Firestore Database → Rules** tab.
2. Replace everything with the contents of [`firestore.rules`](firestore.rules).
3. In the list near the top, replace `change-me@example.com` with the staff email(s) from step 3.3, written in lowercase.
4. Click **Publish**.

These rules mean customers can only place orders and see their own. Only the staff emails can see and update all orders.

## 5. Connect the website
1. Click the ⚙️ **Project settings** → scroll to **Your apps** → click the **Web** icon `</>`.
2. Nickname: `therapy-menu`. Leave Hosting unticked → **Register app**.
3. You'll see a `firebaseConfig` block. Copy **apiKey, authDomain, projectId, appId** into `menu.js` under `THERAPY_CONFIG.orders.firebase`:
   ```js
   firebase: {
     apiKey: "AIza…",
     authDomain: "therapy-orders.firebaseapp.com",
     projectId: "therapy-orders",
     appId: "1:123…:web:abc…",
   },
   ```
   These values are **not secret**. Every Firebase website shows them, and the rules from step 4 are what keep the data safe.
4. Commit and push. After 1–2 minutes the menu shows **Place order**.

## 6. Test it
1. Open `…/staff.html` on the counter tablet, sign in with the staff email, and tap **Start receiving orders**.
2. On your phone, open the menu, add something, and place an order. It appears on the staff screen with a chime.
3. Optional: in the staff page ⚙️, follow **Alerts on staff phones** to get notifications through the ntfy app, and tick the box on the counter tablet only.

## 7. Menu photos (Firebase Storage)
Staff can change prices, mark items sold out or hidden, edit text and add dishes from the **Menu & prices** tab on the staff page. That part works on the free plan. **Photo upload** needs Cloud Storage, which requires the **Blaze** (pay-as-you-go) plan:

1. **Upgrade:** in the bottom-left of the Firebase console, click **Upgrade** → **Blaze** → add a card.
2. **Set a budget alert:** when asked (or at console.cloud.google.com → Billing → Budgets & alerts), create a budget of **₹100/month** with email alerts. A cafe menu uses a few MB, so the expected bill is **₹0**.
3. **Create the photo storage:** left menu → **Databases and storage → Storage → Get started**. Choose **US-CENTRAL1** as the location, because the free allowance only applies to US regions. Photos are cached on phones for a year, so the distance doesn't matter. Choose **production mode** → **Create**.
4. **Paste the photo rules:** on the Storage **Rules** tab, replace everything with [`storage.rules`](storage.rules). Put the same staff email(s) in place of `change-me@example.com`, then click **Publish**.
5. **Update the database rules:** paste the latest [`firestore.rules`](firestore.rules), with your staff emails, into Firestore → Rules → **Publish** again. They now include the `menu` section.

Photos are shrunk on the phone to about 100 KB before upload, so the menu stays fast on mobile data.

## Good to know
- The staff page must stay open, with the screen on, on at least one device to hear orders. It keeps the screen awake by itself.
- You can see or delete orders any time under **Firestore Database → Data → orders**. Staff menu edits are in **menu → live**.
- **Reset to original** in the staff editor undoes all edits to a dish and brings back the version from `menu.js`.
- Anyone can still place a fake order, as with any public order form, and staff can cancel it. If this becomes a problem, turn on **Firebase App Check** with reCAPTCHA.
