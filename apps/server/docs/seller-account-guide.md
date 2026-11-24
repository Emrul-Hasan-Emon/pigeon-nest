SELLER ACCOUNT GUIDE
====================

Who is this for?
Anyone. You do not need to know how to code. This guide explains how a seller
gets into Pigeon Nest, what each account state means, what the seller can and
cannot do in each state, and who is allowed to change what.

If you only have two minutes, read sections 1, 2 and 3.


1. THE BIG PICTURE
------------------

A seller account has TWO separate labels. Think of them as two switches that
live side by side:

  Label 1 - APPROVAL STATUS ("status")
      Answers: "Did our team accept this seller?"
      Values:  pending, approved, rejected

  Label 2 - ACTIVITY STATUS ("activeStatus")
      Answers: "Is this seller currently switched on?"
      Values:  active, inactive, suspended

Both labels are always present. Together they decide what the seller can do.

Two golden rules:

  RULE 1. Only an admin can change either label. A seller can never approve
          themselves, activate themselves, or lift their own suspension.

  RULE 2. A seller can ALWAYS log in, whatever the labels say. Logging in is
          never blocked. What changes is what they can do after logging in.


2. WHAT EACH LABEL MEANS
------------------------

APPROVAL STATUS

```text
  pending    The seller registered and is waiting for an admin to review them.
  approved   An admin accepted the seller.
  rejected   An admin turned the registration down (a reason is always given).
```

ACTIVITY STATUS

  active     Switched on. Combined with "approved", the seller can do
             everything.
  inactive   Switched off. The seller can still log in and fix their profile,
             but cannot run their business.
  suspended  Frozen completely. The seller can log in and see their status,
             but cannot change anything at all, not even their profile.
             This is the strictest state and is meant for serious problems.


3. WHAT THE SELLER CAN DO IN EACH SITUATION (THE MASTER TABLE)
--------------------------------------------------------------

Legend:  YES = allowed     no = blocked
"Look" = log in and see own profile and status message.
"Edit" = change name / email / phone / photos, and change password.
"Run"  = full business access (everything else the seller portal offers;
         product and order features for sellers will fall under this level).

```text
  Approval    Activity     Look   Edit   Run   Plain-language meaning
  ----------  -----------  -----  -----  ----  ----------------------------------
  pending     inactive     YES    YES    no    New self-registered seller waiting
                                                for review. (the normal case)
  approved    active       YES    YES    YES   Fully working seller. (the goal)
  rejected    inactive     YES    YES    no    Turned down. Can fix profile and
                                                try again. (the normal case)
  approved    inactive     YES    YES    no    Accepted but switched off by admin.
  approved    suspended    YES    no     no    Accepted but frozen by admin.
  pending     suspended    YES    no     no    Frozen while waiting.
  rejected    suspended    YES    no     no    Frozen after rejection.
  pending     active       YES    YES    no    Unusual, see note A below.
  rejected    active       YES    YES    no    Unusual, see note A below.
```

  Note A: "Run" needs BOTH approved AND active. Being active alone is not
  enough. Pending/rejected + active can only happen if an admin edits the two
  labels by hand to that combination; the normal buttons never create it.

The shortest way to remember it:

  * approved + active   -> can do everything.
  * suspended           -> can do nothing except log in and read status.
  * anything else       -> can only change their profile and password.


4. HOW A SELLER ACCOUNT IS BORN
-------------------------------

There are exactly two ways.

4A. THE SELLER REGISTERS THEMSELVES (public sign-up page)

  What the seller enters
    - Name (required)
    - Phone number with country (required) - this is also their login ID
    - Password (required, at least 8 characters)
    - Email (optional)
    - Profile picture, NID front photo, NID back photo (all optional)

  What the system does
    1. Checks every field (see section 9 for the rules).
    2. Saves the phone number in a standard worldwide format (section 8).
    3. Creates the account as  PENDING + INACTIVE.
    4. Logs the seller in immediately, so they can watch their status.
    5. The request appears in the admin's "Pending requests" list.

  Result: the seller can log in and edit their profile, but cannot run a
  business yet. They wait for an admin.

4B. AN ADMIN CREATES THE SELLER (admin panel -> Sellers -> Add seller)

  What the admin enters
    - Name (required)
    - Phone number with country (required)
    - Password (required, at least 6 characters)
    - Email, system commission rate, payout info, photos (optional)

  What the system does
    - Creates the account as  APPROVED + ACTIVE straight away.
    - There is no review step, because the admin is the reviewer.
    - The admin does not choose the labels at creation; they are always
      approved + active. The admin can change them later by editing
      (section 6).

  Result: the seller can log in with the phone number and password the admin
  gave them and has full access immediately.

