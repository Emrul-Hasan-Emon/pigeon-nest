# Buyer App Roadmap

Goal: everything a buyer can do on the website, in the app, for Android and iOS.
Rules for building it mirror the seller app's (root `rules.md`, rules 5 to 8, extended to this app).
The map of what lies where is `FEATURES.md`.

How to use this file: build the phases in order. When a phase is finished, tick its boxes and set its row in `FEATURES.md` to `done`.

The whole buyer API already exists and is tested (`/v1/api/user/*` — storefront browsing,
cart, checkout, orders, wishlist, reviews, proposals, questions, returns, payment claims).
This app is frontend-only work: no server changes expected before Phase 8.

Theme note: the buyer app follows the website's catalogue redesign (serif display
face, ink/dove/teal/brass palette, hairline plates, honest lot numbers) — not the
seller app's big plain icon-led look. Browsing birds should feel premium.

## Phases

Each phase can be released on its own.

### Phase 0. Foundation
- [x] Flutter app created, builds for Android and iOS (`apps/buyer_app`)
- [x] Server address config, API client with token, secure token storage
- [x] Guest session header (`x-cart-session`) generated and stored, sent when signed out
- [x] Sign in, register, restore session, sign out, guest browsing (most screens work signed out)
- [x] Router: guest-allowed by default (no blanket redirect); a tab asks for sign-in itself when it needs one
- [x] Home with bottom bar (placeholders): Home, Categories, Cart, Orders, Account
- [x] Shared parts: catalogue plate, lot number badge, status badge, loading, empty and error states
- [x] List paging helpers (page-number for storefront/orders, cursor where the API uses it)
- [x] Money (USD, one formatter) and date formatting
- [x] Picture picker (reviews, questions)
- [x] Theme: serif display face (Fraunces via google_fonts), ink/dove/teal/brass palette, hairline plate style
- [ ] `flutter test` currently fails on this machine building a native asset for a transitive dependency (`objective_c`, macOS host target) — a broken Xcode Command Line Tools SDK, not a code issue; the same failure happens on the already-shipped seller app. `flutter analyze` is clean.

### Phase 1. Account
- [x] Register, sign in (phone + password)
- [x] My profile: view and edit, avatar
- [x] Change password
- [x] Address book: list, add, edit, delete, default address
- [x] Guest cart/order merge into account on sign-in (built in phase 0, since login/register needed it right away)

### Phase 2. Browse
- [x] Homepage: hero banners (auto-sliding), sections (categories, collections, featured/specific products, sellers)
- [x] Category tree, category product list
- [x] Collections list and detail
- [x] Product list: search, sort, breed/bloodline filters (price and vaccinated filters not wired in the UI yet — the API supports them)
- [x] Product detail: gallery, SKU/variant picker, stock, seller card, breadcrumb, related products
- [x] Sellers list and seller detail (their own product list)

### Phase 3. Cart and Checkout
- [x] Cart per seller: add, change quantity, remove, empty (summary badge on the Cart tab not wired yet — `GET /carts/summary` is built but unused)
- [x] Checkout: recipient, address (saved or new), delivery type with live price, payment method with its proof fields
- [x] Place order, see confirmation with order number (a minimal confirmation screen; the full order detail is phase 4)
- [x] Price offers applied to a cart line show the offer price, not the SKU price

### Phase 4. Orders
- [x] Order list: status filter, search by order number, paging
- [x] Order detail: items, totals, delivery, payment status, status history, updates from the seller
- [x] Cancel an order (while allowed)
- [x] Track an order by number + phone (no account needed)
- [x] Submit payment proof (mark as paid) when paying outside the app

### Phase 5. Engagement
- [x] Wishlist: save, remove, list with live price/availability (sign-in required, same as the server)
- [x] Reviews: write on a delivered item, edit within the window, photos, helpful votes, report, read replies
- [x] Price offers: propose a price on a SKU, see seller's counter, accept/reject/cancel
- [x] Product questions: ask, read answers

### Phase 6. Returns
- [x] Check return eligibility for a delivered order
- [x] Request a return (whole order or specific items), with a reason and photos
- [x] Return detail with status history
- [x] Cancel a return request (while open)

### Phase 7. Release
- [x] Push notifications: order status changes, offer responses, answered questions (needed a small, additive server change — see below)
- [x] Offline and slow network handling: no-internet bar, read retry, clear slow-server message (built in phase 0)
- [x] App name, icon, splash screen (a placeholder bird mark; swap the three files in `assets/brand/` for the final artwork)
- [x] Signing key config, CI check-and-build workflow, store listing drafted. Still needs your accounts (Play/App Store), a real signing key, screenshots, privacy policy URL — see `RELEASE.md`

Note: push needed a server endpoint the buyer side didn't have yet (`apps/server/src/push/controllers/user-device.controller.ts`, a `user_device` table, and `PushService.notifyUser`), plus hooking it into order status changes, seller responses to a price offer, and answered questions. This is the one exception to "frontend-only" in this roadmap's intro — flagged here since it wasn't planned, but it mirrors the seller app's own push setup exactly and needed no new concepts.
