WISHLIST
========

A signed-in customer saves products with a heart to find them later. Saving is
not buying: it never touches the cart, stock or prices, and only the customer
removes what they saved.

Per-role details: `user/wishlist-flow.md`, `seller/wishlist-flow.md`,
`admin/wishlist-flow.md`.

Rules
-----
- Customers only. Guests who tap a heart are sent to sign in and come back to the
  same page (`/user/login?next=/products/...`). Only same-site paths are honoured.
- A wishlist holds at most 200 products. The 201st is refused (400); removing one
  frees a slot. The limit holds even when adds race.
- A wishlist saves the product, not a variant. "Add to cart" uses the same SKU the
  product page would pick by default.
- Only products a customer can see in the store can be saved (approved, active,
  live seller, at least one active SKU). Anything else is 404. Out-of-stock
  products can be saved.
- Saving twice changes nothing. Removing something not saved changes nothing.
- Each row keeps `priceWhenSaved`: the price the customer would have paid when
  they saved it (live discount, else list price). The list compares it with
  today's price (`dropped`, `rose`, `same`, with the amount).
- The list shows live product details, never a copy. A product that was hidden,
  rejected, deleted or sold out stays on the list, greyed out, with a reason
  (`out_of_stock`, `unavailable`, `removed`). It cannot be added to the cart.
- Removing is a hard delete (the pair customer + product is unique, so saving
  again later makes a new row with a new saved price).
- Every row carries the tracker fields (`createdBy`, `creatorType`,
  `creatorName`, `updatedBy`, `updaterType`, `updaterName`, `createdAt`,
  `updatedAt`, `deletedAt`).

Saved count on products
-----------------------
`seller_product.wishlistCount` is the number of customers who have the product
saved. Every save and every remove updates it in the same transaction, and a
database check keeps it from going below zero. Sellers and admins read it; nobody
writes it directly (a product update that sends `wishlistCount` is rejected).

Data
----
- `wishlist`: `userId`, `sellerProductId`, `priceWhenSaved`, tracker fields.
  Unique on (`userId`, `sellerProductId`); deleting the customer or the product
  removes the rows.
- `seller_product.wishlistCount` (integer, default 0, indexed, check >= 0).
- Migration `Wishlist1796300000000` reshapes the first wishlist table (it had a
  stray `productId` column), adds `priceWhenSaved` and the count.

Tests
-----
`testing/wishlist_test.py` (201 checks): access rules, save and remove, saved
price, tracker fields, live details and price changes, every unavailable state,
filters and cursor paging, the 200 cap (including racing adds), seller counts
and sort, admin lists and report, and the count-equals-rows invariant.
