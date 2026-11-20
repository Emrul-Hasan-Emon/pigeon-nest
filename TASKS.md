# Task Tracker

Each task breaks into Backend / Frontend / QA. Mark a part `[x]` when told it's done.

## Category Management in Admin

Admin CRUD for the Category tree (create, list, update, delete), parent-chain
breadcrumb lookup, and a nested tree endpoint for the parent picker. Guarded by
admin-only auth. Reference: `apps/server/docs/admin/api/category-api-guide.md`,
Postman: `apps/server/postman/admin/category.postman_collection.json`, frontend
prompt: `apps/server/prompt/admin/category-management-frontend-prompt.md`.

- [x] Backend
- [ ] Frontend
- [ ] QA

## Collection & Attribute/Attribute-Value Management in Admin

Admin CRUD for Collections (badges like "New Arrival", "Sale") and for
Attributes with their Attribute Values (e.g. Color: Red/Blue/Green), the
building blocks for product variants. Guarded by admin-only auth. Idea
borrowed from `/Users/emrulhasan/Github/jabaib-group`, adapted to pigeon-nest's
existing `Collection`/`Attribute`/`AttributeValue` entities. Now grouped with
Category under Catalog: `apps/server/src/catalog/{category,collection,attribute}`,
frontend `apps/client/app/admin/catalog/{categories,collections,attributes}`.

- [x] Backend
- [x] Frontend
- [ ] QA

## Seller Management in Admin

Admin can create, update, list (cursor-paginated, with search/status/activeStatus
filters) and view seller details. Each seller carries `nidFrontImagePath`/
`nidFrontImageUrl` and `nidBackImagePath`/`nidBackImageUrl` for NID image
uploads, plus a `status` (`pending`/`approved`/`rejected`). A seller created
by an admin is always `approved` and `activeStatus: active`. Endpoints:
`apps/server/src/seller` (`/sellers`, `/sellers/:id`). Frontend:
`apps/client/app/admin/sellers` (list with cursor "Load more", create, edit).

- [x] Backend
- [x] Frontend
- [ ] QA

## Product Management in Admin (Seller Products)

Admin creates/manages products on behalf of sellers (multi-vendor: admin picks
an approved + active seller per product). Entities: `SellerProduct` /
`SellerProductSku` / `SellerProductSkuVariant` / `SellerProductMedia` (idea
adapted from `/Users/emrulhasan/Github/jabaib-group`'s product/SKU/variant
split). SKU variants are manually assigned attribute/value pairs (no
auto-generated combination matrix); SKU code and variants are immutable after
creation. Six endpoints in `apps/server/src/catalog/product`:
`GET /products` (cursor list with seller info), `GET /products/:id` (seller,
all SKUs, all media), `POST /products` (JSON, creates the product with its
SKUs), `PATCH /products/:id` (JSON; product fields plus `skus[]` — entries with
`id` update, without `id` create — and `removeSkuIds[]` which soft-deletes),
`PATCH /products/:id/media-files` (multipart: `thumbnailImage`,
`removeThumbnail`, `mediaFiles[]`, `removeMediaFilesIds`), `DELETE /products/:id`
(soft). A product must keep at least one SKU. Frontend:
`apps/client/app/admin/catalog/products` (list, create with SKU editor +
optional media, read-only detail, edit with one-save SKU changes and a media
manager).

- [x] Backend
- [x] Frontend
- [ ] QA

## Carts: Customer, Guest and Admin

