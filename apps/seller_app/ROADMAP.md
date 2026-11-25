# Seller App Roadmap

Goal: everything a seller can do on the website, in the app, for Android and iOS.
Rules for building it are in the root `rules.md` (rules 5 to 8). The map of what lies where is `FEATURES.md`.

How to use this file: build the phases in order. When a phase is finished, tick its boxes and set its row in `FEATURES.md` to `done`.

## Phases

Each phase can be released on its own.

### Phase 0. Foundation
- [x] Flutter app created, builds for Android (`apps/seller_app`)
- [x] Server address config, API client with token, secure token storage
- [x] Sign in, session restore, sign out
- [x] Router that sends signed-out sellers to login
- [x] Home with bottom bar (placeholders)
- [ ] Shared parts: big button, card, status badge, loading, empty and error states
- [ ] List paging helpers (the API uses both page-number and cursor paging)
- [ ] Money (USD, one formatter) and date formatting
- [ ] Picture picker and multipart upload
- [ ] Access banners: awaiting approval, suspended, rejected, shop closed
- [ ] More menu that lists every section

### Phase 1. Account
- [ ] Register (with photos and ID images)
- [ ] My profile: view and edit, avatar, ID images
- [ ] Selling on and off, shop break dates
- [ ] Change password
- [ ] Shop set-up checklist (onboarding)

### Phase 2. Dashboard
- [ ] Date range filter
- [ ] "You keep" card and support numbers
- [ ] Sales and refunds chart
- [ ] To-do tiles (needs attention)
- [ ] Orders by status, top products, reviews
- [ ] Product counts and wishlist insights

### Phase 3. Orders
- [ ] Order list: filters, search, paging
- [ ] Order detail
- [ ] Change status, bulk status
- [ ] Record a payment, reverse a payment
- [ ] Order updates (notes)
- [ ] New order: customer, address, items, options
- [ ] Share or print the invoice (PDF)

### Phase 4. Products
- [ ] Product list and detail
- [ ] Create and edit product
- [ ] SKU editor
- [ ] Pictures and media
- [ ] Bird details
- [ ] Copy product, bulk actions, status history

### Phase 5. Money
- [ ] Payments list and detail
- [ ] Paid requests (confirm and reject)
- [ ] Payment accounts
- [ ] Returns: list, detail, accept, processing, reject, returning money
- [ ] Refunds: list, detail, status
- [ ] System commission: balance, history, disbursements
- [ ] Statements
- [ ] Reports: sales, orders, products, returns, earnings

### Phase 6. Customers
- [ ] Price offers: accept, counter, reject
- [ ] Questions: answer
- [ ] Reviews: list, reply, report
- [ ] Wishlist insights

### Phase 7. Help
- [ ] Help topics from `/seller/help`, same steps and icons as the website

### Phase 8. Release
- [ ] Push notifications (needs new server work: save phone tokens, send on events)
- [ ] Offline and slow network handling
- [ ] App name, icon, splash screen
- [ ] Signing, store listings, test builds on both stores
- [ ] Build automation

## Open decisions

Fill these in before the phase that needs them.

| # | Question | Needed by | Answer |
|---|---|---|---|
| 1 | Push notifications: in phase 8, or earlier? | Phase 3 | |
| 2 | Language: English only, or Bangla too? | Phase 0 | |
| 3 | Invoice as a PDF to share or print? | Phase 3 | |
| 4 | Register in the app, or log in only? | Phase 1 | |
| 5 | Login expiry: sign in again, or add a refresh token on the server? | Phase 1 | |
| 6 | Phone only, or tablet layouts too? | Phase 0 | |
| 7 | First store release: after phase 4, or after everything? | Phase 4 | |

## Known risks

- iOS builds need the full Xcode and CocoaPods on the build machine.
- Android builds need JDK 21 (see `README.md`).
- Orders and products are the biggest screens on the website. Expect them to take the most time.
- If server routes are renamed while the app is built, the app breaks. Finish the backend module review before phase 3.
