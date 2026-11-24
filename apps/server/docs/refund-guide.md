# Refunds for cancelled orders (and money records on returns)

## The return window

A buyer can ask for a return only within `returns.windowDays` after delivery (default 7; 0 means no limit; an admin sets it in General settings). After that the server refuses the request (409 "The return window of N days has ended"), and the buyer's order page shows "The return window of N days ended on <date>" with no button. While it is open, the page says "You can ask for a return until <date>". An admin is not held to the window.

## When a refund starts

When an order that has received money (payment status paid or partly paid, amount paid above 0) is cancelled, by anyone, the system:

- opens a **refund record** in `order_refund` with status `needs_to_refund` and the amount to refund (what the buyer paid),
- writes a row in `order_refund_status_history`,
- sets `order.refundStatus = needs_to_refund`.

Cancelled orders from before this feature that had money paid were given a `needs_to_refund` record by the migration. The order's `refundStatus` always follows the latest record that still counts.

## Steps

`needs_to_refund` -> `processing` -> `refunded`. A seller or an admin moves it on; a seller goes one step at a time. An admin can set **any** status (including `voided` and back to `needs_to_refund`).

**Refunded** needs all of:
- `amount`: exactly what the buyer paid. Any other amount is refused with "The refund amount must be exactly what the buyer paid (450). You entered 400.",
- `note`: how and when the money was sent,
- at least one proof file (`files`) from a seller (optional for an admin).

A cancelled order whose refund is processing or refunded cannot be reopened (409); change the refund first. Reopening an order whose refund was never started voids that record.

## Several records, disputes

An order can have several records. If a seller says "refunded" and the buyer says the money never came, an admin adds **another record** (usually `refunded`, with amount, note and proof) or moves the first one back. The buyer, the seller and the admin all see every record and every step with who, when, amount, note and proof.

## Money records on returns

For a return, the seller's own "returning money" step stays in the return history. If the buyer says the money never came, an admin adds an extra **money record** on the return (`kind = return`): the amount must be exactly the return's refund amount. These records show on the return page for the buyer, the seller and the admin. They do not change the return's own status.

## Routes

| Role | Route |
|---|---|
| Seller | `GET /seller/order/refunds?status=&search=&page=`, `GET /seller/order/refunds/summary`, `GET /seller/order/refunds/:id`, `POST /seller/order/refunds/:id/status` (multipart `status`, `amount`, `note`, `transactionId`, `files`) |
| Admin | the same under `/admin/order/refunds`, plus `POST /admin/order/:orderId/refunds` (another record, multipart, default status `refunded`) and `POST /admin/order/returns/:returnId/money-records` |
| Buyer | read only: `GET /user/order/:id` returns `refundStatus` and `refunds` (records with history); `GET /user/returns/:id` returns `moneyRecords` |

Screens: seller **Refunds** (with a count badge) and admin **Commerce > Refunds** list the cancelled orders with money paid; the order pages show every record in both portals and for the buyer ("Your refund"). The seller dashboard to-do list counts "Refunds to send back".
