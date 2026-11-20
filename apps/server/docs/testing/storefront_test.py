#!/usr/bin/env python3
"""Black-box tests: public customer APIs (products, categories, collections, sellers). Needs the seeded dev data."""
import json, subprocess, sys

ROOT = __import__("os").environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = __import__("os").environ.get("TEST_DB", "pigeon_nest_dev")
U = "/user"
results = []


def call(path, token=None):
    cmd = ["curl", "-s", ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout
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


def ids(v):
    return [r["id"] for r in v["results"]]


def price(r):
    return r["discountedPrice"] if r["discountedPrice"] is not None else r["price"]


ELIGIBLE = """select count(*) from seller_product p join seller s on s.id=p."sellerId"
 where p.status='approved' and p."activeStatus"='active' and p."deletedAt" is null and s.status='approved' and s."activeStatus"='active' and s."deletedAt" is null
 and exists (select 1 from seller_product_sku k where k."sellerProductId"=p.id and k."isActive" and k."deletedAt" is null)"""
TOTAL = int(sql(ELIGIBLE))
P_HOMER, P_SPRINT, P_FANTAIL = 94, 95, 96  # seeded: sellers 5, 6, 7; categories 16, 17, 11


def restore():
    sql("update seller_product set \"activeStatus\"='active', status='approved' where id in (94,95,96)")
    sql("update seller set status='approved', \"activeStatus\"='active' where id in (5,6,7)")
    sql("update seller_product_sku set \"isActive\"=true, \"discountedPriceStartDate\"=null where \"sellerProductId\" in (94,95,96)")
    sql("update category set \"isActive\"=true where id in (5,6,11,16)")
    sql("update collection set \"isActive\"=true where id in (3,8)")


restore()
assert TOTAL >= 10, "seed data missing"

# ================================================================= A public + pagination
check("A no token needed", call(f"{U}/products"), 200, pred=lambda v: v["total"] == TOTAL)
check("A garbage token is ignored (public)", call(f"{U}/products", "garbage"), 200)
c, p1 = call(f"{U}/products?pageSize=5")
check("A page shape", (c, p1), 200, pred=lambda v: v["page"] == 1 and v["pageSize"] == 5 and v["totalPages"] == -(-TOTAL // 5) and len(v["results"]) == 5)
c, p2 = call(f"{U}/products?pageSize=5&page=2")
check("A page 2 does not overlap page 1", (c, p2), 200, pred=lambda v: not set(ids(v)) & set(ids(p1)))
last = -(-TOTAL // 5)
check("A last page is the remainder", call(f"{U}/products?pageSize=5&page={last}"), 200, pred=lambda v: len(v["results"]) == TOTAL - 5 * (last - 1))
check("A page past the end -> empty, total intact", call(f"{U}/products?pageSize=5&page={last + 5}"), 200, pred=lambda v: v["results"] == [] and v["total"] == TOTAL)
seen = []
for pg in range(1, last + 1):
    seen += ids(call(f"{U}/products?pageSize=5&page={pg}")[1])
check("A walking every page visits each product exactly once", (200, seen), 200, pred=lambda v: len(v) == TOTAL and len(set(v)) == TOTAL)
check("A default pageSize is 20", call(f"{U}/products"), 200, pred=lambda v: v["pageSize"] == 20)
check("A pageSize 51 -> 400", call(f"{U}/products?pageSize=51"), 400)
check("A pageSize 0 -> 400", call(f"{U}/products?pageSize=0"), 400)
check("A page 0 -> 400", call(f"{U}/products?page=0"), 400)
check("A page abc -> 400", call(f"{U}/products?page=abc"), 400)
check("A page 1.5 -> 400", call(f"{U}/products?page=1.5"), 400)
check("A page huge -> 400", call(f"{U}/products?page=99999999999"), 400)
check("A unknown param -> 400", call(f"{U}/products?cursor=1"), 400)
check("A card shape", call(f"{U}/products?pageSize=1"), 200, pred=lambda v: set(["id", "name", "slug", "thumbnailUrl", "price", "discountedPrice", "seller", "category"]) <= set(v["results"][0]))

# ================================================================= B eligibility
sql(f"update seller_product set \"activeStatus\"='inactive' where id={P_HOMER}")
check("B inactive product hidden from list", call(f"{U}/products?pageSize=50"), 200, pred=lambda v: P_HOMER not in ids(v) and v["total"] == TOTAL - 1)
check("B inactive product detail -> 404", call(f"{U}/products/{P_HOMER}"), 404)
restore()
sql(f"update seller_product set status='pending' where id={P_HOMER}")
check("B pending product hidden", call(f"{U}/products/{P_HOMER}"), 404)
restore()
sql(f"update seller_product set status='rejected' where id={P_HOMER}")
check("B rejected product hidden", call(f"{U}/products?pageSize=50"), 200, pred=lambda v: P_HOMER not in ids(v))
restore()
sql("update seller set \"activeStatus\"='suspended' where id=5")
check("B suspended seller's products hidden", call(f"{U}/products?pageSize=50"), 200, pred=lambda v: all(r["seller"]["id"] != 5 for r in v["results"]))
check("B suspended seller's product detail -> 404", call(f"{U}/products/{P_HOMER}"), 404)
check("B suspended seller -> 404", call(f"{U}/sellers/5"), 404)
check("B suspended seller not listed", call(f"{U}/sellers?pageSize=50"), 200, pred=lambda v: 5 not in ids(v))
restore()
sql("update seller set status='pending' where id=5")
check("B pending seller's products hidden", call(f"{U}/products/{P_HOMER}"), 404)
restore()
sql(f"update seller_product_sku set \"isActive\"=false where \"sellerProductId\"={P_HOMER}")
check("B product with no active SKU hidden", call(f"{U}/products/{P_HOMER}"), 404)
restore()
sql(f"update seller_product_sku set \"isActive\"=false where \"sellerProductId\"={P_HOMER} and \"isDefault\"=false")
check("B inactive SKUs are not in the detail", call(f"{U}/products/{P_HOMER}"), 200, pred=lambda v: len(v["skus"]) == 1 and v["skus"][0]["isDefault"])
restore()
check("B soft-deleted product hidden", (200, sql("update seller_product set \"deletedAt\"=now() where id=96 returning id")), 200)
check("B soft-deleted detail -> 404", call(f"{U}/products/96"), 404)
check("B soft-deleted not listed", call(f"{U}/products?pageSize=50"), 200, pred=lambda v: 96 not in ids(v))
sql("update seller_product set \"deletedAt\"=null where id=96")
restore()

# ================================================================= C filters + sort
c, cat5 = call(f"{U}/products?categoryId=5&pageSize=50")
expect5 = int(sql("select count(*) from seller_product p where p.\"categoryId\" in (5,16,17) and p.status='approved' and p.\"activeStatus\"='active' and p.\"deletedAt\" is null and exists(select 1 from seller_product_sku k where k.\"sellerProductId\"=p.id and k.\"isActive\")"))
check("C categoryId includes subcategories by default", (c, cat5), 200, pred=lambda v: v["total"] == expect5 and {P_HOMER, P_SPRINT} <= set(ids(v)))
check("C includeSubcategories=false -> only direct", call(f"{U}/products?categoryId=5&includeSubcategories=false"), 200, pred=lambda v: v["total"] == 0)
check("C subcategory only", call(f"{U}/products?categoryId=16&pageSize=50"), 200, pred=lambda v: P_HOMER in ids(v) and P_SPRINT not in ids(v))
check("C includeSubcategories=maybe -> 400", call(f"{U}/products?categoryId=5&includeSubcategories=maybe"), 400)
check("C categoryId 0 -> 400", call(f"{U}/products?categoryId=0"), 400)
check("C unknown category -> empty", call(f"{U}/products?categoryId=99999999"), 200, pred=lambda v: v["total"] == 0)
exp_col = int(sql(ELIGIBLE + ' and p."collectionId"=8'))
check("C collectionId matches the database", call(f"{U}/products?collectionId=8&pageSize=50"), 200, pred=lambda v: P_HOMER in ids(v) and v["total"] == exp_col)
check("C sellerId", call(f"{U}/products?sellerId=6&pageSize=50"), 200, pred=lambda v: P_SPRINT in ids(v) and all(r["seller"]["id"] == 6 for r in v["results"]))
check("C search by product name", call(f"{U}/products?search=fantail"), 200, pred=lambda v: P_FANTAIL in ids(v) and all("fantail" in r["name"].lower() for r in v["results"]))
check("C search by seller name", call(f"{U}/products?search=karim"), 200, pred=lambda v: P_SPRINT in ids(v) and all(r["seller"]["name"] == "Karim Breeders" or "karim" in r["name"].lower() for r in v["results"]))
check("C search is case-insensitive", call(f"{U}/products?search=FANTAIL"), 200, pred=lambda v: P_FANTAIL in ids(v))
check("C search % is literal (no wildcard match-all)", call(f"{U}/products?search=%25"), 200, pred=lambda v: v["total"] == 0)
check("C search _ is literal", call(f"{U}/products?search=_"), 200, pred=lambda v: v["total"] == 0)
check("C search no match", call(f"{U}/products?search=zzzzzz"), 200, pred=lambda v: v["total"] == 0 and v["totalPages"] == 0)
check("C blank search ignored", call(f"{U}/products?search="), 200, pred=lambda v: v["total"] == TOTAL)
exp_feat = int(sql(ELIGIBLE + ' and p."isFeatured"'))
check("C featured=true returns only featured products", call(f"{U}/products?featured=true&pageSize=50"), 200, pred=lambda v: v["total"] == exp_feat and exp_feat > 0 and P_HOMER in ids(v) and P_FANTAIL not in ids(v))
check("C featured=false is no filter", call(f"{U}/products?featured=false"), 200, pred=lambda v: v["total"] == TOTAL)
check("C featured=maybe -> 400", call(f"{U}/products?featured=maybe"), 400)
check("C search too long -> 400", call(f"{U}/products?search=" + "a" * 201), 400)
c, asc = call(f"{U}/products?sort=priceAsc&pageSize=50")
check("C sort priceAsc is non-decreasing", (c, asc), 200, pred=lambda v: [price(r) for r in v["results"]] == sorted(price(r) for r in v["results"]))
c, desc = call(f"{U}/products?sort=priceDesc&pageSize=50")
check("C sort priceDesc is non-increasing", (c, desc), 200, pred=lambda v: [price(r) for r in v["results"]] == sorted((price(r) for r in v["results"]), reverse=True))
check("C sort nameAsc", call(f"{U}/products?sort=nameAsc&pageSize=50"), 200, pred=lambda v: [r["name"].lower() for r in v["results"]] == sorted(r["name"].lower() for r in v["results"]))
check("C sort newest = id desc", call(f"{U}/products?sort=newest&pageSize=50"), 200, pred=lambda v: ids(v) == sorted(ids(v), reverse=True))
check("C price sort paging is stable across pages", (200, [i for pg in range(1, 5) for i in ids(call(f"{U}/products?sort=priceAsc&pageSize=5&page={pg}")[1])]), 200, pred=lambda v: len(set(v)) == len(v) == TOTAL)
check("C sort invalid -> 400", call(f"{U}/products?sort=cheap"), 400)
check("C price range", call(f"{U}/products?minPrice=1000&maxPrice=3000&pageSize=50"), 200, pred=lambda v: v["total"] > 0 and all(1000 <= price(r) <= 3000 for r in v["results"]))
check("C minPrice only", call(f"{U}/products?minPrice=5000&pageSize=50"), 200, pred=lambda v: all(price(r) >= 5000 for r in v["results"]))
check("C maxPrice only", call(f"{U}/products?maxPrice=300&pageSize=50"), 200, pred=lambda v: v["total"] > 0 and all(price(r) <= 300 for r in v["results"]))
check("C min > max -> 400", call(f"{U}/products?minPrice=9&maxPrice=1"), 400)
check("C negative minPrice -> 400", call(f"{U}/products?minPrice=-1"), 400)
check("C price with 3 decimals -> 400", call(f"{U}/products?minPrice=1.234"), 400)
check("C price not a number -> 400", call(f"{U}/products?minPrice=cheap"), 400)
check("C filters combine (category + max price + sort)", call(f"{U}/products?categoryId=5&maxPrice=3100&sort=priceDesc"), 200, pred=lambda v: all(price(r) <= 3100 for r in v["results"]) and P_HOMER not in ids(v) and P_SPRINT in ids(v))

# discount window drives the shown/filtered price
sql(f"update seller_product_sku set \"discountedPriceStartDate\"=now()+interval '1 day' where \"sellerProductId\"={P_HOMER}")
check("C future discount is not shown on the card", call(f"{U}/products?categoryId=16"), 200, pred=lambda v: next(r for r in v["results"] if r["id"] == P_HOMER)["discountedPrice"] is None)
check("C future discount not applied to price filter (list price 3500 >= 3300)", call(f"{U}/products?categoryId=16&minPrice=3300"), 200, pred=lambda v: P_HOMER in ids(v))
restore()
check("C live discount shown on the card", call(f"{U}/products?categoryId=16"), 200, pred=lambda v: any(r["id"] == P_HOMER and r["discountedPrice"] == 3200 for r in v["results"]))
check("C live discount applied to price filter (3200 < 3300)", call(f"{U}/products?categoryId=16&minPrice=3300"), 200, pred=lambda v: P_HOMER not in ids(v))

# ================================================================= D categories + collections
c, tree = call(f"{U}/categories/tree")
check("D tree: roots only at top, nested children", (c, tree), 200, pred=lambda v: any(n["slug"] == "racing-pigeons" and {x["slug"] for x in n["children"]} >= {"homer", "sprinter"} for n in v))
check("D tree exposes no admin fields", (c, tree), 200, pred=lambda v: set(v[0].keys()) == {"id", "name", "slug", "imageUrl", "children"})
sql("update category set \"isActive\"=false where id=5")
check("D inactive category and its children leave the tree", call(f"{U}/categories/tree"), 200, pred=lambda v: all(n["slug"] != "racing-pigeons" for n in v) and "homer" not in json.dumps(v))
check("D inactive category -> 404", call(f"{U}/categories/racing-pigeons"), 404)
restore()
check("D category detail: breadcrumb + children", call(f"{U}/categories/homer"), 200, pred=lambda v: v["name"] == "Homer" and [b["slug"] for b in v["breadcrumb"]] == ["racing-pigeons"] and v["children"] == [])
check("D root category children", call(f"{U}/categories/racing-pigeons"), 200, pred=lambda v: v["breadcrumb"] == [] and {c["slug"] for c in v["children"]} >= {"homer", "sprinter"})
check("D unknown category -> 404", call(f"{U}/categories/nope"), 404)
check("D collections paged", call(f"{U}/collections?pageSize=3"), 200, pred=lambda v: len(v["results"]) == 3 and v["total"] >= 8 and v["totalPages"] == -(-v["total"] // 3))
check("D collections page 2", call(f"{U}/collections?pageSize=3&page=2"), 200, pred=lambda v: len(v["results"]) == 3)
check("D collections pageSize 51 -> 400", call(f"{U}/collections?pageSize=51"), 400)
sql("update collection set \"isActive\"=false where id=3")
check("D inactive collection not listed", call(f"{U}/collections?pageSize=50"), 200, pred=lambda v: all(c["slug"] != "best-seller" for c in v["results"]))
check("D inactive collection -> 404", call(f"{U}/collections/best-seller"), 404)
restore()
check("D collection detail", call(f"{U}/collections/champion-bloodline"), 200, pred=lambda v: v["id"] == 8 and v["colorCode"])
check("D unknown collection -> 404", call(f"{U}/collections/nope"), 404)

# ================================================================= E product detail
c, d = call(f"{U}/products/{P_HOMER}")
check("E detail core fields", (c, d), 200, pred=lambda v: v["id"] == P_HOMER and v["name"] == "Blue Bar Racing Homer" and v["category"]["slug"] == "homer")
check("E detail breadcrumb root->leaf", (c, d), 200, pred=lambda v: [b["slug"] for b in v["breadcrumb"]] == ["racing-pigeons", "homer"])
check("E detail collection", (c, d), 200, pred=lambda v: v["collection"]["slug"] == "champion-bloodline")
check("E detail seller card (public fields only)", (c, d), 200, pred=lambda v: set(v["seller"].keys()) == {"id", "name", "avatarUrl", "productCount"} and v["seller"]["id"] == 5)
check("E detail SKUs: default first, priced, stocked", (c, d), 200, pred=lambda v: v["skus"][0]["isDefault"] and all(k["price"] > 0 and k["effectivePrice"] <= k["price"] for k in v["skus"]) and all(isinstance(k["inStock"], bool) for k in v["skus"]))
check("E detail live discount on SKU", (c, d), 200, pred=lambda v: next(k for k in v["skus"] if k["sku"] == "HOM-BB-M")["discountedPrice"] == 3200)
check("E detail options grouped per attribute", (c, d), 200, pred=lambda v: {o["name"] for o in v["options"]} == {"Color", "Gender"} and len(next(o for o in v["options"] if o["name"] == "Gender")["values"]) == 3)
check("E every SKU has one value per option", (c, d), 200, pred=lambda v: all(len(k["variants"]) == len(v["options"]) for k in v["skus"]))
check("E detail media list", (c, d), 200, pred=lambda v: len(v["media"]) >= 1 and all(m["url"] for m in v["media"]))
check("E related excludes the product itself, max 6", (c, d), 200, pred=lambda v: P_HOMER not in [r["id"] for r in v["related"]] and len(v["related"]) <= 6)
check("E no private fields anywhere in the payload", (c, d), 200, pred=lambda v: not any(w in json.dumps(v) for w in ["passwordHash", "nidFront", "nidBack", "commissionRate", "payoutAccountInfo", "myBuyingPrice", "rejectionReason", "suspensionReason", "\"email\"", "\"phone\""]))
sql("update seller_product_sku set quantity=0 where \"sellerProductId\"=94 and sku='HOM-BB-F'")
check("E out-of-stock SKU: inStock false", call(f"{U}/products/{P_HOMER}"), 200, pred=lambda v: next(k for k in v["skus"] if k["sku"] == "HOM-BB-F")["inStock"] is False)
sql("update seller_product_sku set quantity=4 where \"sellerProductId\"=94 and sku='HOM-BB-F'")
check("E missing product -> 404", call(f"{U}/products/99999999"), 404)
check("E product id abc -> 400", call(f"{U}/products/abc"), 400)
check("E product id 0 -> 400", call(f"{U}/products/0"), 400)
check("E product id too big -> 400", call(f"{U}/products/99999999999"), 400)
check("E product id negative -> 400", call(f"{U}/products/-1"), 400)

# ================================================================= F sellers
c, sl = call(f"{U}/sellers?pageSize=50")
exp_sellers = int(sql("select count(*) from seller s where s.status='approved' and s.\"activeStatus\"='active' and s.\"deletedAt\" is null and exists (select 1 from seller_product p where p.\"sellerId\"=s.id and p.status='approved' and p.\"activeStatus\"='active' and p.\"deletedAt\" is null and exists(select 1 from seller_product_sku k where k.\"sellerProductId\"=p.id and k.\"isActive\" and k.\"deletedAt\" is null))"))
check("F sellers list = sellers with something to buy", (c, sl), 200, pred=lambda v: v["total"] == exp_sellers and all(s["productCount"] > 0 for s in v["results"]))
check("F sellers public fields only", (c, sl), 200, pred=lambda v: all(set(s.keys()) == {"id", "name", "avatarUrl", "joinedAt", "productCount"} for s in v["results"]))
check("F sellers payload leaks nothing private", (c, sl), 200, pred=lambda v: not any(w in json.dumps(v) for w in ["email", "phone", "nid", "passwordHash", "commission", "payout"]))
check("F sellers paged", call(f"{U}/sellers?pageSize=3&page=2"), 200, pred=lambda v: v["page"] == 2 and len(v["results"]) == min(3, max(0, exp_sellers - 3)))
check("F sellers sort nameAsc", call(f"{U}/sellers?sort=nameAsc&pageSize=50"), 200, pred=lambda v: [s["name"].lower() for s in v["results"]] == sorted(s["name"].lower() for s in v["results"]))
check("F sellers search", call(f"{U}/sellers?search=karim"), 200, pred=lambda v: [s["name"] for s in v["results"]] == ["Karim Breeders"])
check("F sellers search % literal", call(f"{U}/sellers?search=%25"), 200, pred=lambda v: v["total"] == 0)
check("F sellers bad sort -> 400", call(f"{U}/sellers?sort=zzz"), 400)
check("F sellers unknown param -> 400", call(f"{U}/sellers?x=1"), 400)
check("F sellers pageSize 51 -> 400", call(f"{U}/sellers?pageSize=51"), 400)
check("F seller detail productCount matches products API", call(f"{U}/sellers/6"), 200, pred=lambda v: v["productCount"] == call(f"{U}/products?sellerId=6")[1]["total"] and v["name"] == "Karim Breeders")
check("F seller detail leaks nothing private", call(f"{U}/sellers/6"), 200, pred=lambda v: set(v.keys()) == {"id", "name", "avatarUrl", "joinedAt", "productCount"})
check("F missing seller -> 404", call(f"{U}/sellers/99999999"), 404)
check("F seller id abc -> 400", call(f"{U}/sellers/abc"), 400)
sql("update seller set status='rejected' where id=6")
check("F rejected seller -> 404 and not listed", call(f"{U}/sellers/6"), 404)
restore()
sql("update seller_product set \"activeStatus\"='inactive' where \"sellerId\"=6")
check("F seller with no visible products not listed", call(f"{U}/sellers?pageSize=50"), 200, pred=lambda v: 6 not in ids(v))
check("F ...but profile still loads with productCount 0", call(f"{U}/sellers/6"), 200, pred=lambda v: v["productCount"] == 0)
sql("update seller_product set \"activeStatus\"='active' where \"sellerId\"=6")
restore()

# ================================================================= summary
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
sys.exit(1 if failed else 0)