Side-by-side comparison

```text
                          Seller registers      Admin creates
                          themselves            the seller
  ----------------------  --------------------  --------------------
  Starting approval       pending               approved
  Starting activity       inactive              active
  Needs admin review?     YES                   no
  Can run business now?   no                    YES
  Minimum password        8 characters          6 characters
  Phone required?         yes                   yes
  Logged in right away?   yes (automatic)       no (admin hands over
                                                the phone and password)
  Commission rate         0 (admin sets later)  admin may set it
```


5. THE ADMIN'S REVIEW: APPROVE OR REJECT
----------------------------------------

Where: admin panel -> Sellers -> Pending requests.
The list shows ONLY sellers whose approval status is "pending", newest first.
It can be searched by name, email or phone. For each seller the admin can see
the phone, email, registration time and the uploaded photos.

APPROVE
  Effect:  status becomes approved, activity becomes active.
           Any old rejection reason is wiped.
  Seller:  immediately gets full access. They do not need to log in again;
           their current session starts working at the next click.

REJECT
  Effect:  status becomes rejected, activity becomes inactive.
  Reason:  REQUIRED (up to 1000 characters). The seller sees it on their
           profile page and it is saved in the status history. Leaving it
           empty, or typing only spaces, is refused and nothing changes.
  Seller:  can still log in, sees "rejected" plus the reason, and can fix
           their profile.

When approve/reject is refused (nothing is changed, the admin sees an error):
  - The seller is not pending any more (someone already approved or rejected
    them, or they edited and the state moved). Error: conflict.
  - The seller is pending but SUSPENDED. A suspended seller must be un-suspended
    first (edit the seller and change the activity), then reviewed.
  - The seller does not exist. Error: not found.

A rejected seller is NOT shown in the pending list again until they change
their profile (see 7B). The admin cannot "approve" a rejected seller from the
pending list directly; the seller must resubmit first.


6. WHAT AN ADMIN CAN DO TO ANY SELLER (EDITING)
-----------------------------------------------

Where: admin panel -> Sellers -> Edit.

The admin controls everything about any seller:
  - name, email, phone, password, system commission rate, payout info, photos
  - approval status (pending / approved / rejected)
  - activity status (active / inactive / suspended)
  - a note explaining the change (required to reject or suspend, see section 15)

Important behaviours
  - The two labels are independent here. Changing one does not automatically
    change the other. (Only the Approve and Reject buttons change both
    together.)
  - Setting approval status to "approved" clears any old rejection reason.
  - Rejecting or suspending through Edit, or through the activity dropdown on
    the list, asks for a note first. Without it nothing is changed.
  - Every change of status or activity is recorded in the status history.
  - The change takes effect immediately, even for a seller who is logged in
    right now. Suspending a logged-in seller blocks their very next action.
  - The sellers list can be filtered by approval status and by activity status,
    and the activity can be changed straight from the list.

Typical admin actions and their meaning

```text
  Goal                                   Do this
  -------------------------------------  -----------------------------------
  Let a new seller start selling         Approve from Pending requests
  Turn a seller down                     Reject (a reason is required)
  Pause a seller temporarily             Set activity to inactive
  Freeze a seller for a serious issue    Set activity to suspended (reason
                                         required)
  Bring a seller back                    Set activity to active
  Reconsider a rejected seller           Set status to approved, or wait for
                                         the seller to resubmit (7B)
  Take a seller offline for good         Suspended (there is no delete; the
                                         record is kept)
```


7. WHAT A SELLER CAN DO TO THEIR OWN ACCOUNT
--------------------------------------------

Where: seller portal -> My profile.

The seller may change ONLY these things:
  - name
  - email
  - phone number
  - profile picture, NID front photo, NID back photo
  - password (needs the current password; new one must differ and be 8-72
    characters)

The seller can NEVER change: approval status, activity status, system commission rate,
payout info, rejection reason. If someone tries to send those, the system
refuses the whole request.

7A. Seller is PENDING
    Can edit freely. Stays pending. Nothing special happens.

7B. Seller is REJECTED  (the resubmission rule)
    - If the seller changes anything real (name, email, phone, or uploads a
      photo), the account automatically goes back to PENDING, the rejection
      reason is cleared, and the request returns to the admin's pending list.
      This is how a rejected seller "asks again".
    - If they press save without actually changing anything, nothing happens
      and they stay rejected.
    - Changing only the PASSWORD does NOT count. They stay rejected.
    - The profile page tells them: update your profile to submit again.

