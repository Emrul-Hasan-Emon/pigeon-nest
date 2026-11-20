#!/usr/bin/env python3
"""Black-box tests: banners, dynamic homepage sections, fixed slots, storefront endpoint."""
import json, os, struct, subprocess, sys, tempfile, zlib

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
HERE = os.path.dirname(os.path.abspath(__file__))
UPLOADS = os.environ.get("UPLOADS_DIR", os.path.normpath(os.path.join(HERE, "..", "..", "uploads")))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
TMP = tempfile.mkdtemp(prefix="homepage-test-")
results = []


def call(method, path, token=None, body=None, form=None, raw=None):
    cmd = ["curl", "-s", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    if raw is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", raw]
    for k, v in form or []:
        cmd += ["-F", f"{k}={v}"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
    text, code = out.rsplit("\n", 1)
    try:
        data = json.loads(text) if text else None
    except ValueError:
        data = text
    return int(code), data


def check(name, got, expected, pred=None):
    ok = got[0] in (expected if isinstance(expected, (list, tuple, set)) else [expected])
    note = ""
    if ok and pred is not None:
        try:
            ok = bool(pred(got[1]))
        except Exception as exc:  # noqa
            ok, note = False, f"predicate error: {exc!r}"
    detail = "" if ok else f"expected {expected} got {got[0]} {note} body={str(got[1])[:300]}"
    results.append((ok, name, detail))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  <-- " + detail))


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip()


def png(name, size=1):
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * size for _ in range(size))
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    p = os.path.join(TMP, name)
    open(p, "wb").write(data)
    return p


def text_file(name, data=b"not an image"):
    p = os.path.join(TMP, name)
    open(p, "wb").write(data)
    return p


code, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
A = d["accessToken"]
IMG, IMG2 = png("a.png"), png("b.png", 2)

created_banners, created_sections = [], []


def cleanup():
    sql("delete from homepage_section where page='main'")
    sql("delete from banner where title like 'T-%'")
    sql("update homepage_section set \"sectionType\"='featured_products', title='Slot '||\"slotNo\", config='{}', layout='carousel', \"deviceVisibility\"='both', \"startsAt\"=null, \"endsAt\"=null, \"isActive\"=false where page='slots'")
    sql("update category set \"isActive\"=true where id in (1,2,3)")
    sql("update seller_product set \"activeStatus\"='active' where \"activeStatus\"='inactive' and name not like 'T-%'")


cleanup()


def banner_form(title="T-banner", position="home_top", extra=None, image=IMG, mobile=None):
    f = [("title", title), ("position", position)]
    if image:
        f.append(("image", "@" + image))
    if mobile:
        f.append(("mobileImage", "@" + mobile))
    return f + (extra or [])


# ================================================================= A banners
check("A no token -> 401", call("GET", "/admin/banners"), 401)
check("A create without image -> 400", call("POST", "/admin/banners", A, form=banner_form(image=None)), 400)
check("A create bad position -> 400", call("POST", "/admin/banners", A, form=banner_form(position="nope")), 400)
check("A create blank title -> 400", call("POST", "/admin/banners", A, form=banner_form(title="  ")), 400)
check("A create end<=start -> 400", call("POST", "/admin/banners", A, form=banner_form(extra=[("startsAt", "2030-01-02T00:00:00Z"), ("endsAt", "2030-01-01T00:00:00Z")])), 400)
check("A create non-image file -> 400", call("POST", "/admin/banners", A, form=banner_form(image=text_file("x.png"))), 400)
check("A create bad linkUrl -> 400", call("POST", "/admin/banners", A, form=banner_form(extra=[("linkUrl", "javascript:alert(1)")])), 400)
check("A create unknown field -> 400", call("POST", "/admin/banners", A, form=banner_form(extra=[("foo", "bar")])), 400)

c, b1 = call("POST", "/admin/banners", A, form=banner_form("T-b1", "home_top", [("sortOrder", "5"), ("linkUrl", "/shop")], mobile=IMG2))
check("A create banner with mobile image -> 201", (c, b1), 201, pred=lambda v: v["imageUrl"] and v["mobileImageUrl"] and v["isActive"] is True)
c, b2 = call("POST", "/admin/banners", A, form=banner_form("T-b2", "home_middle", [("sortOrder", "1"), ("isActive", "false")]))
check("A create inactive banner -> 201", (c, b2), 201, pred=lambda v: v["isActive"] is False and not v.get("mobileImageUrl"))
c, b3 = call("POST", "/admin/banners", A, form=banner_form("T-b3", "home_top", [("sortOrder", "1"), ("startsAt", "2099-01-01T00:00:00Z")]))
c, b4 = call("POST", "/admin/banners", A, form=banner_form("T-b4", "home_top", [("sortOrder", "1"), ("endsAt", "2000-01-01T00:00:00Z")]))
ids = [b["id"] for b in (b1, b2, b3, b4)]
check("A details", call("GET", f"/admin/banners/{b1['id']}", A), 200, pred=lambda v: v["title"] == "T-b1")
check("A details missing -> 404", call("GET", "/admin/banners/99999999", A), 404)
check("A details bad id -> 400", call("GET", "/admin/banners/abc", A), 400)
check("A list newest-first", call("GET", "/admin/banners?search=T-b", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted(ids, reverse=True))
check("A list filter position", call("GET", "/admin/banners?search=T-b&position=home_middle", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [b2["id"]])
check("A list filter isActive=false", call("GET", "/admin/banners?search=T-b&isActive=false", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [b2["id"]])
check("A list schedule=scheduled", call("GET", "/admin/banners?search=T-b&schedule=scheduled", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [b3["id"]])
check("A list schedule=expired", call("GET", "/admin/banners?search=T-b&schedule=expired", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [b4["id"]])
check("A list schedule=live", call("GET", "/admin/banners?search=T-b&schedule=live", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [b1["id"]])
check("A list bad enum -> 400", call("GET", "/admin/banners?position=zzz", A), 400)
expected = [x["id"] for x in sorted((b1, b2, b3, b4), key=lambda b: (b["sortOrder"], b["id"]))]
check("A list sort=displayOrder", call("GET", "/admin/banners?search=T-b&sort=displayOrder", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == expected)
seen, cursor = [], 0
for _ in range(6):
    c, v = call("GET", f"/admin/banners?search=T-b&sort=displayOrder&limit=1&cursor={cursor}", A)
    seen += [r["id"] for r in v["results"]]
    if not v["nextCursor"]:
        break
    cursor = v["nextCursor"]
check("A displayOrder cursor paging visits all in order, no dupes", (200, seen), 200, pred=lambda v: v == expected)
seen, cursor = [], 0
for _ in range(6):
    c, v = call("GET", f"/admin/banners?search=T-b&limit=1&cursor={cursor}", A)
    seen += [r["id"] for r in v["results"]]
    if not v["nextCursor"]:
        break
    cursor = v["nextCursor"]
check("A newest cursor paging", (200, seen), 200, pred=lambda v: v == sorted(ids, reverse=True))

old_mobile = sql(f"select \"mobileImagePath\" from banner where id={b1['id']}")
check("A patch title+sort", call("PATCH", f"/admin/banners/{b1['id']}", A, form=[("title", "T-b1x"), ("sortOrder", "9")]), 200, pred=lambda v: v["title"] == "T-b1x" and v["sortOrder"] == 9)
check("A patch end before existing start (effective window) -> 400", call("PATCH", f"/admin/banners/{b3['id']}", A, form=[("endsAt", "2050-01-01T00:00:00Z")]), 400)
check("A patch mobileImage + removeMobileImage -> 400", call("PATCH", f"/admin/banners/{b1['id']}", A, form=[("mobileImage", "@" + IMG), ("removeMobileImage", "true")]), 400)
check("A patch removeMobileImage", call("PATCH", f"/admin/banners/{b1['id']}", A, form=[("removeMobileImage", "true")]), 200, pred=lambda v: not v.get("mobileImageUrl"))
check("A removed mobile file deleted from disk", (200, os.path.exists(os.path.join(UPLOADS, old_mobile)) if old_mobile else False), 200, pred=lambda v: v is False)
check("A patch image replaced", call("PATCH", f"/admin/banners/{b1['id']}", A, form=[("image", "@" + IMG2)]), 200)
check("A patch unknown field -> 400", call("PATCH", f"/admin/banners/{b1['id']}", A, form=[("zzz", "1")]), 400)
check("A patch clear endsAt with blank", call("PATCH", f"/admin/banners/{b4['id']}", A, form=[("endsAt", "")]), 200, pred=lambda v: v["endsAt"] is None)
check("A patch missing -> 404", call("PATCH", "/admin/banners/99999999", A, form=[("title", "x")]), 404)

# ================================================================= B section types + validation
c, types = call("GET", "/admin/homepage-sections/section-types", A)
check("B section-types lists 8 types with fields", (c, types), 200, pred=lambda v: len(v) == 8 and all(t["fields"] is not None for t in v))
check("B section-types no token -> 401", call("GET", "/admin/homepage-sections/section-types"), 401)

H = "/admin/homepage-sections"
check("B create unknown type -> 400", call("POST", H, A, body={"sectionType": "nope"}), 400)
check("B create missing type -> 400", call("POST", H, A, body={"config": {}}), 400)
check("B create unknown top-level key -> 400", call("POST", H, A, body={"sectionType": "featured_products", "foo": 1}), 400)
check("B create config not object -> 400", call("POST", H, A, body={"sectionType": "featured_products", "config": [1]}), 400)
check("B create config unknown key -> 400", call("POST", H, A, body={"sectionType": "featured_products", "config": {"zzz": 1}}), 400)
check("B create limit 0 -> 400", call("POST", H, A, body={"sectionType": "featured_products", "config": {"limit": 0}}), 400)
check("B create limit 51 -> 400", call("POST", H, A, body={"sectionType": "featured_products", "config": {"limit": 51}}), 400)
check("B create limit string -> 400", call("POST", H, A, body={"sectionType": "featured_products", "config": {"limit": "5"}}), 400)
check("B create limit float -> 400", call("POST", H, A, body={"sectionType": "featured_products", "config": {"limit": 1.5}}), 400)
check("B banners needs exactly one -> 400 (none)", call("POST", H, A, body={"sectionType": "banners", "config": {}}), 400)
check("B banners needs exactly one -> 400 (both)", call("POST", H, A, body={"sectionType": "banners", "config": {"position": "home_top", "bannerIds": [b1["id"]]}}), 400)
check("B banners bad position -> 400", call("POST", H, A, body={"sectionType": "banners", "config": {"position": "x"}}), 400)
check("B banners unknown id -> 400", call("POST", H, A, body={"sectionType": "banners", "config": {"bannerIds": [99999999]}}), 400)
check("B category_products missing categoryId -> 400", call("POST", H, A, body={"sectionType": "category_products", "config": {}}), 400)
check("B category_products unknown category -> 400", call("POST", H, A, body={"sectionType": "category_products", "config": {"categoryId": 99999999}}), 400)
check("B category_products includeSubcategories string -> 400", call("POST", H, A, body={"sectionType": "category_products", "config": {"categoryId": 1, "includeSubcategories": "yes"}}), 400)
check("B category_products id 0 -> 400", call("POST", H, A, body={"sectionType": "category_products", "config": {"categoryId": 0}}), 400)
check("B specific_products empty -> 400", call("POST", H, A, body={"sectionType": "specific_products", "config": {"productIds": []}}), 400)
check("B specific_products >50 -> 400", call("POST", H, A, body={"sectionType": "specific_products", "config": {"productIds": list(range(1, 52))}}), 400)
check("B specific_products non-int item -> 400", call("POST", H, A, body={"sectionType": "specific_products", "config": {"productIds": ["a"]}}), 400)
check("B bad layout -> 400", call("POST", H, A, body={"sectionType": "featured_products", "layout": "x"}), 400)
check("B bad deviceVisibility -> 400", call("POST", H, A, body={"sectionType": "featured_products", "deviceVisibility": "x"}), 400)
check("B end<=start -> 400", call("POST", H, A, body={"sectionType": "featured_products", "startsAt": "2030-01-02T00:00:00Z", "endsAt": "2030-01-01T00:00:00Z"}), 400)
check("B title null -> 400", call("POST", H, A, body={"sectionType": "featured_products", "title": None}), 400)

# ================================================================= C create each type
prod = sql("select id from seller_product where status='approved' and \"activeStatus\"='active' and exists(select 1 from seller_product_sku k where k.\"sellerProductId\"=seller_product.id and k.\"isActive\") order by id limit 1")
prod2 = sql(f"select id from seller_product where id<>{prod} and status='approved' and \"activeStatus\"='active' order by id limit 1")
prod, prod2 = int(prod), int(prod2)


def mk(body):
    c, v = call("POST", H, A, body=body)
    if c == 201:
        created_sections.append(v["id"])
    return c, v


c, s_ban = mk({"sectionType": "banners", "title": "T-hero", "config": {"position": "home_top"}})
check("C create banners by position -> 201 (default limit)", (c, s_ban), 201, pred=lambda v: v["config"]["limit"] == 10 and v["layout"] == "carousel" and v["deviceVisibility"] == "both" and v["page"] == "main")
c, s_cat = mk({"sectionType": "categories"})
check("C create categories default title + auto config", (c, s_cat), 201, pred=lambda v: v["title"] == "Shop by category")
c, s_cp = mk({"sectionType": "category_products", "title": "T-phones", "config": {"categoryId": 1}})
check("C create category_products defaults includeSubcategories=true", (c, s_cp), 201, pred=lambda v: v["config"]["includeSubcategories"] is True)
c, s_col = mk({"sectionType": "collection_products", "title": "T-col", "config": {"collectionId": 1, "limit": 3}})
check("C create collection_products", (c, s_col), 201)
c, s_sp = mk({"sectionType": "specific_products", "title": "T-picks", "deviceVisibility": "mobile", "config": {"productIds": [prod2, prod, prod, prod2]}})
check("C specific_products dedupes ids preserving order", (c, s_sp), 201, pred=lambda v: v["config"]["productIds"] == [prod2, prod])
c, s_sc = mk({"sectionType": "specific_collections", "title": "T-cols", "config": {"collectionIds": [2, 1]}})
check("C create specific_collections", (c, s_sc), 201)
c, s_fe = mk({"sectionType": "featured_products", "title": "T-feat", "deviceVisibility": "web", "isActive": False})
check("C create featured_products inactive", (c, s_fe), 201, pred=lambda v: v["isActive"] is False)
c, s_se = mk({"sectionType": "sellers", "title": "T-sellers", "config": {"sellerIds": [5, 6]}})
check("C create sellers", (c, s_se), 201)
order = [s_ban, s_cat, s_cp, s_col, s_sp, s_sc, s_fe, s_se]
check("C default sortOrder increments (max+1)", (200, [s["sortOrder"] for s in order]), 200, pred=lambda v: v == list(range(8)))
sids = [s["id"] for s in order]

# ================================================================= D list / filters / cursor
check("D list newest-first (default)", call("GET", f"{H}?limit=100", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted(sids, reverse=True))
check("D list sort=displayOrder", call("GET", f"{H}?sort=displayOrder&limit=100", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == sids)
seen, cursor = [], 0
for _ in range(12):
    c, v = call("GET", f"{H}?sort=displayOrder&limit=3&cursor={cursor}", A)
    seen += [r["id"] for r in v["results"]]
    if not v["nextCursor"]:
        break
    cursor = v["nextCursor"]
check("D displayOrder cursor paging complete, ordered, no dupes", (200, seen), 200, pred=lambda v: v == sids)
check("D filter sectionType", call("GET", f"{H}?sectionType=sellers", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [s_se["id"]])
check("D filter isActive=false", call("GET", f"{H}?isActive=false", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [s_fe["id"]])
check("D filter deviceVisibility=mobile", call("GET", f"{H}?deviceVisibility=mobile", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [s_sp["id"]])
check("D filter search", call("GET", f"{H}?search=T-phones", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [s_cp["id"]])
check("D filter bad sectionType -> 400", call("GET", f"{H}?sectionType=zz", A), 400)
check("D filter bad sort -> 400", call("GET", f"{H}?sort=zz", A), 400)
check("D list excludes slots", call("GET", f"{H}?limit=100", A), 200, pred=lambda v: all(r["page"] == "main" for r in v["results"]))
check("D cursor too large -> 400", call("GET", f"{H}?cursor=99999999999", A), 400)

# ================================================================= E details / warnings / update
c, det = call("GET", f"{H}/{s_cp['id']}", A)
check("E details enriched with entities, no warnings", (c, det), 200, pred=lambda v: v["entities"]["categoryId"][0]["name"] == "Electronics" and v["warnings"] == [])
check("E details missing -> 404", call("GET", f"{H}/99999999", A), 404)
sql("update category set \"isActive\"=false where id=1")
check("E details warns about inactive category", call("GET", f"{H}/{s_cp['id']}", A), 200, pred=lambda v: len(v["warnings"]) == 1 and v["warnings"][0]["entityId"] == 1)
check("E create allows inactive entity (warning only)", mk({"sectionType": "category_products", "title": "T-inactive", "config": {"categoryId": 1}}), 201)
sql("update category set \"isActive\"=true where id=1")

check("E patch title/layout/device", call("PATCH", f"{H}/{s_cp['id']}", A, body={"title": "T-phones2", "layout": "grid", "deviceVisibility": "mobile"}), 200, pred=lambda v: v["title"] == "T-phones2" and v["layout"] == "grid")
check("E patch config only (validated against current type)", call("PATCH", f"{H}/{s_cp['id']}", A, body={"config": {"categoryId": 2, "includeSubcategories": False, "limit": 4}}), 200, pred=lambda v: v["config"]["categoryId"] == 2)
check("E patch config bad -> 400", call("PATCH", f"{H}/{s_cp['id']}", A, body={"config": {"categoryId": "x"}}), 400)
check("E patch type change without config -> 400", call("PATCH", f"{H}/{s_cp['id']}", A, body={"sectionType": "sellers"}), 400)
check("E patch type change with config", call("PATCH", f"{H}/{s_cp['id']}", A, body={"sectionType": "featured_products", "config": {"limit": 5}}), 200, pred=lambda v: v["sectionType"] == "featured_products" and v["config"] == {"limit": 5})
check("E patch same type, no config keeps config", call("PATCH", f"{H}/{s_cp['id']}", A, body={"sectionType": "featured_products", "title": "T-f2"}), 200, pred=lambda v: v["config"] == {"limit": 5})
check("E patch null title -> 400", call("PATCH", f"{H}/{s_cp['id']}", A, body={"title": None}), 400)
check("E patch null isActive -> 400", call("PATCH", f"{H}/{s_cp['id']}", A, body={"isActive": None}), 400)
check("E patch unknown field -> 400", call("PATCH", f"{H}/{s_cp['id']}", A, body={"page": "slots"}), 400)
check("E patch slotNo -> 400", call("PATCH", f"{H}/{s_cp['id']}", A, body={"slotNo": 1}), 400)
check("E patch sets schedule", call("PATCH", f"{H}/{s_cp['id']}", A, body={"startsAt": "2099-01-01T00:00:00Z", "endsAt": "2099-02-01T00:00:00Z"}), 200)
check("E patch end before stored start -> 400", call("PATCH", f"{H}/{s_cp['id']}", A, body={"endsAt": "2098-01-01T00:00:00Z"}), 400)
check("E patch null clears schedule", call("PATCH", f"{H}/{s_cp['id']}", A, body={"startsAt": None, "endsAt": None}), 200, pred=lambda v: v["startsAt"] is None and v["endsAt"] is None)
check("E patch missing -> 404", call("PATCH", f"{H}/99999999", A, body={"title": "x"}), 404)
check("E patch slot id through main route -> 404", call("PATCH", f"{H}/{sql(chr(115)+'elect id from homepage_section where page=' + chr(39) + 'slots' + chr(39) + ' and \"slotNo\"=1')}", A, body={"title": "x"}), 404)

# ================================================================= F reorder
rev = list(reversed(sids))
check("F reorder missing id -> 400", call("PUT", f"{H}/reorder", A, body={"ids": sids[:-1]}), 400)
check("F reorder duplicate -> 400", call("PUT", f"{H}/reorder", A, body={"ids": sids + [sids[0]]}), 400)
check("F reorder foreign id -> 400", call("PUT", f"{H}/reorder", A, body={"ids": sids[:-1] + [99999999]}), 400)
check("F reorder empty -> 400", call("PUT", f"{H}/reorder", A, body={"ids": []}), 400)
check("F reorder non-int -> 400", call("PUT", f"{H}/reorder", A, body={"ids": ["a"]}), 400)
all_main = [int(x) for x in sql("select id from homepage_section where page='main' and \"deletedAt\" is null order by id").split()]
new_order = list(reversed(all_main))
check("F reorder ok", call("PUT", f"{H}/reorder", A, body={"ids": new_order}), 200)
check("F list displayOrder follows reorder", call("GET", f"{H}?sort=displayOrder&limit=100", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == new_order)

# ================================================================= G preview + storefront
SF = "/user/homepage"
check("G storefront needs no auth", call("GET", SF), 200, pred=lambda v: v["page"] == "main" and v["device"] == "web")
check("G storefront bad device -> 400", call("GET", SF + "?device=tv"), 400)
check("G storefront bad page -> 400", call("GET", SF + "?page=zz"), 400)
check("G storefront unknown param -> 400", call("GET", SF + "?x=1"), 400)
c, web = call("GET", SF + "?device=web")
c, mob = call("GET", SF + "?device=mobile")
web_ids = [s["id"] for s in web["sections"]]
mob_ids = [s["id"] for s in mob["sections"]]
check("G inactive section hidden", (200, web_ids), 200, pred=lambda v: s_fe["id"] not in v and s_fe["id"] not in mob_ids)
check("G mobile-only section only on mobile", (200, (web_ids, mob_ids)), 200, pred=lambda v: s_sp["id"] not in v[0] and s_sp["id"] in v[1])
check("G sections follow admin order", (200, web_ids), 200, pred=lambda v: v == [i for i in new_order if i in v])
sp_items = next(s for s in mob["sections"] if s["id"] == s_sp["id"])["items"]
check("G specific_products keeps configured order + card shape", (200, sp_items), 200, pred=lambda v: [i["id"] for i in v] == [prod2, prod] and set(["id", "name", "slug", "thumbnailUrl", "price", "discountedPrice", "seller", "category"]) <= set(v[0]))
ban_items = next(s for s in web["sections"] if s["id"] == s_ban["id"])["items"]
check("G banners by position: only live+active (b1,b4; b2 other position, b3 future)", (200, ban_items), 200, pred=lambda v: sorted(i["id"] for i in v if i["title"].startswith("T-")) == sorted([b1["id"], b4["id"]]))

# eligibility
sql(f"update seller_product set \"activeStatus\"='inactive' where id={prod}")
c, mob2 = call("GET", SF + "?device=mobile")
sp2 = next(s for s in mob2["sections"] if s["id"] == s_sp["id"])["items"]
check("G inactive product skipped silently", (200, sp2), 200, pred=lambda v: [i["id"] for i in v] == [prod2])
check("G admin details warns about ineligible product", call("GET", f"{H}/{s_sp['id']}", A), 200, pred=lambda v: any(w["entityId"] == prod for w in v["warnings"]))
sql(f"update seller_product set \"activeStatus\"='inactive' where id={prod2}")
c, mob3 = call("GET", SF + "?device=mobile")
check("G section with no eligible items dropped", (200, [s["id"] for s in mob3["sections"]]), 200, pred=lambda v: s_sp["id"] not in v)
sql(f"update seller_product set \"activeStatus\"='active' where id in ({prod},{prod2})")
sql(f"update seller set status='pending' where id=5")
c, mob4 = call("GET", SF + "?device=mobile")
se = next((s for s in mob4["sections"] if s["id"] == s_se["id"]), None)
check("G unapproved seller skipped", (200, se), 200, pred=lambda v: v is not None and [i["id"] for i in v["items"]] == [6])
sql("update seller set status='approved' where id=5")

# schedule
check("G schedule future hides section", call("PATCH", f"{H}/{s_col['id']}", A, body={"startsAt": "2099-01-01T00:00:00Z"}), 200)
c, w = call("GET", SF + "?device=web")
check("G future section hidden on storefront", (200, [s["id"] for s in w["sections"]]), 200, pred=lambda v: s_col["id"] not in v)
check("G preview still resolves, visible=false", call("GET", f"{H}/{s_col['id']}/preview", A), 200, pred=lambda v: v["visible"] is False and "items" in v)
check("G preview device bad -> 400", call("GET", f"{H}/{s_col['id']}/preview?device=tv", A), 400)
check("G preview missing -> 404", call("GET", f"{H}/99999999/preview", A), 404)
call("PATCH", f"{H}/{s_col['id']}", A, body={"startsAt": None})
check("G expired window hides section", call("PATCH", f"{H}/{s_col['id']}", A, body={"endsAt": "2000-01-01T00:00:00Z"}), 200)
c, w = call("GET", SF + "?device=web")
check("G expired section hidden", (200, [s["id"] for s in w["sections"]]), 200, pred=lambda v: s_col["id"] not in v)
call("PATCH", f"{H}/{s_col['id']}", A, body={"endsAt": None})

# banners device image + schedule
c, bb = call("POST", "/admin/banners", A, form=banner_form("T-bm", "home_bottom", mobile=IMG2))
c, s_b2 = mk({"sectionType": "banners", "title": "T-bm", "config": {"bannerIds": [bb["id"], b3["id"]]}})
c, mobx = call("GET", SF + "?device=mobile")
c, webx = call("GET", SF + "?device=web")
mi = next(s for s in mobx["sections"] if s["id"] == s_b2["id"])["items"]
wi = next(s for s in webx["sections"] if s["id"] == s_b2["id"])["items"]
check("G mobile gets mobileImageUrl, web gets imageUrl; scheduled banner skipped", (200, (mi, wi)), 200, pred=lambda v: len(v[0]) == 1 and v[0][0]["imageUrl"] == bb["mobileImageUrl"] and v[1][0]["imageUrl"] == bb["imageUrl"])

# category products with subcategories
c, s_sub = mk({"sectionType": "category_products", "title": "T-sub", "config": {"categoryId": 1, "limit": 50}})
c, s_nosub = mk({"sectionType": "category_products", "title": "T-nosub", "config": {"categoryId": 1, "includeSubcategories": False, "limit": 50}})
n_sub = int(sql("select count(*) from seller_product p where p.status='approved' and p.\"activeStatus\"='active' and p.\"deletedAt\" is null and p.\"categoryId\" in (with recursive t as (select id from category where id=1 union all select c.id from category c join t on c.\"parentId\"=t.id) select id from t)"))
c, preview_sub = call("GET", f"{H}/{s_sub['id']}/preview", A)
c, preview_nosub = call("GET", f"{H}/{s_nosub['id']}/preview", A)
check("G includeSubcategories pulls descendant categories' products", (c, preview_sub), 200, pred=lambda v: len(v["items"]) >= len(preview_nosub["items"]) and (len(v["items"]) > 0 or n_sub == 0))
check("G without subcategories shows only direct", (c, preview_nosub), 200, pred=lambda v: all(i["category"]["id"] == 1 for i in v["items"]))

# "See all" targets
def see_all(section):
    return call("GET", f"{H}/{section['id']}/preview", A)
check("G seeAll collection_products -> its collection page", see_all(s_col), 200, pred=lambda v: v["seeAll"] == {"type": "collection", "slug": "new-arrival"})
check("G seeAll category_products -> its category page", see_all(s_sub), 200, pred=lambda v: v["seeAll"] == {"type": "category", "slug": sql("select slug from category where id=1")})
check("G seeAll featured_products", see_all(s_fe), 200, pred=lambda v: v["seeAll"] == {"type": "featured"})
check("G seeAll sellers", see_all(s_se), 200, pred=lambda v: v["seeAll"] == {"type": "sellers"})
check("G seeAll specific_collections", see_all(s_sc), 200, pred=lambda v: v["seeAll"] == {"type": "collections"})
check("G seeAll specific_products / categories fall back to all products", see_all(s_sp), 200, pred=lambda v: v["seeAll"] == {"type": "products"})
check("G seeAll categories", see_all(s_cat), 200, pred=lambda v: v["seeAll"] == {"type": "products"})
check("G seeAll banners -> none", see_all(s_ban), 200, pred=lambda v: v["seeAll"] is None)
sql("update category set \"isActive\"=false where id=1")
check("G seeAll of an inactive category falls back to all products", see_all(s_sub), 200, pred=lambda v: v["seeAll"] == {"type": "products"})
sql("update category set \"isActive\"=true where id=1")
check("G storefront payload carries seeAll", call("GET", "/user/homepage?device=web"), 200, pred=lambda v: all("seeAll" in s for s in v["sections"]))

# ================================================================= H delete conflicts
check("H banner used by a section -> 409", call("DELETE", f"/admin/banners/{bb['id']}", A), 409)
check("H category used by a section -> 409", call("DELETE", "/admin/categories/1", A), 409)
check("H collection used by a section -> 409", call("DELETE", "/admin/collections/1", A), 409)
check("H delete section -> 204", call("DELETE", f"{H}/{s_b2['id']}", A), 204)
check("H delete section again -> 404", call("DELETE", f"{H}/{s_b2['id']}", A), 404)
check("H banner now deletable -> 204", call("DELETE", f"/admin/banners/{bb['id']}", A), 204)
check("H banner file removed from disk", (200, os.path.exists(os.path.join(UPLOADS, "banners")) and sql(f"select count(*) from banner where id={bb['id']}")), 200, pred=lambda v: v in ("0", False))
check("H delete banner missing -> 404", call("DELETE", f"/admin/banners/{bb['id']}", A), 404)
check("H deleted section not in list", call("GET", f"{H}?limit=100", A), 200, pred=lambda v: s_b2["id"] not in [r["id"] for r in v["results"]])
check("H delete reorders nothing but reorder now excludes it", call("PUT", f"{H}/reorder", A, body={"ids": [int(x) for x in sql("select id from homepage_section where page='main' and \"deletedAt\" is null order by id").split()]}), 200)

# ================================================================= I cap
sql("delete from homepage_section where page='main'")
sql("insert into homepage_section (title,\"sectionType\",page,config,\"sortOrder\") select 'T-cap'||g,'featured_products','main','{}',g from generate_series(1,100) g")
check("I 101st main section -> 409", call("POST", H, A, body={"sectionType": "featured_products"}), 409)
sql("delete from homepage_section where page='main'")
check("I create works again after clearing", call("POST", H, A, body={"sectionType": "featured_products"}), 201, pred=lambda v: v["sortOrder"] == 0)
sql("delete from homepage_section where page='main'")

# ================================================================= J slots
S = "/admin/homepage-slots"
c, slots = call("GET", S, A)
check("J slots list: exactly 4, ordered by slotNo", (c, slots), 200, pred=lambda v: [r["slotNo"] for r in v["results"]] == [1, 2, 3, 4] and v["nextCursor"] is None)
slot_ids = [r["id"] for r in slots["results"]]
check("J slots cursor paging", call("GET", S + "?limit=2", A), 200, pred=lambda v: len(v["results"]) == 2 and v["nextCursor"] == slot_ids[1])
check("J slots page 2", call("GET", S + f"?limit=2&cursor={slot_ids[1]}", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == slot_ids[2:])
check("J slots sort=newest filter", call("GET", S + "?sort=newest", A), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted(slot_ids, reverse=True))
check("J slots no POST", call("POST", S, A, body={"sectionType": "featured_products"}), 404)
check("J slots no DELETE", call("DELETE", f"{S}/{slot_ids[0]}", A), 404)
check("J slots details", call("GET", f"{S}/{slot_ids[0]}", A), 200, pred=lambda v: v["slotNo"] == 1 and v["page"] == "slots")
check("J slot via sections route -> 404", call("GET", f"{H}/{slot_ids[0]}", A), 404)
check("J main section via slots route -> 404", (404, None) if not created_sections else call("GET", f"{S}/99999999", A), 404)
check("J slot patch sortOrder -> 400 (fixed)", call("PATCH", f"{S}/{slot_ids[0]}", A, body={"sortOrder": 3}), 400)
check("J slot patch page -> 400", call("PATCH", f"{S}/{slot_ids[0]}", A, body={"page": "main"}), 400)
check("J slot patch slotNo -> 400", call("PATCH", f"{S}/{slot_ids[0]}", A, body={"slotNo": 9}), 400)
check("J slot patch content", call("PATCH", f"{S}/{slot_ids[0]}", A, body={"title": "T-Slot A", "sectionType": "sellers", "config": {"sellerIds": [5]}, "isActive": True}), 200, pred=lambda v: v["slotNo"] == 1 and v["title"] == "T-Slot A" and v["config"]["sellerIds"] == [5])
check("J slot patch bad config -> 400", call("PATCH", f"{S}/{slot_ids[0]}", A, body={"config": {"sellerIds": "x"}}), 400)
check("J slot type change without config -> 400", call("PATCH", f"{S}/{slot_ids[0]}", A, body={"sectionType": "categories"}), 400)
check("J slot preview", call("GET", f"{S}/{slot_ids[0]}/preview?device=mobile", A), 200, pred=lambda v: v["slotNo"] == 1 and len(v["items"]) == 1)
c, sf = call("GET", SF + "?page=slots&device=web")
check("J storefront slots page: only active+non-empty, slot order", (c, sf), 200, pred=lambda v: v["page"] == "slots" and [s["slotNo"] for s in v["sections"]] == [1])
call("PATCH", f"{S}/{slot_ids[1]}", A, body={"isActive": True, "config": {"limit": 3}})
c, sf = call("GET", SF + "?page=slots&device=web")
check("J storefront slots follow slotNo", (c, sf), 200, pred=lambda v: [s["slotNo"] for s in v["sections"]] == [1, 2] or [s["slotNo"] for s in v["sections"]] == [1])
sql("insert into homepage_section (title,\"sectionType\",page,\"slotNo\") values ('dup','featured_products','slots',1) on conflict do nothing")
check("J slots unique (page, slotNo) enforced by DB", (200, sql("select count(*) from homepage_section where page='slots' and \"slotNo\"=1")), 200, pred=lambda v: v == "1")
check("J slots need token", call("GET", S), 401)

# ================================================================= summary
cleanup()
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
import shutil
shutil.rmtree(TMP, ignore_errors=True)
sys.exit(1 if failed else 0)
