REVIEW GUIDE
============

What is this?
Customers rate and review what they bought. Anyone can read the reviews on a
product page. The reviewer, the seller and Support can reply, and replies nest
like a conversation. Admins moderate. This guide is the overview and the rules.
No coding needed.

Detailed guides for each role:
  - Customer: user/review-flow.md
  - Seller:   seller/review-flow.md
  - Admin:    admin/review-flow.md

The role guides have the screens, addresses, filters, error cases and examples.


## 1. The short version

- Only a customer with a delivered order can review a product (a verified
  purchase). One review per order line. Buying the same product again allows
  another review.
- A review has 1 to 5 stars, an optional title, an optional text (2000
  characters) and up to 5 photos.
- A review is published straight away. A moderator can hide it later.
- A customer can edit a review for 30 days. Every edit is logged. They can also
  delete it, and then write a new one for the same item.
- Each product keeps a running rating (average and count) of its published
  reviews. A hidden or deleted review leaves the rating at once.
- Other customers can mark a review "helpful" (one vote each) and report a
  review or a reply.
- Replies nest. Only the reviewer, the product's seller and Support (admin) may
  write replies. Other customers can read them and report them.
- The public sees a masked name ("Rahim K."). Sellers see the same masked name.
  Only admins see who wrote what.


## 2. Who can do what

| | Customer | Seller | Admin |
|---|---|---|---|
| Read published reviews and threads | yes | yes | yes (also hidden) |
| Write a review | yes, delivered orders only | no | no |
| Edit or delete a review | own, 30 days to edit | no | never edits text |
| Hide / restore a review | no | no | yes, with a reason |
| Reply | the reviewer, on their own review | on reviews of own products | as "Support" |
| Edit or delete a reply | own, 30 days to edit | own | own only |
| Hide / restore a reply | no | no | yes, with a reason |
| Mark helpful | yes, not on own review | no | no |
| Report a review or reply | yes, not own | yes, own products only | settles reports |


## 3. The rating on a product

`seller_product` carries `ratingCount`, `ratingSum` and `ratingAverage` (two
decimals). They count published, not-deleted reviews only. Every change to a
review (post, edit, delete, hide, restore) locks the product row and rebuilds the
numbers from the reviews inside the same transaction, so they cannot drift and
two changes at once cannot lose each other. The product page, product cards,
the seller and admin product lists and the storefront search all read these
columns.


## 4. Moderation

- Hiding a review needs a reason (3 to 1000 characters). The customer sees the
  reason on their own review. The history keeps who, when and why.
- A hidden review cannot be edited, voted on, reported or replied to. Its thread
  is closed to the public. Restoring it brings everything back and the rating
  counts it again.
- A hidden reply shows to the public as "hidden by a moderator". Admins still see
  its text and the reason.
- A deleted reply that has answers under it stays as a "deleted" placeholder so
  the answers keep their place.
- Reports: a customer or seller picks a reason (spam, abusive, fake, not
  relevant, other) and an optional note. An admin either hides the text (every
  open report on it closes) or dismisses that one report. Nobody is told who
  reported.
- A review deleted by its author closes its open reports.


## 5. Replies

A reply belongs to a review (`reviewId`) and may answer another reply
(`parentId`). Each reply stores:
  - `authorType` (user, seller, admin) and `authorId`: who wrote it. Both are
    real columns, separate from the tracker fields, with an index.
  - `authorName`: the name shown. A customer is masked, a seller is the shop
    name, an admin is "Support".
  - `depth` (1 for a direct reply) and `path` (ids from the root, "12/45/78/").

Depth cap: 4 levels. A reply to a level-4 reply sits beside it at level 4 and
carries `replyToName`, shown as "@name". A thread holds at most 200 replies.
Replies are read one level at a time: the replies under the review, then the
answers under one reply with `?parentId=`.


## 6. Data

New tables (all with the usual tracker fields):
  review, review_attachment, review_edit_history, review_status_history,
  review_helpful_vote, review_report, review_reply.
Changed: `seller_product` (rating columns).
Migration `Reviews1796400000000` replaces the empty first review table and stops
if it finds rows in it.

Rules the database enforces: rating between 1 and 5, counters never negative,
one live review per order line, one vote per customer per review, one open
report per reporter per target.


## 7. Not built

No review notifications, no seller-initiated review requests, no review export,
no helpfulness for replies. A review can be edited for 30 days only; there is no
admin override.
