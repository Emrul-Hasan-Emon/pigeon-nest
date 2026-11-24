BIRD DETAILS: WHAT AN ADMIN DOES
================================

An admin can set the same pigeon facts as a seller, for any seller's product.
Rules and reasons: `docs/product-guide.md` section 3.5.

Addresses (admin token, under `/v1/api/admin/products`)
-------------------------------------------------------
- `POST /` and `PATCH /:id`: same body as the seller's, plus `sellerId` on create.
  Product fields at the top level (`breed`, `bloodline`, `bloodlineNote`,
  `vaccinationNote`, `healthNote`, `raceRecord`); option fields inside each
  entry of `skus` (`ringNumber`, `hatchDate`, `vaccineName`, `vaccinatedOn`).
  A blank string or `null` clears a field; a missing field stays.
- `PUT /:id/skus/:skuId/parents/sire|dam`: multipart `name`, `ringNumber`,
  `removeImage`, `image` (up to 10MB).
- `DELETE /:id/skus/:skuId/parents/sire|dam`.
- `GET /:id` returns everything, each SKU with `parents` (sire first).

Differences from a seller
-------------------------
- An admin can change a locked (rejected or suspended) product.
- The ring-number rule works per seller: two sellers may use the same ring, one
  seller may not use a ring twice. The check uses the product's owner.
- The status history does not record bird edits (they are not a status change).

Orders
------
Each order item has `bird`, the facts as sold (null for older orders and items
without bird facts). See `docs/admin/order-flow.md`.

In the console
--------------
- Catalog > Products > Add product and Edit product: an "About the birds" block
  (breed, bloodline, notes, race record). Each option has "About this bird": ring
  number, hatched on, vaccine, vaccinated on.
- Father and mother: boxes on every option, with name, ring number and photo.
  - A saved option: each box saves on its own, straight away (Save, Remove photo,
    Remove father / mother).
  - A new option (Add product, or + Add SKU on Edit): type them in the form. They
    are saved right after the product, in the order the options were typed. If one
    fails the product is still saved and a message says to add it again.
- The form checks future dates, vaccination before hatch, and a ring used twice on
  one product. The server's message (for example a ring already used on another
  bird) shows at the top of the form.
- Product page: an "About the birds" card (hidden when empty) and, under each option
  row, its ring, age, vaccine and the parents with photos.
- Order page: each line shows ring, age, breed and bloodline from the order's copy.
- Sellers use the same forms, so their Add and Edit product pages show the same fields.

## Copy a product and quick edit

- **Copy** (products list, or `POST /admin/products/:id/copy`): makes a new product for the same seller, named "Name (copy)" and switched off, with stock 0. Category, text, bird facts, prices and variants are copied; SKU codes, ring numbers, hatch and vaccine dates and parents are not. Pictures are copied as new files. You land on the copy's Edit page.
- **Quick edit** (products list): change price, offer price, stock and on/off of each option in one window. It uses the normal `PATCH /admin/products/:id` with `skus[]`.
