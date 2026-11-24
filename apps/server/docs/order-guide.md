ORDER GUIDE
===========

Who is this for?
Anyone. You do not need to know how to code. This guide explains how a purchase
travels through Pigeon Nest: from a customer putting a bird in a cart, to the
order being delivered and paid. It covers what every person (customer, guest,
seller, admin) can see and do, what every status means, how payments are
recorded and undone, and what happens to stock along the way.

If you only have five minutes, read sections 1, 2, 5, 6 and 7.


## Contents

1. The big picture
2. Who is who
3. Setting things up first (admin only)
4. The cart
5. Checkout: turning a cart into an order
6. Order status: the life of an order
7. Payment: how an order gets paid
8. Payment reversal: undoing a mistake
9. Order updates: messages and files on an order
10. Histories: who changed what, and when
11. Stock: what happens to the shelves
12. The customer's pages
13. The seller's pages
14. The admin's pages
15. Creating an order for a customer (admin and seller)
16. Files: what can be attached
17. Every case at a glance (cheat sheets)
18. Questions people ask
19. What is not built yet
20. Words used in this guide


---------------------------------------------------------------------------


## 1. THE BIG PICTURE

Pigeon Nest is a marketplace. Many sellers sell on it, and a customer can buy
from several sellers at the same time. Because every seller ships and is paid
separately, the system works like this:

```text
  Customer adds birds and supplies  ->  one CART per seller
  Customer checks out one cart      ->  one ORDER for that seller
  Seller confirms, packs, ships     ->  order moves forward step by step
  Seller or admin records payment   ->  order becomes "paid"
```

Three golden rules:

  RULE 1. One cart = one seller = one order. If a customer fills carts with
          three sellers, checking out makes three separate orders. Each one has
          its own status, payment and delivery.

  RULE 2. Prices, stock and delivery costs always come from the system, never
          from the customer's screen. Even if a page is out of date, the system
          re-checks everything the moment an order is placed.

  RULE 3. Nothing is deleted when it is "undone". A cancelled order stays. A
          reversed payment stays. A cart that became an order stays (as an
          inactive cart). Everything leaves a trail showing who did it and when.


## 2. WHO IS WHO

There are four kinds of people, and each sees a different part of the system.

```text
  GUEST      Someone without an account. Can browse, fill carts, check out and
             track an order with its number and phone number.

  CUSTOMER   Someone with an account (signed in). Everything a guest can do,
             plus: see all their orders in one place, keep an address book,
             and have orders from other devices appear under their account.

  SELLER     A shop owner. Sees only THEIR OWN orders and payments. Can confirm,
             pack, ship and deliver them, record payments, post updates and
             enter orders for customers. Cannot see carts. The seller must be
             approved and active to use orders (see the Seller Account Guide).

  ADMIN      The Pigeon Nest team. Sees EVERYTHING: all orders, all payments,
             all carts. Can do everything a seller can, for any seller, and a
             few things only an admin can do (cancel after confirmation,
             reopen a cancelled order, reverse any payment, move an order to
             any status).
```

Where each person works:

```text
  Guest / customer   the shop pages: Cart, Checkout, Orders, Track an order,
                     Addresses (addresses need an account)
  Seller             the seller portal: Orders, Payments (left menu)
  Admin              the admin console: Commerce > Orders, Payments,
                     Active carts, Inactive carts; Settings > Payment gateways,
                     Shipping zones, General settings; Users > a user's page
                     (for their addresses)
```


## 3. SETTING THINGS UP FIRST (ADMIN ONLY)

Before customers can check out, the admin sets up three things under SETTINGS.

### 3.1 Payment gateways ("ways to pay")

A payment gateway is a way a customer can pay. Pigeon Nest does not take money
itself. The customer pays the seller directly (cash, bank transfer, mobile
money) and the seller or admin then records that the money arrived.

There are five types, and each asks the customer for different details:

```text
  Type              Example                What the customer enters
  ----------------  ---------------------  --------------------------------
  Cash on delivery  Pay when it arrives    Nothing
  Mobile banking    bKash, Nagad           Transaction ID (required)
  Bank transfer     A bank account         Name on the sending account and
                                           the transfer reference (both required)
  Card              Card payment           Payment reference (required)
  Other (manual)    Anything else          A reference (optional)
```