7C. Seller is APPROVED + ACTIVE
    Can edit anything allowed above. Status and activity stay exactly as they
    are. Editing does not send them back for review.

7D. Seller is APPROVED + INACTIVE
    Can edit profile and password. Stays approved and inactive. Cannot run
    the business until an admin sets activity to active.

7E. Seller is SUSPENDED (any approval status)
    - Can log in.
    - Can see their profile and the suspension message.
    - CANNOT edit anything: not profile, not photos, not password.
    - Every attempt to change something is refused with a clear message.
    - Only an admin can lift this.

Changing the phone number changes the seller's login ID. The old number stops
working for login immediately; the new one works.


8. PHONE NUMBERS (MULTI-COUNTRY)
--------------------------------

Sellers can come from any country. The phone number is the login ID, so it has
to be exact and unique.

  - Every number is stored with its country code in the worldwide standard
    form (called E.164), for example:
        Bangladesh   +8801712345678
        India        +919812345678
        UAE          +971501234567
        USA          +14155550123
  - On the screens the seller picks the country from a dropdown and types the
    number. The system builds the full number for them.
  - Typing with spaces or dashes is fine; the system tidies it up.
  - A number WITHOUT a country code (for example 01712345678) is refused when
    sent directly; the country must be included.
  - A number that is not a real number for its country is refused.
  - The same number can belong to only one seller. "+880 1712-345678" and
    "+8801712345678" are the SAME number, so the second is refused as a
    duplicate.

Existing sellers created before this feature were converted to the standard
form once, by a data update.


9. FIELD RULES AT A GLANCE
--------------------------

```text
  Field        Rule
  -----------  ------------------------------------------------------------
  Name         Required, not just spaces, max 255 characters. Extra spaces at
               the ends are removed.
  Phone        Required, valid for its country, unique among sellers.
  Email        Optional. Must look like an email. Saved in lowercase. Unique
               (capital letters do not make it different). Blank means "none".
  Password     Self-register: 8-72 characters. Admin-create: 6-72 characters.
               Stored scrambled (hashed), never readable by anyone.
  Photos       JPG, PNG, WEBP, GIF, AVIF, HEIC. Max 10 MB each. The file is
               checked by its real content, not just its name, so a renamed
               text file is refused. Empty files are refused.
  Reason       Needed to reject or suspend a seller; optional for other
               admin changes. Up to 1000 characters.
```

If any one field is wrong, NOTHING is saved and no photos are kept.


10. LOGGING IN
--------------

  - The seller logs in with phone number + password.
  - Works in every state: pending, approved, rejected, inactive, suspended.
  - After login the seller sees a banner explaining their state (section 11).
  - If the phone or the password is wrong, the message is the same in both
    cases ("invalid phone number or password"). This is deliberate, so nobody
    can use the login page to find out which phone numbers are registered.
  - A login session lasts a limited time, then the seller signs in again.
  - If a seller's record is ever removed from the system, that seller's session
    stops working at once. (The admin panel has no delete button for sellers;
    to stop a seller, use inactive or suspended.)
  - Admin and seller sessions are separate. A seller session cannot open any
    admin screen, and an admin session cannot be used as a seller.


11. WHAT THE SELLER SEES (STATUS BANNER)
----------------------------------------

```text
  Situation             Banner title           Meaning shown to the seller
  --------------------  ---------------------  ---------------------------------
  approved + active     Account active         Full access.
  pending               Awaiting approval      Waiting for review; profile can be
                                               updated meanwhile.
  rejected              Registration rejected  Shows the admin's reason (if any)
                                               and invites them to update their
                                               profile to resubmit.
  approved + inactive   Account inactive       Switched off by admin; profile
                                               editing still allowed.
  any + suspended       Account suspended      Frozen; nothing can be changed.
```

When the account is suspended, the profile form is greyed out.


12. PRODUCTS AND SELLERS
------------------------

Admins create products on behalf of sellers. A product can be attached ONLY to
a seller who is approved AND active. For any other seller (pending, rejected,
inactive, suspended) the system refuses with a conflict message. The seller
picker on the "Add product" page lists only eligible sellers.

Sellers who later become ineligible (for example suspended) keep their existing
products in the system; only creating new products for them is blocked.


13. LIFE STORIES (COMPLETE SCENARIOS)
-------------------------------------

Story 1 - The happy path
  Rahim registers with his phone. He is pending + inactive and is logged in.
  He sees "Awaiting approval". An admin opens Pending requests, checks his NID
  photos and clicks Approve. Rahim is now approved + active. His banner turns
  to "Account active" with full access, without signing in again.

