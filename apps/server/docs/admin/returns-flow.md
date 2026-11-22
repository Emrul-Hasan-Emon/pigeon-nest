RETURNS: WHAT AN ADMIN DOES
===========================

All addresses are under `/v1/api/admin/returns`. Menu: Commerce > Returns.

See returns
-----------
`GET /returns` (filters: `status`, `scope`, `search` (return or order number),
`sellerId`, `userId`, `orderId`; pages). `GET /returns/:id` has the items (with
commission), the refund breakdown, the customer, the history with files, and
`actions.adminTargets`.

Open a return for a customer
----------------------------
Returns > Open a return, or "Open a return" on a delivered order's page.
`GET /returns/eligibility/:orderId` shows what can be returned. `POST /returns`
(multipart): `orderId`, `scope`, `orderItemIds` (items), `reason`,
`includeDeliveryCharge` (whole order only; left out, the setting decides), `files`.
- You are not held to the return window.
- You can open another return for an item the customer already used their one
  request on, but not for an item that is returned or already in an open return.
- Works for guest orders too.

Move a return to any status
---------------------------
`POST /returns/:id/status` (multipart: `status`, `note` (required, 3+
characters), `includeDeliveryCharge?`, `files?`). Any status to any other.
- Moving to `returned` takes the returned items' commission off the seller, flags
  the items (and the order when all items are back) as returned, and writes the
  ledger and change-log rows. The screen shows how much first.
- Moving out of `returned` puts the commission back, clears the flags and voids
  the return ledger rows.
- The same status is refused, except to change the delivery choice of a return
  that is not finished.
- Reopening a rejected or cancelled return needs its items to be free of other
  open returns (409 otherwise).

Orders
------
An order with an open or returned return cannot be cancelled (409) and its
payment cannot be reversed (409). Reject or cancel the return first.

Settings
--------
Settings > General settings > Returns and refunds: the return window in days and
whether a whole-order return refunds delivery by default.

Commission change log
---------------------
Commission > Balance changes (`GET /commission/changes`): every move of every
balance, before and after, with the reason and who. Also a tab on a seller's
commission page.
