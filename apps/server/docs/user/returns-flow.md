RETURNS: WHAT A CUSTOMER DOES
=============================

All addresses are under `/v1/api/user/returns` and need a signed-in customer. A
suspended customer can read returns but not open or cancel them.

Ask for a return
----------------
Open a delivered, fully paid order (`/orders/:id`). The Returns box offers
"Return items from this order". Choose the whole order or some items, say what is
wrong, add photos if you like, and send.
- You can ask until the end of the return window (shown on the form).
- You get one request per order or item, whatever happens to it. Cancelling it or
  having it rejected does not give you another.
- Asking for some items does not stop you asking for other items. Once any item
  has a request you cannot ask for the whole order.
- Whole order: the refund is the items plus, if the seller or an admin says so,
  the delivery charge. Some items: delivery is never refunded.

API: `GET /returns/eligibility/:orderId` (what is allowed and what it would
refund), `POST /returns` (multipart: `orderId`, `scope` = `full_order` | `items`,
`orderItemIds` as `1,2,3` for items, `reason`, `files` photos).

Follow it
---------
`/returns` lists yours (status and search filters, pages). `/returns/:id` shows
the items, the refund, and the progress: requested, accepted or rejected (with the
seller's note), processing, money on its way back (with the seller's proof),
returned.
- Cancel while it is still "Waiting for the seller": `POST /returns/:id/cancel`.
  After that only the seller and support move it.
- If the seller rejects, you cannot ask again; contact support, who can open
  another request for you.

After it is returned
--------------------
The items show "Returned" on the order and, when every item came back, the order
shows "Returned". The refund itself is paid by the seller and confirmed by an
admin.

Screens
-------
Footer "Your returns", `/returns`, `/returns/:id`, and the Returns box on the
order page.
