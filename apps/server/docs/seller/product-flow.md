BIRD DETAILS: WHAT A SELLER DOES
================================

Pigeon facts on a product. All optional. For the rules and the reasons read
`docs/product-guide.md` section 3.5.

Two levels
----------
- On the product (the same for every option): breed, bloodline, bloodlineNote,
  vaccinationNote, healthNote, raceRecord.
- On an option (a SKU: one bird or one batch): ringNumber, hatchDate (YYYY-MM-DD),
  vaccineName, vaccinatedOn (YYYY-MM-DD), and a sire and a dam.

Saving the facts (JSON)
-----------------------
Addresses are under `/v1/api/seller/products` and need a seller token.
- `POST /` creates a product. `PATCH /:id` changes one. Send the product fields
  at the top level and the option fields inside each entry of `skus`.
- A blank string or `null` clears a field. A field left out stays as it was.
- `PATCH` example:
  `{ "breed": "Homer", "skus": [ { "id": 142, "ringNumber": "BD-2026-001", "hatchDate": "2026-01-10" } ] }`
- Rules: dates must be real and not in the future; the vaccination date cannot be
  before the hatch date; a ring number can be used once per seller (case does not
  matter). A broken rule answers 400 with the message to show.
- A rejected or suspended product is locked: every save answers 403.

Sire and dam (multipart)
------------------------
- `PUT /:id/skus/:skuId/parents/sire` or `.../dam`. Fields: `name`, `ringNumber`,
  `removeImage` (true or false) and a file `image` (a picture, up to 10MB).
  Adding one that exists changes it. A new parent needs at least a name, a ring
  number or a photo.
- `DELETE /:id/skus/:skuId/parents/sire` or `.../dam` removes the parent and the photo.
- Both answer with the whole product, so the screen can reload from it.
- `skuId` must belong to the product (404 otherwise). Another seller's product is 404.

Reading it back
---------------
`GET /:id` returns the product fields, and each SKU with its own fields and
`parents` (sire first), each parent with `role`, `name`, `ringNumber`, `imageUrl`.

On orders
---------
Each order item carries `bird`, a copy made when the order was placed, so you
pack the right bird even if you edit the option afterwards. See
`docs/seller/order-flow.md`.

In the portal
-------------
- My products > Add product and Edit product: an "About the birds" block, and on
  every option an "About this bird" block: ring number, hatched on (the age shows
  under it), vaccine, vaccinated on, and a Father and a Mother box (name, ring
  number, photo).
- A saved option: each parent box saves on its own, straight away. A new option
  (Add product, or + Add SKU): fill the boxes in; they are saved right after the
  product, in the order the options were typed. If one fails the product is still
  saved and a message says to add it again.
- The section above the options is called "Options you sell (each bird, colour or size)".
- A product's page: an "About the birds" card (hidden when empty) and, inside each
  option card, "About this bird" with ring, hatched on, vaccine and the father and
  mother with pictures.
- Orders: each line shows ring, age, breed and bloodline from the order's copy.

COPY A PRODUCT AND QUICK EDIT
=============================

Copy
----
`POST /v1/api/seller/products/:id/copy` (seller token) makes a new product from one of yours and answers
with it (same shape as `GET /:id`).
- The copy is named "Name (copy)", or "(copy 2)" and so on when that name is taken. It is **switched off**
  (`activeStatus` inactive), approved, and gets its own history line.
- Copied: category, collection, description, SEO text, the bird facts of the product, and every option with its
  price, offer price and dates, low-stock alert, on/off, default, price-proposal settings, and variants. The
  thumbnail and gallery are copied as **new files**, so deleting one product never removes the other's pictures.
- Not copied: SKU codes, ring numbers, hatch and vaccine dates and the father and mother (they belong to one
  bird), and stock (every option starts at 0).
- A product that is rejected or suspended can be copied. Another seller's product is 404. If a picture cannot be
  copied, the copy is still made without it.
In the portal: "Copy" on the products list and "Copy this product" on a product's page. You land on the copy's
Edit page. Turn it on when it is ready.

Quick edit
----------
"Quick edit" on the products list opens a window with every option's Price, Offer price, In stock and
"Customers can buy this option". It saves through the normal `PATCH /:id` (only `skus[]` with `id`, `price`,
`discountedPrice`, `quantity`, `isActive`). An emptied offer price is saved as the normal price, which means no offer.

