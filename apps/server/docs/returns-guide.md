RETURNS AND REFUNDS
===================

A customer asks to send back a whole order or some of its items. The seller
accepts or rejects, walks the return through processing and the refund, and an
admin confirms it as returned. Confirming takes the returned items' commission
back off the seller.

Per-role details: `user/returns-flow.md`, `seller/returns-flow.md`,
`admin/returns-flow.md`. Commission side: `commission-guide.md` (section 12).

Rules
-----
- Only a delivered and fully paid order can be returned. A customer must ask
  within the return window after delivery (setting `returns.windowDays`, default
  7, 0 means no limit). An admin is not held to the window.
- Two kinds: `full_order` (every item not already returned) or `items` (one or
  more chosen items; the whole line comes back, no part quantities).
- A customer gets ONE request for an order or an item for good. Any outcome
  (open, rejected, cancelled, returned) uses it up. A request on item A never
  blocks item B. A request on any item blocks a full-order request, and a
  full-order request blocks item requests.
- An admin can open more for an order or item that is not returned yet, as long
  as no open return (requested, accepted, processing, returning money) already
  covers it. Two open returns never hold the same item.
- Guest orders have no customer account, so only an admin can open a return for
  them.
- Refund: the lines' payable amount (what the customer paid for each line). A
  full-order return can add the delivery charge; an item return never does. The
  delivery choice (`includeDeliveryCharge`) starts from the setting
  `returns.refundDeliveryCharge`; the seller changes it when accepting, an admin
  can change it any time before the return is finished.
- No restock and no return shipping in this version.
- An order with an open or returned return cannot be cancelled and its payment
  cannot be reversed (409). Cancel or reject the return first.

Status flow
-----------
`return_requested -> accepted | rejected -> processing -> returning_money -> returned`

- Customer (or admin for them) opens it. The customer can cancel only while it is
  `return_requested` (`cancelled`).
- Seller: accept, or reject (a note is required), then processing, then
  returning money (a description is required; files are optional proof).
- Admin: confirms `returned`, and can move a return to ANY status with a note
  (and optional files). Moving into `returned` takes the commission back; moving
  out of it puts the commission back.
- Every move is a row in `order_return_status_history` (from, to, note, who,
  files).

When a return becomes `returned`
--------------------------------
In one transaction, under a lock on the order and the seller's balance row:
- the returned order items get `order_item.isReturned = true`;
- the order gets `order.isReturned = true` when every item is returned (a
  full-order return, or the last item);
- each returned item's commission comes off `system_commission` total and due;
- a ledger row is written in `system_commission_history`: one per item for an
  item return (with `orderItemId`), one for a whole-order return (order id, no
  item id), type `order_return`, status `order_returned_to_customer`;
- a row is written in `system_commission_change_history` (before and after).
Moving a return out of `returned` reverses all of this (the return ledger rows
are voided, never deleted, and a change row says `return_undone`).

Commission is worked out per item
---------------------------------
Each order item stores its own `systemCommission` and `sellerAmount`; the order's
commission is the sum. See `commission-guide.md` section 3. Fixed commission is
per item line. Orders from before this change had their commission shared over
their items by amount (migration), so returns work on them too.

Data
----
- `order_return`: `returnNumber` (RT<yymmdd>-<5 digits>), `orderId`, `userId`
  (empty for guest orders), `sellerId`, `status`, `scope`, `reason`,
  `includeDeliveryCharge`, `itemsAmount`, `deliveryAmount`, `refundAmount`,
  `commissionAmount`, `returnedAt`, tracker fields. Database checks on status,
  scope and amounts.
- `order_return_item`: the lines of a return with `refundAmount` and
  `commissionAmount` copied from the line when it was opened.
- `order_return_status_history`, `order_return_attachments` (customer evidence on
  the first row, seller refund proof on `returning_money`, admin files).
- `order_item`: `systemCommission`, `sellerAmount`, `isReturned`. `order`:
  `isReturned`.
- `system_commission_history`: `status`, `orderItemId`, `orderReturnId`.
- `system_commission_change_history`: new, append only.
- Settings: `returns.windowDays`, `returns.refundDeliveryCharge`.
- Migration `ReturnsRefunds1796600000000` (reversible).

Tests
-----
`testing/returns_test.py` (266 checks): settings, per-item commission (percentage,
fixed, caps), ledger and change log, eligibility, validation and access, the
one-request rules, every seller step and who may do it, money and the delivery
choice, partial then full returns, admin any-status (including undo), cancel and
payment-reversal guards, concurrency, the window, guest orders, lists and views,
and consistency checks (balances, change chain, flags, refunds). `KEEP=1` leaves
the data in place for looking at the screens.
