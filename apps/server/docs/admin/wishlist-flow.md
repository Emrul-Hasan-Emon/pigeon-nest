WISHLIST: WHAT AN ADMIN DOES
============================

Read only. Admins cannot save or remove anything for a customer, and the
customer wishlist addresses refuse an admin token (403).

Addresses (admin token)
-----------------------
- `GET /admin/wishlist` every saved row, newest first, cursor paged. Each row has
  the customer (id, name, phone, email), the seller (id, name, phone, email), the
  product (id, name, price now, stock, status, `wishlistCount`, `deleted`), the
  saved price and price change, `availability`/`reason`, and the tracker fields.
  Filters: `userId`, `sellerId`, `productId`, `search` (product name),
  `userSearch` (customer name, email or phone), `sellerSearch` (seller name,
  email or phone).
- `GET /admin/users/:userId/wishlist` one customer's list, same shape (404 for an
  unknown customer).
- `GET /admin/wishlist/most-saved?sellerId=&categoryId=&limit=` products with the
  most saves, busiest first (limit 1-100, default 20).
- `GET /admin/products?sort=mostSaved` the product list ordered by saves (cursor
  is an offset with this sort). Every product row has `wishlistCount`.
- Deleted products stay on these lists, marked `removed`.

In the admin console
--------------------
- Commerce > Wishlists: "Saved items" (with the filters above) and "Most saved
  products".
- Users > a customer: a "Wishlist" section under the addresses.
- Products: a "Saved by" column and a "Most saved first" sort.
