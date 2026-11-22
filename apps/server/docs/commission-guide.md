COMMISSION GUIDE
================

What is this?
The platform keeps a share of every order it helps a seller make. This guide
explains how that share (the commission) is set, worked out, counted, paid back
by the seller, and undone when an order falls through. No coding needed.


Detailed guides for each role:
  - Admin:    admin/commission-flow.md
  - Seller:   seller/commission-flow.md
  - Customer: user/commission-flow.md (customers and guests see nothing)

This file is the overview and the rules. The role guides have the screens,
columns, filters, error cases, worked examples and API per role.


## 1. The short version

- The admin sets one global commission (a percentage or a fixed amount) in
  Settings > General settings.
- The admin can give a seller their own commission. It beats the global one.
- When an order is placed, the commission is worked out for each item on its own
  and the order's commission is the sum. It is saved on the order and on every
  item. Nothing changes for the customer.
- The commission only counts once the order is fully paid. Then it is added to
  the seller's commission balance.
- The seller hands the money over to the platform. The admin records each
  payment. The amount moves from "due" to "paid".
- If the payment is reversed or the order is cancelled, the commission is taken
  back out. Nothing is deleted: the ledger row is marked voided.
- If a customer returns an item (or the whole order) and an admin confirms it as
  returned, that item's commission is taken back off the balance. See
  `returns-guide.md`.


## 2. Setting the commission

Global: Admin > Settings > General settings > Seller commission.
  - Type: percentage of each item, or a fixed amount per item.
  - Amount: 0 to 100 for a percentage; any amount for a fixed one.
  - At most 2 decimals. A percentage cannot be over 100.

Per seller: Admin > Sellers > create or edit a seller > Commission, or the
Commission rate box on the seller's page under Commission > Balances.
  - A seller with no own rate uses the global one.
  - Once a seller has their own rate it can be changed but not removed.
  - Only an admin can set or change it. The seller can look, never edit.

Every change is saved in the rate history (what changed, from what, to what,
who, when, optional note). Admin: seller page > Rate history, or the API
`GET /v1/api/admin/seller-settings/history`. Seller: Commission > Rate history.

A rate change affects new orders only. Old orders keep the rate they were
placed with.


## 3. How the commission is worked out

When an order is placed (customer, guest, seller or admin entering it):

  for each item:
    commission    = item amount x percentage / 100   (percentage)
                  = the fixed amount                 (fixed, per item line)
    commission    = never more than the item amount
    item seller amount = item amount - commission
  order commission    = the sum of the items' commissions
  order sellerAmount  = payable (items + delivery) - order commission

The "item amount" is what the customer pays for that line (after item
discounts, or the accepted proposal price). Delivery charge and order-level
discount are not part of it. Each item's commission is rounded to 2 decimals
before adding up, so the order always equals the sum of its items. Each item
saves `systemCommission` and `sellerAmount`; the order saves `systemCommission`
and `sellerAmount`, with the rule used (`commissionType`, `commissionValue`).
Orders placed before this change keep their old total; it was shared over their
items by amount so a return can take back the right part.

Admins and sellers see these on the order. Customers never do.


## 4. When the commission counts

Placing an order only works out the commission. It counts when the order's
payment status becomes PAID:

  - Part payment: nothing counts yet.
  - Fully paid: total commission and due commission go up by the commission.
    A ledger row is written ("Commission earned").
  - Payment reversed so the order is no longer fully paid: the ledger row is
    voided and the balance goes back down.
  - Order cancelled while paid: same, voided. If the order is reopened while
    still paid, it counts again (a new ledger row).

Each order has at most one live ledger row, even if two people act at once.


## 5. The balance

Per seller, three numbers:

  Total commission  everything earned from fully paid orders
  Due               earned but not yet handed over (total - paid)
  Paid              handed over so far

Due can go below zero. That means the seller already paid commission on an
order that was later cancelled or reversed: the platform owes them a credit.
A payment cannot be recorded while due is 0 or less.


