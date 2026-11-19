# Seller account testing

How to test seller registration, login, approval and the access rules. Read
[`../seller-account-guide.md`](../seller-account-guide.md) first for what the
behaviour is supposed to be. This document is about how to check it.

There are two parts:

1. **Automated API suite** (`seller_account_test.py`): 267 checks, about two
   minutes, covers the rules end to end.
2. **Manual UI checklist** (section 5): the browser flows the script cannot
   see.

## 1. Prerequisites

| Need | Detail |
|---|---|
| Backend running | `pnpm start:dev` in `apps/server` (default port 3100) |
| Frontend running (UI part) | `npx next dev --port 3001` in `apps/client` |
| Postgres + `psql` on PATH | The script reads and cleans the DB directly with `psql -d <db>` |
| Python 3 and `curl` | No extra Python packages needed |
| An admin account | Default `test-admin@example.com` / `Admin@123` (see section 2 to change) |
| Seed data | A category with id 16 and attribute 2 / value 6 (used only by section G). Adjust the ids in the script if your DB differs |

Run it against a **development database only**. See section 3.

## 2. Running the automated suite

```bash
cd apps/server/docs/testing
python3 seller_account_test.py
```

Output prints one `PASS` / `FAIL` line per check, then a summary:

```text
==== 267/267 passed, 0 failed ====
```

Exit code is 0 when everything passes and 1 otherwise. Failed checks print
the expected status, the actual status and the start of the response body.

To see only problems:

```bash
python3 seller_account_test.py | grep -v '^PASS'
```

### Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `API_ROOT` | `http://localhost:3100/v1/api` | Versioned API root |
| `TEST_DB` | `pigeon_nest_dev` | Database name passed to `psql -d` |
| `UPLOADS_DIR` | `apps/server/uploads` | Where the server stores uploads |
| `ADMIN_EMAIL` | `test-admin@example.com` | Admin used to approve/reject |
| `ADMIN_PASSWORD` | `Admin@123` | Its password |
| `JWT_ACCESS_SECRET` | `dev-secret-change-me` | Must equal the server's `JWT_ACCESS_SECRET`; used to forge tokens for the "wrong role" and "unknown seller" checks |

Example:

```bash
API_ROOT=http://localhost:3000/v1/api TEST_DB=pigeon_nest JWT_ACCESS_SECRET=... python3 seller_account_test.py
```

## 3. Safety: what the suite touches

- It creates sellers whose names start with `T-` and products whose names start
  with `T-elig-`. It deletes **only** those rows (and the image files that
  belong to those sellers) before it starts and after it finishes.
- It never deletes other sellers, other products or other uploads. If a run is
  interrupted, run it again; the next run cleans the leftovers first.
- It writes to the database and uploads folder the server is using, so do not
  point it at production.
- Check afterwards: `select count(*) from seller where name like 'T-%';` should
  be 0.

## 4. What the automated suite covers

Each group below is one section of the script. "Expected" is the HTTP status.

### A. Registration (`POST /v1/api/seller/auth/register`)

| Case | Expected |
|---|---|
| Missing name, blank name, name over 255 characters | 400 |
| Missing phone, empty phone, phone without country code (`01712345678`), digits without `+`, too short, invalid for its country, letters | 400 |
| Missing password, password 7 characters, password 73 characters | 400 |
| Invalid email, email over 255 characters | 400 |
| Extra fields the seller must not send: `status`, `activeStatus`, `commissionRate`, `rejectionReason`, `isActive`, `passwordHash`, `id`, any unknown field | 400 |
| Avatar / NID image that is a text file, text with an image MIME type, zero bytes, unknown file field name, two avatars | 400 |
| Image over 10 MB | 413 |
| Rejected requests create no seller row and store no files | checked |
| Minimal valid registration | 201, access token returned |
| New seller is `pending` + `inactive`, commission 0, no payout info, name trimmed, phone stored as E.164, no `passwordHash` in the response | checked |
| Response contains access flags (can edit profile yes, can manage no, code `SELLER_PENDING`) | checked |
| Password stored as a bcrypt hash | checked |
| Same phone again, and the same phone written with spaces/dashes | 400 |
| Phones from India, US, UAE, Singapore, Pakistan register and are stored as E.164 | 201 |
| International number typed with spaces is normalised | 201 |
| Email is lowercased; same email in other case is a duplicate; blank email means none | checked |
| Registration with avatar and both NID images, files exist on disk | 201 |
| 8 simultaneous registrations of one phone | exactly one 201, seven 400, no 500, one row |

### B. Login (`POST /v1/api/seller/auth/login`)

