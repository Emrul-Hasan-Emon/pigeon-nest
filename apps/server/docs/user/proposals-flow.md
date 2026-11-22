PRICE PROPOSALS: WHAT A CUSTOMER DOES
=====================================

All addresses are under `/v1/api/user/proposals` and need a signed-in customer.
A suspended customer can read proposals but not make or answer them.

Make an offer
-------------
On a product page, a SKU whose seller takes offers shows "Make an offer"
(`acceptProposals: true` on the SKU). `POST /proposals` with
`{ sellerProductSkuId, quantity, price, note? }`; `price` is for one unit.
Only you and the seller can see it. A price under the seller's hidden lowest
price is rejected at once. You can hold one open (pending or accepted) offer
per SKU; a second one answers 409.

The conversation
----------------
- The seller can accept, counter or reject. When they counter, it is your
  turn: accept, counter back, decline (`/reject`) or cancel.
- `POST /proposals/:id/accept | counter | reject | cancel`. Each response is
  the whole proposal with `actions`, the buttons you may show now.
- You can cancel while the offer is pending. Once accepted you cannot cancel
  it; only an admin can reject or cancel an accepted offer.
- After a reject or cancel you can make a new offer.
- `GET /proposals` lists yours (`status`, `awaiting`, `search`, cursor paging).
  `GET /proposals/:id` adds the `history` of every price. `GET /proposals/sku/:skuId`
  returns your current offer for a SKU, or `{ proposal: null }`.

Buying at the agreed price
--------------------------
An accepted offer is yours to use or ignore; it has no expiry. "Add to cart at
this price" calls `POST /user/carts/items` with `proposalId`. The quantity is
fixed at the offer's, so remove the line to buy a different amount.
- The cart line shows your price with the item price struck through.
- If the item later gets cheaper than your price, you pay the lower price and
  the cart says so. The offer stays accepted.
- If an admin rejects or cancels the offer while it is in your cart, the line
  goes back to the item price with a message.
- Checkout charges the offer price. The order shows the item price at that
  time and your offer price, and the offer becomes `used`.
- The shop sends the total it showed (`expectedItemsTotal`) when placing the
  order. If an offer was closed or a price changed meanwhile, the order is
  refused with 409 `PRICE_CHANGED`, the form shows the new total, and you
  place it again.

Screens
-------
Header "Offers" and `/proposals` (tabs: All, Your turn, With the seller,
Accepted, Used, Rejected, Cancelled), `/proposals/:id` (actions and price
history), the offer box on product pages, the cart, and the order page.
