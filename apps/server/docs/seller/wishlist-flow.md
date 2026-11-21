WISHLIST: WHAT A SELLER SEES
============================

Demand only. A seller sees how many customers saved each of their products,
never who. There is nothing a seller can change.

- `GET /seller/wishlist/insights?limit=` (limit 1-50, default 10) returns
  `{ totalSaves, productsSaved, products, top: [...] }`. `top` lists the seller's
  most saved products (id, name, slug, wishlistCount, category), busiest first.
  Readable even when the seller is suspended.
- `wishlistCount` is on every product in `GET /seller/products` and
  `GET /seller/products/:id`.
- `GET /seller/products?sort=mostSaved` puts the most saved products first
  (ties: newest first). With this sort `cursor` is an offset: send the
  `nextCursor` you got back, as usual. `sort=newest` is the default.
- Sending `wishlistCount` when updating a product is rejected (400).
- A seller only ever sees their own products and counts.

In the portal
-------------
- Dashboard: a "Wishlist demand" section with total saves, products saved and the
  top five.
- Products list: a "Saved by" column and a "Most saved first" sort.
- Product page: "Saved by N customers" next to the status.
