#!/usr/bin/env python3
"""Black-box tests: SKU price proposals (buyer, seller, admin) and their history.

Uses its own sellers and products ("T PP ..." / tpp-<run>-N), so real catalog data is never touched.
"""
import concurrent.futures as cf, json, os, subprocess, sys, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
P = "/user/proposals"


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
    sql("delete from sku_price_proposal_history where \"proposalId\" in (select id from sku_price_proposal where \"sellerId\" in (select id from seller where name like 'T PP %'))")
    sql("delete from sku_price_proposal where \"sellerId\" in (select id from seller where name like 'T PP %')")
    sql("delete from seller_product_sku where \"sellerProductId\" in (select id from seller_product where slug like 'tpp-%')")
    sql("delete from seller_product where slug like 'tpp-%'")
    sql("delete from \"user\" where email like 't-pp-%'")
    sql("delete from seller where name like 'T PP %'")


def register(n):
    phone = f"+88017{RUN_NUM}{n:03d}"
    c, d = call("POST", "/user/auth/register", body={"name": f"T PP User {n}", "phone": phone, "password": "Passw0rd!x", "email": f"t-pp-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


def make_seller(tag, n):
    c, d = call("POST", "/seller/auth/register", body={"name": f"T PP Seller {tag}", "phone": f"+88017{RUN_NUM}9{n:02d}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = d["seller"]["id"]
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


CAT = sqlint("select \"categoryId\" from seller_product where id=94")
SEQ = [0]


def mk(seller_id, price=2000, qty=5, name=None, accept=True, floor=None):
    """A product with one SKU. Returns (product id, sku id)."""
    SEQ[0] += 1
    n = SEQ[0]
    pid = sqlint(
        f"insert into seller_product (\"sellerId\",\"categoryId\",name,slug) values ({seller_id},{CAT},'{name or f'T PP Pigeon {n}'}','tpp-{RUN}-{n}') returning id"
    )
    fl = "null" if floor is None else floor
    kid = sqlint(
        f"insert into seller_product_sku (\"sellerProductId\",price,quantity,\"isDefault\",\"isActive\",\"acceptProposals\",\"minProposalPrice\") values ({pid},{price},{qty},true,true,{str(accept).lower()},{fl}) returning id"
    )
    return pid, kid



cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
S1_TOKEN, S1 = make_seller("One", 1)
S2_TOKEN, S2 = make_seller("Two", 2)
tok_a, uid_a = register(1)
tok_b, uid_b = register(2)
UA, SE, AD = "/user/proposals", "/seller/proposals", "/admin/proposals"
hist = lambda pid: sqlint(f"select count(*) from sku_price_proposal_history where \"proposalId\"={pid}")
status_of = lambda pid: sql(f"select status from sku_price_proposal where id={pid}")
offer = lambda tok, sku, price=1500, qty=1, **kw: call("POST", UA, tok, {"sellerProductSkuId": sku, "price": price, "quantity": qty, **kw})
PID, SKU = mk(S1)
_, SKU_OFF = mk(S1, accept=False)
_, SKU_S2 = mk(S2)

# ================================================================= A identity
for label, tok in (("no token", None), ("bad token", "garbage")):
    check(f"A buyer list with {label} -> 401", call("GET", UA, tok), 401)
    check(f"A buyer create with {label} -> 401", call("POST", UA, tok, {}), 401)
    check(f"A seller list with {label} -> 401", call("GET", SE, tok), 401)
    check(f"A admin list with {label} -> 401", call("GET", AD, tok), 401)
check("A admin token on buyer API -> 403", call("GET", UA, ADMIN), 403)
check("A seller token on buyer API -> 403", call("GET", UA, S1_TOKEN), 403)
check("A buyer token on seller API -> 403", call("GET", SE, tok_a), 403)
check("A buyer token on admin API -> 403", call("GET", AD, tok_a), 403)
check("A seller token on admin API -> 403", call("GET", AD, S1_TOKEN), 403)
check("A new buyer starts with nothing", call("GET", UA, tok_a), 200, pred=lambda v: v["results"] == [] and v["nextCursor"] is None)

# ================================================================= B create: validation
check("B missing body -> 400", call("POST", UA, tok_a, {}), 400)
check("B unknown field -> 400", offer(tok_a, SKU, junk=1), 400)
check("B price 0 -> 400", offer(tok_a, SKU, price=0), 400)
check("B negative price -> 400", offer(tok_a, SKU, price=-5), 400)
check("B 3 decimals -> 400", offer(tok_a, SKU, price=10.123), 400)
check("B price as text -> 400", offer(tok_a, SKU, price="abc"), 400)
check("B quantity 0 -> 400", offer(tok_a, SKU, qty=0), 400)
check("B quantity 1.5 -> 400", offer(tok_a, SKU, qty=1.5), 400)
check("B note too long -> 400", offer(tok_a, SKU, note="x" * 501), 400)
check("B unknown SKU -> 404", offer(tok_a, 99999999), 404)
check("B SKU id 0 -> 400", offer(tok_a, 0), 400)
check("B SKU that takes no proposals -> 400", offer(tok_a, SKU_OFF), 400)
check("B more than stock -> 400", offer(tok_a, SKU, qty=6), 400, pred=lambda v: "stock" in str(v).lower())
_, sku_empty = mk(S1, qty=0)
check("B out of stock -> 400", offer(tok_a, sku_empty), 400)
hid, sku_hid = mk(S1)
sql(f"update seller_product set \"activeStatus\"='inactive' where id={hid}")
check("B inactive product -> 404", offer(tok_a, sku_hid), 404)
sql(f"update seller_product set \"activeStatus\"='active' where id={hid}")
sql(f"update seller_product_sku set \"isActive\"=false where id={sku_hid}")
check("B inactive SKU -> 404", offer(tok_a, sku_hid), 404)
tok_s, uid_s = register(9)
sql(f"update \"user\" set status='suspended' where id={uid_s}")
check("B suspended buyer cannot propose -> 403", offer(tok_s, SKU), 403)
check("B suspended buyer can still read -> 200", call("GET", UA, tok_s), 200)
check("B none of the refused calls left a row", (200, sqlint("select count(*) from sku_price_proposal where \"sellerId\" in (%d,%d)" % (S1, S2))), 200, pred=lambda v: v == 0)

# ================================================================= C create: happy path
c1 = offer(tok_a, SKU, 1500, 2, note="Can you do 1500?")
check("C offer 1500 x2 against 2000 -> 201 pending, awaiting seller", c1, 201,
      pred=lambda v: v["status"] == "pending" and v["awaitingParty"] == "seller" and v["price"] == 1500 and v["quantity"] == 2
      and v["total"] == 3000 and v["skuPriceAtCreate"] == 2000 and len(v["history"]) == 1 and v["history"][0]["action"] == "created"
      and v["history"][0]["note"] == "Can you do 1500?" and v["actions"] == ["cancel"])
PR1 = c1[1]["id"]
check("C tracker fields stamped", (200, sql(f"select \"creatorType\"||'|'||\"updaterType\"||'|'||\"createdBy\" from sku_price_proposal where id={PR1}")), 200,
      pred=lambda v: v == f"user|user|{uid_a}")
check("C a second open proposal for the same SKU -> 409", offer(tok_a, SKU, 1400), 409)
check("C another buyer may propose for the same SKU", offer(tok_b, SKU, 1700), 201)
PRB = call("GET", UA, tok_b)[1]["results"][0]["id"]
check("C buyer list shows only own", call("GET", UA, tok_a), 200, pred=lambda v: [r["id"] for r in v["results"]] == [PR1])
check("C buyer get own with history", call("GET", f"{UA}/{PR1}", tok_a), 200, pred=lambda v: v["id"] == PR1 and len(v["history"]) == 1)
check("C buyer cannot read another buyer's -> 404", call("GET", f"{UA}/{PRB}", tok_a), 404)
check("C unknown id -> 404", call("GET", f"{UA}/99999999", tok_a), 404)
check("C id abc -> 400", call("GET", f"{UA}/abc", tok_a), 400)
check("C by-sku returns the open one", call("GET", f"{UA}/sku/{SKU}", tok_a), 200, pred=lambda v: v["proposal"]["id"] == PR1)
check("C by-sku with none -> null", call("GET", f"{UA}/sku/{SKU_S2}", tok_a), 200, pred=lambda v: v["proposal"] is None)

# ---- 10 parallel proposals from one buyer on one SKU: exactly one wins
tok_r, uid_r = register(7)
with cf.ThreadPoolExecutor(10) as ex:
    codes = sorted(r[0] for r in ex.map(lambda _: offer(tok_r, SKU, 1500), range(10)))
check("C 10 parallel proposals -> exactly one 201, rest 409", (200, codes), 200, pred=lambda v: v.count(201) == 1 and v.count(409) == 9)
check("C ...and one open row", (200, sqlint(f"select count(*) from sku_price_proposal where \"userId\"={uid_r}")), 200, pred=lambda v: v == 1)

# ================================================================= D privacy
check("D seller 1 sees both proposals on its SKU", call("GET", SE, S1_TOKEN), 200, pred=lambda v: {PR1, PRB} <= {r["id"] for r in v["results"]})
check("D seller list shows buyer name", call("GET", f"{SE}/{PR1}", S1_TOKEN), 200, pred=lambda v: v["buyer"]["name"] == "T PP User 1")
check("D seller 2 sees none of them", call("GET", SE, S2_TOKEN), 200, pred=lambda v: v["results"] == [])
check("D seller 2 cannot read seller 1's -> 404", call("GET", f"{SE}/{PR1}", S2_TOKEN), 404)
check("D seller 2 cannot accept seller 1's -> 404", call("POST", f"{SE}/{PR1}/accept", S2_TOKEN, {}), 404)
check("D buyer 2 cannot cancel buyer 1's -> 404", call("POST", f"{UA}/{PR1}/cancel", tok_b, {}), 404)
check("D buyer 2 cannot counter buyer 1's -> 404", call("POST", f"{UA}/{PR1}/counter", tok_b, {"price": 1}), 404)
text = json.dumps(call("GET", f"{UA}/{PR1}", tok_a)[1])
check("D buyer view never carries the seller's floor", (200, "minProposalPrice" in text), 200, pred=lambda v: v is False)
check("D admin sees all", call("GET", AD, ADMIN), 200, pred=lambda v: {PR1, PRB} <= {r["id"] for r in v["results"]})
check("D admin get", call("GET", f"{AD}/{PR1}", ADMIN), 200, pred=lambda v: v["id"] == PR1 and v["actions"] == ["reject", "cancel"])

# ================================================================= E turns
check("E buyer cannot accept on the seller's turn -> 409", call("POST", f"{UA}/{PR1}/accept", tok_a, {}), 409)
check("E buyer cannot counter on the seller's turn -> 409", call("POST", f"{UA}/{PR1}/counter", tok_a, {"price": 1600}), 409)
check("E buyer cannot reject on the seller's turn -> 409", call("POST", f"{UA}/{PR1}/reject", tok_a, {}), 409)
check("E counter needs a price -> 400", call("POST", f"{SE}/{PR1}/counter", S1_TOKEN, {}), 400)
check("E counter price 0 -> 400", call("POST", f"{SE}/{PR1}/counter", S1_TOKEN, {"price": 0}), 400)
check("E counter above stock -> 400", call("POST", f"{SE}/{PR1}/counter", S1_TOKEN, {"price": 1800, "quantity": 9}), 400)
cc = call("POST", f"{SE}/{PR1}/counter", S1_TOKEN, {"price": 1800, "note": "1800 is my best"})
check("E seller counters 1800 -> awaiting buyer", cc, 201,
      pred=lambda v: v["status"] == "pending" and v["awaitingParty"] == "buyer" and v["price"] == 1800 and v["quantity"] == 2
      and [h["action"] for h in v["history"]] == ["created", "countered"] and v["actions"] == [])
check("E history keeps every price", call("GET", f"{UA}/{PR1}", tok_a), 200,
      pred=lambda v: [h["price"] for h in v["history"]] == [1500, 1800] and v["history"][1]["actorType"] == "seller" and v["actions"] == ["accept", "counter", "reject", "cancel"])
check("E seller cannot answer on the buyer's turn -> 409", call("POST", f"{SE}/{PR1}/accept", S1_TOKEN, {}), 409)
check("E seller cannot counter twice in a row -> 409", call("POST", f"{SE}/{PR1}/counter", S1_TOKEN, {"price": 1700}), 409)
check("E seller cannot reject on the buyer's turn -> 409", call("POST", f"{SE}/{PR1}/reject", S1_TOKEN, {}), 409)
check("E buyer counters back 1650 qty 3", call("POST", f"{UA}/{PR1}/counter", tok_a, {"price": 1650, "quantity": 3}), 201,
      pred=lambda v: v["awaitingParty"] == "seller" and v["price"] == 1650 and v["quantity"] == 3 and len(v["history"]) == 3)
check("E seller counters 1700 again", call("POST", f"{SE}/{PR1}/counter", S1_TOKEN, {"price": 1700}), 201, pred=lambda v: v["quantity"] == 3 and len(v["history"]) == 4)
check("E buyer accepts the counter -> accepted at 1700", call("POST", f"{UA}/{PR1}/accept", tok_a, {}), 201,
      pred=lambda v: v["status"] == "accepted" and v["awaitingParty"] is None and v["price"] == 1700 and v["quantity"] == 3 and v["acceptedAt"]
      and v["history"][-1]["action"] == "accepted" and v["history"][-1]["actorType"] == "user" and v["actions"] == [])

# ================================================================= F accepted is locked
check("F seller cannot reject an accepted one -> 409", call("POST", f"{SE}/{PR1}/reject", S1_TOKEN, {}), 409)
check("F seller cannot accept again -> 409", call("POST", f"{SE}/{PR1}/accept", S1_TOKEN, {}), 409)
check("F seller cannot counter an accepted one -> 409", call("POST", f"{SE}/{PR1}/counter", S1_TOKEN, {"price": 1}), 409)
check("F buyer cannot cancel an accepted one -> 409", call("POST", f"{UA}/{PR1}/cancel", tok_a, {}), 409)
check("F buyer cannot counter an accepted one -> 409", call("POST", f"{UA}/{PR1}/counter", tok_a, {"price": 1}), 409)
check("F buyer cannot propose again while accepted -> 409", offer(tok_a, SKU, 1000), 409)
check("F still accepted", (200, status_of(PR1)), 200, pred=lambda v: v == "accepted")
sql(f"update seller_product_sku set \"discountedPrice\"=1600 where id={SKU}")
check("F SKU now cheaper than the accepted price -> warning flag", call("GET", f"{UA}/{PR1}", tok_a), 200,
      pred=lambda v: v["skuPriceNow"] == 1600 and v["skuPriceNowLower"] is True)
sql(f"update seller_product_sku set \"discountedPrice\"=null where id={SKU}")
check("F back to normal -> no warning", call("GET", f"{UA}/{PR1}", tok_a), 200, pred=lambda v: v["skuPriceNowLower"] is False)
check("F admin cancels the accepted one", call("POST", f"{AD}/{PR1}/cancel", ADMIN, {"note": "Dispute"}), 201,
      pred=lambda v: v["status"] == "cancelled" and v["closedByType"] == "admin" and v["closeNote"] == "Dispute" and v["history"][-1]["actorType"] == "admin")
check("F closed: nobody can act -> 409", call("POST", f"{AD}/{PR1}/reject", ADMIN, {}), 409)
check("F closed: buyer cannot cancel -> 409", call("POST", f"{UA}/{PR1}/cancel", tok_a, {}), 409)
n1 = offer(tok_a, SKU, 1300)
check("F after the cancel the buyer can propose again", n1, 201, pred=lambda v: v["status"] == "pending")
PR2 = n1[1]["id"]

# ================================================================= G reject / cancel / admin
check("G seller rejects (pending, its turn)", call("POST", f"{SE}/{PR2}/reject", S1_TOKEN, {"note": "Too low"}), 201,
      pred=lambda v: v["status"] == "rejected" and v["closedByType"] == "seller" and v["closeNote"] == "Too low" and v["awaitingParty"] is None)
n2 = offer(tok_a, SKU, 1400)
check("G after a seller reject the buyer can propose again", n2, 201)
PR3 = n2[1]["id"]
check("G buyer cancels a pending one", call("POST", f"{UA}/{PR3}/cancel", tok_a, {}), 201, pred=lambda v: v["status"] == "cancelled" and v["closedByType"] == "user")
n3 = offer(tok_a, SKU, 1450)
PR4 = n3[1]["id"]
check("G admin rejects a pending one", call("POST", f"{AD}/{PR4}/reject", ADMIN, {"note": "Policy"}), 201, pred=lambda v: v["status"] == "rejected" and v["closedByType"] == "admin")
n4 = offer(tok_a, SKU, 1480)
PR5 = n4[1]["id"]
call("POST", f"{SE}/{PR5}/counter", S1_TOKEN, {"price": 1900})
check("G buyer rejects the seller's counter -> rejected", call("POST", f"{UA}/{PR5}/reject", tok_a, {"note": "No"}), 201,
      pred=lambda v: v["status"] == "rejected" and v["closedByType"] == "user")
check("G buyer can propose again after rejecting a counter", offer(tok_a, SKU, 1500), 201)
PR6 = call("GET", UA + "?status=pending", tok_a)[1]["results"][0]["id"]
check("G admin can also cancel a pending one", call("POST", f"{AD}/{PR6}/cancel", ADMIN, {}), 201, pred=lambda v: v["status"] == "cancelled")

# ================================================================= H floor
_, SKU_F = mk(S1, price=2000, floor=1200)
f1 = offer(tok_a, SKU_F, 1000)
check("H below the floor -> created and turned down at once", f1, 201,
      pred=lambda v: v["status"] == "rejected" and v["closedByType"] == "seller" and len(v["history"]) == 2 and v["history"][1]["action"] == "rejected" and v["actions"] == [])
check("H ...and the floor is not in the answer", (200, "1200" in json.dumps(f1[1])), 200, pred=lambda v: v is False)
f2 = offer(tok_a, SKU_F, 1200)
check("H exactly at the floor is fine -> pending", f2, 201, pred=lambda v: v["status"] == "pending")
call("POST", f"{SE}/{f2[1]['id']}/counter", S1_TOKEN, {"price": 1800})
check("H buyer counter below the floor is turned down", call("POST", f"{UA}/{f2[1]['id']}/counter", tok_a, {"price": 1100}), 201,
      pred=lambda v: v["status"] == "rejected" and v["history"][-1]["action"] == "rejected" and v["history"][-2]["price"] == 1100)

# ================================================================= I lists, filters, paging
check("I filter status=rejected", call("GET", UA + "?status=rejected", tok_a), 200, pred=lambda v: v["results"] and all(r["status"] == "rejected" for r in v["results"]))
check("I filter status=banana -> 400", call("GET", UA + "?status=banana", tok_a), 400)
check("I filter awaiting=seller", call("GET", SE + "?awaiting=seller", S1_TOKEN), 200, pred=lambda v: all(r["awaitingParty"] == "seller" and r["status"] == "pending" for r in v["results"]))
check("I filter by sku", call("GET", f"{UA}?sellerProductSkuId={SKU_F}", tok_a), 200, pred=lambda v: v["results"] and all(r["sku"]["id"] == SKU_F for r in v["results"]))
check("I seller filter buyerSearch", call("GET", SE + "?buyerSearch=User%202", S1_TOKEN), 200, pred=lambda v: v["results"] and all(r["buyer"]["name"] == "T PP User 2" for r in v["results"]))
check("I admin filter sellerId", call("GET", f"{AD}?sellerId={S2}", ADMIN), 200, pred=lambda v: v["results"] == [])
check("I admin filter userId", call("GET", f"{AD}?userId={uid_a}", ADMIN), 200, pred=lambda v: v["results"] and all(r["buyer"]["id"] == uid_a for r in v["results"]))
check("I unknown query param -> 400", call("GET", UA + "?junk=1", tok_a), 400)
p1 = call("GET", UA + "?limit=3", tok_a)
check("I paging: page 1 has 3 and a cursor", p1, 200, pred=lambda v: len(v["results"]) == 3 and v["nextCursor"])
p2 = call("GET", UA + f"?limit=3&cursor={p1[1]['nextCursor']}", tok_a)
check("I paging: page 2 continues without overlap", p2, 200, pred=lambda v: v["results"] and not ({r["id"] for r in v["results"]} & {r["id"] for r in p1[1]["results"]}))
check("I newest first", p1, 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted((r["id"] for r in v["results"]), reverse=True))
check("I summary", call("GET", SE + "/summary", S1_TOKEN), 200, pred=lambda v: set(v) == {"pending", "awaitingYou", "accepted", "used", "closed"} and v["closed"] >= 4)
check("I summary is per seller", call("GET", SE + "/summary", S2_TOKEN), 200, pred=lambda v: v["pending"] == 0 and v["closed"] == 0)

# ================================================================= J races
_, SKU_R = mk(S1)
rr = offer(tok_a, SKU_R, 1500)
PRR = rr[1]["id"]
def go(i):
    return call("POST", f"{SE}/{PRR}/accept", S1_TOKEN, {}) if i == 0 else call("POST", f"{UA}/{PRR}/cancel", tok_a, {})
with cf.ThreadPoolExecutor(2) as ex:
    out = list(ex.map(go, range(2)))
st = status_of(PRR)
check("J accept vs cancel at once: one answer, state consistent", (200, (sorted(r[0] for r in out), st)), 200,
      pred=lambda v: (v[0] == [201, 201] and v[1] == "accepted") or (v[0] == [201, 409] and v[1] in ("accepted", "cancelled")))
check("J history length matches", (200, hist(PRR)), 200, pred=lambda v: v == 2)
_, SKU_R2 = mk(S1)
rr2 = offer(tok_a, SKU_R2, 1500)
PRR2 = rr2[1]["id"]
with cf.ThreadPoolExecutor(6) as ex:
    out = list(ex.map(lambda i: call("POST", f"{SE}/{PRR2}/counter", S1_TOKEN, {"price": 1600 + i}), range(6)))
check("J 6 parallel seller counters: exactly one wins", (200, sorted(r[0] for r in out)), 200, pred=lambda v: v.count(201) == 1 and v.count(409) == 5)
check("J ...history has created + one counter", (200, hist(PRR2)), 200, pred=lambda v: v == 2)

# ================================================================= K storefront exposure
text = json.dumps(call("GET", f"/user/products/{PID}", tok_a)[1])
check("K product page tells the buyer the SKU takes proposals", (200, '"acceptProposals": true' in text), 200, pred=lambda v: v is True)
check("K product page never carries the floor", (200, "minProposalPrice" in text), 200, pred=lambda v: v is False)

cleanup()
failed = [r for r in results if not r[0]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
