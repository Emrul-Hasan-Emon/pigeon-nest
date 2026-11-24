# Pigeon Nest: Product Guide

This guide explains everything about **products** in Pigeon Nest, in plain
English. You do not need to be a programmer to read it. It covers what a
product is, who can create and change one, what the different states mean,
what happens in every situation, and where to click in the admin and seller
screens.

If you only have two minutes, read sections 1, 3 and 4.

> **Delete is switched off for now** in the seller portal and the admin panel (no Delete button, and the delete routes are commented out). See `delete-switched-off.md`. The delete steps below describe how it works when it is switched back on.

---

## Contents

1. [The big picture](#1-the-big-picture)
2. [The people involved](#2-the-people-involved)
3. [What a product is made of](#3-what-a-product-is-made-of)
4. [The two states of a product: Status and Activity](#4-the-two-states-of-a-product-status-and-activity)
5. [When is a product visible to customers?](#5-when-is-a-product-visible-to-customers)
6. [Who can do what: the full permission table](#6-who-can-do-what-the-full-permission-table)
7. [Life of a product: step by step](#7-life-of-a-product-step-by-step)
8. [Every scenario, in detail](#8-every-scenario-in-detail)
9. [Reasons and notes](#9-reasons-and-notes)
10. [The status history (the audit log)](#10-the-status-history-the-audit-log)
11. [Rules for names, prices, stock and SKUs](#11-rules-for-names-prices-stock-and-skus)
12. [Pictures and videos](#12-pictures-and-videos)
13. [Deleting a product](#13-deleting-a-product)
14. [How a seller's own account state affects products](#14-how-a-sellers-own-account-state-affects-products)
15. [The admin screens](#15-the-admin-screens)
16. [The seller screens](#16-the-seller-screens)
17. [The seller dashboard numbers](#17-the-seller-dashboard-numbers)
18. [Error messages and what they mean](#18-error-messages-and-what-they-mean)
19. [Frequently asked questions](#19-frequently-asked-questions)
20. [Glossary](#20-glossary)

---

## 1. The big picture

Pigeon Nest is a **marketplace**: many different sellers sell their own pigeons
and pigeon supplies in one shop. Every item for sale is a **product**, and
every product belongs to exactly **one seller**.

Think of it like a shopping mall:

- The **mall owner** is the **admin**. The admin decides who may sell and keeps
  order.
- Each **shop** in the mall is a **seller**.
- Each **item on a shop shelf** is a **product**.
- The **people walking through the mall** are the **customers**.

Products can be created in two ways:

1. **A seller creates their own product** from the seller portal.
2. **An admin creates a product on behalf of a seller** from the admin
   console. The admin picks which seller the product belongs to.

Either way, the product is born **approved** and **active** (explained in
section 4), unless the admin chooses otherwise while creating it.

The admin stays in control at all times. The admin can:

- put a product on hold (**pending**),
- turn it down (**rejected**),
- or temporarily block it (**suspended**).

When the admin does that, the seller cannot change that product any more until
the admin lifts the block. The seller is always told **why** (the admin must
write a reason).

Every change to a product's state is written into a permanent **history log**
so anyone with admin access can later see who changed what, when, and why.

---

## 2. The people involved

| Person | What they are | What they do with products |
|---|---|---|
| **Admin** | A staff member who runs the marketplace. | Can see **every** product of **every** seller. Can create, edit, approve, reject, suspend, activate, deactivate and (when delete is switched on) delete any product. Can read the history log. |
| **Seller** | A shop owner who has an approved and active seller account. | Can see and manage **only their own** products, within the limits in this guide. Cannot see other sellers' products. Cannot read the history log. |
| **Customer** | A shopper. | Can only see products that are **visible** (approved and active). Customers cannot create or change products. (The customer-facing shop is not part of this guide.) |

A seller can only work with products if the **seller account itself** is in good
standing (approved and active). See section 14.

---

## 3. What a product is made of

A product is not a single record. It is a small family of connected parts.

### 3.1 The product itself ("the listing")

This is the general description that customers read first.

| Field | What it means | Who can set it | Notes |
|---|---|---|---|
| **Name** | The title of the product, for example "Racing Homer Pair". | Admin, seller | Required. Up to 400 characters. Must contain at least one letter or number. |
| **Seller** | Which seller owns it. | Admin picks it when creating. Fixed for a seller (always themselves). | **Cannot be changed afterwards.** |
| **Category** | Where the product belongs in the shop, for example "Electronics > Mobiles". | Admin, seller | Required. Chosen from the shop's category tree. |
| **Collection** | An optional themed group, for example "Champion Bloodline" or "Clearance". | Admin, seller | Optional. Can be removed again by choosing "None". |
| **Description** | A longer text about the product. | Admin, seller | Optional. Up to 20,000 characters. |
| **SEO title** | A short title used by search engines such as Google. | Admin, seller | Optional. Up to 255 characters. |
| **SEO description** | A short summary used by search engines. | Admin, seller | Optional. Up to 1,000 characters. |
| **Featured** | A "highlight this product" marker, for promotion. | **Admin only** | A seller cannot feature their own product. |
| **Thumbnail** | The one main picture shown in lists. | Admin, seller | Optional. See section 12. |
| **Gallery** | More pictures and videos. | Admin, seller | Optional. See section 12. |
| **Status** | Review state: approved, pending or rejected. | **Admin only** | See section 4. |
| **Activity** | Availability: active, inactive or suspended. | Admin (all three), seller (active or inactive only) | See section 4. |
| **Slug** | The web-friendly version of the name, for example `racing-homer-pair`. | Automatic | Made from the name. Never typed by a person. |

### 3.2 SKUs: the actual things you can buy

A product can come in different versions. A phone can come in black and white,
a ring can come in different sizes. Each exact version is called a **SKU**
(say "skew"; it stands for "stock keeping unit").

**Every product has at least one SKU, and may have up to 100.** A product with
no SKU cannot exist, because there would be nothing to buy.

Each SKU carries its own price and stock:

| SKU field | What it means | Notes |
|---|---|---|
| **SKU code** | An optional internal code you choose, for example `RING-S-RED`. | Optional. Up to 100 characters. **Cannot be changed after the SKU is created.** |
| **Description** | Extra text for this version. | Optional. |
| **Price** | The normal selling price. | Required. Zero or more, with at most two decimal places. |
| **Discounted price** | A sale price. | Optional. **Cannot be higher than the normal price.** If you leave it empty it simply equals the normal price. |
| **Discount start and end date** | The period during which the sale applies. | Optional. If both are given, the end must be **after** the start. |
| **Buying price ("my buying price")** | What the seller paid. For the seller's own records. | Optional. |
| **Quantity** | How many are in stock. | A whole number, zero or more. Default 0. |
| **Low stock at** | The number at or below which stock is considered "low". | Default 5. |
| **Default** | Marks the main version shown first. | **Exactly one SKU per product is the default.** If you do not choose, the first SKU becomes the default. |
| **Active** | Switches this single SKU on or off. | This is separate from the product's own Activity. |
| **Variants** | The choices that make this SKU different (see below). | Required: at least one, up to 20. |

### 3.3 Variants: what makes one SKU different from another

A **variant** is a pair: **attribute + value**.

- An **attribute** is a kind of choice, for example **Ring Size**, **Feather
  Pattern** or **Gender**.
- A **value** belongs to one attribute, for example **Ring Size: Small**,
  **Ring Size: Large**, **Gender: Male**.

Examples:

| SKU | Its variants |
|---|---|
| Small ring | Ring Size: Small |
| Large ring | Ring Size: Large |
| Male, checkered | Gender: Male + Feather Pattern: Checkered |

The system enforces these rules:

- A SKU may use each attribute **only once** (you cannot have two Ring Sizes on
  one SKU).
- A value must really belong to the attribute it is paired with.
- **Two SKUs of the same product cannot have exactly the same combination** of
  variants. That would be two identical items.
- **Variants cannot be changed after a SKU is created.** If you made a mistake,
  remove that SKU and add a new one.
- Attributes and their values are maintained by the admin. Sellers can only
  pick from the active ones.

### 3.4 Media: pictures and videos

Covered in section 12.

### 3.5 Bird details (breed, ring number, parents and more)

Pigeon Nest sells pigeons, and a pigeon buyer wants to know the bird, not just
the price. These facts are all **optional**. A seller who leaves them empty
loses nothing; buyers simply see "not given".

The facts sit on two levels, depending on what they describe.

**On the product (true for every SKU under it):**

| Field | What it means | Limit |
|---|---|---|
| **Breed** | For example Homer or Roller. | 120 characters |
| **Bloodline** | The family line, for example Janssen. | 120 characters |
| **Bloodline note** | More about the line. | 5,000 characters |
| **Vaccination note** | The vaccination programme in general, for example "PMV and paratyphoid every year". | 5,000 characters |
| **Health note** | Health history and checks. | 5,000 characters |
| **Race record** | Results and achievements. | 5,000 characters |

**On the SKU (one SKU = one bird, or one batch):**

| Field | What it means | Limit |
|---|---|---|
| **Ring number** | The number on the leg ring. It identifies one bird. | 60 characters |
| **Hatch date** | The day the bird hatched. The age is worked out from it. | A real date, `YYYY-MM-DD`, not in the future |
| **Vaccine name** | Which vaccine this bird had. | 120 characters |
| **Vaccinated on** | The date of that vaccination. | A real date, not in the future, and not before the hatch date |
| **Sire and dam** | The father and the mother. Each has a name, a ring number and one photo, all optional. | Name 120, ring 60, photo up to 10MB |

Why two levels: a ring number or a hatch date describes one bird, so it cannot
be shared by every SKU of a product. Breed and bloodline describe the whole
listing, so typing them once is enough.

Rules:

- **One ring = one bird.** A ring number can be used only once per seller,
  upper or lower case does not matter. Saving a second bird with the same ring
  is refused. A bird that is deleted frees its ring.
- A SKU has **at most one sire and one dam**. Adding one that already exists
  changes it.
- A blank value (or `null`) clears a field. Leaving a field out of a save
  leaves it as it was.
- A parent with no name, no ring number and no photo is not saved.
- Removing a parent also removes its photo file. Replacing a photo removes the
  old file.
- A seller can change these only while the product is not locked (section 4.3).
- Parent photos are not part of the product's gallery (section 12).

**Orders keep a copy.** When an order is placed, each item stores the bird as it
was sold: ring number, hatch date, vaccine name and date, breed, bloodline, and
the names and ring numbers of the sire and dam (not the photos). If the seller
edits the SKU later, the order still shows what the buyer bought. Orders placed
before this feature have no copy (`bird` is `null`).

Where it is shown: the admin and seller product responses carry the product
fields and each SKU's `parents`. The shop's product response (`/user/products/:id`)
carries a `bird` block on the product and on every SKU, with the parents' photos.
Order responses carry `items[].bird`. See `admin/product-flow.md`,
`seller/product-flow.md` and `user/product-flow.md` for the addresses.

---

## 4. The two states of a product: Status and Activity

Every product has **two separate states**. They answer two different questions.

> **Status** answers: *"Has the marketplace approved this product?"*
> **Activity** answers: *"Is this product switched on right now?"*

They are independent. A product can be approved but switched off, or switched on
but waiting for approval. Keep them apart in your mind.

### 4.1 Status (the review state): Approved, Pending, Rejected

| Status | Plain meaning | What the seller can do | Who can set it |
|---|---|---|---|
| **Approved** | The marketplace is happy with this product. | Everything allowed to a seller (edit, switch active/inactive, manage pictures; delete is switched off for now). | Admin. Also the **automatic starting state** for every new product. |
| **Pending** | The admin has put the product "on hold" for a look. | **Still everything.** Pending does **not** lock the seller. | Admin only. |
| **Rejected** | The admin turned the product down. | **Nothing at all except looking at it.** No editing, no changing activity, no deleting, no picture changes. The seller can read the reason. | Admin only. A reason is **mandatory**. |

Important points:

- A new product starts **Approved**. It does **not** wait in a queue. (This is
  a deliberate choice: sellers can publish immediately and the admin steps in
  only when needed.)
- **Only the admin can change Status.** If a seller tries, the system refuses.
- A seller **cannot resubmit** a rejected product. (This is different from
  seller accounts, where a rejected seller goes back to pending by editing
  their profile.) For products, only an admin can move a rejected product back
  to approved or pending.

### 4.2 Activity: Active, Inactive, Suspended

| Activity | Plain meaning | What the seller can do | Who can set it |
|---|---|---|---|
| **Active** | The product is switched on. | Everything allowed to a seller. | Admin or seller. Also the **automatic starting state**. |
| **Inactive** | The product is switched off, for example the seller is out of stock or on holiday. | Everything allowed to a seller, including switching it back on. | Admin or seller. |
| **Suspended** | The admin has blocked the product, for example for breaking a rule. | **Nothing at all except looking at it.** The seller cannot switch it back on. | **Admin only.** A reason is **mandatory**. |

Important points:

- A seller may switch a product between **Active** and **Inactive** freely, as
  often as they like, as long as it is not locked.
- A seller can **never** set a product to Suspended, not even their own.
- A seller **cannot lift a suspension**. Only an admin can.

### 4.3 The "locked" rule in one sentence

> **A product is locked for its seller when it is Rejected OR Suspended.**
> A locked product can be **viewed** but not **changed in any way**.

Pending and Inactive do **not** lock a product.

A product can even be both rejected **and** suspended at the same time. It is
then locked until **both** blocks are lifted.

### 4.4 All nine combinations

| Status | Activity | Visible to customers? | Can the seller change it? |
|---|---|---|---|
| Approved | Active | **Yes** | Yes |
| Approved | Inactive | No | Yes |
| Approved | Suspended | No | **No (locked)** |
| Pending | Active | No | Yes |
| Pending | Inactive | No | Yes |
| Pending | Suspended | No | **No (locked)** |
| Rejected | Active | No | **No (locked)** |
| Rejected | Inactive | No | **No (locked)** |
| Rejected | Suspended | No | **No (locked)** |

There are nine rows because 3 statuses times 3 activities gives nine.

---

## 5. When is a product visible to customers?

There is **one simple rule**:

> **A product is visible on the storefront only when its Status is Approved
> AND its Activity is Active.**

Any other combination hides it. The admin and seller screens show this
directly: the product details page says either **"Visible on storefront"** or
**"Hidden from storefront"**.

This replaces an older "Published" switch. There is no separate "publish"
button any more. Visibility follows automatically from the two states, so it
can never get out of step.

Note: the customer-facing shop pages are not built yet. The rule is already
recorded in the data and shown in the admin and seller screens, so that when the
shop pages are built they only need to follow it.

---

## 6. Who can do what: the full permission table

"Own" means a product belonging to that seller. A seller account must itself be
approved and active (section 14) for any of the seller rows to work.

| Action | Admin | Seller (own product, **not locked**) | Seller (own product, **Rejected or Suspended**) | Seller (someone else's product) |
|---|---|---|---|---|
| See the product list | All products | Own products only | Own products only | Not shown |
| Open a product's details | Yes | Yes | **Yes (read only)** | "Product not found" |
| Create a product | Yes, for any eligible seller | Yes, for themselves | n/a | n/a |
| Choose the seller of a new product | Yes | No (always themselves) | n/a | n/a |
| Edit name, category, collection, description, SEO | Yes | Yes | **No** | "Product not found" |
| Add, edit, remove SKUs | Yes | Yes | **No** | "Product not found" |
| Add, replace, remove pictures and videos | Yes | Yes | **No** | "Product not found" |
| Mark as Featured | Yes | **No** | No | No |
| Change Status (approve / pending / reject) | **Yes** | **No** | No | No |
| Switch Active / Inactive | Yes | Yes | **No** | No |
| Suspend a product | **Yes** (reason required) | **No** | No | No |
| Lift a suspension | **Yes** | **No** | No | No |
| Delete a product (switched off for now) | Yes | Yes | **No** | "Product not found" |
| See a product's status history | **Yes** | **No** | No | No |
| See their dashboard numbers | n/a | Yes | Yes | n/a |

A seller who tries to open or change **another seller's product** is told the
product does not exist. The system does not even confirm that it is there.

---

## 7. Life of a product: step by step

### 7.1 A seller creates a product

1. The seller logs in and clicks **Products > Add product**.
2. They choose a category, type a name, add at least one SKU (price,
   variants), and optionally add a description, SEO text, pictures and a
   collection. They may choose to start the product **Inactive**.
3. They click **Create product**.
4. The product is saved as **Approved + Active** (or Approved + Inactive if
   they chose that).
5. A history entry is written: **"Created by seller"**.
6. The seller lands on the new product's page.

### 7.2 An admin creates a product for a seller

1. The admin goes to **Catalog > Products > Add product**.
2. They pick the **seller** from the list. Only sellers who are **approved and
   active** appear in that list.
3. They fill in the rest the same way as above. They can additionally mark the
   product **Featured**, and choose its Status and Activity. If they choose
   Rejected or Suspended, they must also type a **reason**.
4. They click **Create product**.
5. A history entry is written: **"Created by admin"** (with the reason if one
   was needed).

### 7.3 Normal day-to-day life

- The seller updates descriptions, prices and stock as things change.
- The seller flips a product to **Inactive** when it is not available, and back
  to **Active** later.
- Each flip between Active and Inactive writes a history entry,
  **"Changed by seller"**.
- Ordinary edits that do not touch Status or Activity (for example fixing a
  typo) do **not** write a history entry. The history log is only about the two
  states.

### 7.4 The admin steps in

Possible reasons: a wrong photo, a misleading description, a rule break, a
complaint, or a quality review. The admin has three tools:

| Admin wants to... | Admin sets... | Reason needed? | Effect on the seller |
|---|---|---|---|
| Look at it before deciding | Status **Pending** | No | None. The seller can still work. |
| Turn the product down | Status **Rejected** | **Yes** | Seller is locked out of that product and sees the reason. |
| Block it temporarily | Activity **Suspended** | **Yes** | Seller is locked out of that product and sees the reason. |
| Lift a rejection | Status **Approved** (or Pending) | No | The rejection reason is erased. The seller can work again. |
| Lift a suspension | Activity **Active** or **Inactive** | No | The suspension reason is erased. The seller can work again. |

### 7.5 The seller reacts to a block

When a product is locked, the seller sees:

- on the **product list**: a badge instead of the switch, the reason in red under
  the product name, and only a **View** link (no Edit, no Delete);
- on the **product page**: a red banner such as *"Rejected by an admin. You can
  view this product but cannot change it. Rejection reason: Photos are
  blurry"*, and every field and button greyed out;
- on the **dashboard**: a red notice counting how many products are locked.

The seller has no button to fight the decision inside the system. They must
contact the admin outside the system. When the admin approves or reactivates
the product, it unlocks immediately.

---

## 8. Every scenario, in detail

Each scenario says what the person does and exactly what the system does.

### 8.1 Creating

| # | Scenario | Result |
|---|---|---|
| 1 | Seller creates a product normally. | Created. Approved + Active. History: "Created by seller". |
| 2 | Seller creates a product and chooses to start it Inactive. | Created. Approved + Inactive. |
| 3 | Seller tries to create a product and sets Status (for example Pending). | **Refused.** Sellers cannot set Status. |
| 4 | Seller tries to start a product Suspended. | **Refused.** |
| 5 | Seller tries to choose a different seller for the product. | **Refused.** The seller is always themselves. |
| 6 | Seller tries to mark it Featured, or to write a reason. | **Refused.** Those are admin-only. |
| 7 | Seller creates a product with no SKU. | **Refused.** At least one SKU is required. |
| 8 | Seller creates a second product with the same name as one they already have. | **Allowed.** A name does not have to be unique. Each product has its own id. |
| 9 | Admin creates a product for an approved and active seller. | Created. Approved + Active by default. History: "Created by admin". |
| 10 | Admin creates a product for a pending, inactive, rejected or suspended **seller**. | **Refused.** "Seller must be approved and active to receive products". |
| 11 | Admin creates a product and sets Status Rejected or Activity Suspended but gives no reason. | **Refused.** A reason is required. |
| 12 | Admin creates a product as Pending + Suspended with a reason. | Created in exactly that state. The reason is stored and shown to the seller. |

### 8.2 Editing by the seller

| # | Scenario | Result |
|---|---|---|
| 13 | Seller edits an approved, active product. | Saved. |
| 14 | Seller edits a **pending** product. | Saved. Pending does not lock. |
| 15 | Seller switches a product to Inactive, then back to Active. | Both saved. Two history entries. |
| 16 | Seller "switches" a product to the value it already has. | Accepted, nothing changes, **no** history entry. |
| 17 | Seller tries to set Status to Approved (even on their own pending product). | **Refused.** |
| 18 | Seller tries to set Activity to Suspended. | **Refused.** |
| 19 | Seller edits a **rejected** product. | **Blocked** (403, "rejected by an admin"), with the reason. |
| 20 | Seller edits a **suspended** product. | **Blocked** (403, "suspended by an admin"), with the reason. |
| 21 | Seller tries to switch a **suspended** product back to Active. | **Blocked.** Only an admin can lift a suspension. |
| 22 | Seller tries to delete or change pictures of a locked product. | **Blocked.** |
| 23 | Seller reads a locked product. | Allowed. They see the status and the reason. |
| 24 | Seller tries to open another seller's product. | "Product not found". |
| 25 | An admin suspends a product at the exact moment the seller is saving an edit. | The system handles the race safely: either the seller's edit lands first and the suspension follows, or the suspension lands first and the seller's edit is blocked. A seller can never slip a change into a product that has just been blocked. |

### 8.3 Actions by the admin

| # | Scenario | Result |
|---|---|---|
| 26 | Admin sets a product to Pending. | Saved, no reason needed. Seller can keep working. History row written. |
| 27 | Admin rejects a product **with** a reason. | Rejected. Reason stored and shown to the seller. Seller locked. |
| 28 | Admin rejects a product with **no reason**, or only spaces. | **Refused.** Nothing changes. |
| 29 | Admin enters a reason longer than 1,000 characters. | **Refused.** |
| 30 | Admin approves a rejected product. | Approved. The rejection reason is erased. Seller unlocked. |
| 31 | Admin suspends a product with a reason. | Suspended. Reason stored. Seller locked. |
| 32 | Admin suspends with no reason. | **Refused.** |
| 33 | Admin sets a suspended product to Inactive or Active. | Suspension lifted. The suspension reason is erased. Seller unlocked. |
| 34 | Admin rejects **and** suspends in one go, with one reason. | Both states set. The one reason is stored for both. Seller locked. |
| 35 | Admin saves an edit that leaves Status and Activity unchanged. | Saved. No history row. |
| 36 | Admin re-saves a product that is already rejected, leaving it rejected. | Allowed with no new reason needed. The old reason stays. |
| 37 | Admin edits a rejected or suspended product's other details. | **Allowed.** Locks apply to sellers, not to admins. |

### 8.4 Lists and filters

| # | Scenario | Result |
|---|---|---|
| 38 | Admin filters the product list by Status. | Shows only that status. |
| 39 | Admin filters by Activity. | Shows only that activity. |
| 40 | Admin combines Status, Activity, seller, name search. | All filters apply together. |
| 41 | Seller filters their own list by Status or Activity. | Works, on their own products only. |
| 42 | Someone sends a made-up filter value such as "status=live". | **Refused.** Only the allowed values are accepted. |
| 43 | Someone uses the old "published" or "active (yes/no)" filters. | **Refused.** Those no longer exist. |

---

## 9. Reasons and notes

A **reason** is a short written explanation (up to 1,000 characters).

When it is **required**:

- Rejecting a product.
- Suspending a product.
- (Both when the product starts life that way, or when it changes into that
  state later.)

When it is **optional**:

- Any other change of Status or Activity. The admin may add a note, and it will
  be saved in the history.

What happens to the reason:

1. It is saved in the **status history** for that change (permanently).
2. For a rejection, it is also kept on the product as the **rejection
   reason**, and for a suspension as the **suspension reason**. The seller sees
   these.
3. When the block is lifted, the reason shown to the seller is **erased**. The
   history still keeps it forever.

Blank reasons (empty or only spaces) are treated as no reason, and are refused
where a reason is required. Nothing is changed when a reason is refused.

On screen, the admin is asked for a reason in a small pop-up (on the product
list) or in a "Reason" box (on the create and edit pages). The button stays
disabled until something is typed.

---

## 10. The status history (the audit log)

Pigeon Nest keeps a **permanent diary** of every change to a product's Status
or Activity. Nothing is ever edited or removed from this diary (it is
"append only").

### 10.1 What each diary line records

| Item | Meaning |
|---|---|
| **When** | The exact date and time. |
| **Which product** | And through it, which seller. |
| **Before and after** | Both Status and Activity, as they were and as they became. |
| **Event** | Why the line was written (see below). |
| **Note** | The reason, if any. |
| **Who** | The person's name and role (admin or seller). The name is stored as it was at that moment, so the diary stays readable even if someone is later renamed. |

### 10.2 The events

| Event | Meaning |
|---|---|
| **Starting point** | The first line for products that already existed when the diary was introduced. Written by "System". |
| **Created by admin** | An admin created the product. |
| **Created by seller** | A seller created the product. |
| **Changed by admin** | An admin changed Status and/or Activity. |
| **Changed by seller** | A seller switched Active or Inactive. |

### 10.3 What does **not** create a line

- Editing text, prices, stock, SKUs, pictures or SEO.
- Saving without changing Status or Activity.
- Changing a SKU's own active switch.
- Failed or refused actions.

### 10.4 Safety

A change and its diary line are saved **together, in one step**. Either both
happen or neither does. It is impossible to change a state without it being
recorded.

### 10.5 Who can read it

**Only admins.** Sellers cannot see the diary, though they do see the current
reason on a rejected or suspended product.

### 10.6 Where the admin finds it

- On a **product's details page**, at the bottom: "Status history" for that
  product, newest first, ten at a time with a **Load more** button.
- On the **Status history list page** (Catalog > Products > "Status history"
  button, or the sidebar entry "Product history"): every product's changes in
  one list. It can be searched by product name or seller name/email/phone, and
  filtered by Event, New status and New activity. It shows twenty at a time with
  **Load more**.

The diary of a **deleted** product is still kept and can still be found in the
list.

---

## 11. Rules for names, prices, stock and SKUs

### 11.1 Names

- A name is required, up to 400 characters, and must contain at least one
  letter or number.
- Spaces at the start and end are removed automatically.
- A name does not have to be unique. One seller may create many products with the same name.
- Changing a product's name also updates its web address (slug).
- A deleted product's name becomes free again.

### 11.2 Prices

- Price and discounted price are amounts with at most two decimal places.
- Zero or more; not negative.
- A discounted price may not be higher than the normal price.
- If a discount start and end date are both given, the end must be after the
  start.
- If no discounted price is given, it is stored as equal to the normal price.

### 11.3 Stock

- Quantity is a whole number from 0 upwards.
- "Low stock at" defaults to 5.
- A SKU with quantity 0 counts as **out of stock** (shown in the seller
  dashboard).

### 11.4 SKU rules

- Every product keeps **at least one SKU**. You cannot remove the last one.
- At most 100 SKUs per product.
- Exactly **one default SKU** per product. Choosing a new default automatically
  un-defaults the old one. If the default is removed, the first remaining SKU
  becomes the default.
- The SKU **code** and the **variants** cannot be changed once created. To
  change them, remove the SKU and add a new one.
- Two SKUs of one product cannot have the same variants.
- Removing a SKU hides it (a "soft" delete, section 13).
- You cannot update and remove the same SKU in one save.

### 11.4a Bird detail rules

See section 3.5. In short: every bird field is optional, ring numbers are unique
per seller, dates must be real and not in the future, the vaccination date
cannot be before the hatch date, and a blank value clears a field.

### 11.5 Numbers that look big

For safety, whole-number fields cannot exceed about 2.1 billion, and price
fields cannot exceed 9,999,999,999.99.

---

## 12. Pictures and videos

A product has two kinds of media.

### 12.1 The thumbnail

- **One** main picture shown in lists.
- Pictures only (not videos).
- Up to **10 MB**.

### 12.2 The gallery

- Up to **20** files per upload, pictures or videos.
- Each file up to **50 MB**.
- They appear in the order they were added.

### 12.3 Allowed file types

| Kind | Allowed |
|---|---|
| Pictures | jpg, jpeg, png, webp, gif, avif, heic, heif |
| Videos | mp4, webm, mov |

The system checks the **real contents** of each file, not just its name, so a
text file renamed to ".jpg" is refused.

### 12.4 Changing media

In one save you can: replace the thumbnail **or** remove it (not both at once),
add new gallery files, and remove existing gallery files. If nothing is
provided, the save is refused. Removed files are also deleted from storage. If
anything fails part-way, the new files are cleaned up so nothing is left
behind.

When **creating** a product, pictures are uploaded just after the product is
saved. If the picture upload fails, the product still exists, and you are sent
to its edit page to try the pictures again.

Sellers cannot change media on a locked (rejected or suspended) product.

---

## 13. Deleting a product

**Switched off for now.** There is no Delete button, and `DELETE /admin/products/:id` and `DELETE /seller/products/:id` answer 404. Switch the product off (Inactive) instead. This section describes how delete works when it is switched back on.

- An admin can delete any product. A seller can delete their own product, but
  **not** when it is Rejected or Suspended.
- Delete is a **"soft" delete**: the product disappears from every list and
  can no longer be opened, but its record, and its history diary, are kept in
  the database.
- Deleting asks for confirmation first, and cannot be undone from the screen.
- If a seller's whole account is later removed from the database, their products
  and their history go with it.

---

## 14. How a seller's own account state affects products

A seller account has its own two states (see the **Seller Account Guide**). For
products, only one combination matters:

| Seller account | Can the seller use the product screens? | Can an admin create products for them? |
|---|---|---|
| **Approved + Active** | **Yes** | **Yes** |
| Pending | No. They see their account notice. | No |
| Approved + Inactive | No | No |
| Rejected | No | No |
| Suspended | No | No |

- A seller whose account is not approved and active can log in and see their
  **profile** and a notice, but the **Products** screens and the dashboard
  numbers are closed to them ("Products are not available right now").
- The system re-checks the seller's account on **every request**. If an admin
  suspends a seller, the effect is immediate, even if the seller is already
  logged in.
- **Products are not changed** when their seller is blocked. They keep their own
  Status and Activity. They simply cannot be managed by that seller until the
  seller account is approved and active again.
- At the moment, a seller's products are not automatically hidden when the
  seller is suspended. (The storefront rule in section 5 looks only at the
  product's own two states.) If you want suspended sellers' products hidden
  automatically, that is a separate decision for the future.

---

## 15. The admin screens

All under **Catalog** in the left menu of the admin console.

### 15.1 Products list (`Catalog > Products`)

Columns: picture, name, seller, category, **Status**, **Activity**, actions.

- **Search boxes:** by product name, and by seller name, email or phone.
- **Filters:** Status (All, Approved, Pending, Rejected) and Activity (Any,
  Active, Inactive, Suspended). They combine with the search boxes.
- **Status and Activity are drop-downs right in the table.** Changing one saves
  immediately.
  - Choosing **Rejected** or **Suspended** first opens a pop-up asking for the
    reason. The confirm button stays disabled until a reason is typed, and
    **nothing is saved before that**.
  - Cancelling the pop-up leaves the product unchanged.
- Actions per row: **View**, **Edit**, **Quick edit** and **Copy**. **Delete** is switched off for now.
- Buttons at the top: **Status history** and **Add product**.
- The list loads 20 at a time with **Load more**, newest products first.

### 15.2 Add product

- Pick the **seller** (only approved and active sellers are offered).
- Pick the category, name, optional collection and description.
- Tick **Featured** if wanted.
- Choose **Review status** (Approved, Pending, Rejected) and **Activity**
  (Active, Inactive, Suspended). If you choose Rejected or Suspended, a
  **Reason** box appears and is required.
- Add SKUs, with variants, prices and stock.
- Optionally add a thumbnail and gallery.

### 15.3 Product details page

Shows the badges (Status, Activity, "Visible on storefront" or "Hidden from
storefront", Featured, number of SKUs), any rejection or suspension reason in
red, the description, the seller card, SEO text, the gallery, the full SKU
table, and at the bottom the **Status history** for the product.

### 15.4 Edit product

- Change any detail. The seller cannot be changed.
- **Review status** and **Activity** are drop-downs. If your change moves the
  product to Rejected or Suspended, a **Reason** box appears and is required. If
  your change is anything else, the box is optional.
- A separate **Media** section handles pictures and videos.
- Variants and SKU codes are fixed once created.

### 15.5 Status history page

`Catalog > Products > Status history` button, or the sidebar item **Product
history**. See section 10.6.

---

## 16. The seller screens

Seller screens have a **left-hand menu**: **Dashboard**, **Products**,
**Profile**, and **Log out** at the bottom.

After logging in, the seller always lands on the **Dashboard** (section 17).

### 16.1 My products (`Products`)

- Only the seller's own products.
- Columns: picture, name, category, **Status** (a badge), **Activity**, actions.
- Search by name. Filter by Status and by Activity.
- **Activity** is a small drop-down offering **Active** and **Inactive**. If the
  product is locked, the drop-down is replaced by a plain badge.
- Actions: **Edit**, **Quick edit** and **Copy** on normal products (**Delete** is switched off for now); **only View** on locked
  ones.
- If a product is rejected or suspended, the admin's reason appears in red under
  the name.
- If the seller's account is not approved and active, a message explains that
  products are not available and offers a link to the profile.

### 16.2 Add product

Same form as the admin, minus the things a seller may not do: there is no
Seller picker, no Featured tick, no Review status, and the Activity choice
offers only Active and Inactive. After saving, the seller lands on the new
product's page.

### 16.3 A product's page

Shows the product's name with its Status and Activity badges, and whether it is
visible on the storefront. Below it is the editing form and the media section.
If the product is locked, a red banner explains why and shows the reason, and
**every field and button is disabled**. After a save, the badges refresh
immediately.

---

## 17. The seller dashboard numbers

The dashboard is the seller's landing page. It counts only the seller's **own,
not-deleted** products.

| Number | What it counts |
|---|---|
| **Total products** | All of the seller's products. |
| **Visible on storefront** | Approved **and** Active. |
| **Locked by admin** | Rejected **or** Suspended (the seller cannot change these). |
| **Total SKUs** | Every SKU across all their products. |
| **Approved / Pending / Rejected** | Products in each status. These three add up to the total. |
| **Active / Inactive / Suspended** | Products in each activity. These three add up to the total. |
| **Out-of-stock SKUs** | SKUs whose quantity is 0. |

Colours: green is good news (approved, active, visible), amber is "needs
attention" (pending, out of stock), red is a problem (rejected, suspended,
locked). A red notice appears at the top when any products are locked, with a
link to review them.

A seller whose account is not approved and active sees their account notice
instead of numbers.

---

## 18. Error messages and what they mean

| What the person sees | What it means |
|---|---|
| "This product was rejected by an admin, so you cannot change it. Reason: ..." | The product is Rejected. The seller must wait for an admin to approve it. |
| "This product was suspended by an admin, so you cannot change it. Reason: ..." | The product is Suspended. The seller must wait for an admin to lift it. |
| "A reason is required when rejecting or suspending a product" | The admin tried to reject or suspend without writing a reason. |
| "Only an admin can change status or suspend a product" | A seller tried to change Status or suspend. |
| "Seller must be approved and active to receive products" | An admin tried to give a product to a seller whose account is not approved and active. |
| "Product not found" | The product does not exist, was deleted, or belongs to another seller. |
| "A product must keep at least one SKU" | An edit would have removed the last SKU. |
| "Only one SKU can be the default" | Two SKUs were marked as default. |
| "Two SKUs of this product have the same variants" | Two SKUs have exactly the same attribute choices. |
| "discountedPrice cannot exceed price" | The sale price is higher than the normal price. |
| "discountedPriceEndDate must be after discountedPriceStartDate" | The sale ends before it starts. |
| "SKU variants cannot be changed; remove the SKU and add a new one" | Variants are locked once a SKU exists. |
| "SKU code cannot be changed" | The SKU code is locked once a SKU exists. |
| "Thumbnail must be 10MB or smaller" | The thumbnail is too large. |
| "Ring number X is already on another of your birds" | Another SKU of the same seller already has that ring number. |
| "Ring number X is used twice in this request" | Two SKUs in one save carry the same ring number. |
| "Hatch date cannot be in the future" / "Vaccination date cannot be in the future" | The date is after today. |
| "Hatch date is not a real date" | For example 2026-02-31. |
| "The vaccination date cannot be before the hatch date" | The bird would have been vaccinated before it hatched. |
| "hatchDate must be a date like 2026-03-14" | The date is not in `YYYY-MM-DD` form. |
| "Give a name, a ring number or a photo for the parent" | A new parent was saved with nothing in it. |
| "That parent is not on this bird" | Removing a sire or dam that was never added. |
| "role must be sire or dam" | The address used another word. |
| "The photo must be 10MB or smaller" | The parent photo is too large. |
| "That option does not belong to this product" | The SKU id in a parent address is from another product. |
| "Products are not available right now" (seller screen) | The seller's own account is not approved and active. |

---

## 19. Frequently asked questions

**Does a new product need admin approval before customers can see it?**
No. New products start Approved and Active, so they are visible straight away.
The admin steps in afterwards only when needed.

**What is the difference between Pending and Rejected?**
Pending is "on hold for a look" and does **not** stop the seller working.
Rejected is a refusal and **locks** the seller out of that product.

**What is the difference between Inactive and Suspended?**
Inactive is the seller's own on/off switch and they can flip it any time.
Suspended is an admin block and only an admin can lift it.

**Can a seller fix a rejected product and send it back?**
Not inside the system. They contact the admin, who may then approve it. (Seller
accounts work differently: a rejected seller account goes back to pending when
the seller edits their profile. Products do not.)

**Can an admin edit a locked product?**
Yes. Locks apply only to sellers.

**Why can't I see a product that exists?**
If you are a seller, products belonging to other sellers are hidden from you
(you are told "Product not found"). If you are looking at the shop, only
Approved and Active products show.

**If an admin suspends a seller, do their products disappear?**
Their products keep their own states and are not changed. The seller just cannot
manage them. Automatic hiding of a suspended seller's products is not built
yet. See section 14.

**What happens to the reason after I approve a rejected product?**
The reason shown on the product disappears. The history diary keeps it forever.

**Does saving a typo fix create a history entry?**
No. Only changes to Status or Activity do.

**Can a seller see the history?**
No. Only admins. A seller sees the current reason on a locked product.

**Can two sellers use the same product name?**
Yes. Each seller can use a name once.

**What was "Published"?**
An older on/off switch. It was removed. Visibility is now worked out
automatically: Approved + Active.

**Is anything ever truly erased?**
Deleted products are only hidden. History lines are never erased.

---

## 20. Glossary

| Word | Meaning |
|---|---|
| **Admin** | A staff member who runs the marketplace. |
| **Seller** | A shop owner selling in the marketplace. |
| **Customer** | A shopper. |
| **Product** | One item (or one family of versions) for sale. |
| **SKU** | One exact buyable version of a product, with its own price and stock. |
| **Variant** | An attribute and value pair, for example "Ring Size: Large", that makes one SKU different from another. |
| **Attribute** | A kind of choice, for example Ring Size. |
| **Value** | One option of an attribute, for example Large. |
| **Category** | The shop section a product belongs to. |
| **Collection** | An optional themed group of products. |
| **Slug** | The web-friendly form of a name, made automatically. |
| **Status** | Review state: Approved, Pending, Rejected. Admin only. |
| **Activity** | Availability: Active, Inactive, Suspended. |
| **Locked** | A product that is Rejected or Suspended: the seller can view it but not change it. |
| **Visible** | Approved **and** Active, so customers can see it. |
| **Reason / note** | Written explanation, required for reject and suspend. |
| **History / audit log** | The permanent diary of every Status or Activity change. |
| **Soft delete** | Hiding a record instead of destroying it. |
| **Featured** | An admin-only "highlight" marker. |
| **Baseline** | The first history line written for products that already existed. |
| **Dashboard** | The seller's landing page of summary numbers. |
| **Ring number** | The number on a pigeon's leg ring. It identifies one bird. |
| **Hatch date** | The day a bird hatched. Its age comes from this. |
| **Bloodline** | The family line a bird comes from. |
| **Sire / dam** | A bird's father / mother. |
| **Bird snapshot** | The copy of a bird's details stored on an order item at the time of sale. |

---

*Related documents:* `seller-account-guide.md` (how seller accounts work) and
`testing/seller-account-testing.md` (how everything, including products, is
tested).

---

## Breed and bloodline filters

Shoppers can filter the product list by **breed**, **bloodline** and **Vaccinated only** (a vaccination date on a live option). `GET /user/products?breed=&bloodline=&vaccinated=true` (exact match, not case sensitive). The search box also matches breed and bloodline. `GET /user/products/bird-filters` lists the breeds and bloodlines that exist, with counts. Each product card shows its breed and bloodline and a Vaccinated badge.

---

## Bulk product actions

`POST /seller/products/bulk` and `POST /admin/products/bulk` with `{ productIds: [1-100], action, ... }`. Actions: `activate`, `deactivate`, `price` (with `mode` percent or amount, `direction` increase or decrease, and `value`; offer prices move the same way and a price cannot drop below 1). Admin only: `approve`, `reject` and `suspend` (with `reason`). Each product goes through the normal update, so locks, history and checks apply: a rejected or suspended product cannot be changed by its seller, and one failing does not stop the others. The answer lists each product with `ok` or an `error`. Another seller's product is "Product not found".

## Stock history

Every change to the stock of an option is kept: starting stock, changes typed in by the seller or admin, stock taken by an order, and stock put back (or taken again) when an order is cancelled or reopened. **Admin only:** `GET /admin/products/:id/stock-history`, cursor paged (`cursor`, `limit`), newest first. Sellers do not see it. Each row has the option, the change, the stock after, the reason, the order and who did it (a customer's name is masked). Shown on the admin product details page.
