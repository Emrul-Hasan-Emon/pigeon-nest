PRICE PROPOSALS: WHAT AN ADMIN DOES
===================================

An admin does not negotiate. The only moves are reject and cancel, and only
while a proposal is pending or accepted. Each proposal lists what the viewer may
do in `actions` (`['reject','cancel']` or `[]`).

Addresses (admin token)
-----------------------
- `GET /admin/proposals` newest first, cursor paged. Filters: `status`,
  `awaiting` (buyer or seller), `userId`, `sellerId`, `productId`,
  `sellerProductSkuId`, `search` (product name), `buyerSearch`, `sellerSearch`.
- `GET /admin/proposals/:id` one proposal with its full `history`.
- `POST /admin/proposals/:id/reject` and `/cancel`, body `{ note? }`.

Rejecting or cancelling an accepted proposal puts any cart line bought at it
back to the SKU price; the buyer sees a message.

In the admin console
--------------------
- Commerce > Price proposals: status chips, product / buyer / seller search,
  a waiting-on filter, and `?userId=` / `?sellerId=` as removable chips.
- A proposal page: the people, product and order, the price figures, a price
  history timeline, and Reject / Cancel with an optional note.
- Users > a customer: a "Price proposals" section with a link to the full list.
