# Seller Order Flow

Everything a **seller** does with orders and payments, in plain words first and then as API
calls. For the whole picture across all roles read `docs/order-guide.md`; the admin and
customer versions are `docs/admin/order-flow.md` and `docs/user/order-flow.md`.

Base URL: `/v1/api/seller` (the paths below are relative to it). Every call needs the seller's
bearer token:

```
Authorization: Bearer <seller access token>
```

The seller must be **approved and active** to use orders and payments (see
`docs/seller-account-guide.md`). A seller who is pending, rejected, inactive or suspended gets
`403` with the reason. A missing token is `401`; an admin or customer token is `403`.

---

## Contents

1. [What a seller can and cannot do](#1-what-a-seller-can-and-cannot-do)
2. [The life of an order from the seller's side](#2-the-life-of-an-order-from-the-sellers-side)
3. [Finding and reading orders](#3-finding-and-reading-orders)
4. [Changing an order's status](#4-changing-an-orders-status)
5. [Payments: record, part-pay, reverse](#5-payments-record-part-pay-reverse)
6. [Order updates](#6-order-updates)
7. [Creating an order for a customer](#7-creating-an-order-for-a-customer)
8. [Payment lists](#8-payment-lists)
9. [Endpoint summary](#9-endpoint-summary)
10. [Errors](#10-errors)

---

## 1. What a seller can and cannot do

| A seller can | A seller cannot |
|---|---|
| See **their own** orders and payments, with filters | See other sellers' orders or payments (a foreign order is `404`) |
| Confirm or cancel a **pending** order | Cancel an order after it is confirmed (only an admin can) |
| Pack, ship and deliver a confirmed order | Skip steps, go backwards, or reopen a cancelled order |
| Record full or part payments, with proof | Record a payment on a cancelled or fully paid order |
| Reverse a payment **a seller recorded** | Reverse a payment an admin recorded |
| Post updates (text and files) on their orders | See carts (customers' carts are not visible to sellers) |
| Create orders for their own shop | Create orders for another seller |

## 2. The life of an order from the seller's side

```
Customer places order                Order: PENDING     Payment: DUE
        |
        v
Seller CONFIRMS (or CANCELS)         Order: CONFIRMED
        |
        v
Seller PACKS                         Order: PACKED
        |
        v
Seller SHIPS                         Order: SHIPPED
        |
        v
Seller marks DELIVERED               Order: DELIVERED
        |
        v
Payment is recorded (any time)       Payment: PARTIALLY_PAID -> PAID
```

- **Cancel**: only while the order is `pending`. After confirming, it can only move forward. If
  something goes wrong later, ask an admin.
- **Payment is separate from the order status.** The customer pays you outside the website (cash,
  bank, mobile money). You mark the payment as received, with proof, whenever the money arrives
  (before shipping, at delivery, in instalments).
- Stock leaves the shelf when the order is placed and returns if the order is cancelled.

## 3. Finding and reading orders

| Method | Path | What |
|---|---|---|
| `GET` | `/order` | Your orders, newest first (cursor paging) |
| `GET` | `/order/{id}` | One order in full |

List filters (all optional): `status`, `paymentStatus`, `customerSearch` (recipient or account
name, phone, email), `owner` (`customer` or `guest`), `orderNumber`, `gatewayId`, `deliveryType`,
`countryCode`, `minTotal`, `maxTotal`, `createdFrom`, `createdTo`, `cursor`, `limit`. (`sellerId`
is ignored; you only ever see your own.) Statuses: `pending`, `confirmed`, `cancelled`, `packed`,
`shipped`, `delivered`; payment statuses: `due`, `partially_paid`, `paid`.

A list row:

```json
{ "id": 77, "orderNumber": "PN261120-Y8EYRS", "status": "pending", "paymentStatus": "due",
  "itemCount": 1, "payable": 1000, "amountPaid": 0,
  "gateway": { "id": 2, "name": "Cash on Delivery", "slug": "cash-on-delivery" },
  "customer": { "userId": null, "isGuest": true, "name": "Browser Buyer 1", "phone": "+8801712340111", "email": null },
  "deliveryType": "standard", "countryCode": "BD", "countryName": "Bangladesh",
  "allowedStatuses": ["confirmed", "cancelled"], "createdAt": "..." }
```

**`allowedStatuses` tells you exactly which moves you may make right now.** Build your buttons
from it.

Details add: `items` (with the price paid and the variant, and `bird`: the ring number, hatch date, vaccination, breed, bloodline, sire and dam as sold, or `null`, so you pack the right bird; for an item bought at a price proposal also `skuUnitPrice`, the SKU price at that time, and `proposal` with `id`, `unitPrice`, `lineTotal`. The order `subtotal` and your system commission use the proposal total), `totals` (`subtotal`, `deliveryCharge`,
`payable`, `amountPaid`, `balanceDue`), `delivery` (type, expected days), `address` (recipient,
phone, full address, country), `payments` (each with proof `attachments`, the customer's typed
`proof` such as the transaction ID, `recordedBy`, and `reversal`), `paymentHistory`,
`statusHistory`, `updates`, and the customer's `note`.

## 4. Changing an order's status

```json
PATCH /order/{id}/status
{ "status": "confirmed", "note": "Packing tomorrow morning" }
```

The response is the updated order. `note` (max 500) is optional and the customer sees it.

| From | You may move to |
|---|---|
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `packed` |
| `packed` | `shipped` |
| `shipped` | `delivered` |
| `delivered` | nothing |
| `cancelled` | nothing (an admin can reopen it) |

Refusals are `403` with a clear message, for example:

- `Only an admin can cancel an order after it is confirmed`
- `Only an admin can reopen a cancelled order`
- `A seller cannot move an order from confirmed to shipped`
- `The order is already confirmed`

Cancelling returns the stock. A foreign order is `404`. Each change is written to the order
history with your shop name and the time.

## 5. Payments: record, part-pay, reverse

### 5.1 Record a payment

```
POST /order/{id}/payments        (multipart/form-data)
```

| Field | Required | Notes |
|---|---|---|
| `description` | yes | 3 to 1000 characters: how it was paid ("bKash to the shop number") |
| `files` | yes, 1 to 10 | image, pdf, doc(x), xls(x), txt, csv; 10 MB each |
| `amount` | no | up to 2 decimals, at least 0.01; default = the whole balance; may not exceed the balance |
| `transactionId` | no | max 100 |
| `paidAt` | no | ISO date, not in the future; default now |

Result `201 { "orderId": 77, "paymentId": 61 }`.

- The order becomes `partially_paid` until the receipts add up to the payable amount, then `paid`.
- Example for an order of 6,440: record 1,000 (partly paid), then 500.50 (partly paid, 1,500.50
  received), then send no amount to record the rest (paid).
- Refused: `400` (no files, no description, bad amount, bad file, amount above the balance), `409`
  (already fully paid, order cancelled).
- Details the customer typed at checkout (transaction ID, bank reference) are on the order for you
  to check against your bank or wallet before recording.

### 5.2 Reverse a payment you recorded

```json
POST /order/{id}/payments/{paymentId}/reverse
{ "reason": "Cheque bounced" }
```

- Works only on a payment **a seller recorded**. A payment an admin recorded gives
  `403 Only an admin can reverse a payment an admin recorded`.
- The payment stays on record as reversed (who, when, why; its files stay). The order goes back to
  `due` or `partially_paid`. The payment history gets a line with the money shown as taken out.
- `409` if the payment was never received or is already reversed.
- When the customer pays again, record a new payment; the reversed one stays visible.

## 6. Order updates

```
POST /order/{id}/updates         (multipart/form-data)
```

`message` (max 2000) and/or `files` (up to 10); at least one is needed. Examples: a courier
tracking number, a photo of the packed birds, a health certificate. The customer, you and the admin
all see it with who and when. Result `201 { "orderId": 77, "updateId": 9 }`. Updates cannot be
edited or deleted.

## 7. Creating an order for a customer

For phone and in-shop sales. It is the admin's flow without the seller step: the order is always
for **your** shop.

| Step | Call | Notes |
|---|---|---|
| 1. Find the customer | `GET /order/customers?q=<email or mobile>` | Exact email or a mobile in any common format; up to 5 results `{ id, name, email, phone, canOrder, status }`. Empty = no account, so enter a **walk-in customer** instead. `canOrder: false` = suspended |
| 2. Your products | `GET /order/catalog?search=` | Your approved, active products with active variants and live `price`, `payable`, `quantity` |
| 3. Delivery and payment choices | `GET /order/options?countryCode=BD&subtotal=6400` | `countries`, `deliveryOptions`, active `paymentGateways` |
| 4. Saved addresses | `GET /order/customers/{userId}/addresses` | The customer's saved addresses (default first) to pick from. Pick one to fill the address fields |
| 5. Save a new address (optional) | `POST /order/customers/{userId}/addresses` | After typing an address that is not saved yet: saves it to the customer's address book (same body and rules as the customer's own `POST /addresses`). The screen then selects it. `400` for a suspended customer |
| 6. Create | `POST /order` | below |

```json
POST /order
{ "userId": 129,
  "items": [ { "sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 2 } ],
  "recipientName": "Aisha Rahman", "recipientPhone": "+8801712345678",
  "countryCode": "BD", "city": "Dhaka", "addressLine": "House 7, Road 3, Banani",
  "deliveryType": "standard", "paymentGatewayId": 2 }
```

- A seller can read a customer's saved addresses and add a new one while entering an order, but cannot
  edit or delete them (the customer or an admin does that).
- Leave `userId` out for a walk-in customer (they can still track the order with number + phone).
- Do **not** send `sellerId` for another shop (`403`); you may omit it.
- Never send prices: the server uses the live price, live stock and the delivery charge for the
  country.
- Each variant at most once (raise its quantity), 1 to 50 items, quantity 1 to 99 and not above the
  stock, items must be yours and active. A suspended or unknown customer is `400`.

Result `201` with the order: `pending`, payment `due`, history "Order placed by seller <your shop>",
stock taken. If a customer account was given, the order appears in their account and they can
cancel it while it is still pending.

## 8. Payment lists

| Method | Path | What |
|---|---|---|
| `GET` | `/order/payments` | Payments on **your** orders, newest first (cursor) |
| `GET` | `/order/payments/{id}` | Details: proof, files, reversal, the order summary and that order's payment history |

Filters: `status`, `orderId`, `orderNumber`, `gatewayId`, `customerSearch`, `transactionId`,
`minAmount`, `maxAmount`, `hasAttachments`, `reversed`, `createdFrom`, `createdTo`, `paidFrom`,
`paidTo`, `cursor`, `limit`. `status=due` leaves out reversed receipts unless you also send
`reversed=true`. Another seller's payment is `404`.

## 9. Endpoint summary

All under `/v1/api/seller`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/order` | Your orders |
| GET | `/order/customers` | Find a customer by email or mobile |
| GET | `/order/catalog` | Your sellable products |
| GET | `/order/options` | Countries, delivery prices, payment methods |
| GET | `/order/customers/{userId}/addresses` | A customer's saved addresses |
| POST | `/order/customers/{userId}/addresses` | Save a new address to the customer's book |
| POST | `/order` | Create an order for your shop |
| GET | `/order/{id}` | Order details |
| PATCH | `/order/{id}/status` | Confirm, cancel (pending only), pack, ship, deliver |
| POST | `/order/{id}/payments` | Record a payment |
| POST | `/order/{id}/payments/{paymentId}/reverse` | Reverse a payment you recorded |
| POST | `/order/{id}/updates` | Post an update |
| GET | `/order/payments`, `/order/payments/{id}` | Your payments |

## 10. Errors

| Code | When |
|---|---|
| `400` | Validation (message lists the fields), bad file, amount above balance, unknown customer |
| `401` | No or expired token |
| `403` | Seller not approved and active; not a seller token; a status move or reversal a seller may not make; naming another seller |
| `404` | The order or payment is not yours or does not exist |
| `409` | Order already fully paid or cancelled; payment already reversed or never received |

List paging and filters: `limit` is 1 to 100; `0` or leaving it out gives the default of 20, and a negative number or
more than 100 is `400`. A `cursor` that is not a number means the first page, a negative one is `400`. `minTotal`
above `maxTotal` is `400`.

Two people acting at once: the server settles it safely. If two staff members (or a staff member and the customer)
change the same order or pay it at the same moment, only one action wins and the others get a clear `403` or `409`.
Stock is given back once, and a payment can never push the received amount above the total.

Validation is strict: unknown fields in a request body are rejected with `400`.

Moving many orders at once
--------------------------
`POST /v1/api/seller/order/bulk-status` with `{ orderIds: [..], status, note? }` (1 to 50 ids).
- All the orders must be in the **same status now** (400 otherwise: "All the orders must be in the same status..."),
  and the move must be one a seller may make from it (pending to confirmed or cancelled, confirmed to packed,
  packed to shipped, shipped to delivered; anything else is 400 with the reason).
- An id that is not yours is 404 for the whole request.
- Each order is moved on its own, through the same rules and history as a single change, so one failing does not
  undo the others. The answer is `{ status, updated, failed, results: [{ id, orderNumber, ok, error? }] }`.
In the portal: tick orders on Orders. Once one is ticked, orders at a different step are greyed out. The header
tick selects every order at the picked step on the page. A bar shows "N orders selected", "Move to" (only the
steps that are allowed), an optional note and "Update N orders". Cancelling asks for confirmation first.

