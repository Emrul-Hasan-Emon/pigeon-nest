RETURNS: WHAT A SELLER DOES
===========================

All addresses are under `/v1/api/seller/returns`. A suspended seller can read
returns but not act on them. You only see returns on your own orders.

The Returns menu shows how many are waiting for your answer.

Steps
-----
1. Requested: open it and read the reason and photos. Accept or reject.
   - Reject needs a note; the customer sees it.
   - Accept can carry a note. On a whole-order return it also asks whether to
     refund the delivery charge. That choice sets the refund (items, or items
     plus delivery). Item returns never include delivery.
2. Accepted: when the goods are back with you, press "Start processing".
3. Processing: refund the customer and press "Money is being returned" with a
   description (how and how much) and, if you have it, proof (a slip or screenshot).
4. Returning money: wait. An admin confirms "Returned" once the money is back.

API: `GET /returns` (status, scope, search, pages), `GET /returns/:id`,
`POST /returns/:id/accept` (`note?`, `includeDeliveryCharge?`), `/reject` (`note`),
`/processing` (`note?`), `/returning-money` (multipart: `note`, `files?`). A step
out of order answers 409. Each response is the whole return with
`actions.sellerNext`, the buttons to show now.

Commission
----------
Each item's commission was worked out when the order was placed. When an admin
confirms a return, that commission comes off your balance (Commission > Balance
changes shows before and after). The return page lists the commission that comes
back per item.

Screens
-------
Returns (list with filters), a return's page (items, refund, history, your next
step). The order page lists the order's returns and shows commission per item.