Second part of cart and checkout. A customer or a guest holds one active cart
per seller (`/v1/api/user/carts`): add (`POST /items`), change quantity or remove
a line, empty a cart, list all my carts (`GET /`), see the cart for one seller
(`GET /seller/:sellerId`), counts for the header (`GET /summary`) and merge a guest
session into the customer's carts after sign-in (`POST /merge`). Guests send an
`x-cart-session` header (any id of 8-100 letters, digits, `-` or `_`; the browser
keeps one in localStorage); a signed-in customer sends the token. Prices and
stock are never trusted from the client: every read is built from the live
SKU (live discount window, stock, product / seller still approved and active),
each line says `ok`, `unavailable`, `out_of_stock` or `insufficient_stock`, and
only buyable lines count towards the totals; writes cap the quantity at stock
and 99 and say so in a `notice`. Removing the last item deletes the cart.
Placing an order (next step) will turn the cart inactive and link cart and
order both ways: `cart.orderId` and `order.cartId` exist now, with unique
indexes so a parallel add can never create two active carts. Admin only
(`/v1/api/admin/carts`, sellers cannot see carts): one list with
`state=active|inactive` and filters for customer, seller, owner (customer or
guest), order number, has items, payable total range, created and updated date
ranges, plus cart details (live for active carts, the checked-out snapshot for
inactive ones). Frontend: header cart badge, `/cart` (all carts), "Your cart
with {seller}" panel and Add to cart on product pages, the same panel on seller
pages, guest-to-customer merge on login and register; admin `Commerce` group
with Active carts, Inactive carts and cart details. API test:
`apps/server/docs/testing/cart_test.py`. The cart has no checkout button yet;
that arrives with checkout.

- [x] Backend
- [x] Frontend
- [ ] QA

## Checkout Setup: Payment Gateways, Shipping Zones & Settings (Admin)

First part of cart and checkout. Admin payment gateways
(`/v1/api/admin/payment-gateways`): types cod, mfs, bank, card, manual; each type
allows and requires its own account details (`GET /types` returns the rules the
form is built from) and defines what the customer enters at checkout; the slug
is generated and never changes; an icon is optional; a gateway used by orders or
payments cannot be deleted (409), deactivate it instead. Cash on Delivery is
seeded. Country-wise shipping: `shipping_zone` is now a set of ISO country codes
for one delivery type (standard / express / pickup) with a charge, delivery days
and a live-birds flag; a country can be in one active zone per delivery type
(409 otherwise). Destinations no active zone covers use the global defaults in
`system_setting` (`shipping.defaultCharge`, `shipping.defaultEstimatedDays`,
`shipping.defaultSupportsLiveAnimal`, edited with `PATCH /admin/settings`).
`GET /admin/shipping-zones/quote?country=&deliveryType=` shows what checkout
will charge, and `GET /admin/countries` lists the 249 countries. Frontend: admin
Settings group (`/admin/settings/{payment-gateways,shipping-zones,general}`).
API test: `apps/server/docs/testing/commerce_config_test.py`. Not built yet:
cart, checkout, orders, payments, order updates (see the plan in the chat).

- [x] Backend
- [x] Frontend
- [ ] QA

## Customer Browsing: Products, Categories, Collections, Sellers

Public customer APIs under `/v1/api/user` (no login), all lists use page-number
pagination (`page`, `pageSize` max 50, returns `{results, page, pageSize, total,
totalPages}`; admin lists keep cursors). `GET /products` (search, category incl.
subcategories, collection, seller, price range, sort newest / priceAsc / priceDesc
/ nameAsc), `GET /products/:id` (SKUs, variant options, media, seller card,
breadcrumb, related), `GET /categories/tree`, `/categories/:slug`,
`/collections`, `/collections/:slug`, `GET /sellers` (only sellers with something
to buy), `/sellers/:id`. One service decides visibility for the homepage and
browse alike: approved + active product, approved + active seller, active SKU,
active category / collection; sellers expose no phone, email, ID images or
payout data. Product URLs are `/products/{id}-{slug}` (a slug is only unique per
seller). Frontend: shared customer layout `app/(store)` with header search and a
category bar, `/products`, `/categories/[slug]`, `/collections/[slug]`,
`/products/[idSlug]` (gallery, SKU picker, stock, related), `/sellers`,
`/sellers/[id]`; filters, sort and page live in the URL. Cart, wishlist and
checkout are not built yet, so the product page has no add-to-cart. Each homepage section has a "See all" button: the API returns a `seeAll` target per section (category, collection, featured, all products, collections, sellers; none for banners) and the button opens that list page (`/products?featured=true`, `/collections`, ...). API test:
`apps/server/docs/testing/storefront_test.py`.

- [x] Backend
- [x] Frontend
- [ ] QA

## Banner & Homepage Content Management in Admin

