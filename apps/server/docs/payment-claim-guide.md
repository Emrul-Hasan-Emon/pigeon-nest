# Payment accounts and mark as paid requests

## Payment accounts (where the buyer pays)

A seller keeps up to 10 bank and online wallet accounts (PayPal, Wise, Zelle or a bank). After ordering, the buyer sees the ones that are switched on, with a Copy number button, on the order page. Staff see all of them on the order, including switched-off ones. Accounts are switched off, never deleted.

| Role | Route |
|---|---|
| Seller | `GET /seller/profile/payment-accounts`, `POST /seller/profile/payment-accounts`, `PATCH /seller/profile/payment-accounts/:id` (use `isActive: false` to switch off) |
| Admin | `GET`, `POST`, `PATCH /admin/seller/:sellerId/payment-accounts` (the admin seller page has the same panel) |

A bank account needs the account holder name. The order detail (`GET /user/order/:id`, and the seller and admin order routes) now carries `payTo` and `paymentClaims`.

## Mark as paid request (cash on delivery only)

For a **cash on delivery** order, once the seller has **accepted** it (confirmed, packed, shipped or delivered), the buyer can say they already paid and send proof. It is kept in its own table, `payment_claim`, with a unique index: **one request per order, ever**.

- `POST /user/orders/:orderId/payment-claims` (multipart): `amount`, `transactionId` and `method` (how it was paid: PayPal, Wise, bank), and at least one proof file in `files` (all required); optional `senderNumber`, `paidOn`, `note`.
- Refused: another buyer's order (404); an order that is not cash on delivery (400); an order still pending, or cancelled (409); a fully paid order (409); an amount above what is still to pay (400); missing transaction ID, method or file (400); a second request for the same order, whatever happened to the first (409). A buyer cannot take a request back.
- Seller: `GET /seller/payment-claims?status=`, `GET /seller/payment-claims/summary`, `POST /seller/payment-claims/:id/confirm` (`{ amount?, note? }`), `POST /seller/payment-claims/:id/reject` (`{ reason }`). Admin: the same under `/admin/payment-claims` for every seller.
- **Accept** records a normal payment on the order (same rules, history and commission as "Mark as paid"), so the order is marked paid (or partly paid if the seller accepts a smaller amount). If the order cannot take it, nothing changes and the request stays open.
- **Reject** needs a reason, which the buyer reads. The buyer cannot send another request for that order and pays in cash on delivery.
- Deciding twice returns 409.

Screens: the buyer's order page has a **Mark as paid** section (cash on delivery only); seller **Paid requests**; admin **Commerce > Mark-paid requests**; the order page in both portals shows the request with Accept and Reject. The seller dashboard to-do list counts "Mark as paid requests to check". Orders paid with another gateway show the seller's payment accounts instead, and the seller records the payment.

## Monthly statement

`GET /seller/reports/statement?month=YYYY-MM` (admin: `GET /admin/reports/statement?sellerId=&month=`). One printable document: sales, system commission, commission given back, refunds, what the seller keeps, payments the seller made to the marketplace, and what is owed at the start and end of the month (from the commission ledger). Screens: seller **Statements**, admin **System commission > Seller statements**.
