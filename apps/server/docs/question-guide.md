# Buyer questions (ask the seller)

A shopper asks a seller about a bird on the product page. The seller answers, and the answer is public.

## Rules

- Anyone can read the published questions on a visible product. Names are masked ("Rahim K.").
- Asking needs a signed-in, active customer: 10 to 1000 characters. At most 3 unanswered questions per customer per product (400 "You already have questions waiting...").
- The seller answers from **Questions** in the seller portal (2 to 2000 characters) and can change the answer later. Only the product's seller can answer (404 for anyone else). A suspended seller can read but not answer.
- An admin can hide a question (a reason is required) and restore it. A hidden question is not shown to shoppers or the seller, and cannot be answered (409). Admins never answer for a seller.
- Deleting is not offered.

## Routes

| Role | Route | What |
|---|---|---|
| Public | `GET /user/questions/product/:productId?page=&pageSize=` | Published questions, newest first |
| Customer | `POST /user/questions/product/:productId` `{ question }` | Ask |
| Customer | `GET /user/questions` | My questions |
| Seller | `GET /seller/questions?show=unanswered\|answered\|all&search=` | Own product questions |
| Seller | `GET /seller/questions/summary` | `{ unanswered, answered }` |
| Seller | `POST /seller/questions/:id/answer` `{ answer }` | Answer or change the answer |
| Admin | `GET /admin/questions?visibility=&show=&sellerId=&search=` | Every question |
| Admin | `POST /admin/questions/:id/hide` `{ reason }` / `POST .../restore` | Moderate |

The seller dashboard to-do list and the alert bell count "Questions to answer" (`attention.questionsToAnswer`).

## Screens

Buyer: "Questions and answers" above the reviews on the product page. Seller: **Questions** in the menu (tabs: Needs your answer, Answered, All). Admin: **Commerce > Buyer questions**.
