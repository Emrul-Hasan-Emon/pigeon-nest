# Feature Map

Which feature lives where. Rule 7 in the root `rules.md`: update this file in the same commit as any change to a feature.

How to read a row:
- **Folder**: where the code is, under `lib/`.
- **Server routes**: all start with `/v1/api/seller`.
- **Website page**: the same feature on the seller website (`apps/client/app/seller/...`).
- **Spec**: the guide to check the screen against (`apps/server/docs/seller/`).
- **Status**: `done`, `started`, `planned`.

Each feature folder has the same shape:

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
| Sign in, restore session, sign out | `core/auth/`, `features/auth/ui/` | `POST /auth/login` | `/seller/login` | done |
| Server address | `core/config/app_config.dart` | | | done |
| API client and errors | `core/api/` | | | done |
| Token storage | `core/storage/token_store.dart` | | | done |
| Router and sign-in guard | `core/router/app_router.dart` | | | done |
| Theme | `core/theme/app_theme.dart` | | | done |
| Home frame and bottom bar | `features/home/ui/` | `GET /profile` (shop name) | `/seller/dashboard` (frame) | started |

## Planned

### Account (phase 1)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Register | `features/auth/` | `POST /auth/register` | `/seller/register` | | planned |
| My profile | `features/profile/` | `GET/PATCH /profile` | `/seller/profile` | | planned |
| Selling on/off, shop break | `features/profile/` | `PATCH /profile/selling` | `/seller/profile` | | planned |
| Change password | `features/profile/` | `PATCH /profile/password` | `/seller/profile` | | planned |
| Shop set-up checklist | `features/onboarding/` | `GET /profile/onboarding` | dashboard card | | planned |

### Dashboard (phase 2)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Dashboard | `features/dashboard/` | `GET /dashboard`, `GET /dashboard/attention` | `/seller/dashboard` | `dashboard-guide.md` | planned |

### Orders (phase 3)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Order list and detail | `features/orders/` | `GET /order`, `GET /order/:id` | `/seller/orders`, `/seller/orders/[id]` | `order-flow.md` | planned |
| Change status, bulk status | `features/orders/` | `PATCH /order/:id/status`, `POST /order/bulk-status` | same | `order-flow.md` | planned |
| Payments on an order | `features/orders/` | `POST /order/:id/payments`, `.../payments/:paymentId/reverse` | same | `order-flow.md` | planned |
| Order updates | `features/orders/` | `POST /order/:id/updates` | same | `order-flow.md` | planned |
| New order | `features/orders/` | `GET /order/catalog`, `/order/customers`, `/order/options`, customer addresses, `POST /order` | `/seller/orders/new` | `order-flow.md` | planned |
| Invoice PDF | `features/orders/` | (built on the phone) | `/seller/orders/[id]/print` | | planned |

### Products (phase 4)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Product list and detail | `features/products/` | `GET /products`, `GET /products/:id` | `/seller/products`, `/seller/products/[id]` | `product-flow.md` | planned |
| Create and edit | `features/products/` | `POST /products`, `PATCH /products/:id`, `GET /catalog/*` | `.../new`, `.../[id]/edit` | `product-flow.md` | planned |
| SKUs, pictures, bird details | `features/products/` | `PUT /products/:id/skus/:skuId/parents/:role`, `PATCH /products/:id/media-files` | same | `product-flow.md` | planned |
| Copy, bulk, status history | `features/products/` | `POST /products/:id/copy`, `POST /products/bulk`, `GET /products/:id/status-history` | same | `product-flow.md` | planned |

### Money (phase 5)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Payments | `features/payments/` | `GET /order/payments`, `GET /order/payments/:id` | `/seller/payments` | | planned |
| Paid requests | `features/payment_claims/` | `GET /payment-claims`, `.../summary`, `POST .../:id/confirm`, `.../reject` | `/seller/payment-claims` | `payment-claim-guide.md` | planned |
| Payment accounts | `features/payment_accounts/` | `GET/POST /profile/payment-accounts`, `PATCH .../:id` | `/seller/payment-accounts` | `payment-claim-guide.md` | planned |
| Returns | `features/returns/` | `GET /returns`, `GET /returns/:id`, `POST .../accept`, `processing`, `reject`, `returning-money` | `/seller/returns` | `returns-flow.md` | planned |
| Refunds | `features/refunds/` | `GET /order/refunds`, `.../summary`, `.../:id`, `POST .../:id/status` | `/seller/refunds` | `returns-flow.md` | planned |
| System commission | `features/commission/` | `GET /commission/balance`, `history`, `changes`, `disbursements`, `setting` | `/seller/commission` | `commission-flow.md` | planned |
| Statements | `features/statements/` | `GET /reports/statement` | `/seller/statements` | `report-flow.md` | planned |
| Reports | `features/reports/` | `GET /reports/sales`, `orders`, `products`, `returns`, `earnings` | `/seller/reports` | `report-flow.md` | planned |

### Customers (phase 6)

| Feature | Folder | Server routes | Website page | Spec | Status |
|---|---|---|---|---|---|
| Price offers | `features/offers/` | `GET /proposals`, `summary`, `:id`, `accept`, `counter`, `reject` | `/seller/offers` | `proposals-flow.md` | planned |
| Questions | `features/questions/` | `GET /questions`, `summary`, `POST .../:id/answer` | `/seller/questions` | | planned |
| Reviews | `features/reviews/` | `GET /review`, `summary`, replies, reports | `/seller/reviews` | `review-flow.md` | planned |
| Wishlist insights | `features/wishlist/` | `GET /wishlist/insights` | `/seller/wishlist` | `wishlist-flow.md` | planned |

### Help and release (phases 7 and 8)

| Feature | Folder | Server routes | Website page | Status |
|---|---|---|---|---|
| Help topics | `features/help/` | `GET /help`, `GET /help/:slug` | `/seller/help` | planned |
| Push notifications | `core/notifications/` | new server routes needed | | planned |

## Shared parts

Built in phase 0 and used by many features. Add each one here when it is created.

| Part | Folder | What it does | Status |
|---|---|---|---|
| Placeholder page | `shared/widgets/placeholder_page.dart` | "Coming soon" page | done |
| Big button, card, badge | `shared/widgets/` | common look | planned |
| Loading, empty, error views | `shared/widgets/` | common states | planned |
| Paging helpers | `shared/` | page and cursor lists | planned |
| Money and date formats | `shared/format/` | USD money and dates | planned |
| Picture picker and upload | `shared/` | choose and send pictures | planned |
| Access banners | `shared/widgets/` | pending, suspended, closed shop | planned |
