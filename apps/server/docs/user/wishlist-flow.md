WISHLIST: WHAT A CUSTOMER DOES
==============================

All addresses are under `/v1/api/user/wishlist` and need a signed-in customer.
A suspended customer can still read the list; saving and removing need an
active account.

Save and remove
---------------
- `POST /wishlist/:productId` saves a product. Answer:
  `{ productId, saved: true, added, total }`. `added` is false when it was
  already saved. 404 if the product is not shown in the store. 400 when the
  wishlist already holds 200 products.
- `DELETE /wishlist/:productId` removes it. Answer:
  `{ productId, saved: false, removed, total }`. Works for hidden and deleted
  products, and answers 200 with `removed: false` when it was not saved.
- `GET /wishlist/ids` returns `{ productIds, limit }`, newest first. Product
  cards use it to colour their hearts with one call.

The list
--------
`GET /wishlist` returns `{ results, nextCursor }`, newest first, cursor paged
(`cursor`, `limit` up to 100). Each row:

  id, productId, savedAt, name, slug, thumbnailUrl, seller { id, name },
  price (today's), priceWhenSaved, priceChange { direction, amount },
  stock, skuCount, availability, reason

- `availability` is `available`, `out_of_stock`, `unavailable` or `removed`.
  Anything but `available` has a `reason` and cannot be added to the cart.
- Filters: `inStock=true` (can buy now) or `false` (cannot), `minPrice`,
  `maxPrice` (2 decimals), `sellerId`, `search` (product name). Bad values are
  400.

In the store
------------
- A heart on every product card and on the product page. Tap to save, tap again
  to remove. A guest is sent to sign in and returns to the page afterwards.
- The heart in the header shows how many products are saved and opens
  `/wishlist`.
- `/wishlist`: search, availability, seller and price filters, "Load more".
  Each row has "Add to cart" (adds the default option, keeps the product on the
  list) and "Remove". When a product has other options the row links to the
  product page. Price rises and drops show under the price.
- Saving never reserves stock and never changes the price you pay later.