| Case | Expected |
|---|---|
| Login while pending | 200 |
| Login accepts a spaced/dashed phone | 200 |
| Wrong password, unknown phone | 401, same message for both |
| Phone without country code, missing phone, missing password, empty password, non-string password, unknown field, password over 128 characters, empty body, malformed JSON | 400 |
| Admin credentials on seller login, seller phone on admin login | 401 |
| Token carries the seller id and type `seller` | checked |
| Login works for approved+active, rejected, approved+inactive, approved+suspended | 200 |

### C. Role separation and tokens

| Case | Expected |
|---|---|
| Seller token on admin products, sellers, seller-requests, approve, admin seller update | 403 |
| Admin token on seller profile read and update | 403 |
| Seller profile endpoints with no token, garbage token, expired token, token signed with the wrong secret | 401 |
| Forged admin-typed token on a seller endpoint | 403 |
| Valid token for a seller id that does not exist | 401 |

### D. Access matrix and profile

Seven account states are tested: pending, approved+active, approved+inactive,
rejected, suspended, pending+suspended, approved+suspended.

| Case | Expected |
|---|---|
| Reading own profile works in every state, with the right access flags | 200 |
| Profile edit and password change work in every state except suspended | 200 |
| Suspended: profile edit and password change | 403, code `SELLER_SUSPENDED`, nothing changed |
| Editing leaves pending, approved+active and approved+inactive unchanged | checked |
| Rejected seller edits name, email, avatar, NID image or phone | back to `pending`, reason cleared |
| Rejected seller saves with no real change | stays rejected, reason kept |
| Rejected seller changes only the password | stays rejected |
| Seller sends `status`, `activeStatus`, `isActive`, `commissionRate`, `rejectionReason`, `passwordHash`, `payoutAccountInfo`, `id` or unknown field | 400 each |
| Inactive seller tries to set own `activeStatus` | 400, still inactive |
| Pending seller tries to set own `status` | 400 |
| Profile validation: blank name, name too long, bad email, local-format phone, invalid phone, empty phone | 400 |
| Phone owned by another seller; email owned by another seller (any case) | 400 |
| Bad avatar files (text, fake MIME, unknown field) | 400 |
| Valid update of phone, email and name is normalised; new phone logs in, old phone no longer does | 200 / 401 |
| Replacing an avatar swaps the file and deletes the old one from disk | checked |
| Empty profile update | 200, no change |
| Password change: wrong current 401; same password, too short, too long, missing, unknown field 400; success 200; old password stops working; 72-character password accepted | checked |
| Live changes: admin suspends, the seller's existing token is blocked at once but can still read status; admin reinstates, same token works; admin rejects, access drops to profile-only; seller row removed, token rejected | checked |

### E. Admin seller requests (`/v1/api/admin/seller-requests`)

| Case | Expected |
|---|---|
| No token | 401 |
| List contains only pending sellers, newest first, with image URLs, never `passwordHash` | 200 |
| Cursor walk visits every pending seller exactly once | checked |
| Approved sellers are absent | checked |
| Search by phone, partial phone, name (any case); `%` matches literally | 200 |
| Unknown query parameter, limit 101, oversized cursor | 400 |
| Approve a pending seller | `approved` + `active`, reason cleared; existing token gets full access |
| Approve again; reject an approved seller | 409 |
| Reject with a reason (trimmed) | `rejected` + `inactive`; seller sees the reason and can log in |
| Reject again; approve a rejected seller directly | 409 |
| Rejected seller edits and reappears in the list, then can be approved | checked |
| Reject with no body, blank reason | 200, no reason stored |
| Reason 1001 characters, wrong type, extra field | 400; 1000 characters is accepted |
| Approve or reject a pending seller who is suspended | 409, suspension untouched |
| Unknown seller id | 404 |
| Bad ids (`abc`, `0`, `-1`, `99999999999`, `1.5`) | 400 |
| Wrong HTTP method on approve | 404 |

### F. Admin seller API (`/v1/api/admin/sellers`)

| Case | Expected |
|---|---|
| Admin-created seller is `approved` + `active`, can log in as a seller with full access | 201 |
| Create rejects: local-format phone, no phone, duplicate phone, password 5 or 73 characters, `isActive`, `activeStatus`, `status` | 400 |
| List filters `activeStatus` (active, suspended), combined with `status`; invalid value | 200 / 400 |
| Old `isActive` query parameter | 400 |
| List search matches phone; rows expose `activeStatus` and `rejectionReason`, not `isActive` | checked |
| Admin sets `activeStatus` to active, inactive, suspended | 200 |
| Update rejects invalid `activeStatus`, `isActive`, local-format phone, duplicate phone, reason over 1000 characters | 400 |
| Update normalises a spaced international phone | 200 |
| Setting `status` to approved clears the rejection reason | checked |

### G. Product eligibility

