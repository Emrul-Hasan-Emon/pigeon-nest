REVIEWS: WHAT A SELLER DOES
===========================

All addresses are under `/v1/api/seller`. Reading works for a suspended seller
too; replying and reporting need an active seller. You only ever see reviews of
your own products. A customer shows as a masked name ("Rahim K."), never a
phone, email or id.

Read
----
- `GET /reviews` returns `{ results, nextCursor }`, newest first, cursor paged.
  Filters: `productId`, `rating`, `unreplied=true` (this shop has not answered)
  or `unreplied=false`. Only published reviews appear; a hidden review leaves
  the list. Each row: id, productId, productName, productSlug, rating, title,
  comment, images, reviewerName, skuData, helpfulCount, replyCount,
  `sellerReplied`, editedAt, createdAt.
- `GET /reviews/summary` (optional `productId`) returns ratingAverage,
  ratingCount, breakdown by stars and `unreplied`, the number of reviews still
  waiting for the shop's answer.
- Product list and product page carry `ratingAverage` and `ratingCount`.
- The thread under a review is the public one: `GET /v1/api/user/reviews/:id/replies`.
  The portal reads it for you.

Reply
-----
- `POST /reviews/:id/replies` with `{ body, parentId? }` (body 1 to 1000). Reply
  to the review or to any reply in its thread. Shown as the shop name with a
  "Seller" badge. As many replies as you like (a thread holds 200).
- `PATCH /review-replies/:id` with `{ body }` edits your reply (30 days).
- `DELETE /review-replies/:id` deletes your reply. Answers under it stay under a
  "deleted" note.
- 404 on a review of another seller's product. 403 on a hidden review. 403 for a
  suspended seller.

Report
------
- `POST /reviews/:id/report` and `POST /review-replies/:id/report` with
  `{ reason, note? }`. Reasons: spam, abusive, fake, irrelevant, other. Only on
  your own products (404 otherwise). 409 when you already have an open report on
  it. A moderator decides; you cannot hide or delete a review yourself.

Screens
-------
`/seller/reviews`: three cards (average rating, reviews waiting for your reply,
low ratings), filters for product, stars and "Not answered yet", and each review
with its thread and a Reply box. Products table: a Rating column beside "Saved by".

## Your public page

Buyers see your overall rating and every review of your products on `/sellers/<your id>`. Write an "About your shop" text in My profile so buyers know who you are. Your phone and email are never shown there.
