BIRD DETAILS: WHAT A CUSTOMER SEES
==================================

Pigeon facts on the product page, so a buyer can judge the bird. Everything is
the seller's own information and is optional.

Address
-------
`GET /v1/api/user/products/:id` (a live product only) now also returns:
- `bird` on the product: `breed`, `bloodline`, `bloodlineNote`,
  `vaccinationNote`, `healthNote`, `raceRecord`. Each is `null` when not given.
- `bird` on every SKU: `ringNumber`, `hatchDate`, `vaccineName`, `vaccinatedOn`,
  and `sire` and `dam`. Each parent is `{ name, ringNumber, imageUrl }` or `null`
  when the seller gave nothing.

What to show
------------
- The product's facts as an "About this bird" section.
- When the buyer picks an option, that option's ring number, age (worked out
  from `hatchDate`), vaccination and the parents' photos.
- Say "not given" for anything `null`. Label the section as the seller's own
  details; nobody at Pigeon Nest has checked them.

After buying
------------
The order keeps a copy of the bird as it was sold, in `items[].bird`
(`ringNumber`, `hatchDate`, `vaccineName`, `vaccinatedOn`, `breed`, `bloodline`,
`sire`, `dam`; parents have name and ring number only). It does not change if
the seller edits the option later. Older orders and non-bird items have
`bird: null`. See `docs/user/order-flow.md`.

In the cart
-----------
Each cart line's `sku` carries `bird`: `{ ringNumber, hatchDate, breed }`, or `null`
for an item without bird facts. The cart shows it under the option name, so the buyer
sees the ring before ordering.

On the shop
-----------
- Product page: a "Bird details" section (the seller's facts, hidden when empty) and a
  "This bird" panel that follows the picked option: ring number, age and hatch date,
  vaccine and date, a "Vaccinated" badge, and the father and mother with pictures
  that open larger. An option with no bird facts shows no panel.
- Orders and returns: the ring, age, breed and bloodline show under each item, from
  the order's copy.

Not yet
-------
Product lists do not show a vaccinated badge, and there are no breed or bloodline
filters.