Admin-managed, dynamic homepage (idea from the shukhee-sis-admin-api homepage
module). **Banners** (`/v1/api/admin/banners`): multipart CRUD with a required
`image`, optional `mobileImage` / `removeMobileImage`, position, link, schedule
window, sort order, active flag; cursor list with search / position / active /
schedule filters and `sort=displayOrder`; delete is refused (409) while a
homepage section uses the banner. **Homepage sections**
(`/v1/api/admin/homepage-sections`): eight section types (banners, categories,
category products, collection products, specific products, specific
collections, featured products, sellers) driven by a registry; `GET
section-types` returns the metadata the admin form is generated from; create /
update validate `config` per type; list is cursor-paged, newest first by
default, with an optional `sort=displayOrder` and filters; `PUT reorder` takes
the full ordered id list; max 100 sections; `GET :id` returns the picked
entities plus warnings; `GET :id/preview?device=`. **Homepage slots**
(`/v1/api/admin/homepage-slots`): four fixed, seeded slots, edit only.
**Storefront** `GET /v1/api/user/homepage?device=mobile|web&page=main|slots`
(public) returns only active, in-schedule, device-visible sections with
eligible items (approved + active product and seller, active SKU, active
category / collection / banner); empty sections are skipped. Deleting a
category or collection used by a section is refused (409). Titles are English
only for now. Frontend: `app/admin/content/{banners,homepage,homepage-slots}`
(Content group in the sidebar), dynamic section form with entity pickers,
reorder dialog and live preview. Customer homepage at `/` (`apps/client/app/page.tsx`, `components/store/*`): full-bleed hero carousel from the top banners, the four fixed slots as an overlapping picks strip, then each section drawn by type and layout (carousel, grid, list); mobile and web get their own device payload. Product, banner and category links point at pages that do not exist yet. API test: `apps/server/docs/testing/homepage_banner_test.py`.

- [x] Backend
- [x] Frontend
- [ ] QA

<!-- Add new tasks above this line, newest first -->

## Seller Auth, Registration & Approval

Sellers register themselves with an international phone number (stored in
E.164, e.g. `+8801712345678`; multiple countries supported) and are created
`pending` + `inactive`. They can log in at any status. `isActive` was replaced
by `activeStatus` (`active`/`inactive`/`suspended`). Access rules: approved +
active = everything; pending / rejected / approved-but-inactive = profile and
password changes only; suspended = nothing (login and reading own status still
work). A rejected seller who edits their profile goes back to `pending` (a
password change does not count). Sellers can never change `status` or
`activeStatus`; only admins can. Admin reviews registrations in a pending list
and approves (approved + active) or rejects (rejected + inactive, optional
reason shown to the seller). The access check re-reads the seller on every
request, so admin changes apply to tokens already issued. Endpoints:
`/v1/api/seller/auth/{login,register}`, `/v1/api/seller/profile[/password]`,
`/v1/api/admin/seller-requests[/:id/{approve,reject}]`. Frontend: seller
portal `apps/client/app/seller/{login,register,profile}`, admin
`app/admin/sellers/requests`, per-role API clients in `lib/api/http.ts`
(`NEXT_PUBLIC_API_BASE_URL` is now the versioned root `.../v1/api`).

### Seller status change history

Every change of a seller's `status` / `activeStatus` is written to an
append-only `seller_status_change_history` table in the same transaction as the
change: before and after of both fields, the action (registered, admin_created,
approved, rejected, resubmitted, admin_updated, baseline), a reason, and the
tracker fields (createdBy, creatorType, creatorName). A reason is required to
reject or suspend (the pending-list reject, the admin PATCH and the activity
dropdown); other changes may carry an optional note. Existing sellers received
one `baseline` row in the migration. Admin only: `GET
/v1/api/admin/seller-status-history` (cursor paged; filters sellerId, search,
action, toStatus, toActiveStatus). Frontend: a "Status history" section on the
seller details page and a separate list page at `/admin/sellers/status-history`.

- [x] Backend
- [x] Frontend
- [ ] QA

### Product status, activity and seller product API