Each gateway also shows the customer its instructions and account details (for
example "Send the total to 01711111111, then enter the transaction ID").

An admin can switch a gateway off (it disappears from checkout) but cannot
delete one that any order or payment has used. One gateway, "Cash on Delivery",
exists from the start.

### 3.2 Shipping zones ("what delivery costs")

Customers come from all over the world, so delivery is priced by COUNTRY.

A shipping zone says: "for THESE countries, THIS delivery type costs THIS much
and takes about THIS many days."

```text
  Delivery type   Meaning
  --------------  -------------------------------------------
  Standard        Normal delivery
  Express         Faster, usually costs more
  Pickup          The customer collects it
```

Rules:

  - A country can have only one active zone per delivery type. The system
    refuses overlapping zones, so a price is never ambiguous.
  - If no zone covers the customer's country and delivery type, the GLOBAL
    DEFAULT is used (see below).
  - The delivery charge is shown on the checkout page the moment the customer
    picks a country, and it is saved on the order exactly as quoted. Changing a
    zone later does not change old orders.

### 3.3 General settings ("the global default")

Three global values apply whenever no shipping zone matches:

```text
  Default delivery charge        How much (0 means free)
  Default delivery time          Days
  Default live-animal support    A yes/no flag (kept for later; see section 19)
```


## 4. THE CART

### 4.1 One cart per seller

```text
  Customer adds a pigeon from Seller A    -> a cart with Seller A appears
  Customer adds feed from Seller B        -> a second, separate cart appears
  Customer adds another bird from Seller A -> goes into the Seller A cart
```

On a product page or a seller's page the customer sees THAT seller's cart. The
cart icon in the top bar shows how many items they have in all carts, and the
"Your carts" page shows all carts at once.

### 4.2 Guests and customers

  - A guest's carts are remembered by their browser (a private session code).
  - A customer's carts belong to their account.
  - When a guest signs in or creates an account, the guest carts are merged
    into the account's carts automatically. Quantities are added together, but
    never above the stock. Items that are no longer available are dropped.
    Orders the guest placed in that browser also move to the account.

### 4.3 What the cart always shows: live information

The cart is never a frozen price list. Every time it is shown, it uses today's
price and today's stock. Each line says one of:

```text
  Available             Fine, counts in the total
  No longer available   The product, variant or seller was switched off
  Out of stock          None left
  Not enough in stock   Fewer left than the customer wants ("Set to 3" button)
```

Only available lines count towards the total. If the price changed since the
customer added the item, the line says so ("Price changed from 3,500 to 3,200").

### 4.4 Quantity rules

  - Most a customer can have of one variant: 99, or the stock if that is lower.
  - If they ask for more, the system quietly lowers it and tells them.
  - Removing the last item deletes the empty cart.
  - "Empty cart" removes the whole cart.

### 4.5 What happens to a cart after checkout

The cart is NOT deleted. It becomes INACTIVE and keeps a link to its order
(and the order keeps a link back to the cart). So later anyone in the admin
team can see exactly which cart became which order. If the customer later adds
something from the same seller, a brand new cart is started.

### 4.6 Admin's view of carts

