COMMISSION: THE SELLER'S GUIDE
==============================

For sellers. It explains what commission is, how much you pay, where to see it,
and what you can and cannot do. The platform keeps a share of each order you
make. You pay that share to the platform; the admin records each payment.


## Contents

1. The idea in one minute
2. How much commission you pay
3. When commission counts
4. Where to look: the Commission page
5. The numbers: total, due, paid
6. Commission records (the ledger)
7. My payments
8. Rate history
9. The order page
10. What you can and cannot do
11. Worked example
12. API reference
13. Questions


## 1. The idea in one minute

- Every order has a **commission**: the platform's share. It is worked out when
  the order is placed and shown on the order.
- It **counts** once the order is fully paid.
- Counted commission adds up in **Due**: what you still owe the platform.
- You hand money to the platform. The admin records it, and the amount moves from
  Due to **Paid**.
- If an order's payment is reversed or the order is cancelled, its commission is
  taken back.

You only ever see your own commission. You cannot change your rate.


## 2. How much commission you pay

Your rate is one of:
- **Your own rate**, if the admin gave you one: a percentage or a fixed amount.
- Otherwise the **global rate** set by the platform.

The Commission page tells you which: "The platform takes 10% of each item on an
order." (or "50 per item" for a fixed rate).

How it is worked out for each order:
- Percentage: the percentage of **each item** (the item's price after its discount;
  delivery and order discounts are not included).
- Fixed: the same amount on every item line.
- Each item's commission is never more than what the customer pays for that item.
  The order's commission is the total of its items, and the order page shows the
  commission and your share per item.
- Your share of the order (**Seller amount**) is the payable amount (items plus
  delivery) minus the commission.
- If an item is returned and refunded, its commission comes back off your balance.

Rounded to 2 decimals.

A rate change by the admin affects new orders only. Orders already placed keep
the rate they had.


## 3. When commission counts

| What happens to the order                     | Effect on your commission                    |
|-----------------------------------------------|----------------------------------------------|
| Order placed                                  | Worked out and shown on the order. Not counted yet |
| Part of the price received                    | Still not counted                            |
| Fully paid                                    | Counted: Total and Due go up                 |
| Payment reversed (no longer fully paid)       | Taken back: Total and Due go down            |
| Order cancelled while it was fully paid       | Taken back                                   |
| That cancelled order is reopened, still paid  | Counted again                                |

Each order is counted at most once at a time.


## 4. Where to look: the Commission page

Sign in to the seller portal and press **Commission** in the left menu. You see:

- A sentence with your current rate.
- Three cards: **Total commission**, **Due**, **Paid**.
- Three tabs: **Commission records**, **My payments**, **Rate history**.

This page also works if your account is suspended, because you may still owe
money.


## 5. The numbers: total, due, paid

- **Total commission**: all commission from your fully paid orders.
- **Due**: what you still owe (shown in amber when above 0).
- **Paid**: what you have already paid the platform.

Total = Due + Paid.

If **Due is below zero** you have a credit: you paid commission on an order that
was later cancelled or reversed. The credit is used up by your next commission.


## 6. Commission records (the ledger)

The first tab. One row for each event:
- **Commission earned**: an order was fully paid. It shows how it was worked out,
  for example "10% of 6,400".
- **Paid to the platform**: a payment you made (shown with a minus sign).

Columns: When, What, Order (a link to the order, or "Payment #n"), Amount, Payment
status, Due after, Paid after, State.

State:
- **Counted**: part of your balance.
- **Voided**: the order was reversed or cancelled, so this commission was taken
  back. The row stays, greyed out, with the reason. It is no longer in your total.

Filters: order ID, type, payment status, voided or not, date from / to. The list
shows 20 rows at a time: press Load more.

Passing another seller's ID in the address changes nothing: you only get your own
rows.


## 7. My payments

The second tab lists the payments you made to the platform: Payment number, Date,
Amount, Total commission at that time, Due after, Paid in total, Files, View.

Filters: amount from / up to, date from / to.

View opens one payment: the amount, the totals right after it, the date, the
admin's notes (if any) and any receipts or files they attached. You cannot open
another seller's payment (you get "not found").

You cannot record a payment yourself: tell the platform you paid, and the admin
records it.


## 8. Rate history

The third tab lists every change to your commission rate: when, the setting
(Commission), the value before ("Not set (global rate)" the first time), the value
after, who changed it and the note, if any. Use it to check what rate applied when.


## 9. The order page

Open any of your orders. Under the totals you see:
- **Platform commission** (with the rule, such as "10% of items" or "fixed")
- **Seller amount** (payable minus commission)

They are fixed when the order is placed. Customers never see them.

Orders you create yourself (Orders > New order) get commission in exactly the same
way as orders customers place.


## 10. What you can and cannot do

You can:
- See your balance, ledger, payments and rate history.
- Open the details of your own payments, including notes and files.
- Record a payment on your own order (this is the order payment, which then makes
  the commission count once the order is fully paid).

You cannot:
- Change your commission rate or its history.
- Record or edit a commission payment to the platform.
- See another seller's commission, payments or rate.
- Use the old "commission rate" profile field: it no longer exists.

Not signed in: 401. Signed in as a customer or admin on a seller address: 403.


## 11. Worked example

Your rate: 10%.

- A customer orders 2 birds at 3,200 each. Subtotal 6,400, delivery 100, payable
  6,500. Commission **640**. Your share (seller amount) **5,860**. Your balance
  has not changed yet.
- The order is fully paid. Total 640, Due 640, Paid 0. A "Commission earned" row
  appears.
- You pay the platform 300. The admin records it: Total 640, Due 340, Paid 300.
  "My payments" shows payment #1 for 300.
- The customer's payment turns out to be wrong and is reversed. The earned row is
  voided: Total 0, Due −300, Paid 300. You have a 300 credit.
- The customer pays again: Total 640, Due 340, Paid 300.


## 12. API reference

All under `/v1/api/seller/commission`. Sign in as a seller. Read only. Lists use
`cursor` and `limit` (1 to 100, default 20) and return `{ results, nextCursor }`.

| Method | Path                    | What                                                      |
|--------|-------------------------|-----------------------------------------------------------|
| GET    | /balance                | Total, due, paid, and your rate (own, global, effective)  |
| GET    | /history                | Ledger. `orderId`, `type`, `paymentStatus`, `voided`, `from`, `to` |
| GET    | /disbursements          | Your payments. `from`, `to`, `minAmount`, `maxAmount`     |
| GET    | /disbursements/{id}     | One payment with its notes and files                      |
| GET    | /setting                | Your own rate, the global rate, the one that applies      |
| GET    | /setting/history        | Changes to your rate. `settingType`, `from`, `to`         |

A `sellerId` in the query is ignored: you always get your own data. Any write
(PUT, POST) to these addresses returns 404.

On orders (`/v1/api/seller/orders/{id}`) the response has `commission`:
`{ type, value, systemCommission, sellerAmount }`.


## 13. Questions

**Why is there a commission on my order but my Due did not change?**
Commission counts when the order is fully paid.

**Why did my Total go down?**
An order's payment was reversed or the order was cancelled, so its commission was
taken back. The ledger row is marked Voided with the reason.

**What is a negative Due?**
You paid more than you owe now. It is a credit and is used up by new commission.

**I paid the platform but my Paid did not change.**
The admin has to record your payment. Ask them, and give them your bank
reference. When it is recorded it appears under My payments.

**Can I ask for a different rate?**
Only the admin can change it. Every change appears in your Rate history.

**Do my old orders have commission?**
Orders placed before this feature have none.
