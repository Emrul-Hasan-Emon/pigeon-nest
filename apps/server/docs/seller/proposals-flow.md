PRICE PROPOSALS: WHAT A SELLER SEES
===================================

A customer can offer their own price for one SKU. Only that customer and the
seller see the offer. The seller answers; the two can go back and forth until
one side accepts or rejects.

In the portal
-------------
- Menu > Offers (a badge shows how many wait for your answer).
- Summary: open, need your answer, accepted, used, closed.
- Tabs: Needs your answer, Waiting for buyer, Accepted, Used, Closed
  (rejected or cancelled, picked in a small list), All. Search by product or
  buyer; "Load more" pages the list.
- Click a row for the offer: buyer, product, SKU, quantity, price per unit,
  total, SKU price then and now, and the full price history (who, what, price x
  quantity, note, time).

Statuses
--------
- pending: open. `awaitingParty` says whose turn it is.
- accepted: agreed and locked. The seller cannot reject it any more.
- used: the customer bought at the agreed price.
- rejected / cancelled: closed.

Answering (your turn only)
--------------------------
The buttons come from the offer's `actions`, so only what is allowed now shows.
- Accept: takes the price and quantity as they stand.
- Counter: a new price, optionally a new quantity and a note. It becomes the
  customer's turn.
- Reject: optional note. Closes the offer.
- If the SKU price drops below an open offer, the offer shows a notice: the
  customer pays the lower price.
- A failed action shows the server's message (for example when the customer
  acted first); the offer reloads to its real state.

SKU settings
------------
On the product form, each SKU has:
- Accept price proposals: off by default.
- Lowest price I will consider: optional, hidden from customers. Offers below it
  are turned down automatically. Empty or 0 means no floor. Saving an empty
  field sends 0, which removes an earlier floor.
