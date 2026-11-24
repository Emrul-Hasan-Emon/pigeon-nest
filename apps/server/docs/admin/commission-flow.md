COMMISSION: THE ADMIN'S GUIDE
=============================

For the platform admin. It explains every system commission screen you have, what each
number means, and what the system will refuse. For the rules behind it (how the
system commission is worked out and when it counts) see `../commission-guide.md`.


## Contents

1. What you can do
2. Set the global rate
3. Give one seller their own rate
4. See the rate a seller has, and its history
5. See the system commission on an order
6. System commission balances
7. Open one seller: the system commission page
8. Record a payment from a seller
9. The system commission ledger
10. System commission payments list
11. What the system refuses
12. Worked example
13. API reference
14. Questions


## 1. What you can do

| Task                                   | Where                                                  |
|----------------------------------------|--------------------------------------------------------|
| Set the rate for all sellers           | Settings > General settings > Seller system commission        |
| Set a rate for one seller              | Sellers > New / Edit seller, or System commission > a seller  |
| See who owes what                      | System commission > Balances                                  |
| Record money a seller handed over      | System commission > Balances > open a seller                  |
| See every earned / paid / voided row   | System commission > System commission ledger                         |
| See every payment received             | System commission > System commission payments                       |
| See how a rate changed over time       | System commission > a seller > Rate history                   |

Only an admin can change a rate or record a payment. Sellers can look at their
own numbers and nothing else.


## 2. Set the global rate

Settings > General settings > Seller system commission.

- **System commission type**: "Percentage of each item" or "Fixed amount per item".
- **System commission amount**: for a percentage, 0 to 100. For a fixed amount, any
  amount up to 9,999,999,999.99. At most 2 decimals either way.
- Press Save settings. A message says "Settings saved."

The global rate is used for every seller who has no rate of their own. It starts
at 0 (no system commission). It changes new orders only: orders already placed keep the
rate they were placed with.

