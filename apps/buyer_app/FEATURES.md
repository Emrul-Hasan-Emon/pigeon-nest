# Feature Map

Which feature lives where. Update this file in the same commit as any change to a feature (same rule as the seller app, root `rules.md` rule 7).

How to read a row:
- **Folder**: where the code is, under `lib/`.
- **Server routes**: all start with `/v1/api/user` unless noted otherwise.
- **Website page**: the same feature on the storefront (`apps/client/app/(store)/...`).
- **Spec**: the guide to check the screen against (`apps/server/docs/user/`), where one exists.
- **Status**: `done`, `started`, `planned`.

Each feature folder has the same shape as the seller app:

```
lib/features/<feature>/
  data/     <feature>_api.dart (every server path), models
  state/    providers
  ui/       screens
  widgets/  pieces used only here
```

## Built

| Feature | Folder | Server routes | Website page | Status |
|---|---|---|---|---|
| Server address | `core/config/app_config.dart` | | | done |
| API client and errors | `core/api/` | | | done |
| Token storage | `core/storage/token_store.dart` | | | done |
| Guest session (cart) | `core/auth/guest_session.dart` | header `x-cart-session` | | done |
| Sign in, register, restore session, sign out | `core/auth/`, `features/auth/ui/` | `POST /auth/login`, `POST /auth/register` | `/user/login`, `/user/register` | done |
| Guest cart merge on sign-in | `core/auth/auth_controller.dart` | `POST /carts/merge` | | done |
| Router (guest-allowed) | `core/router/app_router.dart` | | | done |
| Theme (catalogue look) | `core/theme/app_theme.dart` | | | done |
| Home frame and bottom bar | `features/home/ui/` | | `/` | started (Cart/Orders still placeholders; Home, Categories and Account are real) |
| Country reference data | `core/data/countries.dart` | | | done |
| Shared parts | see below | | | done |

## Planned

### Account (phase 1)

| Feature | Folder | Server routes | Website page | Status |
|---|---|---|---|---|
| My profile (view, edit, avatar) | `features/account/` | `GET/PATCH /profile` | `/user/profile` | done |
| Change password | `features/account/` | `PATCH /profile/password` | `/user/profile` | done |
| Address book | `features/addresses/` | `GET/POST /profile/addresses`, `GET/PATCH/DELETE /profile/addresses/:id` | `/addresses` | done |

### Browse (phase 2)

| Feature | Folder | Server routes | Website page | Status |
|---|---|---|---|---|
| Homepage | `features/home/ui/homepage_screen.dart` | `GET /homepage` | `/` | done |
| Category tree, category products | `features/catalog/` | `GET /categories/tree`, `GET /categories/:slug` | `/categories/[slug]` | done |
| Collections | `features/catalog/` | `GET /collections`, `GET /collections/:slug` | `/collections`, `/collections/[slug]` | done |
| Product list, search, sort, breed/bloodline filters | `features/catalog/` | `GET /products`, `GET /products/bird-filters` | `/products` | done |
| Product detail | `features/product_detail/` | `GET /products/:id` | `/products/[idSlug]` | done |
| Sellers list and detail | `features/sellers/` | `GET /sellers`, `GET /sellers/:id` | `/sellers`, `/sellers/[id]` | done |

### Cart and Checkout (phase 3)

| Feature | Folder | Server routes | Website page | Status |
|---|---|---|---|---|
| Cart | `features/cart/` | `GET /carts`, `summary`, `POST items`, `PATCH/DELETE :cartId/items/:itemId`, `DELETE :cartId` | `/cart` | done (`summary` is built, not yet shown as a tab badge; `seller/:sellerId` not used — the full cart list already has what each screen needs) |
| Checkout | `features/checkout/`, `features/orders/` (confirmation only) | `GET /order/checkout/:cartId`, `POST /order/checkout/:cartId/place` | `/checkout/[cartId]` | done |

### Orders (phase 4)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Order list and detail | `features/orders/` | `GET /order`, `GET /order/:id` | `/orders`, `/orders/[id]` | `order-flow.md` | done |
| Cancel an order | `features/orders/` | `POST /order/:id/cancel` | same | `order-flow.md` | done |
| Track an order (no account) | `features/orders/` | `GET /order/track` | `/orders/track` | `order-flow.md` | done |
| Payment proof (mark as paid) | `features/orders/` | `POST /orders/:orderId/payment-claims` | order detail | | done |

### Engagement (phase 5)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Wishlist | `features/wishlist/` | `GET /wishlist`, `GET /wishlist/ids`, `POST/DELETE /wishlist/:productId` | `/wishlist` | `wishlist-flow.md` | done |
| Reviews | `features/reviews/` | `GET/POST /review`, `GET /review/pending`, `votes`, `product/:productId[/summary]`, `GET/PATCH/DELETE /review/:id`, `POST/DELETE :id/helpful`, `POST :id/report`, `GET :id/replies` | product page, `features/reviews/ui/my_reviews_screen.dart` | `review-flow.md` | done (reading and voting on replies, not posting one — the buyer answers through their own review, not the thread) |
| Price offers | `features/offers/` | `GET /proposals`, `GET /proposals/:id`, `POST /proposals`, `:id/accept`, `counter`, `reject`, `cancel` | `features/offers/ui/` (no matching website page listed) | `proposals-flow.md` | done (`GET /proposals/sku/:skuId` not used — the product page just offers to propose, it doesn't show an existing one yet) |
| Product questions | `features/questions/` | `GET /questions/product/:productId`, `POST /questions/product/:productId` | product page | | done (`GET /questions` — "my questions" — not built; only asking and reading answers, as the roadmap asked) |

### Returns (phase 6)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Returns | `features/returns/` | `GET /returns`, `GET /returns/eligibility/:orderId`, `GET /returns/:id`, `POST /returns`, `POST /returns/:id/cancel` | `/returns`, `/returns/[id]` | `returns-flow.md` | done |

### Release (phase 7)

| Feature | Folder | Server routes | Website page | Status |
|---|---|---|---|---|
| Push notifications | `core/notifications/`, server `src/push/controllers/user-device.controller.ts` | `POST /devices`, `POST /devices/unregister` | | done |
| Offline bar and read retry | `core/network/`, `core/api/api_client.dart` | | | done |
| App name, icon, splash screen | `assets/brand/` | | | done |

## Shared parts

Built in phase 0 and used by many features. Add each one here when it is created.

| Part | Folder | What it does | Status |
|---|---|---|---|
| Catalogue plate, lot number badge | `shared/widgets/catalogue_plate.dart`, `lot_badge.dart` | hairline-framed photo + honest position number, matching the website | done |
| Loading, empty, error views | `shared/widgets/loading_view.dart`, `empty_view.dart`, `error_view.dart` | common states | done |
| Primary button, status badge | `shared/widgets/primary_button.dart`, `status_badge.dart` | common look | done |
| Access banner | `shared/widgets/access_banner.dart`, `core/auth/user_access.dart` | suspended-account notice | done |
| Paging helpers | `shared/paging/page_list_controller.dart`, `cursor_list_controller.dart` | page-number and cursor lists | done |
| Paged list, cursor list | `shared/widgets/paged_list.dart`, `cursor_list.dart` | endless lists with refresh and an empty state | done |
| Money and date formats | `shared/format/money.dart`, `date_format.dart` | USD money and dates | done |
| Status text | `shared/format/text.dart` | `partially_paid` to `Partially paid` | done |
| Picture picker and upload | `shared/media/image_picker_helper.dart`, `multipart_upload.dart` | choose and send pictures | done |
