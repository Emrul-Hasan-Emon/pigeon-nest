# Customer Order Flow

Everything a **customer or guest** does to buy: carts, checkout, orders, cancelling, tracking and
the address book. Plain words first, then the API calls. For the whole picture across all roles
read `docs/order-guide.md`; the admin and seller versions are `docs/admin/order-flow.md` and
`docs/seller/order-flow.md`.

Base URL: `/v1/api/user` (the paths below are relative to it).

## Who you are to the server

There are two ways to be identified. Pick one per request, never both.

| You are | Send | Notes |
|---|---|---|
| **Signed-in customer** | `Authorization: Bearer <user access token>` | An invalid token is `401`. An admin or seller token on these routes is `403`. A suspended customer is `403` |
| **Guest** | `x-cart-session: <session code>` | 8 to 100 letters, digits, `-` or `_` (anything else is `400`). Get one from `POST /carts/session`, keep it in the browser |

Guests can use carts, checkout, the order list and an order's details (for orders from the same
session). The address book needs an account.

---

## Contents

1. [The journey](#1-the-journey)
2. [Carts](#2-carts)
3. [After signing in: merging guest carts](#3-after-signing-in-merging-guest-carts)
4. [Checkout](#4-checkout)
5. [Orders: list, details, cancel](#5-orders-list-details-cancel)
6. [Tracking an order without an account](#6-tracking-an-order-without-an-account)
7. [What the statuses mean to you](#7-what-the-statuses-mean-to-you)
8. [Address book](#8-address-book)
9. [Endpoint summary](#9-endpoint-summary)
10. [Errors](#10-errors)

---

## 1. The journey

```
Browse  ->  Add to cart  ->  Check out one cart  ->  Pay the seller  ->  Follow the order
              (one cart           (one order per          (outside the           (status, updates,
               per seller)         cart)                   website)               payments, history)
```

Key facts:

- You get **one cart per seller**. Three sellers in your basket means three carts and, after
  checkout, three separate orders.
- Prices and stock come from the server. A cart always shows today's price and stock, and the
  server re-checks them the moment you place the order.
- You **pay the seller directly** (cash on delivery, bank, mobile money). The seller or admin
  marks your order paid after checking. Entering a transaction ID at checkout does not mark it paid
  by itself.
- You can **cancel only while the order is `pending`**. After the seller confirms, you cannot.

## 2. Carts

Carts need no sign-in (guests send `x-cart-session`).

| Method | Path | What |
|---|---|---|
| `POST` | `/carts/session` | A fresh guest session code: `{ "sessionId": "..." }`. No auth needed |
| `GET` | `/carts` | All your active carts, newest activity first, plus `summary` |
| `GET` | `/carts/summary` | Just the counts for a header badge: `{ "cartCount": 2, "itemCount": 5 }` |
| `GET` | `/carts/seller/{sellerId}` | Your cart with one seller (`cart` is `null` if none yet); use it on product and seller pages |
| `POST` | `/carts/items` | Add an item |
| `PATCH` | `/carts/{cartId}/items/{itemId}` | Change a quantity |
| `DELETE` | `/carts/{cartId}/items/{itemId}` | Remove an item (removing the last one deletes the cart) |
| `DELETE` | `/carts/{cartId}` | Empty the cart (`204`) |

Add an item:

```json
POST /carts/items
{ "sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 2 }
```

`sellerProductSkuId` (the variant) is optional: left out, the default or cheapest in-stock variant is
used. `quantity` defaults to 1 and is at most 99. The reply is `{ "cart": {...}, "notice": null }`.
If you asked for more than there is, the quantity is lowered and `notice` says so. Another seller's
product goes into a **different cart** automatically.

To buy at an accepted price proposal, send its id instead of a quantity (see `proposals-flow.md`):
`{ "sellerProductId": 94, "proposalId": 31 }`. The SKU and quantity come from the proposal. A different
`quantity` is `400`, a proposal that is not yours or not accepted is `404`/`400`, and guests cannot use one.

A cart (always live):

```json
{ "id": 299, "isActive": true,
  "seller": { "id": 5, "name": "Rahim Pigeon Loft", "avatarUrl": null },
  "lines": [ { "id": 412,
      "product": { "id": 94, "name": "Blue Bar Racing Homer", "slug": "blue-bar-racing-homer", "thumbnailUrl": "..." },
      "sku": { "id": 119, "code": "HOM-BB-M", "label": "Gender: Male / Color: Blue Bar", "imageUrl": null },
      "quantity": 2, "unitPrice": 3500, "unitPayable": 3200, "linePayable": 6400,
      "availableQuantity": 6, "status": "ok", "priceChanged": false, "previousUnitPayable": 3200,
      "skuUnitPayable": 3200, "proposal": null, "proposalNotice": null } ],
  "totals": { "itemCount": 2, "listTotal": 7000, "payableTotal": 6400, "savings": 600 },
  "canCheckout": true, "issues": [], "notices": [], "updatedAt": "..." }
```

Line `status`: `ok`, `unavailable` (product, variant or seller switched off), `out_of_stock`,
`insufficient_stock` (fewer left than you want; `availableQuantity` says how many). Only `ok`
lines are in `totals`. `canCheckout` is true only when every line is `ok`; `issues` lists plain
sentences to show ("Only 1 of X left."). `priceChanged` is true when today's price differs from the
price when you added it.

Proposal lines: `proposal` is `{ id, unitPrice, applied }` and `unitPayable` is the proposal price while
`applied` is true. The quantity of such a line cannot be changed (`400`, "fixed"), and the same SKU cannot be
added plainly next to it. `skuUnitPayable` is the live SKU price. If the SKU is now cheaper than the proposal,
`applied` is false, the line pays the SKU price and `proposalNotice` says so. If the proposal was closed (an
admin rejected or cancelled it), the line is back at the SKU price and `proposalNotice` says why. Every
`proposalNotice` is also listed in the cart's `notices` (messages that do not block checkout).

Other rules: a parallel double-add never creates two carts or two lines; an admin or seller token on
a cart route is `403`; a guest with no `x-cart-session` gets `400` on writes.

## 3. After signing in: merging guest carts

Right after login or registration, send the guest session once:

```json
POST /carts/merge        (needs the customer's bearer token)
{ "sessionId": "<the guest session code>" }
```

The guest carts are folded into the account's carts: quantities add up (never above stock), items no
longer available are dropped, empty results leave no cart behind. **Orders placed with that guest
session also move to the account.** The reply is the account's cart list. After a successful merge
the browser can forget the session code.

## 4. Checkout

Checkout is for **one cart**. There are two calls.

### 4.1 Get the checkout options

```
GET /checkout/{cartId}?countryCode=BD
```

The cart must be yours and active (`404` otherwise, including a cart that was already ordered).
`countryCode` (2 letters, optional) makes the server price delivery for that country. Reply:

```json
{ "cart": { ...the live cart... },
  "countryCode": "BD", "countryName": "Bangladesh",
  "deliveryOptions": [
    { "deliveryType": "standard", "charge": 60, "estimatedDays": 7, "supportsLiveAnimal": true, "zoneName": null, "payable": 6460 },
    { "deliveryType": "express",  "charge": 120, "estimatedDays": 3, "supportsLiveAnimal": true, "zoneName": "South Asia express", "payable": 6520 },
    { "deliveryType": "pickup",   "charge": 0, "estimatedDays": 7, "supportsLiveAnimal": true, "zoneName": null, "payable": 6400 } ],
  "paymentGateways": [
    { "id": 2, "name": "Cash on Delivery", "slug": "cash-on-delivery", "type": "cod", "typeLabel": "Cash on delivery",
      "description": null, "iconUrl": null, "accountName": null, "accountNumber": null, "bankName": null, "branchName": null,
      "proofFields": [] },
    { "id": 38, "name": "bKash", "type": "mfs", "accountNumber": "01711111111",
      "description": "Send the total, then enter the transaction ID.",
      "proofFields": [ { "key": "transactionId", "label": "Transaction ID", "required": true } ] } ] }
```

Without `countryCode`, `deliveryOptions` is empty. The delivery price comes from the shipping zone for
that country and delivery type, else the global default. Show the gateway's instructions and account
details, and ask for each `proofFields` entry.

### 4.2 Place the order

```json
POST /checkout/{cartId}/place
{ "recipientName": "Aisha Rahman", "recipientPhone": "+8801712345678",
  "contactEmail": "aisha@example.com", "countryCode": "BD", "state": "Dhaka Division",
  "city": "Dhaka", "addressLine": "House 7, Road 3, Banani", "postalCode": "1213",
  "deliveryType": "standard", "paymentGatewayId": 38,
  "paymentProof": { "transactionId": "BK-12345" }, "note": "Call before delivery" }
```

| Field | Required | Rule |
|---|---|---|
| `recipientName` | yes | 2 to 255 characters |
| `recipientPhone` | yes | international format with `+` and country code |
| `contactEmail` | no | valid email; defaults to your account email |
| `countryCode` | yes | 2-letter code (`BD`, `US`, ...) |
| `state`, `postalCode` | no | state up to 120, postal code up to 20 |
| `city` | yes | up to 120 |
| `addressLine` | yes | 5 to 500 characters |
| `deliveryType` | yes | `standard`, `express` or `pickup` |
| `paymentGatewayId` | yes | an active gateway from the options |
| `paymentProof` | per gateway | an object with **only** that gateway's `proofFields`; required ones must be filled (for example `transactionId` for mobile banking). A field the gateway does not take is `400` |
| `note` | no | up to 1000 |
| `expectedItemsTotal` | no | the items total the customer saw (2 decimals). If the cart's live total is different now (a price changed, or an accepted offer was closed), nothing is ordered and the reply is `409` with `code: PRICE_CHANGED`, `currentTotal` and `notices`. The shop sends it; leave it out to order at whatever the live total is |

**Never send prices, totals or the delivery charge** (any such field is rejected). The server uses live
prices, live stock and the delivery price for your country.

What the server does, all or nothing: re-checks every line, takes the stock (a lost race for the last
item is a clean `409`), creates the order (`pending`, payment `due`, order number like
`PN261120-K7M2QX`), saves the lines at the price sold, creates the payment record with your proof,
writes the first history lines, and turns the cart **inactive** (linked to the order both ways). Reply:
`201` with the full order (section 5.2).

If something changed, the reply is `409` with a message and the reasons:

```json
{ "statusCode": 409, "message": "Some items in this cart cannot be bought right now. Update the cart and try again.",
  "issues": [ "Only 1 of Red Chequer Sprinter left." ] }
```

Show the `issues` to the customer with a link back to the cart. Sending the same cart twice (double
click, two tabs) gives one order and `409 This cart has already been ordered` for the second.

A guest's order is tied to the session code. Show the order number and tell the guest to keep it with
their phone number (section 6).

## 5. Orders: list, details, cancel

### 5.1 List

```
GET /orders?page=1&pageSize=10&status=pending&paymentStatus=due&search=PN2611
```

Page numbers (default page 1, page size 20, max 50). `status` and `paymentStatus` filters,
`search` matches the order number (any part, any case). Reply:

```json
{ "results": [ { "id": 117, "orderNumber": "PN261120-2L4SMZ", "status": "pending", "paymentStatus": "due",
    "seller": { "id": 6, "name": "Karim Breeders", "avatarUrl": null },
    "itemCount": 3, "previewItems": [ { "productName": "...", "imageUrl": "..." } ],
    "payable": 9120, "amountPaid": 0, "gateway": { "id": 2, "name": "Cash on Delivery", "slug": "cash-on-delivery" },
    "canCancel": true, "createdAt": "..." } ],
  "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
```

A guest sees the orders of their session; a customer sees their account's orders.

### 5.2 Details

```
GET /orders/{id}
```

Someone else's order is `404`. The reply holds: `status`, `paymentStatus`, `canCancel`, `seller`,
`items` (price paid, variant, picture; for a proposal line also `skuUnitPrice`, the SKU price at that time, and `proposal` with `id`, `unitPrice`, `lineTotal`), `totals` (`subtotal`, `deliveryCharge`, `payable`,
`amountPaid`, `balanceDue`, `savings`), `delivery` (type, expected days), `address`, `payments` (each
with its proof files and, if staff undid it, a `reversal` with the reason), `paymentHistory` (every
payment change with the money, who and when; a reversal shows as a negative amount),
`updates` (messages and files from the seller or admin) and `statusHistory` (every status change with
the note, who and when).

### 5.3 Cancel

```json
POST /orders/{id}/cancel
{ "reason": "Ordered by mistake" }
```

`reason` is optional (max 500; if empty the history says "Cancelled by the customer"). Allowed **only
while the order is `pending`**; the stock goes back on the shelf. Otherwise `403` with the reason
("An order can only be cancelled before the seller confirms it"). Cancelling twice is `403`. After
confirmation, contact the seller; only an admin can cancel it.

## 6. Tracking an order without an account

For a guest who has the order number and phone but not the original browser:

```
GET /orders/track?orderNumber=PN261120-2L4SMZ&phone=%2B8801712345678
```

No sign-in and no session needed. `phone` must be in international format (`%2B` is `+`). A wrong number
or phone is `404 No order matches that number and phone` (the same message for both, so nobody can
probe for other people's orders). The reply is the order's details. This route only **shows**; to
cancel, use the browser session that placed the order, or sign in.

## 7. What the statuses mean to you

Order status:

| Status | What it means | Can you cancel? |
|---|---|---|
| `pending` | Placed, waiting for the seller | Yes |
| `confirmed` | The seller accepted it | No |
| `packed` | Packed | No |
| `shipped` | On its way | No |
| `delivered` | You have it | No |
| `cancelled` | Stopped | n/a |

Normal path: `pending`, `confirmed`, `packed`, `shipped`, `delivered`.

Payment status (separate): `due` (nothing recorded yet), `partially_paid` (some received),
`paid` (all received). The seller or admin records payments with proof; one can be reversed if it was a
mistake, and you see that in the payment history. An order can be delivered but still `due`
(for example cash on delivery before the cash is recorded).

Stock: placing an order takes stock; a cancelled order puts it back.

## 8. Address book

Needs an account (bearer token). Saved addresses make checkout faster; orders keep their own copy of the
address, so editing or deleting one never changes an order.

| Method | Path | What |
|---|---|---|
| `GET` | `/addresses` | Your addresses, default first, then newest: `{ "results": [...] }` |
| `POST` | `/addresses` | Add one |
| `GET` | `/addresses/{id}` | One |
| `PATCH` | `/addresses/{id}` | Change fields |
| `DELETE` | `/addresses/{id}` | Delete (`204`) |

```json
POST /addresses
{ "recipientName": "Aisha Rahman", "phone": "+8801712345678", "countryCode": "BD",
  "state": "Dhaka Division", "city": "Dhaka",
  "address": "Flat 4B, Road 9, Banani, near the lake gate", "zipCode": "1213", "isDefault": true }
```

| Field | Required | Rule |
|---|---|---|
| `recipientName` | yes | 2 to 255 |
| `phone` | yes | international format with `+` |
| `countryCode` | yes | 2-letter code |
| `state` | no | state, province or division, up to 120 |
| `city` | yes | city or district, up to 120 |
| `address` | yes | the address in words, 5 to 500 |
| `zipCode` | no | up to 20 |
| `isDefault` | no | `true` to make it the default |
| `type` | no | `shipping` (default) or `billing` |

Rules:

- The **first** address you save becomes the default automatically.
- Only **one default** at a time. Saving or editing an address with `isDefault: true` takes the role from
  the old one. Sending `isDefault: false` on the default is ignored (choose another address as the
  default instead).
- At most **20** addresses (`409` after that).
- On `PATCH` send only what changes; a blank (or `null`) `state` or `zipCode` clears it.
- Deleting the default hands the default to your newest remaining address.
- Another customer's address is `404`.
- An admin can manage your addresses on your behalf (it is recorded as made by the admin).
- A seller entering an order for you can see your saved addresses and add a new one; they cannot edit or
  delete yours.

At checkout (the screen): your saved addresses are offered in a list and the default is filled in. Pick
another to fill the fields, or type a new address. When what is typed is not a saved address (or you
changed a saved one), a **Save this address** button appears; pressing it saves it to your address book
(`POST /addresses`) and selects it. Guests have no address book and just type an address.

## 9. Endpoint summary

All under `/v1/api/user`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/carts/session` | anyone | New guest session code |
| GET | `/carts` | guest or customer | All my active carts |
| GET | `/carts/summary` | guest or customer | Badge counts |
| GET | `/carts/seller/{sellerId}` | guest or customer | My cart with one seller |
| POST | `/carts/items` | guest or customer | Add an item |
| PATCH | `/carts/{cartId}/items/{itemId}` | guest or customer | Change quantity |
| DELETE | `/carts/{cartId}/items/{itemId}` | guest or customer | Remove an item |
| DELETE | `/carts/{cartId}` | guest or customer | Empty a cart |
| POST | `/carts/merge` | customer | Fold guest carts (and orders) into my account |
| GET | `/checkout/{cartId}` | guest or customer | Options: delivery prices, payment methods |
| POST | `/checkout/{cartId}/place` | guest or customer | Place the order |
| GET | `/orders` | guest or customer | My orders (page numbers, filters) |
| GET | `/orders/{id}` | guest or customer | One order in full |
| POST | `/orders/{id}/cancel` | guest or customer | Cancel while pending |
| GET | `/orders/track` | anyone | Find an order by number and phone |
| GET/POST | `/addresses` | customer | List / add addresses |
| GET/PATCH/DELETE | `/addresses/{id}` | customer | One address |

## 10. Errors

| Code | When |
|---|---|
| `400` | Validation (message lists the fields), bad session code, a guest without `x-cart-session`, a payment method that does not take a proof field, a proof field missing |
| `401` | Invalid or expired bearer token |
| `403` | Admin or seller token on a customer route, suspended customer, or a cancel that is not allowed |
| `404` | Cart, order or address not found or not yours; no order for a number and phone |
| `409` | Cart already ordered or empty; items cannot be bought now (`issues` explains); the total changed since the customer saw it (`PRICE_CHANGED`, with `currentTotal`); a proposal was closed during checkout; address limit reached |

Paging: `pageSize` is 1 to 50 and `page` starts at 1 (`0` or a larger page size is `400`).

Pressing "Place order" or "Cancel" several times, or from two devices, is safe: only one order is made from a cart
and only one cancel counts. Stock is taken and given back once.

Validation is strict: unknown fields in a request body are rejected with `400`.