## 6. Seller pays the platform (disbursement)

Admin > Commission > Balances > open a seller > Record a payment.

  - Amount: above 0, at most 2 decimals, not more than the due amount.
  - Notes and files are optional.
  - Due goes down, paid goes up, total stays the same.
  - A payment record is saved with the balance after it (total, due, paid),
    and a ledger row "Paid to the platform".

All balance changes run in one database transaction under a lock on the
seller's balance row, so two people recording at once cannot overspend.


## 7. Where to look

Admin (Commission menu):
  Balances             every seller's total, due and paid; filter by seller
                       name and by due / nothing due
  Commission ledger    every earned and paid row; filter by seller, order,
                       type, payment status, voided or not, dates
  Commission payments  every payment from sellers; filter by seller, dates,
                       amount; open one for notes and files

Seller (Commission menu): their own balance, ledger, payments and rate history.
A seller only ever sees their own rows, even if they pass someone else's id.
A suspended seller can still look, since they may still owe money.

All lists load 20 at a time ("Load more"), newest first.


## 8. API at a glance

Admin (`/v1/api/admin`):
  GET   /commission/balances            ?sellerId &search &status=due|cleared
  GET   /commission/balances/{sellerId}
  POST  /commission/balances/{sellerId}/disbursements   (multipart: amount, notes?, files?)
  GET   /commission/history             ?sellerId &orderId &type &paymentStatus &voided &from &to
  GET   /commission/disbursements       ?sellerId &from &to &minAmount &maxAmount
  GET   /commission/disbursements/{id}
  GET   /sellers/{sellerId}/commission-setting
  PUT   /sellers/{sellerId}/commission-setting          {commissionType, commissionAmount, note?}
  GET   /seller-settings/history        ?sellerId &settingType &from &to
  PATCH /settings                       {"settings": {"commission.type": ..., "commission.amount": ...}}

Seller (`/v1/api/seller/commission`), read only:
  GET /balance, /history, /disbursements, /disbursements/{id}, /setting, /setting/history

Lists use `cursor` and `limit` (1 to 100).


## 9. Questions

Why is commission taken from the items and not the payable amount?
  Delivery is not the seller's income and a discount should not shrink the
  platform's cut, so the item subtotal is the fair base.

Can the commission be more than the order?
  No. It is capped at the payable amount, so the seller's amount is never
  negative.

Does changing the rate change old orders?
  No. Each order keeps the rate it was placed with.

What if an order is cancelled after the seller already paid its commission?
  The commission is taken back out, so due drops, possibly below zero. That
  credit is kept; it is not refunded automatically.

What happened to the old seller "commission rate" field?
  It moved into the seller's own commission setting (percentage). The old
  field is gone.

Orders that existed before this feature?
  They have no commission: sellerAmount equals the payable amount and no
  ledger rows.

Tests: apps/server/docs/testing/commission_test.py


12. Return take-back and the change log
---------------------------------------
- `system_commission_history` (the ledger) has `status`: `for_system` for
  commission earned by the system, `order_returned_to_customer` for commission
  taken back on a return. A return row has type `order_return`, the order id, the
  return id and, for an item return, the item id.
- `system_commission_change_history` records every move of a balance: what total,
  due and paid were (`current*`), what they became (`new*`), the reason
  (`commissionStatus`: `for_system`, `order_returned_to_customer`,
  `commission_payment`, `commission_voided`, `return_undone`), the ledger row it
  belongs to and who did it. It is append only. Each row starts where the last one
  for that seller ended.
- Read it: admin `GET /admin/commission/changes` (filter `sellerId`, `status`,
  `from`, `to`), seller `GET /seller/commission/changes`. Screens: Commission >
  Balance changes (admin), the Balance changes tab (admin seller page and seller
  Commission).
- It starts when this was added. Earlier moves exist only in the ledger.
