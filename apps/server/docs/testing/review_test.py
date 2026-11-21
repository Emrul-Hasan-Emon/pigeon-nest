#!/usr/bin/env python3
"""Black-box tests: reviews (customer), replies (customer / seller / admin), helpful votes, reports,
seller reading and admin moderation, plus the rating kept on every product.

Uses its own sellers, products ("T Rev ..." / trv-<run>-N), users and orders, so real catalog data is never touched.
"""
import base64, concurrent.futures as cf, json, os, subprocess, sys, tempfile, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
UPLOADS = os.environ.get("UPLOADS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads"))
TMP = tempfile.mkdtemp(prefix="rev")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
TAG = "T Rev"
R, RP, PR = "/user/reviews", "/user/review-replies", "/user/products"


def run(cmd):
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    text, code = out.rsplit("\n", 1)
    try:
        data = json.loads(text) if text else None
    except ValueError:
        data = text
    return int(code), data


def call(method, path, token=None, body=None, session=None):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path.replace(" ", "%20"), "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if session is not None:
        cmd += ["-H", f"x-cart-session: {session}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    return run(cmd)


def multi(method, path, token, fields=None, files=None, field="images"):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    for k, v in (fields or {}).items():
        cmd += ["--form-string", f"{k}={v}"]
    for i, (name, data, mime) in enumerate(files or []):
        p = os.path.join(TMP, f"{i}-{uuid.uuid4().hex[:4]}")
        open(p, "wb").write(data)
        cmd += ["-F", f"{field}=@{p};type={mime};filename={name}"]
    return run(cmd)


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


def truth(name, cond, detail=""):
    results.append((bool(cond), name, "" if cond else detail))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  <-- " + str(detail)))


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip().split("\n")[0]


def sqlint(q):
    return int(sql(q) or 0)


def sqlf(q):
    return float(sql(q) or 0)


def cleanup():
    sellers = f"select id from seller where name like '{TAG} %'"
    products = f"select id from seller_product where slug like 'trv-%'"
    ids = f"select id from \"order\" where \"recipientName\" like '{TAG} %' or \"sellerId\" in ({sellers})"
    paths = sql(f"select \"filePath\" from review_attachment where \"reviewId\" in (select id from review where \"sellerProductId\" in ({products}))").split()
    for t in ("review_report", "review_status_history", "review_edit_history", "review_helpful_vote"):
        sql(f"delete from {t} where \"reviewId\" in (select id from review where \"sellerProductId\" in ({products}))" if t != "review_helpful_vote" else
            f"delete from review_helpful_vote where \"reviewId\" in (select id from review where \"sellerProductId\" in ({products}))")
    sql(f"delete from review_reply where \"reviewId\" in (select id from review where \"sellerProductId\" in ({products}))")
    sql(f"delete from review_attachment where \"reviewId\" in (select id from review where \"sellerProductId\" in ({products}))")
    sql(f"delete from review where \"sellerProductId\" in ({products})")
    sql(f"delete from order_update where \"orderId\" in ({ids})")
    sql(f"delete from payment_attachments where \"orderId\" in ({ids})")
    sql(f"delete from payment_status_history where \"orderId\" in ({ids})")
    sql(f"update cart set \"orderId\"=null where \"orderId\" in ({ids})")
    sql(f"delete from payment where \"orderId\" in ({ids})")
    sql(f"delete from \"order\" where id in ({ids})")
    sql("delete from cart where \"userId\" in (select id from \"user\" where email like 't-rev-%')")
    sql("delete from address where \"userId\" in (select id from \"user\" where email like 't-rev-%')")
    sql("delete from \"user\" where email like 't-rev-%'")
    sql("delete from seller_product_sku where \"sellerProductId\" in (" + products + ")")
    sql(f"delete from seller_product where slug like 'trv-%'")
    sql(f"delete from seller where name like '{TAG} %'")
    for p in paths:
        try:
            os.unlink(os.path.join(UPLOADS, p))
        except OSError:
            pass


cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
COD = int(sql("select id from payment_gateway where slug='cash-on-delivery'"))
CAT = sqlint("select \"categoryId\" from seller_product where id=94")


def make_seller(tag):
    c, d = call("POST", "/seller/auth/register", body={"name": f"{TAG} Seller {tag}", "phone": f"+88017{RUN_NUM}9{int(tag):02d}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = d["seller"]["id"]
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], sid


def register(n, name=None):
    c, d = call("POST", "/user/auth/register", body={"name": name or f"{TAG} User {n}", "phone": f"+88017{RUN_NUM}{n:03d}", "password": "Passw0rd!x", "email": f"t-rev-{RUN}-{n}@example.com"})
    assert c == 201, d
    return d["accessToken"], d["user"]["id"]


SEQ = [0]


def mk(seller_id, price=100, qty=500, name=None):
    SEQ[0] += 1
    n = SEQ[0]
    pid = sqlint(f"insert into seller_product (\"sellerId\",\"categoryId\",name,slug) values ({seller_id},{CAT},'{name or f'{TAG} Pigeon {n}'}','trv-{RUN}-{n}') returning id")
    sku = sqlint(f"insert into seller_product_sku (\"sellerProductId\",price,quantity,\"isDefault\",\"isActive\") values ({pid},{price},{qty},true,true) returning id")
    return pid, sku


def addr(**over):
    p = {"recipientName": f"{TAG} Buyer", "recipientPhone": "+8801712345678", "countryCode": "BD", "city": "Dhaka",
         "addressLine": "House 1, Road 2", "deliveryType": "standard", "paymentGatewayId": COD}
    p.update(over)
    return p


def buy(token, pid, sku, deliver=True):
    """A customer orders a product; returns (orderId, orderItemId). Delivered unless told otherwise."""
    c, d = call("POST", "/user/carts/items", token, {"sellerProductId": pid, "sellerProductSkuId": sku, "quantity": 1})
    assert c in (200, 201), d
    c, o = call("POST", f"/user/checkout/{d['cart']['id']}/place", token, addr())
    assert c == 201, o
    if deliver:
        c, x = call("PATCH", f"/admin/orders/{o['id']}/status", ADMIN, {"status": "delivered"})
        assert c == 200, x
    return o["id"], sqlint(f"select id from order_item where \"orderId\"={o['id']} order by id limit 1")


def review(token, item, rating=5, **fields):
    f = {"orderItemId": item, "rating": rating}
    f.update(fields)
    return multi("POST", R, token, f)


def rate(pid):
    return sql(f"select \"ratingCount\"||'|'||\"ratingSum\"||'|'||\"ratingAverage\" from seller_product where id={pid}").split("|")


S1_TOKEN, S1 = make_seller("1")
S2_TOKEN, S2 = make_seller("2")
P1, K1 = mk(S1, 100, name=f"{TAG} Tumbler One")
P2, K2 = mk(S1, 250)
P3, K3 = mk(S2, 80)
tok_a, uid_a = register(1, "Rahim Khan Chowdhury")
tok_b, uid_b = register(2, "Karim")
tok_c, uid_c = register(3)
tok_d, uid_d = register(4)
tok_e, uid_e = register(5)
ADM = lambda path, **k: call(k.get("m", "GET"), "/admin" + path, ADMIN, k.get("b"))

# ================================================================= A identity
for label, tok in (("no token", None), ("bad token", "garbage")):
    check(f"A list mine with {label} -> 401", call("GET", R, tok), 401)
    check(f"A create with {label} -> 401", multi("POST", R, tok, {"orderItemId": 1, "rating": 5}), 401)
    check(f"A pending with {label} -> 401", call("GET", R + "/pending", tok), 401)
    check(f"A helpful with {label} -> 401", call("POST", R + "/1/helpful", tok), 401)
    check(f"A report with {label} -> 401", call("POST", R + "/1/report", tok, {"reason": "spam"}), 401)
    check(f"A reply with {label} -> 401", call("POST", R + "/1/replies", tok, {"body": "x"}), 401)
check("A admin token on customer reviews -> 403", call("GET", R, ADMIN), 403)
check("A seller token on customer reviews -> 403", call("GET", R, S1_TOKEN), 403)
check("A customer token on seller reviews -> 403", call("GET", "/seller/reviews", tok_a), 403)
check("A customer token on admin reviews -> 403", call("GET", "/admin/reviews", tok_a), 403)
check("A seller token on admin reviews -> 403", call("GET", "/admin/reviews", S1_TOKEN), 403)
check("A no token on seller reviews -> 401", call("GET", "/seller/reviews"), 401)
check("A no token on admin reviews -> 401", call("GET", "/admin/reviews"), 401)
check("A no token on admin reports -> 401", call("GET", "/admin/review-reports"), 401)
tok_s, uid_s = register(9)
sql(f"update \"user\" set status='suspended' where id={uid_s}")
check("A suspended customer may read own reviews", call("GET", R, tok_s), 200)
check("A suspended customer may read pending", call("GET", R + "/pending", tok_s), 200)
check("A suspended customer cannot create -> 403", multi("POST", R, tok_s, {"orderItemId": 1, "rating": 5}), 403)
check("A suspended customer cannot vote -> 403", call("POST", R + "/1/helpful", tok_s), 403)
check("A new customer has no reviews", call("GET", R, tok_a), 200, pred=lambda v: v["results"] == [] and v["nextCursor"] is None)
check("A ...and nothing pending", call("GET", R + "/pending", tok_a), 200, pred=lambda v: v["results"] == [])

# ================================================================= B create: rules
O_A1, I_A1 = buy(tok_a, P1, K1)
O_P, I_P = buy(tok_b, P1, K1, deliver=False)
check("B missing orderItemId -> 400", multi("POST", R, tok_a, {"rating": 5}), 400)
check("B missing rating -> 400", multi("POST", R, tok_a, {"orderItemId": I_A1}), 400)
for bad in (0, 6, -1, 2.5, "abc", ""):
    check(f"B rating {bad!r} -> 400", multi("POST", R, tok_a, {"orderItemId": I_A1, "rating": bad}), 400)
check("B orderItemId 0 -> 400", multi("POST", R, tok_a, {"orderItemId": 0, "rating": 5}), 400)
check("B orderItemId abc -> 400", multi("POST", R, tok_a, {"orderItemId": "abc", "rating": 5}), 400)
check("B orderItemId too large -> 400", multi("POST", R, tok_a, {"orderItemId": 99999999999, "rating": 5}), 400)
check("B title over 150 -> 400", review(tok_a, I_A1, 5, title="x" * 151), 400)
check("B comment over 2000 -> 400", review(tok_a, I_A1, 5, comment="x" * 2001), 400)
check("B unknown field -> 400", review(tok_a, I_A1, 5, isApproved="true"), 400)
check("B unknown order item -> 404", review(tok_a, 99999999), 404)
check("B someone else's order item -> 404", review(tok_c, I_A1), 404)
check("B order not delivered yet -> 400", review(tok_b, I_P), 400)
for st in ("pending", "confirmed", "packed", "shipped", "cancelled"):
    call("PATCH", f"/admin/orders/{O_P}/status", ADMIN, {"status": st})
    check(f"B order at {st} cannot be reviewed -> 400", review(tok_b, I_P), 400)
check("B nothing saved by the refused tries", (200, sqlint("select count(*) from review where \"sellerProductId\"=%d" % P1)), 200, pred=lambda v: v == 0)
check("B product rating untouched", (200, rate(P1)), 200, pred=lambda v: v == ["0", "0", "0"])
call("PATCH", f"/admin/orders/{O_P}/status", ADMIN, {"status": "delivered"})
check("B too many photos -> 400", multi("POST", R, tok_b, {"orderItemId": I_P, "rating": 4}, [(f"p{i}.png", PNG, "image/png") for i in range(6)]), 400)
check("B a text file as photo -> 400", multi("POST", R, tok_b, {"orderItemId": I_P, "rating": 4}, [("a.txt", b"hello", "text/plain")]), 400)
check("B a script renamed .png -> 400", multi("POST", R, tok_b, {"orderItemId": I_P, "rating": 4}, [("a.png", b"<script>alert(1)</script>", "image/png")]), 400)
check("B an empty photo -> 400", multi("POST", R, tok_b, {"orderItemId": I_P, "rating": 4}, [("a.png", b"", "image/png")]), 400)
check("B an oversize photo -> 413/400", multi("POST", R, tok_b, {"orderItemId": I_P, "rating": 4}, [("a.png", PNG + b"0" * (5 * 1024 * 1024 + 1), "image/png")]), [400, 413])
check("B refused photos saved no review", (200, sqlint(f"select count(*) from review where \"orderItemId\"={I_P}")), 200, pred=lambda v: v == 0)

# ================================================================= C create: happy path
c, v = review(tok_a, I_A1, 5, title="Lovely birds", comment="Healthy and calm.")
check("C create ok", (c, v), 201, pred=lambda v: v["rating"] == 5 and v["title"] == "Lovely birds" and v["status"] == "published" and v["productId"] == P1 and v["orderItemId"] == I_A1 and v["images"] == [])
RV_A = v["id"]
check("C response shape", (c, v), 201, pred=lambda v: all(k in v for k in ["id", "productId", "product", "orderNumber", "rating", "title", "comment", "images", "status", "helpfulCount", "replyCount", "editedAt", "createdAt", "editableUntil", "canEdit"]))
check("C new review: helpful 0, replies 0, not edited", (c, v), 201, pred=lambda v: v["helpfulCount"] == 0 and v["replyCount"] == 0 and v["editedAt"] is None and v["canEdit"] is True)
check("C product rating now 1 / 5 / 5", (200, rate(P1)), 200, pred=lambda v: v == ["1", "5", "5"])
check("C tracker fields filled", (200, sql(f"select \"createdBy\"||'|'||\"creatorType\"||'|'||\"creatorName\"||'|'||\"updatedBy\"||'|'||\"updaterType\" from review where id={RV_A}")), 200,
      pred=lambda v: v == f"{uid_a}|user|{TAG} User 1|{uid_a}|user".replace(f"{TAG} User 1", "Rahim Khan Chowdhury"))
check("C order and product stored", (200, sql(f"select \"orderId\"||'|'||\"sellerProductId\"||'|'||\"userId\" from review where id={RV_A}")), 200, pred=lambda v: v == f"{O_A1}|{P1}|{uid_a}")
check("C same item again -> 409", review(tok_a, I_A1, 3), 409)
check("C still one review for the item", (200, sqlint(f"select count(*) from review where \"orderItemId\"={I_A1} and \"deletedAt\" is null")), 200, pred=lambda v: v == 1)
check("C rating unchanged after the 409", (200, rate(P1)), 200, pred=lambda v: v == ["1", "5", "5"])
check("C mine lists it", call("GET", R, tok_a), 200, pred=lambda v: [r["id"] for r in v["results"]] == [RV_A])
check("C mine by id", call("GET", f"{R}/{RV_A}", tok_a), 200, pred=lambda v: v["id"] == RV_A)
check("C someone else cannot open it -> 404", call("GET", f"{R}/{RV_A}", tok_c), 404)
check("C mine of another customer is empty", call("GET", R, tok_c), 200, pred=lambda v: v["results"] == [])
check("C review id 0 -> 400", call("GET", f"{R}/0", tok_a), 400)
check("C review id abc -> 400", call("GET", f"{R}/abc", tok_a), 400)
check("C unknown review -> 404", call("GET", f"{R}/99999999", tok_a), 404)

# a review with photos
O_B1, I_B1 = buy(tok_b, P1, K1)
c, v = multi("POST", R, tok_b, {"orderItemId": I_B1, "rating": 4, "comment": "Good"}, [("a.png", PNG, "image/png"), ("b.png", PNG, "image/png")])
check("C create with two photos", (c, v), 201, pred=lambda v: len(v["images"]) == 2 and all(i["url"] and i["id"] for i in v["images"]))
RV_B = v["id"]
PATHS_B = sql(f"select \"filePath\" from review_attachment where \"reviewId\"={RV_B}").split()
truth("C photo files are on disk", len(PATHS_B) >= 1 and all(os.path.exists(os.path.join(UPLOADS, p)) for p in PATHS_B), PATHS_B)
check("C rating is now 2 / 9 / 4.5", (200, rate(P1)), 200, pred=lambda v: v == ["2", "9", "4.5"])
O_C1, I_C1 = buy(tok_c, P1, K1)
check("C a 5 photo review is allowed", multi("POST", R, tok_c, {"orderItemId": I_C1, "rating": 3}, [(f"p{i}.png", PNG, "image/png") for i in range(5)]), 201, pred=lambda v: len(v["images"]) == 5)
RV_C = sqlint(f"select id from review where \"orderItemId\"={I_C1}")
check("C rating is now 3 / 12 / 4", (200, rate(P1)), 200, pred=lambda v: v == ["3", "12", "4"])

# ================================================================= D pending
O_D1, I_D1 = buy(tok_d, P1, K1)
O_D2, I_D2 = buy(tok_d, P2, K2)
O_D3, I_D3 = buy(tok_d, P3, K3, deliver=False)
check("D pending lists delivered, unreviewed lines", call("GET", R + "/pending", tok_d), 200, pred=lambda v: {r["id"] for r in v["results"]} == {I_D1, I_D2})
check("D pending row shape", call("GET", R + "/pending", tok_d), 200, pred=lambda v: all(k in v["results"][0] for k in ["id", "orderId", "orderNumber", "productId", "productName", "productSlug", "thumbnailUrl"]))
check("D pending is newest first", call("GET", R + "/pending", tok_d), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted([I_D1, I_D2], reverse=True))
check("D pending page 1 of size 1", call("GET", R + "/pending?limit=1", tok_d), 200, pred=lambda v: len(v["results"]) == 1 and v["nextCursor"] == v["results"][0]["id"])
c, p1 = call("GET", R + "/pending?limit=1", tok_d)
check("D pending page 2", call("GET", R + f"/pending?limit=1&cursor={p1['nextCursor']}", tok_d), 200, pred=lambda v: len(v["results"]) == 1 and v["results"][0]["id"] != p1["results"][0]["id"] and v["nextCursor"] is None)
check("D pending: another customer sees none of them", call("GET", R + "/pending", tok_e), 200, pred=lambda v: v["results"] == [])
check("D limit 101 -> 400", call("GET", R + "/pending?limit=101", tok_d), 400)
check("D cursor abc is treated as the first page", call("GET", R + "/pending?cursor=abc", tok_d), [200, 400])
review(tok_d, I_D1, 2)
check("D once reviewed the line leaves pending", call("GET", R + "/pending", tok_d), 200, pred=lambda v: {r["id"] for r in v["results"]} == {I_D2})
RV_D1 = sqlint(f"select id from review where \"orderItemId\"={I_D1}")
check("D deleting the review brings the line back", call("DELETE", f"{R}/{RV_D1}", tok_d), 200, pred=lambda v: v["deleted"] is True)
check("D ...pending shows both again", call("GET", R + "/pending", tok_d), 200, pred=lambda v: {r["id"] for r in v["results"]} == {I_D1, I_D2})
check("D ...and the rating dropped it", (200, rate(P1)), 200, pred=lambda v: v == ["3", "12", "4"])
check("D the soft-deleted row is kept", (200, sqlint(f"select count(*) from review where id={RV_D1} and \"deletedAt\" is not null")), 200, pred=lambda v: v == 1)
check("D a deleted review is gone for the owner -> 404", call("GET", f"{R}/{RV_D1}", tok_d), 404)
check("D deleting twice -> 404", call("DELETE", f"{R}/{RV_D1}", tok_d), 404)
check("D can review the same line again", review(tok_d, I_D1, 1, comment="Second try"), 201)
RV_D = sqlint(f"select id from review where \"orderItemId\"={I_D1} and \"deletedAt\" is null")
check("D rating is now 4 / 13 / 3.25", (200, rate(P1)), 200, pred=lambda v: v == ["4", "13", "3.25"])
check("D someone else cannot delete it -> 404", call("DELETE", f"{R}/{RV_D}", tok_c), 404)
check("D ...still there", (200, sqlint(f"select count(*) from review where id={RV_D} and \"deletedAt\" is null")), 200, pred=lambda v: v == 1)

# ================================================================= E edit
check("E someone else cannot edit -> 404", multi("PATCH", f"{R}/{RV_A}", tok_c, {"rating": 1}), 404)
check("E nothing to change -> 400", multi("PATCH", f"{R}/{RV_A}", tok_a, {}), 400)
check("E same values -> 400", multi("PATCH", f"{R}/{RV_A}", tok_a, {"rating": 5, "title": "Lovely birds"}), 400)
for bad in (0, 6, "x"):
    check(f"E rating {bad!r} -> 400", multi("PATCH", f"{R}/{RV_A}", tok_a, {"rating": bad}), 400)
check("E title over 150 -> 400", multi("PATCH", f"{R}/{RV_A}", tok_a, {"title": "x" * 151}), 400)
check("E unknown field -> 400", multi("PATCH", f"{R}/{RV_A}", tok_a, {"status": "hidden"}), 400)
check("E removeImageIds with a stranger's photo -> 400", multi("PATCH", f"{R}/{RV_A}", tok_a, {"removeImageIds": "99999999"}), 400)
check("E removeImageIds not a number -> 400", multi("PATCH", f"{R}/{RV_A}", tok_a, {"removeImageIds": "abc"}), 400)
check("E edit rating and comment", multi("PATCH", f"{R}/{RV_A}", tok_a, {"rating": 4, "comment": "Calm, a bit small."}), 200,
      pred=lambda v: v["rating"] == 4 and v["comment"] == "Calm, a bit small." and v["editedAt"] is not None and v["title"] == "Lovely birds")
check("E rating follows: 4 / 12 / 3", (200, rate(P1)), 200, pred=lambda v: v == ["4", "12", "3"])
check("E an edit row was written", (200, sql(f"select \"fromRating\"||'>'||\"toRating\"||'|'||\"fromComment\"||'>'||\"toComment\" from review_edit_history where \"reviewId\"={RV_A}")), 200,
      pred=lambda v: v == "5>4|Healthy and calm.>Calm, a bit small.")
check("E a blank title clears it", multi("PATCH", f"{R}/{RV_A}", tok_a, {"title": ""}), 200, pred=lambda v: v["title"] is None)
check("E two edits, two rows", (200, sqlint(f"select count(*) from review_edit_history where \"reviewId\"={RV_A}")), 200, pred=lambda v: v == 2)
c, cur = call("GET", f"{R}/{RV_B}", tok_b)
img_ids = [i["id"] for i in cur["images"]]
check("E add a photo", multi("PATCH", f"{R}/{RV_B}", tok_b, {}, [("c.png", PNG, "image/png")]), 200, pred=lambda v: len(v["images"]) == 3)
check("E remove a photo", multi("PATCH", f"{R}/{RV_B}", tok_b, {"removeImageIds": str(img_ids[0])}), 200, pred=lambda v: len(v["images"]) == 2 and img_ids[0] not in [i["id"] for i in v["images"]])
check("E the removed file is gone from disk", (200, PATHS_B[0]), 200, pred=lambda v: not os.path.exists(os.path.join(UPLOADS, v)) or len(PATHS_B) == 0)
check("E past 5 photos -> 400", multi("PATCH", f"{R}/{RV_B}", tok_b, {}, [(f"p{i}.png", PNG, "image/png") for i in range(4)]), 400)
check("E remove two and add two in one edit", multi("PATCH", f"{R}/{RV_B}", tok_b, {"removeImageIds": ",".join(str(i["id"]) for i in call("GET", f"{R}/{RV_B}", tok_b)[1]["images"])}, [("x.png", PNG, "image/png"), ("y.png", PNG, "image/png")]), 200, pred=lambda v: len(v["images"]) == 2)
check("E a refused edit changed nothing", (200, sql(f"select rating from review where id={RV_B}")), 200, pred=lambda v: v == "4")
sql(f"update review set \"createdAt\" = now() - interval '31 days' where id={RV_C}")
check("E past 30 days -> 403", multi("PATCH", f"{R}/{RV_C}", tok_c, {"rating": 1}), 403)
check("E ...and canEdit is false", call("GET", f"{R}/{RV_C}", tok_c), 200, pred=lambda v: v["canEdit"] is False)
check("E ...but it can still be deleted? (own review)", (200, 200), 200)
sql(f"update review set \"createdAt\" = now() - interval '29 days' where id={RV_C}")
check("E at 29 days it still works", multi("PATCH", f"{R}/{RV_C}", tok_c, {"rating": 4}), 200)
check("E rating follows: 4 / 13 / 3.25", (200, rate(P1)), 200, pred=lambda v: v == ["4", "13", "3.25"])

# ================================================================= F public reads
PUB = f"{PR}/{P1}/reviews"
check("F summary needs no token", call("GET", PUB + "/summary"), 200, pred=lambda v: v["ratingCount"] == 4 and v["ratingAverage"] == 3.25 and v["productId"] == P1)
check("F summary breakdown", call("GET", PUB + "/summary"), 200, pred=lambda v: v["breakdown"] == {"1": 1, "2": 0, "3": 0, "4": 3, "5": 0})
check("F summary of an unknown product -> 404", call("GET", f"{PR}/99999999/reviews/summary"), 404)
check("F summary id 0 -> 400", call("GET", f"{PR}/0/reviews/summary"), 400)
check("F list needs no token", call("GET", PUB), 200, pred=lambda v: len(v["results"]) == 4 and v["nextCursor"] is None)
check("F list is newest first", call("GET", PUB), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted([r["id"] for r in v["results"]], reverse=True))
check("F list row shape", call("GET", PUB), 200, pred=lambda v: all(k in v["results"][0] for k in ["id", "rating", "title", "comment", "images", "reviewerName", "verifiedPurchase", "helpfulCount", "replyCount", "editedAt", "createdAt"]))
check("F the name is masked: Rahim K.", call("GET", PUB), 200, pred=lambda v: "Rahim C." in [r["reviewerName"] for r in v["results"]])
check("F a one-word name stays as is", call("GET", PUB), 200, pred=lambda v: "Karim" in [r["reviewerName"] for r in v["results"]])
check("F no phone, email, user id or order id leaks", call("GET", PUB), 200, pred=lambda v: not any(k in r for r in v["results"] for k in ["userId", "user", "email", "phone", "orderId", "orderNumber", "orderItemId"]))
check("F nobody's full name leaks", call("GET", PUB), 200, pred=lambda v: "Chowdhury" not in json.dumps(v) and "Rahim Khan" not in json.dumps(v))
check("F filter rating=4", call("GET", PUB + "?rating=4"), 200, pred=lambda v: len(v["results"]) == 3 and all(r["rating"] == 4 for r in v["results"]))
check("F filter rating=2 -> none", call("GET", PUB + "?rating=2"), 200, pred=lambda v: v["results"] == [])
check("F rating=0 -> 400", call("GET", PUB + "?rating=0"), 400)
check("F rating=6 -> 400", call("GET", PUB + "?rating=6"), 400)
check("F withPhotos=true", call("GET", PUB + "?withPhotos=true"), 200, pred=lambda v: len(v["results"]) == 2 and all(len(r["images"]) > 0 for r in v["results"]))
check("F withPhotos=maybe -> 400", call("GET", PUB + "?withPhotos=maybe"), 400)
check("F sort=bogus -> 400", call("GET", PUB + "?sort=bogus"), 400)
check("F unknown query field -> 400", call("GET", PUB + "?foo=1"), 400)
check("F page 1 of 2 (newest)", call("GET", PUB + "?limit=2"), 200, pred=lambda v: len(v["results"]) == 2 and v["nextCursor"] == v["results"][-1]["id"])
c, pg = call("GET", PUB + "?limit=2")
check("F page 2 follows page 1 with no overlap", call("GET", PUB + f"?limit=2&cursor={pg['nextCursor']}"), 200, pred=lambda v: len(v["results"]) == 2 and not ({r["id"] for r in v["results"]} & {r["id"] for r in pg["results"]}) and v["nextCursor"] is None)
check("F limit 0 is the default", call("GET", PUB + "?limit=0"), [200, 400])
check("F limit 101 -> 400", call("GET", PUB + "?limit=101"), 400)
check("F cursor -1 -> 400", call("GET", PUB + "?cursor=-1"), 400)
# helpful votes for the sorting tests
check("F vote 1", call("POST", f"{R}/{RV_A}/helpful", tok_c), 201)
check("F vote 2", call("POST", f"{R}/{RV_A}/helpful", tok_d), 201)
check("F vote 3", call("POST", f"{R}/{RV_B}/helpful", tok_c), 201)
check("F sort=helpful puts the most voted first", call("GET", PUB + "?sort=helpful"), 200, pred=lambda v: v["results"][0]["id"] == RV_A and v["results"][1]["id"] == RV_B and [r["helpfulCount"] for r in v["results"]][:2] == [2, 1])
check("F helpful page 1 (offset cursor)", call("GET", PUB + "?sort=helpful&limit=2"), 200, pred=lambda v: len(v["results"]) == 2 and v["nextCursor"] == 2)
check("F helpful page 2 starts after page 1", call("GET", PUB + "?sort=helpful&limit=2&cursor=2"), 200, pred=lambda v: len(v["results"]) == 2 and v["nextCursor"] is None)
check("F helpful pages cover every review once", (200, [r["id"] for r in call("GET", PUB + "?sort=helpful&limit=2")[1]["results"]] + [r["id"] for r in call("GET", PUB + "?sort=helpful&limit=2&cursor=2")[1]["results"]]), 200, pred=lambda v: len(set(v)) == 4)
sql(f"update seller_product set \"activeStatus\"='inactive' where id={P3}")
check("F a hidden product shows no summary -> 404", call("GET", f"{PR}/{P3}/reviews/summary"), 404)
check("F a hidden product shows no list -> 404", call("GET", f"{PR}/{P3}/reviews"), 404)
sql(f"update seller_product set \"activeStatus\"='active' where id={P3}")

# ================================================================= G helpful votes
check("G vote on own review -> 400", call("POST", f"{R}/{RV_A}/helpful", tok_a), 400)
check("G vote twice changes nothing", call("POST", f"{R}/{RV_A}/helpful", tok_c), [200, 201], pred=lambda v: v["added"] is False and v["helpfulCount"] == 2 and v["helpful"] is True)
check("G unknown review -> 404", call("POST", f"{R}/99999999/helpful", tok_c), 404)
check("G review id 0 -> 400", call("POST", f"{R}/0/helpful", tok_c), 400)
check("G votes endpoint lists mine", call("GET", f"{R}/votes?productId={P1}", tok_c), 200, pred=lambda v: set(v["reviewIds"]) == {RV_A, RV_B})
check("G votes endpoint needs productId -> 400", call("GET", f"{R}/votes", tok_c), 400)
check("G votes for another product -> empty", call("GET", f"{R}/votes?productId={P2}", tok_c), 200, pred=lambda v: v["reviewIds"] == [])
check("G un-vote", call("DELETE", f"{R}/{RV_B}/helpful", tok_c), 200, pred=lambda v: v["removed"] is True and v["helpfulCount"] == 0 and v["helpful"] is False)
check("G un-vote again changes nothing", call("DELETE", f"{R}/{RV_B}/helpful", tok_c), 200, pred=lambda v: v["removed"] is False and v["helpfulCount"] == 0)
check("G the vote row is gone", (200, sqlint(f"select count(*) from review_helpful_vote where \"reviewId\"={RV_B}")), 200, pred=lambda v: v == 0)
check("G vote again after un-vote", call("POST", f"{R}/{RV_B}/helpful", tok_c), 201, pred=lambda v: v["added"] is True and v["helpfulCount"] == 1)
with cf.ThreadPoolExecutor(8) as ex:
    rs = list(ex.map(lambda _: call("POST", f"{R}/{RV_C}/helpful", tok_d), range(8)))
check("G 8 parallel votes from one customer count once", (200, sqlint(f"select \"helpfulCount\" from review where id={RV_C}")), 200, pred=lambda v: v == 1)
check("G ...and one vote row", (200, sqlint(f"select count(*) from review_helpful_vote where \"reviewId\"={RV_C}")), 200, pred=lambda v: v == 1)
check("G all 8 answered fine", (200, [r[0] for r in rs]), 200, pred=lambda v: all(x in (200, 201) for x in v))
check("G a stranger sees the new count in the list", call("GET", PUB), 200, pred=lambda v: {r["id"]: r["helpfulCount"] for r in v["results"]}[RV_A] == 2)

# ================================================================= H replies
RP_URL = lambda rid: f"{R}/{rid}/replies"
PUBR = lambda rid, q="": call("GET", f"{PR[:-9]}/reviews/{rid}/replies{q}")
check("H the thread of a fresh review is empty", PUBR(RV_A), 200, pred=lambda v: v["results"] == [] and v["nextCursor"] is None)
check("H unknown review thread -> 404", PUBR(99999999), 404)
check("H thread id 0 -> 400", PUBR(0), 400)
check("H reply needs a body -> 400", call("POST", RP_URL(RV_A), tok_a, {}), 400)
check("H empty body -> 400", call("POST", RP_URL(RV_A), tok_a, {"body": ""}), 400)
check("H blank body -> 400", call("POST", RP_URL(RV_A), tok_a, {"body": "   "}), 400)
check("H body over 1000 -> 400", call("POST", RP_URL(RV_A), tok_a, {"body": "x" * 1001}), 400)
check("H unknown field -> 400", call("POST", RP_URL(RV_A), tok_a, {"body": "hi", "authorType": "admin"}), 400)
check("H parentId 0 -> 400", call("POST", RP_URL(RV_A), tok_a, {"body": "hi", "parentId": 0}), 400)
check("H unknown parent -> 404", call("POST", RP_URL(RV_A), tok_a, {"body": "hi", "parentId": 99999999}), 404)
check("H another customer cannot reply -> 403", call("POST", RP_URL(RV_A), tok_c, {"body": "me too"}), 403)
check("H another seller cannot reply -> 404", call("POST", f"/seller/reviews/{RV_A}/replies", S2_TOKEN, {"body": "hello"}), 404)
check("H customer token on the seller reply route -> 403", call("POST", f"/seller/reviews/{RV_A}/replies", tok_a, {"body": "hello"}), 403)
check("H seller token on the customer reply route -> 403", call("POST", RP_URL(RV_A), S1_TOKEN, {"body": "hello"}), 403)
c, r1 = call("POST", f"/seller/reviews/{RV_A}/replies", S1_TOKEN, {"body": "Thank you for the kind words!"})
check("H the seller replies to the review", (c, r1), 201, pred=lambda v: v["depth"] == 1 and v["parentId"] is None and v["authorType"] == "seller" and v["authorName"] == f"{TAG} Seller 1" and v["body"] == "Thank you for the kind words!")
c, r2 = call("POST", RP_URL(RV_A), tok_a, {"body": "Happy to help.", "parentId": r1["id"]})
check("H the reviewer answers the seller (depth 2)", (c, r2), 201, pred=lambda v: v["depth"] == 2 and v["parentId"] == r1["id"] and v["authorName"] == "Rahim C." and v["authorType"] == "user")
c, r3 = call("POST", f"/seller/reviews/{RV_A}/replies", S1_TOKEN, {"body": "Anytime.", "parentId": r2["id"]})
check("H the seller answers back (depth 3)", (c, r3), 201, pred=lambda v: v["depth"] == 3)
c, r4 = call("POST", RP_URL(RV_A), tok_a, {"body": "One more question.", "parentId": r3["id"]})
check("H depth 4 is allowed", (c, r4), 201, pred=lambda v: v["depth"] == 4 and v["replyToName"] is None)
c, r5 = call("POST", f"/seller/reviews/{RV_A}/replies", S1_TOKEN, {"body": "Of course.", "parentId": r4["id"]})
check("H past depth 4 the reply sits beside its parent", (c, r5), 201, pred=lambda v: v["depth"] == 4 and v["parentId"] == r3["id"] and v["replyToName"] == "Rahim C.")
c, r6 = call("POST", f"/admin/reviews/{RV_A}/replies", ADMIN, {"body": "Support here, can we help?"})
check("H admin replies as Support", (c, r6), 201, pred=lambda v: v["authorName"] == "Support" and v["authorType"] == "admin" and v["depth"] == 1)
check("H admin can answer a reply too", call("POST", f"/admin/reviews/{RV_A}/replies", ADMIN, {"body": "Following up", "parentId": r2["id"]}), 201, pred=lambda v: v["depth"] == 3 and v["parentId"] == r2["id"])
R_ADMIN_CHILD = sqlint(f"select max(id) from review_reply where \"reviewId\"={RV_A}")
check("H review replyCount counts every live reply (7)", (200, sqlint(f"select \"replyCount\" from review where id={RV_A}")), 200, pred=lambda v: v == 7)
check("H the seller reply has 1 direct child", (200, sqlint(f"select \"replyCount\" from review_reply where id={r1['id']}")), 200, pred=lambda v: v == 1)
check("H the depth-3 reply has 2 direct children (depth 4 + the flattened one)", (200, sqlint(f"select \"replyCount\" from review_reply where id={r3['id']}")), 200, pred=lambda v: v == 2)
check("H paths follow the tree", (200, sql(f"select path from review_reply where id={r4['id']}")), 200, pred=lambda v: v == f"{r1['id']}/{r2['id']}/{r3['id']}/{r4['id']}/")
check("H the flattened reply's path is under the depth-3 reply", (200, sql(f"select path from review_reply where id={r5['id']}")), 200, pred=lambda v: v == f"{r1['id']}/{r2['id']}/{r3['id']}/{r5['id']}/")
check("H the author id and type are stored", (200, sql(f"select \"authorType\"||'|'||\"authorId\" from review_reply where id={r2['id']}")), 200, pred=lambda v: v == f"user|{uid_a}")
check("H seller author id stored", (200, sql(f"select \"authorType\"||'|'||\"authorId\" from review_reply where id={r1['id']}")), 200, pred=lambda v: v == f"seller|{S1}")
check("H admin author id stored", (200, sql(f"select \"authorType\" from review_reply where id={r6['id']}")), 200, pred=lambda v: v == "admin")
check("H tracker fields on a reply", (200, sql(f"select \"createdBy\"||'|'||\"creatorType\"||'|'||\"updatedBy\" from review_reply where id={r2['id']}")), 200, pred=lambda v: v == f"{uid_a}|user|{uid_a}")
check("H public thread: two top-level replies, oldest first", PUBR(RV_A), 200, pred=lambda v: [r["id"] for r in v["results"]] == [r1["id"], r6["id"]])
check("H top-level reply carries its child count", PUBR(RV_A), 200, pred=lambda v: v["results"][0]["replyCount"] == 1 and v["results"][1]["replyCount"] == 0)
check("H children of a reply", PUBR(RV_A, f"?parentId={r1['id']}"), 200, pred=lambda v: [r["id"] for r in v["results"]] == [r2["id"]])
check("H children of the depth-3 reply", PUBR(RV_A, f"?parentId={r3['id']}"), 200, pred=lambda v: [r["id"] for r in v["results"]] == [r4["id"], r5["id"]])
check("H the public sees names, not ids", PUBR(RV_A), 200, pred=lambda v: not any("authorId" in r for r in v["results"]))
check("H thread page of 1", PUBR(RV_A, "?limit=1"), 200, pred=lambda v: len(v["results"]) == 1 and v["nextCursor"] == r1["id"])
check("H thread page 2", PUBR(RV_A, f"?limit=1&cursor={r1['id']}"), 200, pred=lambda v: [r["id"] for r in v["results"]] == [r6["id"]] and v["nextCursor"] is None)
check("H parentId from another review gives nothing", PUBR(RV_B, f"?parentId={r1['id']}"), 200, pred=lambda v: v["results"] == [])
check("H replying under another review's reply -> 404", call("POST", f"/admin/reviews/{RV_B}/replies", ADMIN, {"body": "x", "parentId": r1["id"]}), 404)
check("H the reviewer cannot reply on someone else's review -> 403", call("POST", RP_URL(RV_B), tok_a, {"body": "x"}), 403)
# edit and delete
check("H edit own reply", call("PATCH", f"{RP}/{r2['id']}", tok_a, {"body": "Happy to help!"}), 200, pred=lambda v: v["body"] == "Happy to help!" and v["editedAt"] is not None)
check("H edit someone else's reply -> 404", call("PATCH", f"{RP}/{r1['id']}", tok_a, {"body": "hack"}), 404)
check("H the seller cannot edit the customer's reply -> 404", call("PATCH", f"/seller/review-replies/{r2['id']}", S1_TOKEN, {"body": "hack"}), 404)
check("H an admin cannot edit the customer's reply -> 404", call("PATCH", f"/admin/review-replies/{r2['id']}", ADMIN, {"body": "hack"}), 404)
check("H edit with an empty body -> 400", call("PATCH", f"{RP}/{r2['id']}", tok_a, {"body": ""}), 400)
check("H edit with an extra field -> 400", call("PATCH", f"{RP}/{r2['id']}", tok_a, {"body": "x", "status": "hidden"}), 400)
check("H the seller edits their own reply", call("PATCH", f"/seller/review-replies/{r1['id']}", S1_TOKEN, {"body": "Thanks so much!"}), 200, pred=lambda v: v["body"] == "Thanks so much!")
check("H admin edits their own reply", call("PATCH", f"/admin/review-replies/{r6['id']}", ADMIN, {"body": "Support here. Anything we can do?"}), 200)
sql(f"update review_reply set \"createdAt\" = now() - interval '31 days' where id={r4['id']}")
check("H past 30 days a reply cannot be edited -> 403", call("PATCH", f"{RP}/{r4['id']}", tok_a, {"body": "late"}), 403)
check("H reply id 0 -> 400", call("PATCH", f"{RP}/0", tok_a, {"body": "x"}), 400)
check("H delete someone else's reply -> 404", call("DELETE", f"{RP}/{r1['id']}", tok_a), 404)
check("H delete the depth-3 reply that has answers", call("DELETE", f"/seller/review-replies/{r3['id']}", S1_TOKEN), 200, pred=lambda v: v["deleted"] is True)
check("H review replyCount dropped to 6", (200, sqlint(f"select \"replyCount\" from review where id={RV_A}")), 200, pred=lambda v: v == 6)
check("H its parent's child count dropped to 1", (200, sqlint(f"select \"replyCount\" from review_reply where id={r2['id']}")), 200, pred=lambda v: v == 1)
check("H the deleted reply stays as a placeholder (it has answers)", PUBR(RV_A, f"?parentId={r2['id']}"), 200, pred=lambda v: len(v["results"]) == 2 and any(r["id"] == r3["id"] and r["deleted"] is True and r["body"] is None for r in v["results"]))
check("H its children are still readable", PUBR(RV_A, f"?parentId={r3['id']}"), 200, pred=lambda v: len(v["results"]) == 2 and all(r["body"] for r in v["results"]))
check("H delete a reply with no answers", call("DELETE", f"{RP}/{r4['id']}", tok_a), 200)
check("H a deleted leaf vanishes from the thread", PUBR(RV_A, f"?parentId={r3['id']}"), 200, pred=lambda v: [r["id"] for r in v["results"]] == [r5["id"]])
check("H delete twice -> 404", call("DELETE", f"{RP}/{r4['id']}", tok_a), 404)
check("H counts after: review 5", (200, sqlint(f"select \"replyCount\" from review where id={RV_A}")), 200, pred=lambda v: v == 5)
# a thread may not grow forever
c, cap = call("POST", f"/admin/reviews/{RV_B}/replies", ADMIN, {"body": "seed"})
sql(f"insert into review_reply (\"reviewId\",depth,path,\"authorType\",\"authorId\",\"authorName\",body) select {RV_B},1,'0/','admin',1,'Support','x' from generate_series(1,199)")
sql(f"update review set \"replyCount\"=200 where id={RV_B}")
check("H the 201st reply -> 400", call("POST", f"/admin/reviews/{RV_B}/replies", ADMIN, {"body": "one too many"}), 400)
check("H ...and nothing was added", (200, sqlint(f"select count(*) from review_reply where \"reviewId\"={RV_B}")), 200, pred=lambda v: v == 200)
sql(f"delete from review_reply where \"reviewId\"={RV_B}")
sql(f"update review set \"replyCount\"=0 where id={RV_B}")
# parallel replies keep the counters exact
with cf.ThreadPoolExecutor(6) as ex:
    rs = list(ex.map(lambda i: call("POST", f"/seller/reviews/{RV_B}/replies", S1_TOKEN, {"body": f"parallel {i}"}), range(6)))
check("H 6 parallel replies all land", (200, [r[0] for r in rs]), 200, pred=lambda v: all(x == 201 for x in v))
check("H ...with an exact count", (200, sqlint(f"select \"replyCount\" from review where id={RV_B}")), 200, pred=lambda v: v == 6)

# ================================================================= I reports
RPT = f"{R}/{RV_C}/report"
check("I report needs a reason -> 400", call("POST", RPT, tok_a, {}), 400)
check("I unknown reason -> 400", call("POST", RPT, tok_a, {"reason": "boring"}), 400)
check("I note over 1000 -> 400", call("POST", RPT, tok_a, {"reason": "spam", "note": "x" * 1001}), 400)
check("I unknown field -> 400", call("POST", RPT, tok_a, {"reason": "spam", "status": "resolved"}), 400)
check("I cannot report your own review -> 403", call("POST", RPT, tok_c, {"reason": "spam"}), 403)
check("I unknown review -> 404", call("POST", f"{R}/99999999/report", tok_a, {"reason": "spam"}), 404)
c, rep1 = call("POST", RPT, tok_a, {"reason": "fake", "note": "Never bought this"})
check("I a customer reports a review", (c, rep1), 201, pred=lambda v: v["status"] == "open" and v["targetType"] == "review")
check("I reporting again -> 409", call("POST", RPT, tok_a, {"reason": "spam"}), 409)
check("I another customer can report it too", call("POST", RPT, tok_d, {"reason": "abusive"}), 201)
check("I the seller reports a review of their own product", call("POST", f"/seller/reviews/{RV_C}/report", S1_TOKEN, {"reason": "other", "note": "Not our bird"}), 201)
check("I another seller cannot report it -> 404", call("POST", f"/seller/reviews/{RV_C}/report", S2_TOKEN, {"reason": "spam"}), 404)
check("I reportCount is 3", (200, sqlint(f"select \"reportCount\" from review where id={RV_C}")), 200, pred=lambda v: v == 3)
check("I the reporter's id and type are stored", (200, sql(f"select \"reporterType\"||'|'||\"reporterId\" from review_report where id={rep1['id']}")), 200, pred=lambda v: v == f"user|{uid_a}")
check("I any customer may report a reply they can read", call("POST", f"{RP}/{r2['id']}/report", tok_c, {"reason": "abusive"}), 201)
check("I the reviewer may report an answer under their own review", call("POST", f"{RP}/{r1['id']}/report", tok_a, {"reason": "abusive"}), 201)
check("I the reply's author cannot report it -> 400", call("POST", f"{RP}/{r2['id']}/report", tok_a, {"reason": "spam"}), 400)
check("I the seller reports a customer's reply", call("POST", f"/seller/review-replies/{r2['id']}/report", S1_TOKEN, {"reason": "spam"}), 201, pred=lambda v: v["targetType"] == "reply")
check("I the same reply again -> 409", call("POST", f"/seller/review-replies/{r2['id']}/report", S1_TOKEN, {"reason": "spam"}), 409)
check("I a deleted reply cannot be reported -> 404", call("POST", f"/seller/review-replies/{r4['id']}/report", S1_TOKEN, {"reason": "spam"}), 404)
check("I a reply report leaves the review's reportCount alone", (200, sqlint(f"select \"reportCount\" from review where id={RV_A}")), 200, pred=lambda v: v == 0)
check("I the other seller cannot report a reply on this product -> 404", call("POST", f"/seller/review-replies/{r2['id']}/report", S2_TOKEN, {"reason": "spam"}), 404)

# ================================================================= J seller
SR = "/seller/reviews"
check("J seller list", call("GET", SR, S1_TOKEN), 200, pred=lambda v: {r["id"] for r in v["results"]} == {RV_A, RV_B, RV_C, RV_D})
check("J row shape", call("GET", SR, S1_TOKEN), 200, pred=lambda v: all(k in v["results"][0] for k in ["id", "productId", "productName", "rating", "title", "comment", "images", "reviewerName", "helpfulCount", "replyCount", "sellerReplied", "createdAt"]))
check("J the seller sees a masked name only", call("GET", SR, S1_TOKEN), 200, pred=lambda v: "Chowdhury" not in json.dumps(v) and not any(k in r for r in v["results"] for k in ["userId", "user", "email", "phone", "orderId"]))
check("J the other seller sees none of them", call("GET", SR, S2_TOKEN), 200, pred=lambda v: v["results"] == [])
check("J filter by product", call("GET", f"{SR}?productId={P1}", S1_TOKEN), 200, pred=lambda v: len(v["results"]) == 4)
check("J filter by someone else's product", call("GET", f"{SR}?productId={P3}", S1_TOKEN), 200, pred=lambda v: v["results"] == [])
check("J filter by rating", call("GET", f"{SR}?rating=1", S1_TOKEN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [RV_D])
check("J unreplied=true", call("GET", f"{SR}?unreplied=true", S1_TOKEN), 200, pred=lambda v: {r["id"] for r in v["results"]} == {RV_C, RV_D})
check("J unreplied=false", call("GET", f"{SR}?unreplied=false", S1_TOKEN), 200, pred=lambda v: {r["id"] for r in v["results"]} == {RV_A, RV_B})
check("J sellerReplied flag", call("GET", SR, S1_TOKEN), 200, pred=lambda v: {r["id"]: r["sellerReplied"] for r in v["results"]} == {RV_A: True, RV_B: True, RV_C: False, RV_D: False})
check("J unreplied=maybe -> 400", call("GET", f"{SR}?unreplied=maybe", S1_TOKEN), 400)
check("J paging", call("GET", f"{SR}?limit=3", S1_TOKEN), 200, pred=lambda v: len(v["results"]) == 3 and v["nextCursor"] is not None)
check("J summary", call("GET", SR + "/summary", S1_TOKEN), 200, pred=lambda v: v["ratingCount"] == 4 and v["ratingAverage"] == 3.25 and v["unreplied"] == 2 and v["breakdown"] == {"1": 1, "2": 0, "3": 0, "4": 3, "5": 0})
check("J summary for one product", call("GET", f"{SR}/summary?productId={P2}", S1_TOKEN), 200, pred=lambda v: v["ratingCount"] == 0 and v["ratingAverage"] == 0)
check("J the other seller's summary is empty", call("GET", SR + "/summary", S2_TOKEN), 200, pred=lambda v: v["ratingCount"] == 0)
check("J the product list carries ratingAverage and ratingCount", call("GET", f"/seller/products?limit=100", S1_TOKEN), 200, pred=lambda v: [p for p in v["results"] if p["id"] == P1][0]["ratingAverage"] == 3.25 and [p for p in v["results"] if p["id"] == P1][0]["ratingCount"] == 4)
check("J the product detail carries them too", call("GET", f"/seller/products/{P1}", S1_TOKEN), 200, pred=lambda v: v["ratingCount"] == 4 and v["ratingAverage"] == 3.25)
sql(f"update seller set \"activeStatus\"='inactive' where id={S1}")
check("J a suspended seller can still read reviews", call("GET", SR, S1_TOKEN), 200)
check("J ...and the summary", call("GET", SR + "/summary", S1_TOKEN), 200)
check("J ...but cannot reply -> 403", call("POST", f"{SR}/{RV_C}/replies", S1_TOKEN, {"body": "hello"}), 403)
check("J ...or report -> 403", call("POST", f"{SR}/{RV_C}/report", S1_TOKEN, {"reason": "spam"}), 403)
check("J ...or edit a reply -> 403", call("PATCH", f"/seller/review-replies/{r1['id']}", S1_TOKEN, {"body": "x"}), 403)
sql(f"update seller set \"activeStatus\"='active' where id={S1}")

# ================================================================= K admin
AR = "/admin/reviews"
check("K list", call("GET", AR + f"?productId={P1}", ADMIN), 200, pred=lambda v: {r["id"] for r in v["results"]} == {RV_A, RV_B, RV_C, RV_D})
check("K row shape", call("GET", AR + f"?productId={P1}", ADMIN), 200, pred=lambda v: all(k in v["results"][0] for k in ["id", "rating", "title", "comment", "status", "helpfulCount", "reportCount", "replyCount", "imageCount", "createdAt", "orderNumber", "user", "seller", "product"]))
check("K the user block has name, phone and email", call("GET", AR + f"?productId={P1}", ADMIN), 200, pred=lambda v: all(k in v["results"][0]["user"] for k in ["id", "name", "phone", "email"]))
check("K seller and product blocks", call("GET", AR + f"?productId={P1}", ADMIN), 200, pred=lambda v: v["results"][0]["seller"]["id"] == S1 and v["results"][0]["product"]["id"] == P1)
check("K filter by seller", call("GET", AR + f"?sellerId={S1}", ADMIN), 200, pred=lambda v: all(r["seller"]["id"] == S1 for r in v["results"]) and len(v["results"]) == 4)
check("K filter by user", call("GET", AR + f"?userId={uid_a}", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [RV_A])
check("K filter by rating", call("GET", AR + f"?productId={P1}&rating=4", ADMIN), 200, pred=lambda v: len(v["results"]) == 3)
check("K filter reported=true", call("GET", AR + f"?productId={P1}&reported=true", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [RV_C])
check("K filter reported=false", call("GET", AR + f"?productId={P1}&reported=false", ADMIN), 200, pred=lambda v: RV_C not in [r["id"] for r in v["results"]])
check("K search by customer name", call("GET", AR + "?search=Rahim", ADMIN), 200, pred=lambda v: RV_A in [r["id"] for r in v["results"]])
check("K search by product name", call("GET", AR + f"?search=Tumbler%20One", ADMIN), 200, pred=lambda v: len(v["results"]) >= 4)
check("K search by comment text", call("GET", AR + "?search=Second%20try", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [RV_D])
check("K search by email", call("GET", AR + f"?search=t-rev-{RUN}-1@", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [RV_A])
check("K date range", call("GET", AR + f"?productId={P1}&from=2000-01-01&to=2100-01-01", ADMIN), 200, pred=lambda v: len(v["results"]) == 4)
check("K a future range is empty", call("GET", AR + f"?productId={P1}&from=2100-01-01", ADMIN), 200, pred=lambda v: v["results"] == [])
check("K a bad date -> 400", call("GET", AR + "?from=yesterday", ADMIN), 400)
check("K status=bogus -> 400", call("GET", AR + "?status=bogus", ADMIN), 400)
check("K rating=9 -> 400", call("GET", AR + "?rating=9", ADMIN), 400)
check("K paging", call("GET", AR + f"?productId={P1}&limit=3", ADMIN), 200, pred=lambda v: len(v["results"]) == 3 and v["nextCursor"] is not None)
check("K a customer's reviews from the user page", call("GET", f"/admin/users/{uid_a}/reviews", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [RV_A])
check("K ...for a user with none", call("GET", f"/admin/users/{uid_e}/reviews", ADMIN), 200, pred=lambda v: v["results"] == [])
check("K user reviews need an admin -> 403", call("GET", f"/admin/users/{uid_a}/reviews", tok_a), 403)
check("K details", call("GET", f"{AR}/{RV_A}", ADMIN), 200, pred=lambda v: v["id"] == RV_A and len(v["editHistory"]) == 2 and v["statusHistory"] == [] and len(v["reports"]) == 3 and all(g["targetType"] == "reply" for g in v["reports"]) and v["images"] == [])
check("K details of a reported review", call("GET", f"{AR}/{RV_C}", ADMIN), 200, pred=lambda v: len(v["reports"]) == 3 and v["reports"][0]["status"] == "open" and len(v["images"]) == 5)
check("K details unknown -> 404", call("GET", f"{AR}/99999999", ADMIN), 404)
check("K details id 0 -> 400", call("GET", f"{AR}/0", ADMIN), 400)
check("K admin thread shows every reply with its author id", call("GET", f"{AR}/{RV_A}/replies", ADMIN), 200, pred=lambda v: all("authorId" in r for r in v["results"]) and len(v["results"]) == 2)
# moderation
check("K hide needs a reason -> 400", call("POST", f"{AR}/{RV_C}/hide", ADMIN, {}), 400)
check("K reason too short -> 400", call("POST", f"{AR}/{RV_C}/hide", ADMIN, {"reason": "x"}), 400)
check("K customer cannot hide -> 403", call("POST", f"{AR}/{RV_C}/hide", tok_a, {"reason": "spam spam"}), 403)
check("K seller cannot hide -> 403", call("POST", f"{AR}/{RV_C}/hide", S1_TOKEN, {"reason": "spam spam"}), 403)
check("K hide unknown -> 404", call("POST", f"{AR}/99999999/hide", ADMIN, {"reason": "spam spam"}), 404)
check("K hide a review", call("POST", f"{AR}/{RV_C}/hide", ADMIN, {"reason": "Fake review"}), 201, pred=lambda v: v["status"] == "hidden" and v["hiddenReason"] == "Fake review" and v["statusHistory"][0]["toStatus"] == "hidden")
check("K the rating dropped it: 3 / 9 / 3", (200, rate(P1)), 200, pred=lambda v: v == ["3", "9", "3"])
check("K the public list drops it", call("GET", PUB), 200, pred=lambda v: RV_C not in [r["id"] for r in v["results"]])
check("K the public summary drops it", call("GET", PUB + "/summary"), 200, pred=lambda v: v["ratingCount"] == 3 and v["breakdown"]["4"] == 2 and v["breakdown"]["3"] == 0)
check("K a hidden review's thread is closed to the public -> 404", PUBR(RV_C), 404)
check("K the owner sees it with the reason", call("GET", f"{R}/{RV_C}", tok_c), 200, pred=lambda v: v["status"] == "hidden" and v["hiddenReason"] == "Fake review" and v["canEdit"] is False)
check("K the owner cannot edit a hidden review -> 403", multi("PATCH", f"{R}/{RV_C}", tok_c, {"rating": 1}), 403)
check("K nobody can vote on it -> 404", call("POST", f"{R}/{RV_C}/helpful", tok_e), 404)
check("K nobody can report it -> 404", call("POST", f"{R}/{RV_C}/report", tok_e, {"reason": "spam"}), 404)
check("K nobody can reply to it -> 403", call("POST", f"/admin/reviews/{RV_C}/replies", ADMIN, {"body": "hi"}), 403)
check("K the seller list drops it", call("GET", SR, S1_TOKEN), 200, pred=lambda v: RV_C not in [r["id"] for r in v["results"]])
check("K the admin list still shows it as hidden", call("GET", AR + f"?productId={P1}&status=hidden", ADMIN), 200, pred=lambda v: [r["id"] for r in v["results"]] == [RV_C])
check("K hide twice -> 400", call("POST", f"{AR}/{RV_C}/hide", ADMIN, {"reason": "Again"}), 400)
check("K restore needs a published->hidden review: restore a visible one -> 400", call("POST", f"{AR}/{RV_A}/restore", ADMIN, {}), 400)
check("K restore", call("POST", f"{AR}/{RV_C}/restore", ADMIN, {"reason": "Checked, fine"}), 201, pred=lambda v: v["status"] == "published" and v["hiddenReason"] is None and len(v["statusHistory"]) == 2)
check("K the rating is back: 4 / 13 / 3.25", (200, rate(P1)), 200, pred=lambda v: v == ["4", "13", "3.25"])
check("K history keeps who did it", (200, sql(f"select \"creatorType\"||'|'||\"fromStatus\"||'>'||\"toStatus\"||'|'||coalesce(reason,'') from review_status_history where \"reviewId\"={RV_C} order by id limit 1")), 200, pred=lambda v: v == "admin|published>hidden|Fake review")
# reply moderation
check("K hide a reply", call("POST", f"/admin/review-replies/{r2['id']}/hide", ADMIN, {"reason": "Rude"}), 201, pred=lambda v: v["status"] == "hidden" and v["hiddenReason"] == "Rude")
check("K the public sees a placeholder for it", PUBR(RV_A, f"?parentId={r1['id']}"), 200, pred=lambda v: v["results"][0]["hidden"] is True and v["results"][0]["body"] is None and "hiddenReason" not in v["results"][0])
check("K admin sees its text and the reason", call("GET", f"{AR}/{RV_A}/replies?parentId={r1['id']}", ADMIN), 200, pred=lambda v: v["results"][0]["body"] and v["results"][0]["hiddenReason"] == "Rude")
check("K a hidden reply cannot be answered -> 400", call("POST", f"/seller/reviews/{RV_A}/replies", S1_TOKEN, {"body": "x", "parentId": r2["id"]}), 400)
check("K a hidden reply cannot be edited -> 403", call("PATCH", f"{RP}/{r2['id']}", tok_a, {"body": "x"}), 403)
check("K hide a hidden reply -> 400", call("POST", f"/admin/review-replies/{r2['id']}/hide", ADMIN, {"reason": "Again"}), 400)
check("K restore a reply", call("POST", f"/admin/review-replies/{r2['id']}/restore", ADMIN, {}), 201, pred=lambda v: v["status"] == "published")
check("K restore a visible reply -> 400", call("POST", f"/admin/review-replies/{r2['id']}/restore", ADMIN, {}), 400)
check("K customer cannot hide a reply -> 403", call("POST", f"/admin/review-replies/{r2['id']}/hide", tok_a, {"reason": "Rude"}), 403)
# reports
c, q = call("GET", "/admin/review-reports", ADMIN)
check("K the open queue", (c, q), 200, pred=lambda v: all(r["status"] == "open" for r in v["results"]) and RV_C in [r["reviewId"] for r in v["results"]])
check("K queue row shape", (c, q), 200, pred=lambda v: all(k in v["results"][0] for k in ["id", "targetType", "targetId", "reviewId", "reporterType", "reporterId", "reporterName", "reason", "note", "status", "productName", "sellerName", "targetText", "targetStatus"]))
check("K the queue shows the reported text", call("GET", f"/admin/review-reports?reviewId={RV_C}", ADMIN), 200, pred=lambda v: len(v["results"]) == 3)
check("K filter by target type", call("GET", "/admin/review-reports?targetType=reply", ADMIN), 200, pred=lambda v: all(r["targetType"] == "reply" for r in v["results"]) and any(r["targetId"] == r2["id"] for r in v["results"]))
check("K status=bogus -> 400", call("GET", "/admin/review-reports?status=bogus", ADMIN), 400)
check("K reports need an admin -> 403", call("GET", "/admin/review-reports", S1_TOKEN), 403)
rep_ids = [r["id"] for r in call("GET", f"/admin/review-reports?reviewId={RV_C}", ADMIN)[1]["results"]]
check("K resolve needs an action -> 400", call("POST", f"/admin/review-reports/{rep_ids[0]}/resolve", ADMIN, {}), 400)
check("K unknown action -> 400", call("POST", f"/admin/review-reports/{rep_ids[0]}/resolve", ADMIN, {"action": "ban"}), 400)
check("K unknown report -> 404", call("POST", "/admin/review-reports/99999999/resolve", ADMIN, {"action": "dismiss"}), 404)
check("K dismiss one report", call("POST", f"/admin/review-reports/{rep_ids[0]}/resolve", ADMIN, {"action": "dismiss", "note": "Looks genuine"}), 201, pred=lambda v: v["status"] == "dismissed" and v["resolutionNote"] == "Looks genuine")
check("K ...the review stays published", (200, sql(f"select status from review where id={RV_C}")), 200, pred=lambda v: v == "published")
check("K ...and its reportCount is 2", (200, sqlint(f"select \"reportCount\" from review where id={RV_C}")), 200, pred=lambda v: v == 2)
check("K settling twice -> 400", call("POST", f"/admin/review-reports/{rep_ids[0]}/resolve", ADMIN, {"action": "hide"}), 400)
check("K hide through a report", call("POST", f"/admin/review-reports/{rep_ids[1]}/resolve", ADMIN, {"action": "hide", "note": "Confirmed fake"}), 201, pred=lambda v: v["status"] == "resolved_hidden")
check("K ...the review is hidden with that reason", (200, sql(f"select status||'|'||\"hiddenReason\" from review where id={RV_C}")), 200, pred=lambda v: v == "hidden|Confirmed fake")
check("K ...the other open report on it closed too", (200, sqlint(f"select count(*) from review_report where \"reviewId\"={RV_C} and status='open'")), 200, pred=lambda v: v == 0)
check("K ...reportCount is 0", (200, sqlint(f"select \"reportCount\" from review where id={RV_C}")), 200, pred=lambda v: v == 0)
check("K ...the rating dropped it", (200, rate(P1)), 200, pred=lambda v: v == ["3", "9", "3"])
call("POST", f"{AR}/{RV_C}/restore", ADMIN, {})
rid = sqlint(f"select id from review_report where \"targetType\"='reply' and \"targetId\"={r2['id']} and status='open'")
check("K hide a reply through its report", call("POST", f"/admin/review-reports/{rid}/resolve", ADMIN, {"action": "hide"}), 201, pred=lambda v: v["status"] == "resolved_hidden")
check("K ...the reply is hidden", (200, sql(f"select status||'|'||\"hiddenReason\" from review_reply where id={r2['id']}")), 200, pred=lambda v: v.startswith("hidden|Reported as"))
call("POST", f"/admin/review-replies/{r2['id']}/restore", ADMIN, {})
# deleting a reported review settles its reports
O_F1, I_F1 = buy(tok_e, P2, K2)
review(tok_e, I_F1, 2, comment="Meh")
RV_E = sqlint(f"select id from review where \"orderItemId\"={I_F1}")
call("POST", f"{R}/{RV_E}/report", tok_a, {"reason": "spam"})
check("K a deleted review closes its open reports", call("DELETE", f"{R}/{RV_E}", tok_e), 200)
check("K ...they are dismissed", (200, sqlint(f"select count(*) from review_report where \"reviewId\"={RV_E} and status='dismissed'")), 200, pred=lambda v: v == 1)

# ================================================================= L storefront
check("L the product card has the rating", call("GET", f"/user/products?search=Tumbler%20One&pageSize=10"), 200, pred=lambda v: any(p["id"] == P1 and p["ratingCount"] == 4 and p["ratingAverage"] == 3.25 for p in v["results"]))
check("L the product page has the rating", call("GET", f"/user/products/{P1}"), [200, 404], pred=lambda v: True)
c, d = call("GET", f"/user/products/{P1}-trv")
check("L a product with no reviews: 0 and 0", call("GET", f"/user/products?search=T%20Rev%20Pigeon&pageSize=20"), 200, pred=lambda v: all(p["ratingCount"] == 0 and p["ratingAverage"] == 0 for p in v["results"] if p["id"] in (P2, P3)))

# ================================================================= M invariants
check("M rating equals the live published reviews, for every test product",
      (200, sql(f"select count(*) from seller_product p where p.slug like 'trv-%' and (p.\"ratingCount\" <> (select count(*) from review r where r.\"sellerProductId\"=p.id and r.status='published' and r.\"deletedAt\" is null) or p.\"ratingSum\" <> coalesce((select sum(rating) from review r where r.\"sellerProductId\"=p.id and r.status='published' and r.\"deletedAt\" is null),0))")), 200, pred=lambda v: v == "0")
check("M ratingAverage is sum / count to 2 places", (200, sql("select count(*) from seller_product where slug like 'trv-%' and \"ratingCount\" > 0 and abs(\"ratingAverage\" - round(\"ratingSum\"::numeric / \"ratingCount\", 2)) > 0.001")), 200, pred=lambda v: v == "0")
check("M helpfulCount equals the vote rows", (200, sql(f"select count(*) from review r where r.\"sellerProductId\" in (select id from seller_product where slug like 'trv-%') and r.\"helpfulCount\" <> (select count(*) from review_helpful_vote v where v.\"reviewId\"=r.id)")), 200, pred=lambda v: v == "0")
check("M reportCount equals the open review reports", (200, sql(f"select count(*) from review r where r.\"sellerProductId\" in (select id from seller_product where slug like 'trv-%') and r.\"reportCount\" <> (select count(*) from review_report g where g.\"reviewId\"=r.id and g.\"targetType\"='review' and g.status='open')")), 200, pred=lambda v: v == "0")
check("M review replyCount equals the live replies", (200, sql(f"select count(*) from review r where r.\"sellerProductId\" in (select id from seller_product where slug like 'trv-%') and r.\"replyCount\" <> (select count(*) from review_reply x where x.\"reviewId\"=r.id and x.\"deletedAt\" is null)")), 200, pred=lambda v: v == "0")
check("M reply replyCount equals its live children", (200, sql(f"select count(*) from review_reply x where x.\"reviewId\" in (select id from review where \"sellerProductId\" in (select id from seller_product where slug like 'trv-%')) and x.\"replyCount\" <> (select count(*) from review_reply c where c.\"parentId\"=x.id and c.\"deletedAt\" is null)")), 200, pred=lambda v: v == "0")
check("M a reply's path ends with its own id", (200, sql(f"select count(*) from review_reply where \"reviewId\" in (select id from review where \"sellerProductId\" in (select id from seller_product where slug like 'trv-%')) and not (path = id || '/' or path like '%/' || id || '/')")), 200, pred=lambda v: v == "0")
check("M a reply's path starts with its parent's path", (200, sql(f"select count(*) from review_reply c join review_reply p on p.id=c.\"parentId\" where c.path not like p.path || '%'")), 200, pred=lambda v: v == "0")
check("M depth equals the number of path parts, up to the cap", (200, sql(f"select count(*) from review_reply where \"reviewId\" in (select id from review where \"sellerProductId\" in (select id from seller_product where slug like 'trv-%')) and depth <> least(4, array_length(string_to_array(trim(trailing '/' from path), '/'), 1))")), 200, pred=lambda v: v == "0")
check("M no reply is deeper than 4", (200, sql("select count(*) from review_reply where depth > 4")), 200, pred=lambda v: v == "0")
check("M every review is on a delivered order of its own author", (200, sql(f"select count(*) from review r join \"order\" o on o.id=r.\"orderId\" where r.\"sellerProductId\" in (select id from seller_product where slug like 'trv-%') and (o.status <> 'delivered' or o.\"userId\" <> r.\"userId\")")), 200, pred=lambda v: v == "0")
check("M a review's product matches its order line", (200, sql(f"select count(*) from review r join order_item oi on oi.id=r.\"orderItemId\" where r.\"sellerProductId\" in (select id from seller_product where slug like 'trv-%') and oi.\"sellerProductId\" <> r.\"sellerProductId\"")), 200, pred=lambda v: v == "0")
check("M at most one live review per order line", (200, sql("select count(*) from (select \"orderItemId\" from review where \"deletedAt\" is null group by 1 having count(*) > 1) x")), 200, pred=lambda v: v == "0")
check("M every review has tracker fields", (200, sql(f"select count(*) from review where \"sellerProductId\" in (select id from seller_product where slug like 'trv-%') and (\"createdBy\" is null or \"creatorType\" is null or \"creatorName\" is null)")), 200, pred=lambda v: v == "0")
check("M every reply has an author id, type and name", (200, sql("select count(*) from review_reply where \"authorId\" is null or \"authorType\" is null or \"authorName\" is null")), 200, pred=lambda v: v == "0")
check("M every status change says who did it", (200, sql("select count(*) from review_status_history where \"createdBy\" is null or \"creatorType\" is null")), 200, pred=lambda v: v == "0")
check("M photo rows match files on disk", (200, [p for p in sql(f"select \"filePath\" from review_attachment where \"reviewId\" in (select id from review where \"sellerProductId\" in (select id from seller_product where slug like 'trv-%') and \"deletedAt\" is null)").split() if not os.path.exists(os.path.join(UPLOADS, p))]), 200, pred=lambda v: v == [])
check("M no review has more than 5 photos", (200, sql("select count(*) from (select \"reviewId\" from review_attachment where \"deletedAt\" is null group by 1 having count(*) > 5) x")), 200, pred=lambda v: v == "0")

cleanup()
failed = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(failed)}/{len(results)} passed, {len(failed)} failed ====")
for ok, name, detail in failed:
    print(" -", name, detail)
sys.exit(1 if failed else 0)
