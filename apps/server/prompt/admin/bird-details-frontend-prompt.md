# Prompt: Admin Bird Details (product and SKU)

Add the pigeon facts to the admin product screens (Next.js, `apps/client`). The
server is done and tested.

## Reference material

- Rules and reasons: `apps/server/docs/product-guide.md` section 3.5.
- Addresses and bodies: `apps/server/docs/admin/product-flow.md`.
- Existing code to extend, not duplicate:
  `components/admin/catalog/products/product-create-form.tsx`,
  `product-edit-form.tsx`, `product-sku-editor.tsx`, `app/admin/catalog/products/[id]/page.tsx`,
  `lib/api/products.ts`, `types/product.ts`, `lib/products/portal.ts`.
  The seller screens share these forms through `ProductPortal`, so one change serves both roles.

## What to build

### 1. Types and API client

Add to `Product`: `breed`, `bloodline`, `bloodlineNote`, `vaccinationNote`,
`healthNote`, `raceRecord` (all `string | null`). Add to `Sku`: `ringNumber`,
`hatchDate`, `vaccineName`, `vaccinatedOn` (`string | null`) and `parents`
(`{ id, role: 'sire' | 'dam', name, ringNumber, imageUrl }[]`).
Add `saveSkuParent(productId, skuId, role, form)` (multipart `PUT`) and
`removeSkuParent(...)` (`DELETE`) to the portal, one implementation per role.

### 2. Product form: "About the birds" block

Fields: breed, bloodline, bloodline note, vaccination note, health note, race record.
Short texts as inputs, notes as textareas. All optional. Send the fields on
create and on update. To clear a field send an empty string; a field the user did not
touch is left out of an update.

### 3. SKU editor: "About this bird"

Per SKU: ring number, hatch date (date input, max today), vaccine name,
vaccinated on (date input, min hatch date, max today), and two parent boxes
"Father (sire)" and "Mother (dam)", each with name, ring number and one photo.
- The parent boxes need a saved SKU (they use the SKU id). On a new SKU show
  "Save the product first, then add the parents" instead of the upload.
- Photo: show the current image, "Replace" and "Remove". Remove sends `removeImage`.
  Accept images only, up to 10MB; show the size error inline.
- A hint under ring number: "One ring = one bird. Add each ringed bird as its own option."

### 4. Product details page

A read-only "About the birds" card and, on each SKU row, its ring, age (from
`hatchDate`, in months or years), vaccination and the parents with photos. Show
"Not given" for empty values. No block when nothing at all is filled in.

### 5. Order details

On each order line show the ring number, age and breed from `items[].bird`
(`null` for older orders and non-bird items: show nothing). Do not read the live
SKU for this; the order keeps its own copy.

## Validation and errors

Show the server's message inline, next to the field it names:
- 400 "Ring number X is already on another of your birds" under the ring field.
- 400 date messages under the date field.
- 400 "Give a name, a ring number or a photo for the parent" in the parent box.
- 404 on a parent address: reload the product.
Do not hand-roll the checks the server already does; only prevent the obvious
(future dates, vaccination before hatch) with the input `min`/`max`.

## Out of scope

- Buyer screens and seller screens (separate prompts).
- Filters or search by breed and bloodline.
- Any "verified" badge.