Refused: a percentage over 100 ("A percentage system commission cannot be more than
100"), a negative amount, more than 2 decimals, a type other than the two above.
Changing only the type to percentage while a fixed amount over 100 is stored is
also refused: set both together.


## 3. Give one seller their own rate

Two places, same result.

**When creating or editing a seller** (Sellers > New seller / Edit):
- The System commission row has a type list and an amount box.
- "Use the global rate" (on a seller with no own rate) keeps the global rate. Leave
  it and the amount stays empty.
- Pick Percentage or Fixed and type the amount to give the seller their own rate.
- On edit, only a changed rate is sent, and a change writes a history row.
- Once a seller has their own rate you can change it, but you cannot go back to
  "Use the global rate". To make a seller follow the global rate again you would
  have to set the same value as the global one.

**On the seller's system commission page** (System commission > Balances > Open): the
System commission rate box has the type, the amount and an optional note. Save rate
writes a history row with your note.

A rate that is saved with the same values as before is accepted and writes no
history row.

Refused: percentage over 100; negative; more than 2 decimals; a type or amount
alone (on the seller form both must be sent together: "Send commissionType and
commissionAmount together").


## 4. See the rate a seller has, and its history

- The sellers list has a System commission column: "10%", "50 / order", or the global
  rate marked "(global)".
- A seller's system commission page shows "Rate: 10% (own rate)" or "(global rate)"
  under their name.
- The Rate history tab on that page lists every change: when, the setting
  (System commission), the value before ("Not set (global rate)" the first time), the
  value after, who changed it, and the note.
- `GET /admin/seller-settings/history` shows the changes of all sellers, with
  filters (see section 13). It is built for more seller settings later, so each
  row names the setting type.


## 5. See the system commission on an order

Open any order (Orders > an order). In the totals box, below Balance due, you see:

- System commission, with the rule used, for example "(10% of items)" or
  "(fixed)".
- Seller amount: payable minus system commission.

These are fixed when the order is placed. Changing the seller's rate later does
not change them. Customers never see these lines.

Note: an order shows a system commission as soon as it is placed, but it only counts
toward the seller's balance once the order is fully paid.


## 6. System commission balances

System commission > Balances. One row per seller who has had a paid order.

| Column            | Meaning                                                       |
|-------------------|---------------------------------------------------------------|
| Seller            | Name and phone                                                |
| Total system commission  | Everything earned from this seller's fully paid orders       |
| Due               | Earned but not yet received from the seller (amber if > 0)   |
| Paid              | Received from the seller so far (green)                      |
| Updated           | When the numbers last changed                                 |
| Actions > Open    | The seller's system commission page                                  |

Total = Due + Paid. Always.

Filters: seller name, email or phone; status "System commission due" (due above 0) or
"Nothing due". Clear filters resets them. Lists load 20 at a time: press Load
more for the next 20.

A seller with no paid order yet has no row. Their page still opens (via the
seller's own link) and shows zeros.


## 7. Open one seller: the system commission page

System commission > Balances > Open. At the top: the seller's name, a link to their
seller page, their rate, and three cards:

- **Total system commission** (earned from fully paid orders)
- **Due** (amber while above 0; a hint appears when it is below zero: "the platform
  owes this seller")
- **Paid** (received from the seller)

Below are two boxes (record a payment, system commission rate) and three tabs: Ledger,
Payments received, Rate history. The tabs only show this seller.


## 8. Record a payment from a seller

On the seller's system commission page, "Record a payment from this seller".

1. Type the **amount received**. It must be above 0, have at most 2 decimals,
   and not be more than the amount due shown above the form.
2. Optionally add **notes** (up to 1000 characters): bank reference, who handed
   it over.
3. Optionally attach **files** (images, PDF, Word, Excel, text, CSV; up to 10 files,
   10 MB each). They are optional.
4. Press **Record payment**. "System commission payment recorded." appears.

What happens, all in one step:
- Due goes down by the amount; Paid goes up by the amount; Total does not change.
- A payment record is saved with the balance after it (total, due, paid at that
  moment), your name and the time.
- A ledger row "Paid to the platform" is written.

You cannot record a payment when the seller has nothing due (the box is
disabled). A payment cannot be edited or deleted afterwards. If you entered it
wrong, tell a developer: there is no undo button for a system commission payment.

Two admins recording at once cannot overspend: one of them gets "amount cannot be
more than the system commission due".


## 9. The system commission ledger

System commission > System commission ledger (all sellers), or the Ledger tab on a seller.

One row per event:
- **System commission earned**: an order became fully paid. Shows the rule and the
  subtotal it was taken from, for example "10% of 6,400".
- **Paid to the platform**: a payment you recorded (shown with a minus sign).

Columns: When, Seller, What, Order (a link to the order, or "Payment #n" linking
to the payment), Amount, Payment status, Due after, Paid after, State.

State:
- **Counted**: the row is part of the balance.
- **Voided**: the order's payment was reversed or the order was cancelled, so the
  system commission was taken back out. The row stays for the record, greyed out, with
  the reason ("Payment #12 reversed: Wrong entry", "Order cancelled"). If the
  order is paid again or reopened, a new row is added.

Filters: seller ID, order ID, type, payment status, voided or not, date from / to.
Newest first, 20 at a time.


## 10. System commission payments list

System commission > System commission payments (all sellers), or the Payments received tab on a
seller. Columns: Payment number, Date, Seller, Amount, Total system commission then, Due
after, Paid in total, Files, View.

Filters: seller ID, amount from / up to, date from / to.

View opens one payment: amount, the totals at that time, who recorded it, the
notes and the attached files (images show as thumbnails, other files as links).


## 11. What the system refuses

| You try                                             | You get                                                    |
|-----------------------------------------------------|------------------------------------------------------------|
| A payment with no amount, 0, negative, text         | 400, the amount is invalid                                 |
| A payment amount with 3 decimals                    | 400                                                        |
| A payment above the due amount                      | 409 "amount cannot be more than the commission due (X)"    |
| A payment when due is 0 or less                     | 409 "This seller has no commission due"                    |
| A payment for a seller that does not exist          | 404 "Seller not found"                                     |
| A bad attachment (wrong type, fake extension)       | 400, nothing is saved                                      |
| More than 10 files                                  | 400                                                        |
| A rate over 100 percent, negative, 3 decimals       | 400                                                        |
| An unknown field in a request                       | 400                                                        |
| No sign-in / a seller or customer signed in         | 401 / 403                                                  |

A failed payment changes nothing: no row, no file left behind, no balance change.


## 12. Worked example

Seller A has their own rate: 10%. Global rate: 5%.

- A customer orders 2 birds at 3,200 each. Subtotal 6,400, delivery 100, payable
  6,500. System commission 10% of 6,400 = **640**. Seller amount 6,500 − 640 = **5,860**.
  The balance does not change yet.
- You record a payment of 1,000 on the order: part payment, still nothing earned.
- You record the other 5,500: the order is fully paid. Total 640, Due 640, Paid 0.
  A "System commission earned" row appears.
- The seller hands you 300. You record it: Total 640, Due 340, Paid 300.
- The customer was never really charged for the second payment, so you reverse it.
  The order is no longer fully paid: the earned row is voided, Total 0, Due −300,
  Paid 300. Due below zero is a credit: the seller overpaid.
- The customer pays properly: a new earned row, Total 640, Due 340, Paid 300.

Seller B has no own rate, so the global 5% applies: 5% of a 3,000 subtotal = 150.

Fixed amount: if the rate is "Fixed 50", every order has system commission 50 whatever
its size, but never more than the payable amount.


## 13. API reference

All under `/v1/api/admin`. Sign in as admin. Lists use `cursor` and `limit` (1 to
100, default 20) and return `{ results, nextCursor }`.

| Method | Path                                           | What                                                      |
|--------|------------------------------------------------|-----------------------------------------------------------|
| GET    | /commission/balances                           | Balances. `sellerId`, `search`, `status=due|cleared`      |
| GET    | /commission/balances/{sellerId}                | One balance plus the seller's rule (own, global, effective)|
| POST   | /commission/balances/{sellerId}/disbursements  | Record a payment. multipart: `amount`, `notes?`, `files?`  |
| GET    | /commission/history                            | Ledger. `sellerId`, `orderId`, `type`, `paymentStatus`, `voided`, `from`, `to` |
| GET    | /commission/disbursements                      | Payments. `sellerId`, `from`, `to`, `minAmount`, `maxAmount` |
| GET    | /commission/disbursements/{id}                 | One payment with its attachments                          |
| GET    | /sellers/{sellerId}/commission-setting         | The seller's own rule, the global rule, the effective one |
| PUT    | /sellers/{sellerId}/commission-setting         | `{ commissionType, commissionAmount, note? }`             |
| GET    | /seller-settings/history                       | Rate changes. `sellerId`, `settingType`, `from`, `to`     |
| GET    | /settings                                      | Includes `commission.type` and `commission.amount`        |
| PATCH  | /settings                                      | `{ "settings": { "commission.type": "fixed", "commission.amount": 50 } }` |
| POST   | /sellers                                       | multipart; optional `commissionType` + `commissionAmount` |
| PATCH  | /sellers/{id}                                  | same two fields to change the rate                        |

`type` values: `order_commission`, `commission_payment`. `commissionType` values:
`percentage`, `fixed`. `paymentStatus` values: `due`, `partially_paid`, `paid`.
`voided=true` shows only voided ledger rows, `voided=false` only counted ones.


## 14. Questions

**Can I change a seller's rate and have old orders follow?**
No. Each order keeps the rate it was placed with. Only new orders use the new rate.

**Why does an order show a system commission but the seller's balance has nothing?**
The system commission only counts when the order is fully paid.

**Why is Due below zero?**
A seller paid system commission on an order that was later cancelled or its payment
reversed. The system commission was taken back, so they have paid more than they owe.
The credit stays until new system commission arrives. It is not refunded automatically.

**A seller paid me too much. Can I undo a system commission payment?**
Not from the screens. Payments cannot be edited or deleted. Check the amount
before pressing Record payment.

**Can I remove a seller's own rate?**
Not directly. Set it equal to the global rate to get the same result.

**Do old orders have system commission?**
Orders placed before this feature have none: seller amount equals payable, and
no ledger rows.
