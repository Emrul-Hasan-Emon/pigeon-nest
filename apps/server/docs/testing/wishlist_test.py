#!/usr/bin/env python3
"""Black-box tests: wishlist (customer), saved counts (seller), lists and reports (admin).

Uses its own sellers and products ("T WL ..." / twl-<run>-N), so real catalog data is never touched.
"""
import concurrent.futures as cf, json, os, subprocess, sys, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
W = "/user/wishlist"


def call(method, path, token=None, body=None):
    cmd = ["curl", "-s", "-X", method, ROOT + path.replace(" ", "%20"), "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
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
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip().split("\n")[0]


def sqlint(q):
    return int(sql(q) or 0)


def cleanup():
    sql(f"delete from wishlist where \"userId\" in (select id from \"user\" where email like 't-wl-{RUN}-%')")
    sql("delete from wishlist where \"sellerProductId\" in (select id from seller_product where slug like 'twl-%')")
    sql("delete from seller_product_sku where \"sellerProductId\" in (select id from seller_product where slug like 'twl-%')")
    sql("delete from seller_product where slug like 'twl-%'")
    sql(f"delete from \"user\" where email like 't-wl-{RUN}-%'")
    sql("delete from seller where name like 'T WL %'")


def register(n):
    phone = f"+88017{RUN_NUM}{n:03d}"
    c, d = call("POST", "/user/auth/register", body={"name": f"T WL User {n}", "phone": phone, "password": "Passw0rd!x", "email": f"t-wl-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


def make_seller(tag, n):
    c, d = call("POST", "/seller/auth/register", body={"name": f"T WL Seller {tag}", "phone": f"+88017{RUN_NUM}9{n:02d}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = d["seller"]["id"]
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


CAT = sqlint("select \"categoryId\" from seller_product where id=94")
SEQ = [0]


def mk(seller_id, price=100, qty=5, name=None):
    SEQ[0] += 1
    n = SEQ[0]
    pid = sqlint(
        f"insert into seller_product (\"sellerId\",\"categoryId\",name,slug) values ({seller_id},{CAT},'{name or f'T WL Pigeon {n}'}','twl-{RUN}-{n}') returning id"
    )
    sql(f"insert into seller_product_sku (\"sellerProductId\",price,quantity,\"isDefault\",\"isActive\") values ({pid},{price},{qty},true,true)")
    return pid


cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
S1_TOKEN, S1 = make_seller("One", 1)
S2_TOKEN, S2 = make_seller("Two", 2)
P1, P2, P3 = mk(S1, 100), mk(S1, 250, name="T WL Rare Tumbler"), mk(S2, 80)
tok_a, uid_a = register(1)
tok_b, uid_b = register(2)
tok_c, uid_c = register(3)
count = lambda pid: sqlint(f"select \"wishlistCount\" from seller_product where id={pid}")
rows = lambda uid=None, pid=None: sqlint("select count(*) from wishlist where true" + (f" and \"userId\"={uid}" if uid else "") + (f" and \"sellerProductId\"={pid}" if pid else ""))
add = lambda tok, pid: call("POST", f"{W}/{pid}", tok)
rem = lambda tok, pid: call("DELETE", f"{W}/{pid}", tok)

# ================================================================= A identity
for label, tok in (("no token", None), ("bad token", "garbage")):
    check(f"A list with {label} -> 401", call("GET", W, tok), 401)
    check(f"A add with {label} -> 401", call("POST", f"{W}/{P1}", tok), 401)
    check(f"A ids with {label} -> 401", call("GET", W + "/ids", tok), 401)
check("A admin token on customer wishlist -> 403", call("GET", W, ADMIN), 403)
check("A seller token on customer wishlist -> 403", call("GET", W, S1_TOKEN), 403)
check("A seller token cannot add -> 403", call("POST", f"{W}/{P1}", S1_TOKEN), 403)
tok_s, uid_s = register(9)
sql(f"update \"user\" set status='suspended' where id={uid_s}")
check("A suspended customer may still read the list", call("GET", W, tok_s), 200)
check("A suspended customer may still read ids", call("GET", W + "/ids", tok_s), 200)
check("A suspended customer cannot add -> 403", call("POST", f"{W}/{P1}", tok_s), 403)
check("A suspended customer cannot remove -> 403", call("DELETE", f"{W}/{P1}", tok_s), 403)
check("A a new customer starts with nothing", call("GET", W, tok_a), 200, pred=lambda v: v["results"] == [] and v["nextCursor"] is None)
check("A ...and no ids", call("GET", W + "/ids", tok_a), 200, pred=lambda v: v["productIds"] == [] and v["limit"] == 200)

# ================================================================= B add
check("B product 0 -> 400", add(tok_a, 0), 400)
check("B product abc -> 400", add(tok_a, "abc"), 400)
check("B product too large -> 400", add(tok_a, 99999999999), 400)
check("B unknown product -> 404", add(tok_a, 99999999), 404)
hidden = mk(S1)
sql(f"update seller_product set \"activeStatus\"='inactive' where id={hidden}")
check("B inactive product -> 404", add(tok_a, hidden), 404)
sql(f"update seller_product set \"activeStatus\"='active', status='pending' where id={hidden}")
check("B unapproved product -> 404", add(tok_a, hidden), 404)
sql(f"update seller_product set status='approved' where id={hidden}")
sql(f"update seller_product_sku set \"isActive\"=false where \"sellerProductId\"={hidden}")
check("B product with no live SKU -> 404", add(tok_a, hidden), 404)
sql(f"update seller_product_sku set \"isActive\"=true where \"sellerProductId\"={hidden}")
sql(f"update seller set \"activeStatus\"='inactive' where id={S1}")
check("B product of a suspended seller -> 404", add(tok_a, hidden), 404)
sql(f"update seller set \"activeStatus\"='active' where id={S1}")
check("B none of the refused adds left a row", (200, rows(uid_a)), 200, pred=lambda v: v == 0)

check("B add a product", add(tok_a, P1), [200, 201], pred=lambda v: v == {"productId": P1, "saved": True, "added": True, "total": 1})
check("B count is 1", (200, count(P1)), 200, pred=lambda v: v == 1)
check("B saved price is the current price", (200, sql(f"select \"priceWhenSaved\" from wishlist where \"userId\"={uid_a} and \"sellerProductId\"={P1}")), 200, pred=lambda v: float(v) == 100.0)
trk = sql(f"select \"createdBy\"||','||\"creatorType\"||','||\"creatorName\"||','||\"updatedBy\"||','||\"updaterType\" from wishlist where \"userId\"={uid_a} and \"sellerProductId\"={P1}")
check("B tracker fields are stamped", (200, trk), 200, pred=lambda v: v == f"{uid_a},user,T WL User 1,{uid_a},user")
check("B add again is a no-op", add(tok_a, P1), [200, 201], pred=lambda v: v["added"] is False and v["saved"] is True and v["total"] == 1)
check("B count still 1", (200, count(P1)), 200, pred=lambda v: v == 1)
check("B still one row", (200, rows(uid_a, P1)), 200, pred=lambda v: v == 1)
check("B a second customer adds the same product", add(tok_b, P1), [200, 201], pred=lambda v: v["added"] is True)
check("B count is 2", (200, count(P1)), 200, pred=lambda v: v == 2)
sql(f"update seller_product_sku set quantity=0 where \"sellerProductId\"={P3}")
check("B an out-of-stock product can be saved", add(tok_a, P3), [200, 201], pred=lambda v: v["added"] is True)
sql(f"update seller_product_sku set quantity=5 where \"sellerProductId\"={P3}")
sql(f"update seller_product_sku set \"discountedPrice\"=60 where \"sellerProductId\"={P2}")
check("B a live discount is the saved price", add(tok_a, P2), [200, 201])
check("B ...stored as 60", (200, sql(f"select \"priceWhenSaved\" from wishlist where \"userId\"={uid_a} and \"sellerProductId\"={P2}")), 200, pred=lambda v: float(v) == 60.0)
sql(f"update seller_product_sku set \"discountedPrice\"=null where \"sellerProductId\"={P2}")
check("B ids lists the three newest first", call("GET", W + "/ids", tok_a), 200, pred=lambda v: v["productIds"] == [P2, P3, P1])
check("B ids are private to each customer", call("GET", W + "/ids", tok_b), 200, pred=lambda v: v["productIds"] == [P1])

# ================================================================= C list: live details, price change, availability
c, lst = call("GET", W, tok_a)
check("C list is newest first", (c, lst), 200, pred=lambda v: [r["productId"] for r in v["results"]] == [P2, P3, P1])
check("C row carries live details", (c, lst), 200, pred=lambda v: all(k in v["results"][2] for k in ("name", "slug", "thumbnailUrl", "seller", "price", "priceWhenSaved", "priceChange", "stock", "skuCount", "availability", "reason", "savedAt")))
check("C row shows the seller", (c, lst), 200, pred=lambda v: v["results"][2]["seller"] == {"id": S1, "name": "T WL Seller One"})
check("C available row has no reason", (c, lst), 200, pred=lambda v: v["results"][2]["availability"] == "available" and v["results"][2]["reason"] is None and v["results"][2]["stock"] == 5)
get = lambda pid, tok=tok_a, q="": next(r for r in call("GET", W + q, tok)[1]["results"] if r["productId"] == pid)
check("C unchanged price -> same", (200, get(P1)), 200, pred=lambda v: v["priceChange"] == {"direction": "same", "amount": 0})
sql(f"update seller_product_sku set price=80 where \"sellerProductId\"={P1}")
check("C price dropped", (200, get(P1)), 200, pred=lambda v: v["price"] == 80 and v["priceWhenSaved"] == 100 and v["priceChange"] == {"direction": "dropped", "amount": 20})
sql(f"update seller_product_sku set price=125.5 where \"sellerProductId\"={P1}")
check("C price rose", (200, get(P1)), 200, pred=lambda v: v["priceChange"] == {"direction": "rose", "amount": 25.5})
sql(f"update seller_product_sku set price=100.1, \"discountedPrice\"=90, \"discountedPriceEndDate\"=now() + interval '1 day' where \"sellerProductId\"={P1}")
check("C a live discount counts as the price", (200, get(P1)), 200, pred=lambda v: v["price"] == 90 and v["priceChange"]["direction"] == "dropped")
sql(f"update seller_product_sku set \"discountedPriceEndDate\"=now() - interval '1 day' where \"sellerProductId\"={P1}")
check("C an expired discount is ignored", (200, get(P1)), 200, pred=lambda v: v["price"] == 100.1 and v["priceChange"] == {"direction": "rose", "amount": 0.1})
sql(f"update seller_product_sku set price=100, \"discountedPrice\"=null, \"discountedPriceEndDate\"=null where \"sellerProductId\"={P1}")
sql(f"update seller_product set name='T WL Pigeon renamed' where id={P1}")
check("C a rename shows at once", (200, get(P1)), 200, pred=lambda v: v["name"] == "T WL Pigeon renamed")
sql(f"update seller_product_sku set quantity=0 where \"sellerProductId\"={P1}")
check("C out of stock is greyed with a reason", (200, get(P1)), 200, pred=lambda v: v["availability"] == "out_of_stock" and v["reason"] == "Out of stock" and v["stock"] == 0)
sql(f"update seller_product_sku set quantity=5 where \"sellerProductId\"={P1}")
sql(f"update seller_product set \"activeStatus\"='inactive' where id={P1}")
check("C hidden product stays, marked unavailable", (200, get(P1)), 200, pred=lambda v: v["availability"] == "unavailable" and v["reason"])
sql(f"update seller_product set \"activeStatus\"='active', status='rejected' where id={P1}")
check("C rejected product is unavailable", (200, get(P1)), 200, pred=lambda v: v["availability"] == "unavailable")
sql(f"update seller_product set status='approved' where id={P1}")
sql(f"update seller set \"activeStatus\"='inactive' where id={S1}")
check("C suspended seller makes it unavailable", (200, get(P1)), 200, pred=lambda v: v["availability"] == "unavailable")
sql(f"update seller set \"activeStatus\"='active' where id={S1}")
sql(f"update seller_product set \"deletedAt\"=now() where id={P1}")
check("C deleted product stays, marked removed", (200, get(P1)), 200, pred=lambda v: v["availability"] == "removed" and "removed" in v["reason"].lower() and v["name"] == "T WL Pigeon renamed")
check("C ...and the list still has all three", call("GET", W, tok_a), 200, pred=lambda v: len(v["results"]) == 3)
check("C a removed product can still be taken off", rem(tok_a, P1), 200, pred=lambda v: v["removed"] is True)
check("C ...and the count follows", (200, count(P1)), 200, pred=lambda v: v == 1)
sql(f"update seller_product set \"deletedAt\"=null where id={P1}")
check("C re-save after restore", add(tok_a, P1), [200, 201], pred=lambda v: v["added"] is True)
check("C ...count back to 2", (200, count(P1)), 200, pred=lambda v: v == 2)

ids = lambda q, tok=tok_a: [r["productId"] for r in call("GET", W + q, tok)[1]["results"]]
check("C inStock=true", (200, ids("?inStock=true")), 200, pred=lambda v: sorted(v) == sorted([P1, P2, P3]))
sql(f"update seller_product_sku set quantity=0 where \"sellerProductId\"={P3}")
sql(f"update seller_product set \"activeStatus\"='inactive' where id={P2}")
check("C inStock=true leaves out the unbuyable", (200, ids("?inStock=true")), 200, pred=lambda v: v == [P1])
check("C inStock=false shows only the unbuyable", (200, ids("?inStock=false")), 200, pred=lambda v: sorted(v) == sorted([P2, P3]))
sql(f"update seller_product_sku set quantity=5 where \"sellerProductId\"={P3}")
sql(f"update seller_product set \"activeStatus\"='active' where id={P2}")
check("C minPrice", (200, ids("?minPrice=100")), 200, pred=lambda v: sorted(v) == sorted([P1, P2]))
check("C maxPrice", (200, ids("?maxPrice=100")), 200, pred=lambda v: sorted(v) == sorted([P1, P3]))
check("C price range", (200, ids("?minPrice=90&maxPrice=120")), 200, pred=lambda v: v == [P1])
check("C sellerId", (200, ids(f"?sellerId={S2}")), 200, pred=lambda v: v == [P3])
check("C search by name", (200, ids("?search=tumbler")), 200, pred=lambda v: v == [P2])
check("C search with LIKE wildcards is literal", (200, ids("?search=%25")), 200, pred=lambda v: v == [])
check("C filters combine", (200, ids(f"?sellerId={S1}&maxPrice=100")), 200, pred=lambda v: v == [P1])
for bad in ("inStock=maybe", "minPrice=-1", "minPrice=1.234", "minPrice=abc", "maxPrice=99999999999999", "sellerId=0", "sellerId=abc", "limit=101", "limit=-1", "cursor=-1", "bogus=1"):
    check(f"C bad filter {bad} -> 400", call("GET", W + "?" + bad, tok_a), 400)
check("C customers never see each other's list", (200, ids("", tok_b)), 200, pred=lambda v: v == [P1])
check("C a customer with nothing saved sees nothing", (200, ids("", tok_c)), 200, pred=lambda v: v == [])

# cursor paging
pg = [mk(S2, 10 + i) for i in range(5)]
for p in pg:
    add(tok_c, p)
seen, cursor, pages = [], 0, 0
while True:
    c, v = call("GET", W + f"?limit=2&cursor={cursor}", tok_c)
    seen += [r["productId"] for r in v["results"]]
    pages += 1
    if v["nextCursor"] is None:
        break
    cursor = v["nextCursor"]
check("C cursor paging visits every row once, newest first", (200, seen), 200, pred=lambda v: v == list(reversed(pg)) and pages == 3)
check("C an exact last page has no next cursor", call("GET", W + "?limit=5", tok_c), 200, pred=lambda v: v["nextCursor"] is None and len(v["results"]) == 5)

# ================================================================= D remove
check("D remove", rem(tok_b, P1), 200, pred=lambda v: v == {"productId": P1, "saved": False, "removed": True, "total": 0})
check("D count follows", (200, count(P1)), 200, pred=lambda v: v == 1)
check("D remove again is a no-op", rem(tok_b, P1), 200, pred=lambda v: v["removed"] is False)
check("D count never goes below its true value", (200, count(P1)), 200, pred=lambda v: v == 1)
check("D remove something never saved", rem(tok_b, P2), 200, pred=lambda v: v["removed"] is False)
check("D remove an unknown product", rem(tok_b, 99999999), 200, pred=lambda v: v["removed"] is False)
check("D remove bad id -> 400", call("DELETE", W + "/0", tok_b), 400)
check("D remove abc -> 400", call("DELETE", W + "/abc", tok_b), 400)
check("D removing leaves another customer's save alone", (200, rows(uid_a, P1)), 200, pred=lambda v: v == 1)
sql(f"update seller_product_sku set price=130 where \"sellerProductId\"={P1}")
check("D re-save after remove stores the new price", add(tok_b, P1), [200, 201], pred=lambda v: v["added"] is True)
check("D ...as a fresh snapshot", (200, sql(f"select \"priceWhenSaved\" from wishlist where \"userId\"={uid_b} and \"sellerProductId\"={P1}")), 200, pred=lambda v: float(v) == 130.0)
sql(f"update seller_product_sku set price=100 where \"sellerProductId\"={P1}")
check("D remove is hard: no row stays behind", (rem(tok_b, P1)[0], rows(uid_b, P1)), 200, pred=lambda v: v == 0)
check("D wishlist never touches the cart", (200, sqlint(f"select count(*) from cart where \"userId\" in ({uid_a},{uid_b},{uid_c})")), 200, pred=lambda v: v == 0)

# ================================================================= E cap and concurrency
bulk = sqlint(
    f"with ins as (insert into seller_product (\"sellerId\",\"categoryId\",name,slug) select {S2},{CAT},'T WL Bulk '||g,'twl-{RUN}-b'||g from generate_series(1,205) g returning id) "
    f"select count(*) from ins"
)
sql(f"insert into seller_product_sku (\"sellerProductId\",price,quantity,\"isDefault\",\"isActive\") select id,50,5,true,true from seller_product where slug like 'twl-{RUN}-b%'")
bulk_ids = [int(x) for x in subprocess.run(["psql", "-d", DB, "-tAc", f"select id from seller_product where slug like 'twl-{RUN}-b%' order by id"], capture_output=True, text=True).stdout.split()]
check("E bulk products ready", (200, bulk), 200, pred=lambda v: v == 205 and len(bulk_ids) == 205)

tok_f, uid_f = register(4)
sql(f"insert into wishlist (\"userId\",\"sellerProductId\",\"priceWhenSaved\") select {uid_f}, id, 50 from seller_product where slug like 'twl-{RUN}-b%' and id in ({','.join(map(str, bulk_ids[:199]))})")
sql(f"update seller_product set \"wishlistCount\"=\"wishlistCount\"+1 where id in ({','.join(map(str, bulk_ids[:199]))})")
check("E customer at 199", call("GET", W + "/ids", tok_f), 200, pred=lambda v: len(v["productIds"]) == 199)
check("E the 200th is accepted", add(tok_f, bulk_ids[199]), [200, 201], pred=lambda v: v["total"] == 200)
r = add(tok_f, bulk_ids[200])
check("E the 201st is refused", r, 400, pred=lambda v: "full" in v["message"] and "200" in v["message"])
check("E ...and nothing was saved or counted", (200, (rows(uid_f), count(bulk_ids[200]))), 200, pred=lambda v: v == (200, 0))
check("E saving an already-saved product at the cap still works", add(tok_f, bulk_ids[0]), [200, 201], pred=lambda v: v["added"] is False)
check("E removing frees a slot", rem(tok_f, bulk_ids[0]), 200, pred=lambda v: v["total"] == 199)
check("E ...which can be reused", add(tok_f, bulk_ids[200]), [200, 201], pred=lambda v: v["total"] == 200)

# race: 10 adds of different products at 195/200 -> exactly 5 win
tok_g, uid_g = register(5)
sql(f"insert into wishlist (\"userId\",\"sellerProductId\",\"priceWhenSaved\") select {uid_g}, id, 50 from seller_product where id in ({','.join(map(str, bulk_ids[:195]))})")
sql(f"update seller_product set \"wishlistCount\"=\"wishlistCount\"+1 where id in ({','.join(map(str, bulk_ids[:195]))})")
with cf.ThreadPoolExecutor(10) as ex:
    outs = list(ex.map(lambda p: add(tok_g, p), bulk_ids[195:205]))
ok_n = sum(1 for c, _ in outs if c in (200, 201))
check("E ten racing adds at 195 -> exactly five succeed", (200, ok_n), 200, pred=lambda v: v == 5)
check("E ...the rest were refused", (200, sum(1 for c, _ in outs if c == 400)), 200, pred=lambda v: v == 5)
check("E ...and the customer holds exactly 200", (200, rows(uid_g)), 200, pred=lambda v: v == 200)

# race: same customer, same product
tok_h, uid_h = register(6)
with cf.ThreadPoolExecutor(10) as ex:
    outs = list(ex.map(lambda _: add(tok_h, P3), range(10)))
check("E ten racing adds of one product all answer fine", (200, [c for c, _ in outs]), 200, pred=lambda v: all(x in (200, 201) for x in v))
check("E ...exactly one actually added", (200, sum(1 for _, b in outs if b["added"])), 200, pred=lambda v: v == 1)
check("E ...one row", (200, rows(uid_h, P3)), 200, pred=lambda v: v == 1)
before = count(P3)
# race: ten customers, one product
users10 = [register(20 + i) for i in range(10)]
with cf.ThreadPoolExecutor(10) as ex:
    outs = list(ex.map(lambda u: add(u[0], P3), users10))
check("E ten customers racing on one product", (200, [c for c, _ in outs]), 200, pred=lambda v: all(x in (200, 201) for x in v))
check("E ...count rose by exactly ten", (200, count(P3)), 200, pred=lambda v: v == before + 10)
check("E ...and matches the rows", (200, rows(pid=P3)), 200, pred=lambda v: v == count(P3))
with cf.ThreadPoolExecutor(10) as ex:
    outs = list(ex.map(lambda u: rem(u[0], P3), users10))
check("E ten removals racing", (200, count(P3)), 200, pred=lambda v: v == before and v == rows(pid=P3))
# mixed add/remove storm on one customer
with cf.ThreadPoolExecutor(12) as ex:
    futs = []
    for i in range(24):
        futs.append(ex.submit((add if i % 2 == 0 else rem), tok_h, P2))
    [f.result() for f in futs]
check("E add/remove storm leaves count equal to rows", (200, count(P2)), 200, pred=lambda v: v == rows(pid=P2))

# ================================================================= F seller (counts only)
SH = lambda tok, path: call("GET", path, tok)
check("F insights without token -> 401", call("GET", "/seller/wishlist/insights"), 401)
check("F customer token on seller insights -> 403", call("GET", "/seller/wishlist/insights", tok_a), 403)
check("F admin token on seller insights -> 403", call("GET", "/seller/wishlist/insights", ADMIN), 403)
for tail, name in (("?limit=0", "limit 0"), ("?limit=51", "limit 51"), ("?limit=abc", "limit abc"), ("?x=1", "unknown param")):
    check(f"F insights {name} -> 400", call("GET", "/seller/wishlist/insights" + tail, S1_TOKEN), 400)
expect1 = sqlint(f"select coalesce(sum(\"wishlistCount\"),0) from seller_product where \"sellerId\"={S1} and \"deletedAt\" is null")
c, ins = call("GET", "/seller/wishlist/insights", S1_TOKEN)
check("F insights totals", (c, ins), 200, pred=lambda v: v["totalSaves"] == expect1 and v["products"] == sqlint(f"select count(*) from seller_product where \"sellerId\"={S1} and \"deletedAt\" is null") and v["productsSaved"] == sqlint(f"select count(*) from seller_product where \"sellerId\"={S1} and \"wishlistCount\">0 and \"deletedAt\" is null"))
check("F top is ordered by saves", (c, ins), 200, pred=lambda v: [t["wishlistCount"] for t in v["top"]] == sorted([t["wishlistCount"] for t in v["top"]], reverse=True) and all(t["seller"]["id"] == S1 for t in v["top"]))
check("F only counts, never customers", (c, json.dumps(ins)), 200, pred=lambda v: not any(k in v for k in ("userId", "userName", "userPhone", "T WL User", "t-wl-", "email")))
check("F top honours limit", call("GET", "/seller/wishlist/insights?limit=1", S1_TOKEN), 200, pred=lambda v: len(v["top"]) == 1)
check("F another seller sees only their own", call("GET", "/seller/wishlist/insights", S2_TOKEN), 200, pred=lambda v: all(t["seller"]["id"] == S2 for t in v["top"]) and v["totalSaves"] == sqlint(f"select coalesce(sum(\"wishlistCount\"),0) from seller_product where \"sellerId\"={S2} and \"deletedAt\" is null"))
sql(f"update seller set \"activeStatus\"='inactive' where id={S1}")
check("F a suspended seller can still read insights", call("GET", "/seller/wishlist/insights", S1_TOKEN), 200)
sql(f"update seller set \"activeStatus\"='active' where id={S1}")

c, pl = call("GET", "/seller/products?limit=100", S1_TOKEN)
check("F seller product list carries wishlistCount", (c, pl), 200, pred=lambda v: all("wishlistCount" in r for r in v["results"]) and next(r for r in v["results"] if r["id"] == P2)["wishlistCount"] == count(P2))
check("F seller product details carry wishlistCount", call("GET", f"/seller/products/{P1}", S1_TOKEN), 200, pred=lambda v: v["wishlistCount"] == count(P1))
check("F seller cannot read another seller's product", call("GET", f"/seller/products/{P3}", S1_TOKEN), 404)
check("F default order is newest", (c, pl), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted([r["id"] for r in v["results"]], reverse=True))
many = [mk(S1, 30 + i) for i in range(4)]
for n, p in enumerate(many):
    for u in users10[: n + 1]:
        add(u[0], p)
c, ms = call("GET", "/seller/products?sort=mostSaved&limit=100", S1_TOKEN)
check("F sort=mostSaved orders by saves", (c, ms), 200, pred=lambda v: [r["wishlistCount"] for r in v["results"]] == sorted([r["wishlistCount"] for r in v["results"]], reverse=True) and v["results"][0]["id"] == many[-1])
check("F ties fall back to newest first", (c, ms), 200, pred=lambda v: all(a["wishlistCount"] != b["wishlistCount"] or a["id"] > b["id"] for a, b in zip(v["results"], v["results"][1:])))
seen, cursor = [], 0
for _ in range(20):
    c, v = call("GET", f"/seller/products?sort=mostSaved&limit=2&cursor={cursor}", S1_TOKEN)
    seen += [r["id"] for r in v["results"]]
    if v["nextCursor"] is None:
        break
    cursor = v["nextCursor"]
check("F mostSaved pages by offset and visits each product once", (200, seen), 200, pred=lambda v: v == [r["id"] for r in ms["results"]] and len(v) == len(set(v)))
check("F sort bad value -> 400", call("GET", "/seller/products?sort=popular", S1_TOKEN), 400)
check("F sort=newest is accepted", call("GET", "/seller/products?sort=newest", S1_TOKEN), 200)
check("F the seller cannot change the count", call("PATCH", f"/seller/products/{P1}", S1_TOKEN, {"wishlistCount": 999}), 400)
check("F ...it did not move", (200, count(P1)), 200, pred=lambda v: v == rows(pid=P1))

# ================================================================= G admin
A = "/admin/wishlist"
check("G list without token -> 401", call("GET", A), 401)
check("G customer token -> 403", call("GET", A, tok_a), 403)
check("G seller token -> 403", call("GET", A, S1_TOKEN), 403)
check("G most-saved: customer token -> 403", call("GET", A + "/most-saved", tok_a), 403)
check("G user wishlist: seller token -> 403", call("GET", f"/admin/users/{uid_a}/wishlist", S1_TOKEN), 403)
c, al = call("GET", A + "?limit=100", ADMIN)
check("G admin list shows user, seller and product", (c, al), 200, pred=lambda v: all(set(("user", "seller", "product", "priceWhenSaved", "priceChange", "availability", "creatorName")) <= set(r) for r in v["results"]))
row = next(r for r in call("GET", A + f"?userId={uid_a}&productId={P2}", ADMIN)[1]["results"])
check("G user block", (200, row), 200, pred=lambda v: v["user"] == {"id": uid_a, "name": "T WL User 1", "phone": sql(f"select phone from \"user\" where id={uid_a}"), "email": f"t-wl-{RUN}-1@example.com"})
check("G seller block", (200, row), 200, pred=lambda v: v["seller"]["id"] == S1 and v["seller"]["name"] == "T WL Seller One" and "phone" in v["seller"])
check("G product block", (200, row), 200, pred=lambda v: v["product"]["id"] == P2 and v["product"]["name"] == "T WL Rare Tumbler" and v["product"]["price"] == 250 and v["product"]["wishlistCount"] == count(P2))
check("G tracker fields come through", (200, row), 200, pred=lambda v: v["creatorType"] == "user" and v["creatorName"] == "T WL User 1" and v["createdBy"] == uid_a)
check("G filter userId", (200, call("GET", A + f"?userId={uid_a}", ADMIN)[1]["results"]), 200, pred=lambda v: v and all(r["user"]["id"] == uid_a for r in v))
check("G filter productId", (200, call("GET", A + f"?productId={P2}", ADMIN)[1]["results"]), 200, pred=lambda v: v and all(r["product"]["id"] == P2 for r in v))
check("G filter sellerId", (200, call("GET", A + f"?sellerId={S2}&limit=100", ADMIN)[1]["results"]), 200, pred=lambda v: v and all(r["seller"]["id"] == S2 for r in v))
check("G product search", (200, call("GET", A + "?search=rare%20tumbler", ADMIN)[1]["results"]), 200, pred=lambda v: v and all(r["product"]["id"] == P2 for r in v))
check("G customer search by name", (200, call("GET", A + "?userSearch=T%20WL%20User%201", ADMIN)[1]["results"]), 200, pred=lambda v: v and all(r["user"]["id"] == uid_a for r in v))
check("G customer search by email", (200, call("GET", A + f"?userSearch=t-wl-{RUN}-1@", ADMIN)[1]["results"]), 200, pred=lambda v: v and all(r["user"]["id"] == uid_a for r in v))
check("G seller search", (200, call("GET", A + "?sellerSearch=Seller%20Two&limit=100", ADMIN)[1]["results"]), 200, pred=lambda v: v and all(r["seller"]["id"] == S2 for r in v))
check("G filters combine", (200, call("GET", A + f"?userId={uid_a}&sellerId={S2}", ADMIN)[1]["results"]), 200, pred=lambda v: v and all(r["user"]["id"] == uid_a and r["seller"]["id"] == S2 for r in v))
check("G a filter that matches nothing", call("GET", A + "?search=zzzznothing", ADMIN), 200, pred=lambda v: v["results"] == [] and v["nextCursor"] is None)
for bad in ("userId=0", "userId=abc", "sellerId=-1", "productId=x", "limit=101", "cursor=-1", "bogus=1"):
    check(f"G bad filter {bad} -> 400", call("GET", A + "?" + bad, ADMIN), 400)
seen, cursor = [], 0
for _ in range(80):
    c, v = call("GET", A + f"?limit=7&cursor={cursor}", ADMIN)
    seen += [r["id"] for r in v["results"]]
    if v["nextCursor"] is None:
        break
    cursor = v["nextCursor"]
check("G cursor paging visits every row once, newest first", (200, seen), 200, pred=lambda v: v == sorted(v, reverse=True) and len(v) == len(set(v)) == rows())
sql(f"update seller_product set \"deletedAt\"=now() where id={P3}")
check("G ...marked removed", call("GET", A + f"?productId={P3}", ADMIN), 200, pred=lambda v: v["results"] and all(r["availability"] == "removed" and r["product"]["deleted"] for r in v["results"]))
sql(f"update seller_product set \"deletedAt\"=null where id={P3}")

check("G a customer's own page", call("GET", f"/admin/users/{uid_a}/wishlist", ADMIN), 200, pred=lambda v: v["results"] and all(r["user"]["id"] == uid_a for r in v["results"]) and len(v["results"]) == rows(uid_a))
check("G the page cannot be pointed at someone else", call("GET", f"/admin/users/{uid_a}/wishlist?userId={uid_b}", ADMIN), 200, pred=lambda v: all(r["user"]["id"] == uid_a for r in v["results"]))
check("G a customer with nothing", call("GET", f"/admin/users/{uid_s}/wishlist", ADMIN), 200, pred=lambda v: v["results"] == [])
check("G unknown customer -> 404", call("GET", "/admin/users/99999999/wishlist", ADMIN), 404)
check("G bad customer id -> 400", call("GET", "/admin/users/abc/wishlist", ADMIN), 400)
check("G customer token on another's page -> 403", call("GET", f"/admin/users/{uid_a}/wishlist", tok_b), 403)

c, top = call("GET", A + "/most-saved", ADMIN)
check("G most-saved is ordered busiest first", (c, top), 200, pred=lambda v: [t["wishlistCount"] for t in v] == sorted([t["wishlistCount"] for t in v], reverse=True) and all(t["wishlistCount"] > 0 for t in v))
check("G most-saved rows carry seller and category", (c, top), 200, pred=lambda v: all(set(("id", "name", "wishlistCount", "seller", "category")) <= set(t) for t in v))
check("G most-saved shows the top product", (c, top), 200, pred=lambda v: v[0]["wishlistCount"] == int(sql("select max(\"wishlistCount\") from seller_product where \"deletedAt\" is null")))
check("G most-saved limit", call("GET", A + "/most-saved?limit=3", ADMIN), 200, pred=lambda v: len(v) == 3)
check("G most-saved by seller", call("GET", A + f"/most-saved?sellerId={S1}", ADMIN), 200, pred=lambda v: v and all(t["seller"]["id"] == S1 for t in v))
check("G most-saved by category", call("GET", A + f"/most-saved?categoryId={CAT}&limit=100", ADMIN), 200, pred=lambda v: v and all(t["category"]["id"] == CAT for t in v))
check("G most-saved unknown category is empty", call("GET", A + "/most-saved?categoryId=99999999", ADMIN), 200, pred=lambda v: v == [])
for bad in ("limit=0", "limit=101", "limit=abc", "sellerId=0", "categoryId=x", "bogus=1"):
    check(f"G most-saved bad {bad} -> 400", call("GET", A + "/most-saved?" + bad, ADMIN), 400)
check("G admin product list sorts by saves", call("GET", "/admin/products?sort=mostSaved&limit=5", ADMIN), 200, pred=lambda v: [r["wishlistCount"] for r in v["results"]] == sorted([r["wishlistCount"] for r in v["results"]], reverse=True))
check("G admin product list carries the count", call("GET", f"/admin/products/{P2}", ADMIN), 200, pred=lambda v: v["wishlistCount"] == count(P2))
check("G admin cannot add to a customer's wishlist", call("POST", f"{A}/{P1}", ADMIN), 404)
check("G admin cannot remove from it", call("DELETE", f"{A}/1", ADMIN), 404)
check("G admin cannot save through the customer route", call("POST", f"{W}/{P1}", ADMIN), 403)

# ================================================================= H storefront and cart unaffected
check("H storefront product page still loads", call("GET", f"/user/products/{P2}"), 200, pred=lambda v: "wishlistCount" not in json.dumps(v))
check("H wishlist does not leak into the storefront card", call("GET", "/user/products?pageSize=5"), 200, pred=lambda v: "wishlistCount" not in json.dumps(v))

# ================================================================= I invariants
check("I every product's count equals its rows", (200, sqlint("select count(*) from seller_product p where p.\"wishlistCount\" <> (select count(*) from wishlist w where w.\"sellerProductId\"=p.id)")), 200, pred=lambda v: v == 0)
check("I no negative count", (200, sqlint("select count(*) from seller_product where \"wishlistCount\" < 0")), 200, pred=lambda v: v == 0)
check("I the database refuses a negative count", (200, sql("update seller_product set \"wishlistCount\"=-1 where id=" + str(P2) + " returning id")), 200, pred=lambda v: v == "")
check("I ...and it stayed valid", (200, count(P2)), 200, pred=lambda v: v >= 0)
check("I no customer is over the cap", (200, sqlint("select count(*) from (select \"userId\" from wishlist group by 1 having count(*) > 200) x")), 200, pred=lambda v: v == 0)
check("I no duplicate (customer, product)", (200, sqlint("select count(*) from (select 1 from wishlist group by \"userId\",\"sellerProductId\" having count(*)>1) x")), 200, pred=lambda v: v == 0)
check("I every row made through the API says who created it", (200, sqlint(f"select count(*) from wishlist where \"createdBy\" is null and \"userId\" in (select id from \"user\" where email like 't-wl-%') and \"userId\" not in ({uid_f},{uid_g})")), 200, pred=lambda v: v == 0)
check("I saved prices are never negative", (200, sqlint("select count(*) from wishlist where \"priceWhenSaved\" < 0")), 200, pred=lambda v: v == 0)

cleanup()
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
sys.exit(1 if failed else 0)