| Case | Expected |
|---|---|
| Admin creates a product for an approved + active seller | 201 |
| Same for pending, approved+inactive, rejected, approved+suspended, pending+suspended | 409 |

## 5. Manual UI checklist

The script tests the API. Run these in a browser once after UI changes.
URLs assume frontend on `http://localhost:3001`.

Use clearly fake data, for example a name starting with `T-`. Delete test
sellers afterwards (see section 6).

| # | Steps | Expected |
|---|---|---|
| 1 | Open `/seller/register`. Choose India, type `12345` in the phone box and click out. | Red border and "Enter a valid India phone number." |
| 2 | Fill name, a valid number (India `9812345670`), email with capitals, password `Passw0rd!`, confirmation `Different1!`. Click Register. | "Passwords do not match." Nothing is created |
| 3 | Fix the confirmation and Register. | Goes to `/seller/profile`. Banner "Awaiting approval". Phone shows India and `9812345670` |
| 4 | Check the database. | Phone `+919812345670`, email lowercase, `pending` + `inactive` |
| 5 | Click Log out. | Back on `/seller/login` |
| 6 | Log in with the right number and a wrong password. | "Invalid phone number or password." |
| 7 | Log in with the number typed with a space (`98123 45670`) and the right password. | Works, banner "Awaiting approval" |
| 8 | Open `/admin/login`, sign in as admin, open Sellers -> Pending requests. | The seller is listed with phone and email |
| 9 | Search `zzzz`, then `98123`. | "No pending requests." then the seller again |
| 10 | Click Reject, type a reason, confirm. | Seller leaves the list, toast shown. Database: `rejected` + `inactive`, reason saved |
| 11 | As the seller, reload `/seller/profile`. | Banner "Registration rejected" with the reason. Button reads "Save and resubmit" |
| 12 | Change only the password (current + new) and submit. | "Password changed." Banner still "Registration rejected" |
| 13 | Change the name and click Save and resubmit. | Toast "resubmitted". Banner "Awaiting approval". Seller is back in the admin list |
| 14 | As admin, click Approve. | Seller leaves the list. Database: `approved` + `active` |
| 15 | Reload the seller profile. | Banner "Account active", all fields editable |
| 16 | In admin Sellers, change that seller's Activity dropdown to Suspended. | Dropdown shows Suspended |
| 17 | Reload the seller profile. | Banner "Account suspended". Every field and both buttons disabled |
| 18 | Set Activity to Inactive, reload the seller profile. | Banner "Account inactive". Fields editable |
| 19 | Set Activity to Active, reload. | Banner "Account active" |
| 20 | Log in again with the new password, then the old one. | New works, old is refused |
| 21 | Admin: Sellers -> Add seller with a phone (country picker), password, no email. | Created as Approved + Active. Can log in on `/seller/login` |
| 22 | Admin: edit a seller, set Status to Rejected. | A "Rejection reason" box appears |
| 23 | Admin: Add product, open the seller dropdown. | Lists only approved + active sellers |
| 24 | Register with an image as NID front / back / avatar. | Registration succeeds; admin pending list shows the thumbnails |

Steps 21 to 24 are not part of the checks the author ran in the browser; the
API rules behind them are covered by the script.

## 6. Cleaning up

Test sellers made through the UI or the script:

```bash
psql -d pigeon_nest_dev -c "delete from seller where name like 'T-%'"
```

Their uploaded image files are left in `apps/server/uploads/sellers`. The
script removes the files of its own test sellers; delete UI-created ones by
hand if you care about the disk space.

Browser leftovers: clear `seller_access_token` and `admin_access_token` from
local storage, or use Log out in both portals.

## 7. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Many checks fail with connection errors | Backend is not running, or `API_ROOT` is wrong |
| Admin login fails at the start of the script | Admin email/password differ; set `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| Section C "forged admin token" or "ghost seller" checks give 401 instead of 403 | `JWT_ACCESS_SECRET` does not match the server's |
| Section G fails with 400 or 404 | The hard-coded category/attribute ids (16, 2, 6) do not exist in your DB |
| `psql: command not found` or database errors | `psql` is not on PATH, or `TEST_DB` is wrong |
| Section A "stored no files" fails | Another process uploaded to `uploads/sellers` while the suite ran |
| Register returns 400 for a number you believe is valid | The number is not valid for its country. Some made-up numbers fail real-number validation, for example random UK mobiles |

## 8. Known gaps

- Seller-side product, order and payout features do not exist yet, so the
  "full access" level is only tested through the access flags, not through real
  seller actions.
- There is no admin delete-seller endpoint, so nothing tests deletion through
  the API (the suite removes rows directly in the database).
- The suite does not run in CI; it needs a live server, database and `psql`.