`seller_product` now has `status` (approved / pending / rejected, admin only,
default approved) and `activeStatus` (active / inactive / suspended; sellers
may only choose active or inactive, default active), plus `rejectionReason` and
`suspensionReason`. `isActive` and `isPublished` were removed: a product is
visible on the storefront only when approved AND active. Rejected products and
suspended products are frozen for the seller (403 `PRODUCT_REJECTED` /
`PRODUCT_SUSPENDED` with the reason; reading stays allowed); pending products
stay editable. The row is locked (`FOR UPDATE`) during a seller write so an
admin decision cannot slip in between the check and the save. Every change is
appended to `seller_product_status_change_history` (from/to of both fields,
action, reason, tracker fields) in the same transaction; a reason is required
to reject or suspend. Existing products got a `baseline` row.
APIs: seller `/v1/api/seller/products` (list own with filters, details, create,
update, media-files, delete) and read-only `/v1/api/seller/catalog/*` lookups;
admin list gained `status` / `activeStatus` filters; admin
`GET /v1/api/admin/product-status-history`. Frontend: admin products list
(status and activity columns, filters, reason prompts), form, details with
history, `/admin/catalog/products/status-history`; seller portal
`/seller/products`, `/new`, `/[id]` reusing the admin forms through a portal
object. After login a seller lands on `/seller/dashboard` (`GET /v1/api/seller/dashboard`:
product counts by status and activity, visible, locked, SKUs, out-of-stock
SKUs); the seller portal navigation is a left sidebar.

- [x] Backend
- [x] Frontend
- [ ] QA

## User Management, Login & Registration

Users (customers) register and log in with an international phone number +
password (`/v1/api/user/auth/{register,login}`). `isActive` was replaced by
`status` (`active` default / `suspended`) plus `suspensionReason`. A suspended
user can still log in and read their own profile (`GET /user/profile`, which
carries `access` and the reason) but every other call returns 403
`USER_SUSPENDED`. The access guard re-reads the user per request, so
suspending applies to tokens already issued. Every status change (and the
first status on register / admin create) is appended to
`user_status_change_history` with from/to status, reason and the actor's
created-by / creator type / creator name; written in the same transaction as
the change. Suspending requires a reason. Admin: `/v1/api/admin/users`
(list with search + status filter and cursor pagination, details, create,
update incl. suspend/reactivate) and `/v1/api/admin/user-status-history`
(cursor paged; filters userId, search, fromStatus, toStatus).
Frontend: admin `app/admin/users` (list, new, details with a status history
section) and a separate list page `/admin/users/status-history`,
user portal `app/user/{login,register,profile}`.

- [x] Backend
- [x] Frontend
- [ ] QA

## Checkout and Orders: Customer and Guest API

Third part of cart and checkout. Checkout is per cart: one cart becomes one
order. `GET /v1/api/user/checkout/:cartId?countryCode=BD` gives the live cart,
a price and delivery time for each delivery type (shipping zone for that
country, else the global default) and the active payment gateways with the
proof each one asks for. `POST /v1/api/user/checkout/:cartId/place` takes the
recipient, address (free text plus country), delivery type, gateway and proof;
prices are never accepted from the client. Placing re-validates every line
against live stock, takes the stock with a conditional update (a lost race
is a clean 409 with `issues`), then writes the order (pending, payment
`due`, gateway id/name/slug, shipping as quoted), its lines, the payment row,
the first history row, and turns the cart inactive with `cart.orderId` and
`order.cartId` set both ways. Open to guests (`x-cart-session`); guest orders
move to the account on login merge. Customer orders: list with page numbers
and filters (`status`, `paymentStatus`, `search`), detail with items, totals,
address, payments and status history (who and when), `POST :id/cancel`
(pending only, gives stock back), and `GET track?orderNumber&phone` for
guests without a session. Status changes go through one `OrderStatusService`
(customer: cancel while pending; seller: pending to confirmed or cancelled,
then packed, shipped, delivered, no cancel after confirmed; admin: any status;
cancel gives stock back, reopening takes it again or fails). Migration
`OrdersCheckout` also fixes the order and payment drift: guest buyer columns,
`paymentGatewayName`, `amountPaid`, `fromStatus` on history, payment status
default `due`. Enums are now: order pending, confirmed, cancelled, packed,
shipped, delivered; payment due, paid, partially_paid. Seller and admin order
endpoints, payments, attachments and order updates come in the next steps.
API test: `apps/server/docs/testing/order_checkout_test.py`; unit test for the
status rules: `src/order/utils/order-status-rules.spec.ts`.