Story 2 - Rejected, then fixed
  Nasrin registers but uploads a blurry NID. The admin rejects her with the
  reason "NID photo is unreadable". Nasrin logs in, sees "rejected" and the
  reason. She uploads a clear NID and saves. She is automatically pending
  again and reappears in the admin's list. The admin approves her.

Story 3 - Rejected, and only changes the password
  A rejected seller changes only their password. They stay rejected. The
  admin's list does not show them. They must change a profile detail or photo
  to resubmit.

Story 4 - Admin onboards a seller by hand
  The admin adds Karim with his phone and a temporary password. Karim is
  approved + active at once. He logs in, and can change his password.

Story 5 - Suspension
  A seller is approved + active. The admin sets activity to suspended and
  must type a reason, which is saved in the status history. The
  seller, still logged in, tries to change their email and is refused
  immediately. They can still log in and read "Account suspended". The admin
  later sets activity back to active and the same session works again.

Story 6 - Switched off, not frozen
  The admin sets an approved seller to inactive (for example, on holiday). The
  seller can still update their profile and password, but cannot run the
  business. Setting activity to active restores everything.

Story 7 - Duplicate phone
  Someone registers with +8801712345678, but another seller already has it
  (even if typed as "+880 1712 345678"). Registration is refused. Nothing is
  created. If two people submit the same number at the very same moment, only
  one succeeds.

Story 8 - Seller tries to cheat
  A seller sends "status: approved" or "activeStatus: active" in a request.
  The system refuses the entire request. Nothing changes.

Story 9 - Pending but suspended
  The admin suspended a seller while they were pending. Approve and Reject both
  refuse. The admin first sets activity to inactive (un-suspend), then reviews.


14. EVERY BLOCKED ACTION AND WHAT THE SYSTEM SAYS
-------------------------------------------------

```text
  Situation                                     Result
  --------------------------------------------  -------------------------------
  Not logged in                                 Refused: please sign in
  Expired or tampered session                   Refused: please sign in again
  Seller's record no longer exists              Refused: please sign in
  Seller session used on an admin screen        Refused: not allowed
  Admin session used on a seller screen         Refused: not allowed
  Suspended seller tries to edit anything       Refused, with the suspension
                                                message and code SELLER_SUSPENDED
  Seller sends status / activity / commission   Refused: not a seller field
  Wrong current password on password change     Refused: current password wrong
  New password same as the current one          Refused
  Phone or email already used by someone else   Refused: already in use
  Approve/reject on a non-pending seller        Refused: conflict
  Approve/reject on a suspended seller          Refused: conflict
  Reject or suspend without a reason (or only   Refused: reason required;
  spaces)                                       nothing is changed
  Seller session on the status history          Refused: not allowed
  Product for a not-approved/not-active seller  Refused: conflict
```

For sellers, pending/rejected/inactive/suspended states also carry a short code
(SELLER_PENDING, SELLER_REJECTED, SELLER_INACTIVE, SELLER_SUSPENDED) that the
apps use to show the right banner.


15. THE STATUS HISTORY (AUDIT LOG)
----------------------------------

Every time a seller's approval status or activity status is set, the system
writes one line to a permanent log. Nothing is ever edited or deleted from it.
Only admins can see it. Sellers cannot.

What one line contains
  - Which seller it is about.
  - The status and the activity status BEFORE and AFTER (both pairs are stored
    on every line, so one line shows the complete change).
  - What happened: registered, created by admin, approved, rejected,
    resubmitted, changed by admin, or "starting point".
  - The note (reason), if any.
  - Who did it: their id, their type (admin or seller) and their name as it was
    at that moment.
  - When it happened.

When a line is written
  - A seller registers themselves ("registered", done by the seller).
  - An admin creates a seller ("created by admin").
  - An admin approves or rejects a registration.
  - A rejected seller edits their profile and goes back to pending
    ("resubmitted", done by the seller).
  - An admin edits a seller and the approval status or the activity status
    actually changes ("changed by admin").
  - NOT written: a save that changes neither status, a password change, a
    refused action, or an admin choosing the value the seller already has.
  - The status change and its log line are saved together. If one fails, both
    are cancelled, so the log can never disagree with the seller.

The note is REQUIRED in two cases
  - Rejecting a seller (from the pending list, or by editing the status).
  - Suspending a seller (from the Sellers list dropdown, or by editing).
  A blank note, or one with only spaces, is refused and nothing changes. Every
  other change may carry an optional note (for example "on holiday"). When an
  admin rejects a seller, the same text is also what the seller reads on their
  profile page. The suspension note is for admins only.