Admin only (sellers cannot see carts). Under Commerce there are two lists:

  - ACTIVE CARTS: carts customers and guests are still filling. Shows live
    prices, and whether the cart could be checked out right now.
  - INACTIVE CARTS: carts that became an order. Shows what the cart held at
    the moment of checkout (the prices then, not today's) and the order it
    became.

Filters on both: customer name/email/phone, seller, customer or guest, order
number, has items, payable total range, created and updated dates.


## 5. CHECKOUT: TURNING A CART INTO AN ORDER

Checkout is always for ONE cart. On "Your carts" (and on a seller's cart box)
every cart has a button "Check out with {seller}".

### 5.1 What the customer fills in

```text
  Who is it for?      Full name, phone (with country), email (optional).
                      A signed-in customer sees their details already filled in.
  Where should it go? Country, street address, city, state/division
                      (optional), postal code (optional).
  How delivered?      Standard / Express / Pickup, each with its price and
                      about how many days. Prices appear after choosing the
                      country.
  How will you pay?   One of the active payment methods. Choosing one shows its
                      instructions, account details and the details to enter
                      (see section 3.1).
  Note                Anything for the seller (optional).
```

A signed-in customer can pick one of their SAVED ADDRESSES from a list (the default
one is filled in automatically), or type a new address. When what is typed is not a
saved address yet, a "Save this address" button appears; pressing it adds it to the
address book and selects it.

The right side shows the order summary, the delivery cost and the total.

### 5.2 What happens when "Place order" is pressed

The system does all of this in one go, or none of it:

  1. Checks the chosen payment method is still active.
  2. Re-checks every item against LIVE price and stock. If anything cannot be
     bought now, nothing is placed and the customer is told exactly which item
     and why, for example "Only 1 of Red Chequer Sprinter left", with a link
     to fix the cart.
  3. Takes the stock off the shelf. If two buyers race for the last bird, one
     succeeds and the other gets the message above. Stock can never go below
     zero.
  4. Creates the ORDER: status PENDING, payment status DUE, with a unique order
     number, the seller, the address, the delivery price and time as quoted,
     and the payment method (id, name and short name are saved).
  5. Saves each item with the price it was sold at, and, for a pigeon that has
     them, a copy of its details (ring number, hatch date, vaccination, breed,
     bloodline, sire and dam). Later edits to the bird do not change the order.
  6. Creates the PAYMENT record (status due) and saves anything the customer
     typed as proof (for example the transaction ID).
  7. Writes the first line of both histories ("Order placed").
  8. Turns the cart inactive and links cart and order both ways.

Pressing the button twice, or opening checkout in two tabs, still produces only
one order: the second attempt is told "This cart has already been ordered".

### 5.3 The order number

A short code the customer can read over the phone, like PN261120-K7M2QX:

```text
  PN  +  date (year, month, day)  +  dash  +  6 letters/digits
```

It never uses 0, O, 1 or I so it cannot be misread.

### 5.4 After placing

The customer lands on the order page with a thank-you note and the order number.
Guests are told to keep the number and the phone they used.

### 5.5 How the total is made

```text
  Items (at today's price)
  + Delivery (from the zone, or the global default)
  = Total payable
```

The list price crossed out on a product and the discount are already inside the
items figure; the order shows "You saved" as information.


## 6. ORDER STATUS: THE LIFE OF AN ORDER

### 6.1 The six statuses

```text
  PENDING     Just placed. Waiting for the seller to accept it.
  CONFIRMED   The seller accepted it.
  PACKED      The seller has packed it.
  SHIPPED     On its way to the customer.
  DELIVERED   The customer has it.
  CANCELLED   Stopped. Will not be delivered.
```

### 6.2 The normal path

```text
  PENDING  ->  CONFIRMED  ->  PACKED  ->  SHIPPED  ->  DELIVERED
     |
     +------>  CANCELLED
```

The order moves one step at a time. A seller cannot skip steps (for example
from confirmed straight to shipped).

### 6.3 Who may change the status, and when

```text
                          CUSTOMER      SELLER (own orders)     ADMIN
  -----------------------------------------------------------------------------
  Pending -> Confirmed       no              yes                  yes
  Pending -> Cancelled       yes             yes                  yes
  Confirmed -> Packed        no              yes                  yes
  Packed -> Shipped          no              yes                  yes
  Shipped -> Delivered       no              yes                  yes
  Confirmed/Packed/Shipped/
    Delivered -> Cancelled   no              NO (admin only)      yes
  Cancelled -> anything      no              NO (admin only)      yes
  Any status -> any other    no              no                   YES
```

In words:

  - CUSTOMER: can cancel their order only while it is still PENDING. Once the
    seller confirms it, the customer can no longer cancel (the order page says
    so and suggests contacting the seller).
  - SELLER: can accept (confirm) or refuse (cancel) a new order. After
    confirming, the seller can only move it forward: packed, shipped,
    delivered. A seller can NOT cancel an order after confirming it, and can
    NOT reopen a cancelled order. If something goes wrong after confirmation,
    only an admin can fix it.
  - ADMIN: can move any order to any other status at any time, including
    backwards (for example delivered back to shipped, or cancelled back to
    pending).

On each order page the status box only offers the moves that person is allowed
to make right now. A note can be added and everyone on the order sees it.

### 6.4 Special notes

  - Moving to the same status again is refused ("The order is already ...").
  - Two people pressing "cancel" at the same instant: only one wins; stock is
    returned only once.
  - Cancelling returns the stock. Reopening a cancelled order takes the stock
    again, and fails with a clear message if there is not enough left (the order
    then stays cancelled).
  - Payment status is separate from order status. An order can be delivered but
    still unpaid (for example cash on delivery before the cash is recorded),
    or paid but still pending.


## 7. PAYMENT: HOW AN ORDER GETS PAID

### 7.1 Why recording a payment is a manual step

The customer pays the seller outside the website (cash, bank, mobile money).
So the order starts as PAYMENT DUE, and the seller or admin marks it paid once
the money has really arrived. This works the same whatever the customer chose
(even if the customer entered a transaction ID at checkout).

### 7.2 The three payment statuses

```text
  DUE             Nothing received yet.
  PARTIALLY PAID  Some money received, not all.
  PAID            The full amount has been received.
```

### 7.3 Marking an order as paid (seller or admin)

On the order page, under Payments, "Mark as paid". The form needs:

```text
  Description    REQUIRED. How it was paid, e.g. "bKash to the shop number" or
                 "cash at pickup".
  Files          REQUIRED, at least one (image or document, up to 10).
                 For example a screenshot of the payment or a bank slip.
  Amount         Optional. Leave empty to record the whole balance. Enter a
                 smaller number for a PART payment.
  Transaction ID Optional.
  When paid      Optional (cannot be in the future). Default is now.
```

The system refuses when:
  - there is no description or no file,
  - the amount is zero, negative, has more than 2 decimals, or is MORE than
    what is still owed,
  - the order is already fully paid,
  - the order is cancelled,
  - a file is not an allowed type (see section 16).

### 7.4 Part payments

A customer may pay in instalments. Example, an order of 6,440:

```text
  Seller records 1,000          -> PARTIALLY PAID   (received 1,000, 5,440 due)
  Seller records 500.50         -> PARTIALLY PAID   (received 1,500.50)
  Seller records the rest       -> PAID             (received 6,440)
```

Each receipt is its own row in the order's payment list, with its own files,
description, who recorded it and when.

### 7.5 What the customer, seller and admin see

On the order page everyone sees the payments, their proof files, any details the
customer typed at checkout, the total received, and the balance still due. Below
that sits the PAYMENT HISTORY (section 10).

### 7.6 Payment lists (seller and admin)

Both have a "Payments" page listing every payment (admin: all sellers; seller:
only their own orders), with filters:

```text
  Payment status, order number, customer name/phone/email, transaction ID,
  payment method, amount range, has proof files or not, reversed or not,
  created dates, paid dates, and (admin only) seller.
```

Opening a payment shows the order, the customer, the proof, the files and the
payment history of that order.


## 8. PAYMENT REVERSAL: UNDOING A MISTAKE

Sometimes a payment was entered by mistake, or the money never really arrived
(a cheque bounced, a transfer was disputed). Staff can REVERSE a payment.

### 8.1 How

On the order page, next to a received payment: "Reverse payment". A reason is
REQUIRED (at least 3 characters).

### 8.2 What it does

  - The payment stays on record, marked REVERSED, showing who reversed it, when
    and why. Its proof files stay too.
  - That amount is taken off what the order has received.
  - The order's payment status follows: back to DUE if nothing is left, or
    PARTIALLY PAID if other payments remain.
  - A new line is added to the PAYMENT HISTORY: from the old status to the new,
    the money taken out (shown as reversed), the total left, the reason, who did
    it and when.
  - The customer can see that a payment was reversed and the reason.

Example:

```text
  Order 3,200. Paid in full.                      status PAID
  Admin reverses it: "Customer disputed it".      status DUE   (0 received)
  Customer pays again; seller records 3,200.      status PAID  (a NEW payment row;
                                                  the reversed one stays visible)
```

### 8.3 Who can reverse

```text
  Admin    any payment, on any order
  Seller   only payments a SELLER recorded, on their own orders.
           A payment an admin recorded can only be reversed by an admin.
  Customer cannot reverse anything
```

### 8.4 What cannot be reversed

  - A payment that was never received (still "due").
  - A payment already reversed.


## 9. ORDER UPDATES: MESSAGES AND FILES ON AN ORDER

At any time the seller or admin can post an UPDATE on an order: a text message,
a file, or both. Examples: "Courier tracking number 12345", a photo of the
packed birds, the health certificate PDF.

  - Needs a message or at least one file (up to 10 files).
  - The CUSTOMER, the SELLER and the ADMIN all see it on the order page, with
    who posted it and when.
  - Updates cannot be edited or deleted (they are a record).
  - Customers cannot post updates (they contact the seller).


## 10. HISTORIES: WHO CHANGED WHAT, AND WHEN

Every order carries two histories. Both are visible to the customer, the seller
and the admin on the order page, newest events with the time and the name of the
person.

### 10.1 Order history

Every status change: from, to, the note (if any), who, and when.

```text
  Pending                Order placed                   Aisha (you)      10:02
  Confirmed              Checked by phone               Rahim Loft       10:30
  Packed                                                Rahim Loft       14:10
  ...
```

Who is shown: the customer's own name, the seller's shop name, and for admins
the name of the admin (customers see "Pigeon Nest team").

### 10.2 Payment history

Every payment status change: from, to, the money that came in or went out, the
total received so far, the note and who did it.

```text
  Due -> Partially paid   1,500 received, 1,500 in total   Cash at the shop
  Partially paid -> Due   1,500 reversed, 0 left in total  "Cash not received"
```

An order placed by staff for a customer says so: "Order placed by admin Sara".


## 11. STOCK: WHAT HAPPENS TO THE SHELVES

```text
  Event                                   Stock
  --------------------------------------  ---------------------------------
  Customer adds to cart                   Unchanged (a cart does not reserve)
  Order placed                            Reduced by the ordered quantities
  Order cancelled (anyone)                Quantities returned to the shelf
  Cancelled order reopened (admin)        Quantities taken again; fails if short
  Payment recorded or reversed            Unchanged
  Order moved forward (packed, shipped..) Unchanged
```

Because carts do not reserve stock, two customers can both have the last bird in
their carts. Whoever places the order first gets it; the other is told it is no
longer available and is helped to fix the cart.


## 12. THE CUSTOMER'S PAGES

### 12.1 Cart  ("Your carts")
All active carts with live prices, quantity buttons, remove, empty cart, and a
"Check out with {seller}" button on each. A cart with a problem item shows what
to fix; the checkout button stays off until fixed.

### 12.2 Checkout
Described in section 5.

### 12.3 Order page
After placing, and any time later:

  - Progress bar: Placed, Confirmed, Packed, Shipped, Delivered (or a red
    "cancelled" notice).
  - "Cancel this order" while pending (asks for an optional reason and a
    confirmation). After confirmation it explains why cancelling is no longer
    possible here.
  - Items with the prices paid, totals, delivery cost, and (if any) "Still to
    pay".
  - Delivery details: recipient, address, delivery type and expected days.
  - Payment: the method, status, each payment received with its proof,
    reversals with the reason.
  - Updates from the seller (messages and files).
  - Full history with who and when.

### 12.4 Your orders
A list (10 per page) with order number, status, payment status, the seller,
item pictures, total and date. Filter by status; search by order number.

### 12.5 Track an order  (no account needed)
A guest enters the order number and the phone number used at checkout, and sees
the order. A wrong number or phone shows the same "No order matches" message, so
no one can fish for other people's orders. This page only shows the order; to
cancel one, use the browser the order was placed in, or sign in.

### 12.6 Your addresses  (account needed)
An address book: add, edit, delete, choose the default.

```text
  Each address has:  recipient name, phone, country, state/division,
                     city/district, the address in words, postal code
  The first address you save becomes the default.
  Only one default at a time. Choose "Make default" on another to change it.
  Up to 20 addresses.
  Deleting the default hands the default to your newest address.
  Deleting or editing an address NEVER changes orders already placed
  (each order keeps its own copy of the address).
```

At checkout the default address is filled in, other saved addresses can be
chosen from a list, and a new address can be saved with one tick.


## 13. THE SELLER'S PAGES

The seller must be approved and active. All pages show ONLY the seller's own
orders and payments; trying to open another seller's order shows "not found".

### 13.1 Orders (list)
Filters: order status, payment status, customer name/phone/email, account or
guest, order number, payment method, delivery type, country, payable range,
placed dates. "Create order" button (section 15).

### 13.2 Order details
Everything about the order, with these actions:

  - CHANGE ORDER STATUS (only the moves a seller may make, section 6.3),
    with an optional note everyone sees.
  - MARK AS PAID / part payment (section 7), and REVERSE a payment the seller
    recorded (section 8).
  - POST AN UPDATE (section 9).
  - Read both histories.

### 13.3 Payments
The list and details described in section 7.6, limited to the seller's orders.

### 13.4 What a seller cannot do
  - See carts, or other sellers' orders and payments.
  - Cancel an order after confirming it, or reopen a cancelled one.
  - Reverse a payment an admin recorded.
  - Move an order backwards or skip steps.


## 14. THE ADMIN'S PAGES

### 14.1 Orders
All orders of all sellers, with the same filters as the seller plus seller name.
The order page adds the customer's ACCOUNT (a link to their user page) and the
cart the order came from.

The admin can:
  - Move the order to ANY status (section 6.3), with a note.
  - Mark paid / part paid, and reverse ANY payment.
  - Post updates.
  - Create orders for customers (section 15).

### 14.2 Payments
All payments of all sellers, with the filters in section 7.6.

### 14.3 Active carts / Inactive carts
Section 4.6.

### 14.4 Users > a user's page > Addresses
The admin can add, edit, delete and set the default for a customer's addresses on
their behalf (for example when helping someone by phone). Changes are recorded
as made by the admin.

### 14.5 Settings
Payment gateways, shipping zones and general settings (section 3).


## 15. CREATING AN ORDER FOR A CUSTOMER (ADMIN AND SELLER)

Both admin and seller can enter an order on a customer's behalf (for example a
phone or in-shop sale). Menu: Orders > "Create order".

### 15.1 Admin flow

```text
  Step 1  Customer   Type the customer's EMAIL or MOBILE number and press Find.
                     - Found: choose "Use this customer" (their details and
                       default saved address are filled in).
                       A suspended account is shown but cannot be used.
                     - Not found: choose "Enter a walk-in customer instead".
  Step 2  Seller     Search and choose the seller (only approved, active sellers).
  Step 3  Items      The seller's products and variants appear with live price
                     and stock. Click a variant to add it; change quantities.
  Step 4  Address    Recipient name, phone, email, country, address. For a found
                     customer their saved addresses are listed (the default is filled
                     in); pick one, or type a new one and press "Save this address"
                     to add it to the customer's address book and select it.
  Step 5  Delivery & Choose country to see delivery prices; choose a delivery type
          payment    and a payment method (customer proof details are optional
                     here and can be added when marking paid).
  Create  The system works out all prices and totals and creates the order.
```

### 15.2 Seller flow

The same, including the customer's saved addresses and the "Save this address" button
(a seller can add an address to a customer's book while entering an order, but cannot
change or delete the customer's addresses), except there is NO seller step: a seller can only create orders for
their own shop, and sees only their own products.

### 15.3 What the new order looks like

  - Status PENDING, payment DUE, exactly like a customer's order.
  - The history says who placed it ("Order placed by admin Sara" / "by seller
    Rahim Pigeon Loft").
  - Stock is taken and prices are live, exactly like checkout.
  - If a customer account was chosen, the order appears in that customer's
    "Your orders" and they can cancel it while pending.
  - A WALK-IN customer has no account. They can still follow the order with
    "Track an order" (order number + phone).
  - There is no cart behind such an order.

### 15.4 What is refused

  - Items that do not belong to the chosen seller, inactive products or variants,
    or more than the stock.
  - The same variant twice (raise its quantity instead).
  - A suspended customer account, an unknown account, an inactive seller.
  - More than 50 different items.


## 16. FILES: WHAT CAN BE ATTACHED

Used for payment proof and order updates.

```text
  Allowed     Images (jpg, jpeg, png, webp, gif, avif, heic, heif), PDF, Word
              (doc, docx), Excel (xls, xlsx), text (txt), CSV
  Limits      Up to 10 files at once, each up to 10 MB
  Refused     Anything else (programs, scripts, web pages, SVG, archives),
              empty files, and files whose content does not match their name
              (a program renamed to .png is caught)
```

If any one file is refused, none are saved and the person is told which.

Note on privacy: files are stored with long unguessable names, but anyone who has
the link can open it. Do not share proof links publicly.


## 17. EVERY CASE AT A GLANCE (CHEAT SHEETS)

### 17.1 What each person can do with an order

```text
  Action                               Guest  Customer  Seller      Admin
  -----------------------------------  -----  --------  ----------  ------
  Place an order                        yes     yes       -           -
  Create an order for a customer         -       -        own shop    any
  See the order                         own*    own       own         all
  Cancel while pending                  own*    own       yes         yes
  Confirm / pack / ship / deliver        -       -        yes         yes
  Cancel after confirmed                 -       -        NO          yes
  Reopen a cancelled order               -       -        NO          yes
  Move to any status                     -       -        NO          yes
  Mark paid / part paid                  -       -        yes         yes
  Reverse a payment                      -       -        own records any
  Post an update                         -       -        yes         yes
  See histories, payments, updates      own     own       yes         yes
  See carts                              own     own      NO          yes (all)

  * A guest sees orders placed from the same browser, or any order with its
    number + phone on the Track page (view only).
```

### 17.2 Order status: what is possible from where

```text
  From         Customer      Seller                   Admin
  -----------  ------------  -----------------------  ----------------------
  Pending      cancel        confirm, cancel          anything else
  Confirmed    -             pack                     anything else
  Packed       -             ship                     anything else
  Shipped      -             deliver                  anything else
  Delivered    -             -                        anything else
  Cancelled    -             -                        anything else (needs stock)
```

### 17.3 Payment status: what happens

```text
  Action                         Order payment status afterwards
  -----------------------------  ----------------------------------------------
  Order placed                   Due
  Receive part of the total      Partially paid
  Receive the rest               Paid
  Reverse a receipt              Due (if nothing left) or Partially paid
  Pay again after a reversal     Partially paid or Paid (a new payment row)
```

### 17.4 Typical stories

STORY 1 - Cash on delivery, everything fine
```text
  1. Aisha checks out, picks Cash on delivery. Order PENDING, payment DUE.
  2. The seller confirms, packs, ships. Order SHIPPED.
  3. The courier delivers; the seller moves it to DELIVERED.
  4. The seller collects the cash and marks the order PAID, attaching a photo
     of the signed receipt and writing "cash collected by courier".
```

STORY 2 - Bank transfer
```text
  1. Karim checks out, picks Bank transfer, pays at his bank, then enters the
     sender name and transfer reference at checkout.
  2. The seller sees the details on the order, checks the bank, confirms the
     order and marks it PAID with a screenshot of the bank statement.
```

STORY 3 - The customer changes their mind
```text
  Order is PENDING: the customer cancels it on their order page. Stock returns.
  Order is CONFIRMED: the customer cannot cancel; they contact the seller, who
  asks an admin to cancel it.
```

STORY 4 - A payment goes wrong
```text
  The seller marks an order paid; later the transfer is found to be fake. The
  seller (or an admin) opens the order, presses "Reverse payment" and writes why.
  The order is DUE again, the history shows it, the customer sees it.
```

STORY 5 - Out of stock at the last second
```text
  Two buyers have the last bird. One places the order first. The other gets
  "Only 0 of ... left" with a link to update the cart. No order is made.
```

STORY 6 - Phone order taken by the admin
```text
  The admin searches the customer by mobile, picks the seller, adds the birds,
  fills in the address, creates the order, and the customer can follow it in
  their account.
```

STORY 7 - Part payments
```text
  An order of 10,000. The customer pays 4,000 now: PARTIALLY PAID. A week later
  another 6,000: PAID. Two receipts, each with its own proof.
```


## 18. QUESTIONS PEOPLE ASK

Can a customer buy from two sellers at once?
  Yes. They get two carts, check out each separately and get two orders.

Does putting something in the cart reserve it?
  No. Stock is taken only when the order is placed.

What if the price changes while it is in the cart?
  The cart always shows today's price and says "Price changed". The customer
  pays today's price at checkout.

What if the seller is switched off or the product is hidden after it is in the cart?
  The line says "No longer available" and checkout is blocked until it is removed.

Can a guest buy?
  Yes. They keep the order number and the phone number to track it later. If they
  sign in on the same browser afterwards, the orders join their account.

Can a seller see my phone number and address?
  Yes, on that seller's own orders, because they must deliver. Sellers do not see
  other sellers' orders.

Why is the order still "pending" after I paid?
  Payment and order status are separate. Pending means the seller has not yet
  accepted the order. Payment status says whether the money has been recorded.

Who marks a payment as received?
  Always the seller or an admin, with proof. Customers cannot mark themselves paid.

Can an order be paid more than the total?
  No. The system refuses an amount above what is still owed.

Can a payment be deleted?
  No. It can be reversed, which keeps a record. Nothing is erased.

Can a seller undo the admin's payment record?
  No, only an admin can.

Can an admin change an order that was delivered?
  Yes. An admin can move it to any status (for example to cancel it after a
  return), and stock follows.

Does editing an address change my old orders?
  No. Each order keeps the address it was placed with.

How do I know which cart became which order?
  Admin > Commerce > Inactive carts, or the "Cart #" link on the order page.

What is a "walk-in" customer?
  An order entered by staff for someone who has no account. It has no login, but
  can be tracked with the order number and phone.

What happens if a gateway is switched off?
  It disappears from checkout. Old orders keep showing the name they used.

Is a cancelled order removed from the lists?
  No. It stays, marked cancelled, and can be filtered by status.
Can a payment be undone on a cancelled order?
  Only an admin can. The order stays cancelled and the payment is marked reversed.

What if two people press a button on the same order at the same moment?
  Only one action wins. The other gets a clear message that it is no longer allowed. Stock is given back once and
  money received can never go above the order total.

What if someone clicks "Place order" twice?
  One order is made. The second click is refused and stock is taken once.

How do the admin and seller lists page?
  Staff lists show up to 100 rows at a time (20 if not stated) and load the next batch on request. A negative or
  too-large limit is refused. A "from" total higher than the "to" total is refused. Customer lists use pages of up
  to 50 orders.


Are amounts limited to two decimals?
  Yes. Every amount typed in (price, payment, delivery charge) can have at most 2 decimals; more is refused. Amounts
  are stored as doubles and every sum is rounded to 2 decimals, so 0.1 + 0.2 is stored as 0.3. The smallest payment
  is 0.01.

## 19. WHAT IS NOT BUILT YET

These do not exist yet, so they are not described above as features:

  - Coupons and discount codes (planned for later).
  - Returns and refunds of delivered orders (an admin can cancel or change the
    status, and reverse a payment, but there is no return flow).
  - Live-animal shipping rules: the zone and global setting exist, but products
    have no "live bird" marker, so checkout does not block anything.
  - Private downloads for proof files (links are unguessable but not locked).
  - Email or SMS notifications when an order changes.
  - Cancelling from the Track page with only an order number and phone.


## 20. WORDS USED IN THIS GUIDE

```text
  Cart          A basket for one seller, before ordering.
  Order         A cart that was checked out. Has its own number and statuses.
  Order status  Where the order is physically: pending ... delivered, cancelled.
  Payment status Whether money has been recorded: due, partially paid, paid.
  Receipt       One recorded payment (an order can have several).
  Reversal      Undoing a recorded payment, keeping a record of it.
  Gateway       A way to pay (cash on delivery, bKash, bank transfer ...).
  Shipping zone A set of countries with a delivery price and time.
  Walk-in       A customer without an account, entered by staff.
  Guest         A visitor shopping without signing in.
  Proof         The description and files that show a payment was made.
  Update        A message or file posted on an order by the seller or admin.
  History       The list of changes with who made them and when.
  Active / inactive cart  Active: still being filled. Inactive: became an order.
```
