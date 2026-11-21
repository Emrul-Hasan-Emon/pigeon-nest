REVIEWS: WHAT AN ADMIN DOES
===========================

All addresses are under `/v1/api/admin` and need an admin token. Admins read
everything and moderate. They never edit what a customer wrote.

Read
----
- `GET /reviews` lists every review, newest first, cursor paged. Filters:
  `productId`, `sellerId`, `userId`, `rating`, `status` (published or hidden),
  `reported=true|false` (open reports), `search` (customer name, email or phone,
  product name, review text), `from` and `to` (dates). Each row has the customer
  (id, name, phone, email), the seller, the product, order number, status,
  helpfulCount, reportCount, replyCount and imageCount.
- `GET /users/:userId/reviews` is one customer's reviews (shown on the user page).
- `GET /reviews/:id` is the full review: photos, edit history (what changed, when),
  hide and restore history (who and why) and every report on the review and its
  replies.
- `GET /reviews/:id/replies` is the thread with hidden replies' text and every
  author's id. `?parentId=` opens the answers under one reply.
- Product list: Rating column and the rating on each product.

Moderate a review
-----------------
- `POST /reviews/:id/hide` with `{ reason }` (3 to 1000 characters). The review
  leaves the product page, its rating share is removed at once, and the customer
  sees the reason. 400 when it is already hidden.
- `POST /reviews/:id/restore` with `{ reason? }`. Puts it back and counts it in
  the rating. 400 when it is not hidden.
- Every change is written to the status history with who did it.

Moderate a reply
----------------
- `POST /review-replies/:id/hide` with `{ reason }` and `/restore`. The public
  sees "hidden by a moderator"; you still read the text.
- `PATCH` and `DELETE /review-replies/:id` work on replies you wrote yourself only
  (404 on anyone else's).
- `POST /reviews/:id/replies` answers as "Support".

Reports
-------
- `GET /review-reports` is the queue. `status` defaults to `open`
  (`resolved_hidden`, `dismissed`); `targetType` (review or reply), `reviewId`.
  Each row shows the reporter, the reason and note, the reported text, the
  product and the seller.
- `POST /review-reports/:id/resolve` with `{ action: "hide" | "dismiss", note? }`.
  `hide` hides the reported review or reply and closes every open report on it.
  `dismiss` closes that one report and leaves the text up. 400 when already settled.

Screens
-------
`Commerce > Reviews` (list with filters), a review's own page (hide, restore,
thread, reports, histories) and `Review reports` (the queue). The user page has a
Reviews section.