- [x] Backend
- [ ] Frontend
- [ ] QA

## Payments, Payment Proof and Order Updates (Staff API)

Fourth part of cart and checkout. A customer may pay outside the site, so the
order stays `pending` with payment `due` until the seller or admin marks it paid
(`POST /v1/api/admin/orders/:id/payments`, `POST /v1/api/seller/orders/:id/payments`,
multipart). Proof is required: a description and 1-10 files (images, or pdf, doc,
docx, xls, xlsx, txt, csv, up to 10 MB each, checked by extension, MIME type and
file signature). The amount is optional (default: whole balance due) and may be a
part payment: the order becomes `partially_paid` until the receipts add up to the
payable amount, then `paid`; paying more than the balance, paying a paid order or
a cancelled order is refused. The first receipt turns the checkout row into the
payment, later ones are new rows; every row keeps the gateway id, name and slug.
Files go in the new `payment_attachments` table, and each change of payment
status is written to `payment_status_history` (from, to, amount, total after,
note, who). Staff can also post an order update (`POST .../orders/:id/updates`:
text, files or both, table `order_update` with `order_update_attachments`). The
customer's order detail now shows each payment with its files, the payment
history and the updates, with who and when; admin and seller get the same data in
the order details (next step). Admin and seller each get a payment list with
filters (status, order, order number, gateway, seller (admin), customer name,
phone or email, transaction id, amount range, has files, created and paid date
ranges) and payment details with files and history: `/v1/api/admin/payments`,
`/v1/api/seller/payments` (a seller only ever sees their own orders' payments).
Proof files are served from `/uploads` like all other uploads. API test:
`apps/server/docs/testing/order_payment_test.py`.

- [x] Backend
- [ ] Frontend
- [ ] QA

## Orders: Admin and Seller (lists, details, status, order entry)

Fifth part of cart and checkout. Admin sees every order, a seller only their own
(`/v1/api/admin/orders`, `/v1/api/seller/orders`, another seller's order is 404).
List (cursor) with filters: order status, payment status, seller (admin), buyer
name / phone / email, account or guest, order number, payment method, delivery
type, country, payable range, placed date range. Details show items, totals,
address, delivery, every payment with its files, payment history, order history
(who and when) and updates, plus the statuses the viewer may move the order to.
`PATCH :id/status` goes through one rule set: seller pending to confirmed or
cancelled, then packed, shipped, delivered, no cancel after confirmed; admin any
status to any other; cancel returns stock, reopening takes it again or fails.
Order entry: `GET customers?q=` finds an account by exact email or mobile (any
common format); `GET catalog` lists the seller's buyable products and variants;
`GET options` gives countries, delivery prices and payment methods;
`POST /orders` creates the order (admin sends `sellerId`, a seller's own is used;
`userId` from the search, or none for a walk-in customer). Prices, stock and
delivery are worked out by the server; the order starts pending with payment due
and its history says who placed it. Checkout and order entry now share one
placement service. Frontend: admin `Orders` and `Payments` in the Commerce group,
seller `Orders` and `Payments` in the sidebar; list with filters, order details
(change status with a note, mark as paid with files, post updates, histories),
create-order page (customer search, seller pick for admin, items, address,
delivery, payment), payment list and details. Test suites:
`apps/server/docs/testing/order_staff_test.py` (165), unit tests for the rules in
`src/order/utils/order-status-rules.spec.ts`.

- [x] Backend
- [x] Frontend
- [ ] QA

## Customer Checkout and Orders (storefront)

Sixth part of cart and checkout. Every cart (`/cart`, and the cart panel on product
and seller pages) has a "Check out with {seller}" button to `/checkout/:cartId`:
recipient (name, phone, optional email, prefilled for a signed-in customer),
country and address, delivery type with live prices for that country (zone price,
else the global default), payment method with its instructions, account details
and the proof fields it asks for, a note, and an order summary. Guests can check
out. Placing re-checks stock and prices on the server, then opens
`/orders/:id?placed=1` with the order number (guests are told to keep it).
`/orders` lists my orders (page numbers, status and order-number filters);
`/orders/:id` shows progress, items, totals, delivery, payments with proof files,
updates from the seller, and the order history with who and when; a pending order
can be cancelled there. `/orders/track` lets a guest find an order by number and
phone. Header and footer link to orders; the profile page links to orders and
carts. Cancelled and confirmed orders explain why they cannot be cancelled.

- [x] Backend (steps 1-5)
- [x] Frontend
- [ ] QA

## Follow-ups: Payment Reversal, Address Book, Checkout Messages

**Payment reversal.** Staff can undo a recorded payment: `POST /v1/api/admin/orders/:id/payments/:paymentId/reverse`
and the seller route, with a required reason. The receipt is kept as reversed (who, when, why; its proof files
stay), the order's received total and payment status go back (paid, partially paid or due), and
`payment_status_history` gets a line (from, to, money out as a negative amount, total after, note, who).
A seller can only reverse a payment a seller recorded; an admin can reverse any. Paying again adds a new receipt.
Payment lists filter `reversed`; the order and payment screens show a Reversed badge, the reason and a
"Reverse payment" action; customers see that a payment was reversed.

**Address book.** Customers keep addresses with country, state (division), city (district) and a free-text
address, plus recipient, phone and postal code (`/v1/api/user/addresses`); an admin manages a customer's
list on their behalf (`/v1/api/admin/users/:userId/addresses`, shown on the admin user page). The first
address is the default, one default per customer (enforced by the database), at most 20, deletes are soft and hand the
default to the newest address left. Storefront: `/addresses`; checkout offers saved addresses (default
prefilled) and "Save this address for next time"; admin create-order fills from the customer's saved
addresses. Migration `PaymentReversalAddressBook` replaces the old division/district links on `address`.

**Checkout messages.** A stock conflict now lists the items (for example "Only 1 of X left") with a link to the
cart; `ApiError` carries the server's `issues`.

Tests: `address_test.py` (93), `order_payment_test.py` (now 165).

- [x] Backend
- [x] Frontend
- [ ] QA

## Saved Addresses While Placing an Order

Checkout (customer), admin order entry and seller order entry now all show the customer's saved
addresses (default selected and filled in), let the creator pick another or type a new one, and
offer a "Save this address" button when what is typed is not a saved address; pressing it saves
it to the customer's book and selects it (checkout's old "save for next time" tick is replaced).
Sellers get `GET` and `POST /v1/api/seller/orders/customers/{userId}/addresses` (read and add only;
a suspended customer is refused); admin uses `/v1/api/admin/users/{userId}/addresses`. Docs updated.
Tests: `order_staff_test.py` now 182.

- [x] Backend
- [x] Frontend
- [ ] QA

## Full Order Journey Test

New black-box suite `apps/server/docs/testing/order_journey_test.py` (557 checks): a guest journey from cart to
delivered (seller, admin, tracking, part and full payment, updates), a customer journey (MFS proof, cancel,
admin reopen, short-stock reopen), staff-created orders, payment reversal rules and history, file upload
abuse, an access sweep of every admin and seller order endpoint (no token, bad token, wrong role, seller not
approved or active), id and body fuzzing (never a 5xx), concurrency (last units, status races, parallel payments,
reversals, cancels, double submit), changes after the cart was built, list filters and cursor paging, data
invariants (money, stock conservation, history chain), and a full role x status matrix. All existing suites also pass.

- [x] Backend
- [x] Tests
- [ ] QA

## Money As Double

All 34 money columns (carts, orders, items, payments, payment history, coupons, returns, payouts, product
prices, shipping charge, seller commission rate) are now `double precision` (migration `MoneyAsDouble`, with a
down step). Entities no longer use the decimal transformer. Input is still limited to 2 decimals (DTOs, settings, storefront price
filter) and every sum is rounded to 2 decimals (`shared/utils/money.util.ts`) so 0.1 + 0.2 is stored as 0.3; the
smallest payment is 0.01. Tests updated, new J1b float section in
`order_journey_test.py` (now 576). Docs updated.

- [x] Backend
- [x] Tests
- [ ] QA
