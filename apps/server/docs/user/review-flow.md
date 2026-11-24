REVIEWS: WHAT A CUSTOMER DOES
=============================

Reading is open to everyone. Everything else needs a signed-in customer. A
suspended customer can read their own reviews; writing, voting and replying need
an active account.

Reading (no sign-in)
--------------------
- `GET /review/product/:productId/summary` returns
  `{ productId, ratingAverage, ratingCount, breakdown: { "1".."5" } }`.
- `GET /review/product/:productId` returns `{ results, nextCursor }`.
  Query: `rating` (1 to 5), `withPhotos=true`, `sort=newest` (default) or
  `helpful`, `cursor`, `limit` (up to 100). With `sort=helpful` the cursor is an
  offset: pass back the `nextCursor` you were given. Each row:
  id, rating, title, comment, images [{ id, url, fileName }], reviewerName
  (masked), verifiedPurchase, skuData, helpfulCount, replyCount, editedAt,
  createdAt. No phone, email or ids of the customer are ever sent.
- Both answer 404 when the product is not shown in the store.
- `GET /review/:reviewId/replies` returns the replies straight under a review.
  Add `?parentId=` for the answers under one reply. Oldest first, cursor paged.
  A hidden reply has `hidden: true` and no text; a deleted reply that has answers
  has `deleted: true`. 404 when the review is hidden or deleted.

What can be reviewed
--------------------
`GET /user/review/pending` lists delivered order lines without a live review:
id (the order line), orderId, orderNumber, productId, productName, productSlug,
thumbnailUrl, skuData, orderedAt. Newest first, cursor paged.

Write a review
--------------
`POST /user/review` (multipart): `orderItemId`, `rating` (1 to 5), `title` (up
to 150), `comment` (up to 2000), `images` (up to 5 files).
- 404: the order line is not yours or does not exist.
- 400: the order is not delivered yet.
- 409: you already reviewed this order line.
- 400: more than 5 photos, a file that is not a real image, an empty file, or a
  photo over 5 MB. Nothing is saved when any photo is refused.
- Unknown fields are refused with 400.
Answer: the review with `editableUntil` and `canEdit`.

Your reviews
------------
- `GET /user/review` lists yours, newest first, cursor paged. A hidden review
  shows `status: "hidden"` and the reason in `hiddenReason`.
- `GET /user/review/:id` opens one of yours (404 for anyone else's).
- `PATCH /user/review/:id` (multipart) changes `rating`, `title`, `comment`;
  `removeImageIds` (comma list) drops photos; `images` adds photos (5 in total).
  A blank title or comment clears it. 400 when nothing changes, 403 after 30
  days or when the review is hidden. Each edit is saved in the edit history.
- `DELETE /user/review/:id` deletes it (soft delete). You can write a new
  review for the same item afterwards.

Helpful votes and reports
-------------------------
- `POST /user/review/:id/helpful` and `DELETE` the same address. Voting twice
  changes nothing. You cannot vote on your own review (400). Hidden or deleted
  reviews answer 404 on a vote.
- `GET /user/review/votes?productId=` returns `{ reviewIds }` you voted on, so
  the buttons can show it.
- `POST /user/review/:id/report` and `POST /user/review/replies/:id/report`
  with `{ reason, note? }`. Reasons: spam, abusive, fake, irrelevant, other.
  403 on your own review; 400 on your own reply; 409 when you already have an
  open report on it. You may report an answer under your own review.

Replies
-------
Only you (the reviewer) can reply on your review; other customers get 403.
- `POST /user/review/:id/replies` with `{ body, parentId? }` (body 1 to 1000).
  Reply to the review, or to any reply in its thread.
- `PATCH /user/review/replies/:id` with `{ body }` edits your reply (30 days).
- `DELETE /user/review/replies/:id` deletes your reply.
- Not allowed: replying to a hidden review (403), answering a hidden reply (400),
  a 201st reply in one thread (400).
- A reply past depth 4 sits beside the one you answered and shows "@name".

Screens
-------
- Product page: stars under the title, then "Customer reviews" with the
  breakdown (click a bar to filter), "With photos", sort, helpful, report, and
  the reply threads.
- `/reviews`: tab "To review" (delivered items) and "My reviews" (edit, delete,
  threads). Order page: "Write a review" beside each delivered item.