Sellers that existed before the log was introduced each received one
"starting point" line, written by "System", so every seller has a timeline.

Where the admin sees it
  - Seller details page (Sellers -> Edit): the "Status history" section lists
    that seller's lines, newest first, 10 at a time with a "Load more" button.
  - Sellers -> Status history: one page listing the lines of every seller,
    newest first, with a "Load more" button. It can be searched by seller name,
    email or phone and filtered by event (registered, approved, ...), by the new
    approval status and by the new activity status.


16. FOR THE TECHNICALLY CURIOUS
-------------------------------

  Seller endpoints
    POST  /v1/api/seller/auth/register
    POST  /v1/api/seller/auth/login
    GET   /v1/api/seller/profile
    PATCH /v1/api/seller/profile
    PATCH /v1/api/seller/profile/password

  Admin endpoints
    GET   /v1/api/admin/seller
    POST  /v1/api/admin/seller
    GET   /v1/api/admin/seller/:id
    PATCH /v1/api/admin/seller/:id
    GET   /v1/api/admin/seller/requests
    POST  /v1/api/admin/seller/requests/:id/approve
    POST  /v1/api/admin/seller/requests/:id/reject   (body: reason, required)
    GET   /v1/api/admin/seller/status-history

  The seller's permissions are re-read from the database on every request, which
  is why admin changes apply to sessions that are already open.

  Code: apps/server/src/seller (profile, requests, admin), apps/server/src/auth
  (login, registration, access policy in auth/policies/seller-access.policy.ts).
  Automated checks for all of the above live in the project's test suite for
  seller accounts.


17. QUICK DECISION CHART
------------------------

  Is the seller suspended?
    YES -> They can log in and look. Nothing else.
    NO  -> Is the seller approved AND active?
             YES -> Full access.
             NO  -> Profile and password changes only.
                    If they are rejected and change real profile details,
                    they go back to pending for another review.

## About text and the public seller page

- `PATCH /seller/profile` accepts an optional `description` (multipart, up to 1000 characters). A blank value clears it.
- Anyone can read the public page data without signing in:
  - `GET /user/sellers/:id` returns name, avatar, join date, product count, `description`, `ratingAverage`, `ratingCount` and a 1-5 `breakdown`. It never returns phone, email, ID images or payout details.
  - `GET /user/review/seller/:id` returns published reviews across all the seller's products, newest first. Query: `rating` (1-5), `limit`, `cursor`. Each review has the product name and slug and a masked reviewer name.
- Both return 404 unless the seller is approved and active.
- The client page is `/sellers/:id`. It has a Share button (share sheet, or copies the link). The seller profile page has a "See my public page" link.

### Admin and the about text

`POST /admin/seller` and `PATCH /admin/seller/:id` also accept `description` (up to 1000 characters, blank clears it). The admin seller form has an "About the shop" box with a link to the public page.

## Seller setup checklist

`GET /seller/profile/onboarding` returns the seller's checklist: profile picture, about text, email, ID front and back, first product, a product picture, bird details, and a product on sale (with stock). Each step has `done`, a plain `label`, a `hint` and the page to fix it. `percent` is steps done out of 8. The seller dashboard shows it as "Get your shop ready" until everything is done.

Admins see every approved seller: `GET /admin/seller/onboarding?show=all|incomplete|complete&search=&page=` (summary, progress and the steps still to do), and one seller at `GET /admin/seller/onboarding/:sellerId`. Screen: **Sellers > Seller setup**.

## Selling switch and planned break

`isEnabledForSell` on the seller is on by default. `PATCH /seller/profile/selling` with `{ isEnabledForSell, breakStartsOn?, breakEndsOn?, note? }`.

- **Off:** the seller is hidden from buyers until it is switched on again.
- **Planned break:** set `breakStartsOn` and `breakEndsOn` (both days included; set both or neither; the end cannot be before the start or in the past). The seller is hidden only between those days and comes back by itself.
- **What "hidden" means:** the seller's public page and reviews return 404, the seller is left out of the seller list and the homepage, every product of theirs returns 404 and drops out of the store, search, wishlist, cart and checkout, and their product questions and reviews are unreachable. Orders already placed carry on as usual, and the buyer's order history still shows them.
- The seller sets it on **My profile > Selling** (an on/off switch and the planned break); the dashboard shows a banner while hidden or when a break is planned. The admin seller list shows "Selling off" or "On a planned break".
