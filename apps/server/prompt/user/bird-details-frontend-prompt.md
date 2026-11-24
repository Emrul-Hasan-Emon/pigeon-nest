# Prompt: Buyer Bird Details (product page)

Show the pigeon facts to customers (Next.js, `apps/client`, the storefront). The
server is done and tested.

## Reference material

- What the API returns and why: `apps/server/docs/user/product-flow.md`.
- Existing code: `components/store/product-detail.tsx` (option picker, gallery),
  the storefront product type in `types/`, and the order pages under
  `components/orders/*`.

## What to build

### 1. Product page: "About this bird"

From `product.bird`: breed, bloodline, bloodline note, vaccination note, health note,
race record. One section, a row per fact, hide a row that is `null`, hide the
section when every field is `null`. Label it "Details from the seller" so buyers know
nobody at Pigeon Nest checked it.

### 2. The chosen option

When the buyer picks an option (`sku.bird`), show a panel that follows the picker:
- Ring number; "Not given" if `null`.
- Age from `hatchDate` ("5 months old", "1 year 2 months"), plus the hatch date.
- Vaccination: vaccine name and date; a "Vaccinated" badge when `vaccinatedOn` is set.
- Father and Mother: photo, name, ring number. A parent that is `null` shows nothing.
  A photo opens larger on tap. Provide `alt` text such as "Father: Thunder".
The panel must change with the picked option, including when options differ only by ring.

### 3. Orders

On the buyer's order details, each line shows the ring number and age from
`items[].bird` (the copy made when ordering). Show nothing when `bird` is `null`.
Never read the live product for an old order.

### 4. Accessibility and layout

Photos need `alt` text; the page must work at phone width with no sideways scroll;
parent photos load lazily.

## Not available yet

The cart line returns only `sku.bird` (ring number, hatch date, breed): show those and
nothing more. Product lists have no vaccinated badge and there are no breed or
bloodline filters. Do not fake these on the client.

## Out of scope

- Admin and seller screens.
- A "verified" badge.
