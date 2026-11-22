# Admin Order Flow

Everything an **admin** does with carts, orders and payments, in plain words first and then
as API calls. For the whole picture across all roles read `docs/order-guide.md`; the seller
and customer versions of this document are `docs/seller/order-flow.md` and
`docs/user/order-flow.md`.

Base URL: `/v1/api` (every path below is relative to it). Every call needs an **admin**
bearer token:

```
Authorization: Bearer <admin access token>
```

A missing token is `401`; a seller or customer token is `403`.

---

## Contents

1. [What an admin can do](#1-what-an-admin-can-do)
2. [Set up before the first order](#2-set-up-before-the-first-order)
3. [Watching carts](#3-watching-carts)
4. [Finding and reading orders](#4-finding-and-reading-orders)
5. [Changing an order's status](#5-changing-an-orders-status)
6. [Payments: record, part-pay, reverse](#6-payments-record-part-pay-reverse)
7. [Order updates](#7-order-updates)
8. [Creating an order for a customer](#8-creating-an-order-for-a-customer)
9. [Payment lists](#9-payment-lists)
10. [A customer's addresses on their behalf](#10-a-customers-addresses-on-their-behalf)
11. [Endpoint summary](#11-endpoint-summary)
12. [Errors](#12-errors)

---

## 1. What an admin can do

| Area | Admin power |
|---|---|
| Settings | Payment gateways, shipping zones, global delivery defaults |
| Carts | Read every active and inactive cart (nobody else can see carts) |
| Orders | See all orders of all sellers; move an order to **any** status at any time; create orders for any seller |
| Payments | Record full or part payments; reverse **any** payment; read every payment |
| Updates | Post text and files on any order |
| Customers | Manage a customer's saved addresses on their behalf |

What only an admin can do (a seller cannot): cancel an order after it is confirmed, reopen a
cancelled order, move an order backwards or skip steps, reverse a payment another admin
recorded, read carts.

## 2. Set up before the first order

### 2.1 Payment gateways (`/payment-gateways`)

A gateway is a way for the customer to pay. The platform does not move money; staff record
payments afterwards (section 6).

| Method | Path | What |
|---|---|---|
| `GET` | `/payment-gateways/types` | The rules per type: which account fields to fill, whether instructions are needed, what the customer must enter at checkout (`proofFields`) |
| `GET` | `/payment-gateways` | List (cursor). Query: `search`, `type`, `isActive`, `cursor`, `limit` |
| `GET` | `/payment-gateways/{id}` | One gateway |
| `POST` | `/payment-gateways` | Create (multipart, optional `icon` file up to 2 MB) |
| `PATCH` | `/payment-gateways/{id}` | Update (multipart; `removeIcon=true` clears the icon) |
| `DELETE` | `/payment-gateways/{id}` | Delete. `409` if any order or payment used it. Switch it off instead |

Types: `cod`, `mfs` (mobile banking), `bank`, `card`, `manual`.

| Type | Account fields (required in bold) | Customer enters at checkout |
|---|---|---|
| `cod` | none | nothing |
| `mfs` | accountName, **accountNumber** | **transactionId** |
| `bank` | **accountName**, **accountNumber**, **bankName**, branchName | **senderName**, **transactionReference** |
| `card` | none | **transactionReference** |
| `manual` | accountName, accountNumber; a **description** is required | reference (optional) |

Create example:

```json
POST /payment-gateways
{ "name": "bKash personal", "type": "mfs", "accountNumber": "01711111111",
  "description": "Send the total, then enter the transaction ID." }
```

The `slug` is generated and never changes. One gateway, **Cash on Delivery** (`cash-on-delivery`),
exists from the start.

### 2.2 Shipping zones (`/shipping-zones`, `/countries`)

Delivery is priced by country. A zone = delivery type + a set of countries + charge + days.

| Method | Path | What |
|---|---|---|
| `GET` | `/countries` | All countries (`code`, `name`) for the picker |
| `GET` | `/shipping-zones` | List (cursor). Query: `search`, `deliveryType`, `isActive`, `country`, `cursor`, `limit` |
| `GET` | `/shipping-zones/{id}` | One zone, with country names |
| `POST` | `/shipping-zones` | Create |
| `PATCH` | `/shipping-zones/{id}` | Update |
| `DELETE` | `/shipping-zones/{id}` | Delete |
| `GET` | `/shipping-zones/quote?country=BD&deliveryType=express` | What a customer would pay (zone or global default). Use it to test your setup |

```json
POST /shipping-zones
{ "name": "South Asia express", "deliveryType": "express",
  "countryCodes": ["BD", "IN", "LK"], "charge": 1200, "estimatedDays": 3,
  "supportsLiveAnimal": true, "isActive": true }
```

Rules: `deliveryType` is `standard`, `express` or `pickup`. A country may be in **one active zone
per delivery type**; an overlap is `409` and names the zone and countries. Orders keep the price
and days they were quoted, so editing a zone never changes old orders.

### 2.3 Global defaults (`/settings`)

Used when no zone covers the destination.

| Method | Path | What |
|---|---|---|
| `GET` | `/settings` | Every known setting with its current value |
| `PATCH` | `/settings` | `{ "settings": { "shipping.defaultCharge": 50 } }` |

Keys: `shipping.defaultCharge` (money, 0 = free), `shipping.defaultEstimatedDays` (0 to 365),
`shipping.defaultSupportsLiveAnimal` (yes/no; stored for later, not enforced yet).

## 3. Watching carts

Admin only. Sellers and customers use their own cart endpoints.

| Method | Path | What |
|---|---|---|
| `GET` | `/carts?state=active` | Carts still being filled |
| `GET` | `/carts?state=inactive` | Carts that became an order |
| `GET` | `/carts/{id}` | Details (a line bought at a price proposal carries `proposal` and the proposal price) |

Filters (all optional, combine freely): `customerSearch` (name, email or phone), `userId`,
`sellerId`, `sellerSearch`, `owner` (`customer` or `guest`), `orderNumber` (inactive),
`hasItems`, `minTotal`, `maxTotal`, `createdFrom`, `createdTo`, `updatedFrom`, `updatedTo`,
plus `cursor` and `limit` (cursor paging; `nextCursor` is `null` on the last page).

An **active** cart is shown live (today's prices and stock, `canCheckout`, `issues`). An
**inactive** cart is shown as a snapshot of what it held at checkout, with its `order`.

## 4. Finding and reading orders

| Method | Path | What |
|---|---|---|
| `GET` | `/orders` | List, newest first (cursor paging) |
| `GET` | `/orders/{id}` | Full details |

List filters: `status`, `paymentStatus`, `sellerId`, `sellerSearch`, `userId`, `customerSearch`
(recipient or account name, phone, email), `owner` (`customer`/`guest`), `orderNumber`,
`gatewayId`, `deliveryType`, `countryCode`, `minTotal`, `maxTotal`, `createdFrom`, `createdTo`,
`cursor`, `limit`. Statuses: `pending`, `confirmed`, `cancelled`, `packed`, `shipped`,
`delivered`. Payment statuses: `due`, `partially_paid`, `paid`.

A list row:

```json
{ "id": 74, "orderNumber": "PN261120-WJCRHP", "status": "pending", "paymentStatus": "due",
  "seller": { "id": 5, "name": "Rahim Pigeon Loft", "avatarUrl": null },
  "itemCount": 3, "payable": 12900, "amountPaid": 0,
  "gateway": { "id": 2, "name": "Cash on Delivery", "slug": "cash-on-delivery" },
  "customer": { "userId": null, "isGuest": true, "name": "Demo Rahim", "phone": "+8801712345001", "email": null },
  "deliveryType": "standard", "countryCode": "BD", "countryName": "Bangladesh",
  "allowedStatuses": ["confirmed", "cancelled", "packed", "shipped", "delivered"],
  "createdAt": "..." }
```

Details add: `cartId`, `items` (price paid, variant label, image; for an item bought at a price proposal also `skuUnitPrice`, the SKU price at that time, and `proposal` with `id`, `unitPrice`, `lineTotal`. The order `subtotal` and the commission use the proposal total), `totals` (`subtotal`,
`deliveryCharge`, `payable`, `amountPaid`, `balanceDue`, `savings`), `delivery`, `address`,
`payments` (each with `attachments`, `reversal`, `recordedBy`), `paymentHistory`, `statusHistory`,
`updates`, `note`, and `account` (the customer's user record, if they have one).

## 5. Changing an order's status

```json
PATCH /orders/{id}/status
{ "status": "confirmed", "note": "Checked by phone" }
```

An admin may choose **any status other than the current one**, in any direction (for example
`delivered` back to `shipped`, or `cancelled` back to `pending`). The response is the updated
order details. The `note` (max 500 characters) is optional and visible to the customer.

Flow reminder (what a seller sees):

```
pending -> confirmed -> packed -> shipped -> delivered        (cancel only from pending)
```

Stock follows the change:

| Move | Stock |
|---|---|
| any status -> `cancelled` | ordered quantities go back on the shelf |
| `cancelled` -> any other status | quantities are taken again; if there is not enough, `409 Not enough stock to reopen this order: <item>` and nothing changes |
| anything else | unchanged |

Same status again is `403` ("The order is already ..."). Two admins cancelling at once: one
succeeds, the other gets `403`, stock returns once. Every change adds a line to the order history
(from, to, note, who, when).

## 6. Payments: record, part-pay, reverse

Payment status is **independent** from order status.

### 6.1 Record a payment

```
POST /orders/{id}/payments        (multipart/form-data)
```

| Field | Required | Notes |
|---|---|---|
| `description` | yes | 3 to 1000 characters: how it was paid |
| `files` | yes, 1 to 10 | image, pdf, doc(x), xls(x), txt, csv; 10 MB each |
| `amount` | no | up to 2 decimals, at least 0.01; default = the whole balance; may not exceed the balance |
| `transactionId` | no | max 100 |
| `paidAt` | no | ISO date, not in the future; default now |

Result `201 { "orderId": 74, "paymentId": 63 }`. The order becomes `partially_paid` until the
receipts add up to the payable amount, then `paid`. Refused with: `400` (no files, no
description, bad amount, bad file, amount above the balance), `409` (already fully paid, order
cancelled). The first receipt turns the payment row created at checkout into the receipt; later
receipts are new rows. A payment-status-history line is written each time.

### 6.2 Reverse a payment

```json
POST /orders/{id}/payments/{paymentId}/reverse
{ "reason": "Customer disputed the transfer" }
```

An admin can reverse **any** received payment. The row stays, marked reversed (who, when, why;
files kept); the order's `amountPaid` and `paymentStatus` go back (`due` or `partially_paid`);
the history gets a line with the amount as a **negative** number. `409` if the payment was never
received (`due`) or is already reversed. Paying again later creates a new receipt row.
This also works on a **cancelled** order (for example after the money was refunded outside the
site): the receipt is reversed and the order stays cancelled.

### 6.3 Payment status flow

```
due --(part payment)--> partially_paid --(rest)--> paid
 ^                           |                      |
 +-------(reverse everything)+---(reverse one)------+
```

## 7. Order updates

```
POST /orders/{id}/updates         (multipart/form-data)
```

Fields: `message` (max 2000) and/or `files` (up to 10). At least one is needed. The customer,
the seller and the admin all see it on the order, with who and when. Result
`201 { "orderId": 74, "updateId": 12 }`. Updates cannot be edited or deleted.

## 8. Creating an order for a customer

Typical phone order. The screen does these calls in order.

| Step | Call | Notes |
|---|---|---|
| 1. Find the customer | `GET /orders/customers?q=<email or mobile>` | Exact email (any case) or a mobile in any common format. Returns up to 5 `{ id, name, email, phone, canOrder, status }`. Empty list = no account; use a walk-in customer. A suspended account is returned with `canOrder: false` |
| 2. Pick the seller | `GET /sellers?search=&status=approved&activeStatus=active` | The normal seller list |
| 3. See their products | `GET /orders/catalog?sellerId=5&search=` | Approved, active products with active variants: `id`, `label`, live `price`, `payable`, `quantity` |
| 4. Saved address (optional) | `GET /users/{userId}/addresses` | The customer's saved addresses (default first); picking one fills the address fields. If you type an address that is not saved yet, `POST /users/{userId}/addresses` saves it to their book and the screen selects it |
| 5. Delivery and payment choices | `GET /orders/options?countryCode=BD&subtotal=6400` | `countries`, `deliveryOptions` (charge, days, zone, payable) and active `paymentGateways` |
| 6. Create | `POST /orders` | below |

```json
POST /orders
{ "sellerId": 5, "userId": 129,
  "items": [ { "sellerProductId": 94, "sellerProductSkuId": 119, "quantity": 2 } ],
  "recipientName": "Aisha Rahman", "recipientPhone": "+8801712345678",
  "contactEmail": "aisha@example.com", "countryCode": "BD", "state": "Dhaka Division",
  "city": "Dhaka", "addressLine": "House 7, Road 3, Banani", "postalCode": "1213",
  "deliveryType": "standard", "paymentGatewayId": 2, "note": "Phone order" }
```

Rules:

- `sellerId` is required for an admin (an approved, active seller). `userId` is optional: leave it
  out for a **walk-in customer** (no account; they can still track the order with number + phone).
- Prices, stock and the delivery charge are **never** taken from the request; the server uses the
  live ones. Do not send prices.
- Each variant at most once (raise its quantity); 1 to 50 items; quantity 1 to 99 and not above the
  stock; items must belong to that seller and be active.
- `paymentProof` (optional) only takes the fields the chosen gateway lists, and nothing is
  required at this point (add the details later when recording the payment).
- A suspended or unknown account is `400`.

Result `201` with the order details: status `pending`, payment `due`, history "Order placed by
admin <your name>", stock taken. If a customer account was given, the order shows in their
"Your orders" and they can cancel it while it is pending. There is no cart behind it
(`cartId: null`).

## 9. Payment lists

| Method | Path | What |
|---|---|---|
| `GET` | `/payments` | All payments, newest first (cursor) |
| `GET` | `/payments/{id}` | Details: proof, `attachments`, `reversal`, the order summary and that order's payment history |

Filters: `status`, `orderId`, `orderNumber`, `sellerId`, `gatewayId`, `customerSearch`,
`transactionId`, `minAmount`, `maxAmount`, `hasAttachments`, `reversed`, `createdFrom`,
`createdTo`, `paidFrom`, `paidTo`, `cursor`, `limit`. `status=due` leaves out reversed receipts
unless you also send `reversed=true`.

## 10. A customer's addresses on their behalf

Same rules as the customer's own address book (see `docs/user/order-flow.md` section 8).

| Method | Path |
|---|---|
| `GET` | `/users/{userId}/addresses` |
| `POST` | `/users/{userId}/addresses` |
| `GET` | `/users/{userId}/addresses/{id}` |
| `PATCH` | `/users/{userId}/addresses/{id}` |
| `DELETE` | `/users/{userId}/addresses/{id}` (`204`) |

An address of another user is `404` through this user's path. Changes are recorded as made by the
admin. An admin can manage a suspended customer's addresses.

## 11. Endpoint summary

All under `/v1/api/admin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/payment-gateways/types` | Gateway type rules |
| GET/POST | `/payment-gateways` | List / create |
| GET/PATCH/DELETE | `/payment-gateways/{id}` | One |
| GET | `/countries` | Country list |
| GET/POST | `/shipping-zones` | List / create |
| GET | `/shipping-zones/quote` | Price check |
| GET/PATCH/DELETE | `/shipping-zones/{id}` | One |
| GET/PATCH | `/settings` | Global defaults |
| GET | `/carts`, `/carts/{id}` | Carts |
| GET | `/orders` | Order list |
| GET | `/orders/customers` | Find customer by email or mobile |
| GET | `/orders/catalog` | A seller's sellable products |
| GET | `/orders/options` | Countries, delivery prices, payment methods |
| POST | `/orders` | Create an order |
| GET | `/orders/{id}` | Order details |
| PATCH | `/orders/{id}/status` | Change status (any) |
| POST | `/orders/{id}/payments` | Record a payment |
| POST | `/orders/{id}/payments/{paymentId}/reverse` | Reverse a payment |
| POST | `/orders/{id}/updates` | Post an update |
| GET | `/payments`, `/payments/{id}` | Payments |
| GET/POST | `/users/{userId}/addresses` | A customer's addresses |
| GET/PATCH/DELETE | `/users/{userId}/addresses/{id}` | One address |

## 12. Errors

| Code | When |
|---|---|
| `400` | Validation (message lists the fields), bad file, amount above balance, unknown seller or customer |
| `401` | No or expired token |
| `403` | Not an admin; or a same-status status change |
| `404` | Order, payment, cart, address or user not found |
| `409` | Gateway in use; zone overlap; order already fully paid or cancelled; payment already reversed or never received; not enough stock to reopen |

List paging and filters: `limit` is 1 to 100; `0` or leaving it out gives the default of 20, and a negative number or
more than 100 is `400`. A `cursor` that is not a number means the first page, a negative one is `400`. `minTotal`
above `maxTotal` is `400`.

Two people acting at once: the server settles it safely. If two staff members (or a staff member and the customer)
change the same order or pay it at the same moment, only one action wins and the others get a clear `403` or `409`.
Stock is given back once, and a payment can never push the received amount above the total.

Validation is strict: unknown fields in a request body are rejected with `400`.
