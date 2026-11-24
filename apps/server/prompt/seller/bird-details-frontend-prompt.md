# Prompt: Seller Bird Details (product and option)

Add the pigeon facts to the seller portal (Next.js, `apps/client`, `/seller/*`).
The server is done and tested.

## Reference material

- Rules and reasons: `apps/server/docs/product-guide.md` section 3.5.
- Addresses and bodies: `apps/server/docs/seller/product-flow.md`.
- Existing code: the shared product form (`components/admin/catalog/products/*`,
  used by sellers through `sellerProductPortal` in `lib/products/portal.ts`),
  `app/seller/products/[id]/page.tsx` (details),
  `app/seller/products/[id]/edit/page.tsx`, `components/seller/product-sku-card.tsx`.
  Build the form fields once in the shared form; see the admin prompt
  (`prompt/admin/bird-details-frontend-prompt.md`) for the types and API client.

## Seller UI rules (same as the rest of the portal)

Big text, plain words, an icon beside each section, one hint line under each
field, no jargon. Say "option", not "SKU". Behaviour of everything else stays the same.

## What to build

### 1. Edit and create form

- Section "About the birds" (a bird icon): Breed, Bloodline, About the bloodline,
  Vaccination programme, Health, Race record. Hint examples under each, such as
  "For example: Homer, Roller, Tumbler".
- In each option: "About this bird": Ring number, Hatched on, Vaccine, Vaccinated on,
  and two photo boxes "Father" and "Mother", each with name, ring number and a picture.
- Ring number hint: "The number on the bird's leg ring. Each bird has its own, so add
  each ringed bird as its own option."
- Parent boxes: "Save the product first, then add the parents" on an unsaved option.
- Everything is optional; say so ("You can leave this empty").
- A locked product (rejected or suspended) disables all of it, as the form already does.

### 2. Product details page

- A card "About the birds" with the six facts, "Not given" for empty ones, hidden
  when all are empty.
- Each option card (`product-sku-card.tsx`): ring number, age ("5 months old"),
  vaccination ("Vaccinated against PMV on 1 Feb 2026"), and the Father and Mother
  with their pictures. Hide the group when the option has none.

### 3. Orders

On an order line show "Ring: BD-2026-001" and the age from `items[].bird`, so the seller
packs the right bird. Nothing when `bird` is `null`.

## Errors

Show the server message next to the field. A duplicate ring says "Ring number X is
already on another of your birds": keep the seller's typing and focus the field.
Reload the product on a 404 from a parent address.

## Out of scope

- Admin and buyer screens.
- Filters by breed or bloodline.
- A "verified by admin" badge.
