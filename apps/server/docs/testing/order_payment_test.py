#!/usr/bin/env python3
"""Black-box tests: marking orders paid (full / partial) with proof files, order updates, admin and seller payment lists."""
import base64, json, os, subprocess, sys, tempfile, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
UPLOADS = os.environ.get("UPLOADS_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
results = []
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
TMP = tempfile.mkdtemp()

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
FILES = {
    "slip.png": (PNG, "image/png"),
    "receipt.pdf": (PDF, "application/pdf"),
    "note.txt": (b"paid by bkash\n", "text/plain"),
}


def call(method, path, token=None, body=None, session=None):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if session is not None:
        cmd += ["-H", f"x-cart-session: {session}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    return run(cmd)


def run(cmd):
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    text, code = out.rsplit("\n", 1)
    try:
        data = json.loads(text) if text else None
    except ValueError:
        data = text
    return int(code), data


def multi(path, token, fields=None, files=None):
    """files: list of (name, bytes, mime); field name is always `files`."""
    cmd = ["curl", "-s", "-g", "-X", "POST", ROOT + path, "-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    for k, v in (fields or {}).items():
        cmd += ["--form-string", f"{k}={v}"]
    for i, (name, data, mime) in enumerate(files or []):
        p = os.path.join(TMP, f"{i}-{uuid.uuid4().hex[:4]}")
        open(p, "wb").write(data)
        cmd += ["-F", f"files=@{p};type={mime};filename={name}"]
    return run(cmd)


def check(name, got, expected, pred=None):
    ok = got[0] in (expected if isinstance(expected, (list, tuple, set)) else [expected])
    note = ""
    if ok and pred is not None:
        try:
            ok = bool(pred(got[1]))
        except Exception as exc:  # noqa
            ok, note = False, f"predicate error: {exc!r}"
    detail = "" if ok else f"expected {expected} got {got[0]} {note} body={str(got[1])[:400]}"
    results.append((ok, name, detail))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  <-- " + detail))


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip()


P_HOMER, S_HOMER_M = 94, 119
CK, OR = "/user/checkout", "/user/orders"


def restore():
    sql("update seller_product_sku set quantity=6, price=3500, \"discountedPrice\"=3200 where id=119")
    sql("update system_setting set value='0' where key='shipping.defaultCharge'")


def cleanup():
    ids = "select id from \"order\" where \"recipientName\" like 'T Pay %'"
    paths = sql(f"select \"filePath\" from payment_attachments where \"orderId\" in ({ids}) union select a.\"filePath\" from order_update_attachments a join order_update u on u.id=a.\"orderUpdateId\" where u.\"orderId\" in ({ids})").split()
    sql(f"delete from \"order_update\" where \"orderId\" in ({ids})")
    sql(f"delete from payment_attachments where \"orderId\" in ({ids})")
    sql(f"delete from payment_status_history where \"orderId\" in ({ids})")
    sql(f"update cart set \"orderId\"=null where \"orderId\" in ({ids})")
    sql(f"delete from payment where \"orderId\" in ({ids})")
    sql("delete from \"order\" where \"recipientName\" like 'T Pay %'")
    sql(f"delete from cart where \"sessionId\" like 'tpay{RUN}%'")
    sql("delete from seller where name like 'T Pay %'")
    for p in paths:
        try:
            os.unlink(os.path.join(UPLOADS, p))
        except OSError:
            pass
    restore()


cleanup()
restore()
c, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]


def seller_token(tag):
    c, d = call("POST", "/seller/auth/register", body={"name": f"T Pay Seller {tag}", "phone": f"+88017{RUN_NUM}{tag}", "password": "Passw0rd!x"})
    assert c == 201, d
    sid = d["seller"]["id"] if "seller" in d else sql(f"select id from seller where name='T Pay Seller {tag}'")
    sql(f"update seller set status='approved', \"activeStatus\"='active' where id={sid}")
    return d["accessToken"], int(sid)


S1, SID1 = seller_token("111")
S2, SID2 = seller_token("222")
c, d = call("POST", "/user/auth/register", body={"name": "T Pay User", "phone": f"+88017{RUN_NUM}333", "password": "Passw0rd!x", "email": f"t-pay-{RUN}@example.com"})
USER = d["accessToken"]


def place(tag, seller_id, qty=2, name="T Pay Buyer"):
    s = f"tpay{RUN}{tag}"
    c, d = call("POST", "/user/carts/items", body={"sellerProductId": P_HOMER, "quantity": qty}, session=s)
    assert c in (200, 201), d
    c, o = call("POST", f"{CK}/{d['cart']['id']}/place", session=s, body={
        "recipientName": name, "recipientPhone": "+8801712345678", "countryCode": "BD", "city": "Dhaka",
        "addressLine": "House 1, Road 2", "deliveryType": "standard", "paymentGatewayId": int(sql("select id from payment_gateway where slug='cash-on-delivery'")),
    })
    assert c == 201, o
    sql(f"update \"order\" set \"sellerId\"={seller_id} where id={o['id']}")
    return o["id"], s, o["totals"]["payable"]


def order_state(oid):
    return sql(f"select \"paymentStatus\"||'|'||\"amountPaid\"::numeric(14,2) from \"order\" where id={oid}")


def detail(oid, s):
    return call("GET", f"{OR}/{oid}", session=s)[1]


ADM, SEL = "/admin/orders", "/seller/orders"
O1, SES1, PAY1 = place("a", SID1)          # 6400 payable
O2, SES2, PAY2 = place("b", SID1)
O3, SES3, PAY3 = place("c", SID2)          # other seller
O4, SES4, PAY4 = place("d", SID1)
f1 = [("slip.png", *FILES["slip.png"])]
good = {"description": "Paid by bKash to the shop number"}

# ================================================================= A validation
check("A no token -> 401", multi(f"{ADM}/{O1}/payments", None, good, f1), 401)
check("A customer token -> 403", multi(f"{ADM}/{O1}/payments", USER, good, f1), 403)
check("A seller token on admin route -> 403", multi(f"{ADM}/{O1}/payments", S1, good, f1), 403)
check("A admin token on seller route -> 403", multi(f"{SEL}/{O1}/payments", ADMIN, good, f1), 403)
check("A unknown order -> 404", multi(f"{ADM}/99999999/payments", ADMIN, good, f1), 404)
check("A bad id -> 400", multi(f"{ADM}/abc/payments", ADMIN, good, f1), 400)
check("A other seller's order -> 404", multi(f"{SEL}/{O3}/payments", S1, good, f1), 404)
check("A no file -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, []), 400, pred=lambda v: "at least one" in v["message"])
check("A no description -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {}, f1), 400)
check("A blank description -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {"description": "   "}, f1), 400)
check("A description too short -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {"description": "ab"}, f1), 400)
check("A description too long -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {"description": "d" * 1001}, f1), 400)
for bad_amount in ["0", "-5", "abc", "10.555", "99999999999", "NaN", "Infinity"]:
    check(f"A amount {bad_amount} -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {**good, "amount": bad_amount}, f1), 400)
check("A amount more than the balance -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {**good, "amount": str(PAY1 + 1)}, f1), 400, pred=lambda v: "balance" in v["message"])
check("A paidAt in the future -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {**good, "paidAt": "2999-01-01"}, f1), 400)
check("A paidAt not a date -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {**good, "paidAt": "yesterday"}, f1), 400)
check("A transactionId too long -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {**good, "transactionId": "t" * 101}, f1), 400)
check("A unknown field -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, {**good, "status": "paid"}, f1), 400)
check("A .exe -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, [("run.exe", b"MZ\x90\x00", "application/octet-stream")]), 400)
check("A .png that is not a png -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, [("x.png", b"not an image at all", "image/png")]), 400)
check("A .pdf that is not a pdf -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, [("x.pdf", PNG, "application/pdf")]), 400)
check("A .html -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, [("x.html", b"<script>1</script>", "text/html")]), 400)
check("A .svg -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, [("x.svg", b"<svg onload=1/>", "image/svg+xml")]), 400)
check("A .txt with binary content -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, [("x.txt", b"ab\x00cd", "text/plain")]), 400)
check("A empty file -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, [("e.png", b"", "image/png")]), 400)
check("A wrong mime for a pdf -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, [("x.pdf", PDF, "text/html")]), 400)
check("A one bad file spoils the lot -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, f1 + [("run.exe", b"MZ", "application/octet-stream")]), 400)
check("A 11 files -> 400", multi(f"{ADM}/{O1}/payments", ADMIN, good, f1 * 11), 400)
check("A nothing changed by failures", (200, order_state(O1) + "|" + sql(f"select count(*) from payment_attachments where \"orderId\"={O1}") + "|" + sql(f"select count(*) from payment where \"orderId\"={O1} and status='due'")), 200, pred=lambda v: v == f"due|0.00|0|1")

# ================================================================= B full payment by admin
c, r = multi(f"{ADM}/{O1}/payments", ADMIN, {**good, "transactionId": "BK-1", "paidAt": "2026-11-01T10:00:00Z"}, [("slip.png", *FILES["slip.png"]), ("receipt.pdf", *FILES["receipt.pdf"])])
check("B admin marks the order paid (balance by default)", (c, r), 201, pred=lambda v: v["orderId"] == O1 and v["paymentId"] > 0)
check("B order is paid, amountPaid = payable", (200, order_state(O1)), 200, pred=lambda v: v == f"paid|{PAY1:.2f}")
d1 = detail(O1, SES1)
check("B the checkout row became the receipt (still one payment row)", (200, d1), 200, pred=lambda v: len(v["payments"]) == 1 and v["payments"][0]["status"] == "paid" and v["payments"][0]["amount"] == PAY1)
check("B description, transaction id and paidAt kept", (200, d1), 200, pred=lambda v: v["payments"][0]["description"] == good["description"] and v["payments"][0]["transactionId"] == "BK-1" and v["payments"][0]["paidAt"].startswith("2026-11-01T10:00"))
check("B two attachments, an image and a file", (200, d1), 200, pred=lambda v: [a["kind"] for a in v["payments"][0]["attachments"]] == ["image", "file"] and v["payments"][0]["attachments"][0]["fileName"] == "slip.png" and v["payments"][0]["attachments"][0]["url"].startswith("http"))
check("B attachments say who uploaded them", (200, d1), 200, pred=lambda v: v["payments"][0]["attachments"][0]["uploadedBy"]["type"] == "admin")
check("B payment history: due then paid", (200, d1), 200, pred=lambda v: [(h["fromStatus"], h["status"]) for h in v["paymentHistory"]] == [(None, "due"), ("due", "paid")])
check("B history rows carry amount, total and who", (200, d1), 200, pred=lambda v: v["paymentHistory"][1]["amount"] == PAY1 and v["paymentHistory"][1]["amountPaidAfter"] == PAY1 and v["paymentHistory"][1]["by"]["type"] == "admin" and v["paymentHistory"][1]["note"] == good["description"])
check("B totals show nothing due", (200, d1), 200, pred=lambda v: v["totals"]["balanceDue"] == 0 and v["paymentStatus"] == "paid")
check("B the order status is untouched by payment", (200, d1), 200, pred=lambda v: v["status"] == "pending")
check("B paying a paid order -> 409", multi(f"{ADM}/{O1}/payments", ADMIN, good, f1), 409, pred=lambda v: "fully paid" in v["message"])
check("B customer list filters by paid", call("GET", f"{OR}?paymentStatus=paid", session=SES1), 200, pred=lambda v: v["total"] == 1)

# ================================================================= C partial payments by the seller
c, r = multi(f"{SEL}/{O2}/payments", S1, {**good, "amount": "1000"}, f1)
check("C seller records a part payment", (c, r), 201)
check("C order is partially_paid", (200, order_state(O2)), 200, pred=lambda v: v == "partially_paid|1000.00")
d2 = detail(O2, SES2)
check("C balance due shown", (200, d2), 200, pred=lambda v: v["totals"]["amountPaid"] == 1000 and v["totals"]["balanceDue"] == PAY2 - 1000 and v["paymentStatus"] == "partially_paid")
check("C first receipt reused the checkout row, status partially_paid, amount 1000", (200, d2), 200, pred=lambda v: len(v["payments"]) == 1 and v["payments"][0]["status"] == "partially_paid" and v["payments"][0]["amount"] == 1000)
check("C seller named as the uploader", (200, d2), 200, pred=lambda v: v["payments"][0]["attachments"][0]["uploadedBy"] == {"name": "T Pay Seller 111", "type": "seller"})
check("C seller cannot overpay", multi(f"{SEL}/{O2}/payments", S1, {**good, "amount": str(PAY2 - 1000 + 0.5)}, f1), 400)
c, r = multi(f"{SEL}/{O2}/payments", S1, {**good, "amount": "500.50", "transactionId": "BK-2"}, [("note.txt", *FILES["note.txt"])])
check("C a second part payment", (c, r), 201)
d2 = detail(O2, SES2)
check("C second payment is its own row", (200, d2), 200, pred=lambda v: len(v["payments"]) == 2 and v["payments"][1]["amount"] == 500.5 and v["payments"][1]["status"] == "partially_paid" and v["payments"][1]["transactionId"] == "BK-2")
check("C running total 1500.50", (200, order_state(O2)), 200, pred=lambda v: v == "partially_paid|1500.50")
rest = round(PAY2 - 1500.5, 2)
check("C the rest in one go completes it", multi(f"{SEL}/{O2}/payments", S1, good, f1), 201)
d2 = detail(O2, SES2)
check("C order paid; three receipts; last is paid", (200, d2), 200, pred=lambda v: v["paymentStatus"] == "paid" and len(v["payments"]) == 3 and v["payments"][2]["status"] == "paid" and v["payments"][2]["amount"] == rest)
check("C history shows the whole path", (200, d2), 200, pred=lambda v: [h["status"] for h in v["paymentHistory"]] == ["due", "partially_paid", "partially_paid", "paid"] and [h["amountPaidAfter"] for h in v["paymentHistory"]] == [0, 1000, 1500.5, PAY2])
check("C receipts add up to the amount paid", (200, sql(f"select sum(amount) from payment where \"orderId\"={O2} and status<>'due'")), 200, pred=lambda v: float(v) == PAY2)
check("C now fully paid -> 409", multi(f"{SEL}/{O2}/payments", S1, {**good, "amount": "1"}, f1), 409)

# cancelled order
call("POST", f"{OR}/{O4}/cancel", body={}, session=SES4)
check("C a cancelled order cannot take a payment -> 409", multi(f"{ADM}/{O4}/payments", ADMIN, good, f1), 409)
check("C ...and stays due", (200, order_state(O4)), 200, pred=lambda v: v == "due|0.00")

# ================================================================= D order updates
U = lambda oid, token, fields=None, files=None, base=ADM: multi(f"{base}/{oid}/updates", token, fields, files)
check("D no token -> 401", U(O1, None, {"message": "hi"}), 401)
check("D customer -> 403", U(O1, USER, {"message": "hi"}), 403)
check("D empty update -> 400", U(O1, ADMIN), 400)
check("D blank message and no file -> 400", U(O1, ADMIN, {"message": "   "}), 400)
check("D message too long -> 400", U(O1, ADMIN, {"message": "m" * 2001}), 400)
check("D unknown field -> 400", U(O1, ADMIN, {"message": "x", "type": "y"}), 400)
check("D bad file -> 400", U(O1, ADMIN, {"message": "x"}, [("a.exe", b"MZ", "application/octet-stream")]), 400)
check("D 11 files -> 400", U(O1, ADMIN, {"message": "x"}, f1 * 11), 400)
check("D unknown order -> 404", U(99999999, ADMIN, {"message": "x"}), 404)
check("D other seller's order -> 404", U(O3, S1, {"message": "x"}, base=SEL), 404)
check("D admin posts a text update", U(O1, ADMIN, {"message": "Packing today"}), 201, pred=lambda v: v["updateId"] > 0)
check("D seller posts a file-only update", U(O1, S1, None, [("label.pdf", *FILES["receipt.pdf"])], base=SEL), 201)
check("D seller posts text and two files", U(O1, S1, {"message": "Shipped via courier"}, [("a.png", *FILES["slip.png"]), ("b.txt", *FILES["note.txt"])], base=SEL), 201)
d1 = detail(O1, SES1)
check("D customer sees all three updates in order", (200, d1), 200, pred=lambda v: [u["message"] for u in v["updates"]] == ["Packing today", None, "Shipped via courier"])
check("D updates say who and when", (200, d1), 200, pred=lambda v: v["updates"][0]["by"]["type"] == "admin" and v["updates"][1]["by"] == {"name": "T Pay Seller 111", "type": "seller"} and v["updates"][0]["createdAt"])
check("D updates carry their files", (200, d1), 200, pred=lambda v: v["updates"][0]["attachments"] == [] and v["updates"][1]["attachments"][0]["fileName"] == "label.pdf" and [a["kind"] for a in v["updates"][2]["attachments"]] == ["image", "file"])
check("D another customer cannot see them", call("GET", f"{OR}/{O1}", session=SES2), 404)
check("D an order with no updates shows none", (200, detail(O3, SES3)), 200, pred=lambda v: v["updates"] == [])

# ================================================================= E lists and details
AP, SP = "/admin/payments", "/seller/payments"
check("E admin list needs admin -> 401/403", call("GET", AP, token=S1), 403)
check("E no token -> 401", call("GET", AP), 401)
check("E seller list needs seller -> 403", call("GET", SP, token=ADMIN), 403)
c, v = call("GET", f"{AP}?limit=100", ADMIN)
mine = [r for r in v["results"] if r["orderId"] in (O1, O2, O3, O4)]
check("E admin sees payments of every seller", (c, v), 200, pred=lambda v: {r["seller"]["id"] for r in mine} == {SID1, SID2})
check("E row shape", (c, v), 200, pred=lambda v: all(k in mine[0] for k in ["id", "orderNumber", "orderStatus", "seller", "customer", "gateway", "status", "amount", "attachmentCount", "paidAt", "transactionId"]))
check("E newest first", (c, v), 200, pred=lambda v: [r["id"] for r in v["results"]] == sorted([r["id"] for r in v["results"]], reverse=True))
check("E filter status paid", call("GET", f"{AP}?status=paid&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["status"] == "paid" for r in v["results"]))
check("E filter status partially_paid", call("GET", f"{AP}?status=partially_paid&limit=100", ADMIN), 200, pred=lambda v: all(r["status"] == "partially_paid" for r in v["results"]) and any(r["orderId"] == O2 for r in v["results"]))
check("E filter status due", call("GET", f"{AP}?status=due&limit=100", ADMIN), 200, pred=lambda v: all(r["status"] == "due" for r in v["results"]) and any(r["orderId"] == O3 for r in v["results"]))
check("E bad status -> 400", call("GET", f"{AP}?status=pending", ADMIN), 400)
check("E filter orderId", call("GET", f"{AP}?orderId={O2}", ADMIN), 200, pred=lambda v: len(v["results"]) == 3)
onum = detail(O2, SES2)["orderNumber"]
check("E filter orderNumber", call("GET", f"{AP}?orderNumber={onum[-6:].lower()}", ADMIN), 200, pred=lambda v: len(v["results"]) == 3)
check("E filter sellerId", call("GET", f"{AP}?sellerId={SID2}&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["seller"]["id"] == SID2 for r in v["results"]))
check("E filter gatewayId", call("GET", f"{AP}?gatewayId=99999999", ADMIN), 200, pred=lambda v: v["results"] == [])
check("E filter customerSearch by name", call("GET", f"{AP}?customerSearch=T%20Pay%20Buyer&limit=100", ADMIN), 200, pred=lambda v: len(v["results"]) >= 6)
check("E filter customerSearch by phone", call("GET", f"{AP}?customerSearch=01712345678&limit=100", ADMIN), 200, pred=lambda v: len(v["results"]) >= 6)
check("E filter transactionId", call("GET", f"{AP}?transactionId=BK-2", ADMIN), 200, pred=lambda v: [r["orderId"] for r in v["results"]] == [O2])
check("E filter amount range", call("GET", f"{AP}?minAmount=1000&maxAmount=1000&orderId={O2}", ADMIN), 200, pred=lambda v: len(v["results"]) == 1 and v["results"][0]["amount"] == 1000)
check("E min above max -> 400", call("GET", f"{AP}?minAmount=5&maxAmount=1", ADMIN), 400)
check("E hasAttachments=true", call("GET", f"{AP}?hasAttachments=true&limit=100", ADMIN), 200, pred=lambda v: v["results"] and all(r["attachmentCount"] > 0 for r in v["results"]))
check("E hasAttachments=false", call("GET", f"{AP}?hasAttachments=false&limit=100", ADMIN), 200, pred=lambda v: all(r["attachmentCount"] == 0 for r in v["results"]))
check("E hasAttachments junk -> 400", call("GET", f"{AP}?hasAttachments=maybe", ADMIN), 400)
check("E paidFrom/paidTo", call("GET", f"{AP}?paidFrom=2026-11-01&paidTo=2026-11-01&limit=100", ADMIN), 200, pred=lambda v: [r["orderId"] for r in v["results"]] == [O1])
check("E created range wrong way -> 400", call("GET", f"{AP}?createdFrom=2026-12-01&createdTo=2026-11-01", ADMIN), 400)
check("E bad date -> 400", call("GET", f"{AP}?createdFrom=nope", ADMIN), 400)
check("E attachmentCount per row", call("GET", f"{AP}?orderId={O1}", ADMIN), 200, pred=lambda v: v["results"][0]["attachmentCount"] == 2)
seen, cursor = [], 0
for _ in range(80):
    c, v = call("GET", f"{AP}?limit=3&cursor={cursor}", ADMIN)
    seen += [r["id"] for r in v["results"]]
    if not v["nextCursor"]:
        break
    cursor = v["nextCursor"]
check("E cursor paging visits each payment once", (200, seen), 200, pred=lambda v: len(v) == len(set(v)) == int(sql("select count(*) from payment p join \"order\" o on o.id=p.\"orderId\" where p.\"deletedAt\" is null")))

c, v = call("GET", f"{SP}?limit=100", S1)
check("E seller sees only own payments", (c, v), 200, pred=lambda v: v["results"] and all(r["seller"]["id"] == SID1 for r in v["results"]) and not any(r["orderId"] == O3 for r in v["results"]))
check("E seller cannot widen scope with sellerId", call("GET", f"{SP}?sellerId={SID2}&limit=100", S1), 200, pred=lambda v: all(r["seller"]["id"] == SID1 for r in v["results"]))
check("E the other seller sees theirs", call("GET", f"{SP}?limit=100", S2), 200, pred=lambda v: [r["orderId"] for r in v["results"]] == [O3])
check("E seller filters work", call("GET", f"{SP}?status=paid&limit=100", S1), 200, pred=lambda v: all(r["status"] == "paid" for r in v["results"]))

pid = [r["id"] for r in call("GET", f"{AP}?orderId={O2}", ADMIN)[1]["results"]][-1]
c, v = call("GET", f"{AP}/{pid}", ADMIN)
check("E admin payment details", (c, v), 200, pred=lambda v: v["id"] == pid and v["order"]["orderNumber"] == onum and len(v["attachments"]) == 1 and v["order"]["balanceDue"] == 0)
check("E details carry the order's payment history", (c, v), 200, pred=lambda v: len(v["history"]) == 4 and v["history"][0]["status"] == "due")
check("E details show the customer", (c, v), 200, pred=lambda v: v["customer"]["name"] == "T Pay Buyer" and v["customer"]["isGuest"] is True)
check("E seller payment details", call("GET", f"{SP}/{pid}", S1), 200, pred=lambda v: v["id"] == pid)
check("E other seller's payment -> 404", call("GET", f"{SP}/{pid}", S2), 404)
check("E unknown payment -> 404", call("GET", f"{AP}/99999999", ADMIN), 404)
check("E bad id -> 400", call("GET", f"{AP}/abc", ADMIN), 400)

# ================================================================= G reversing a payment
RV = lambda oid, pid, token, body, base=ADM: call("POST", f"{base}/{oid}/payments/{pid}/reverse", token, body)
d1 = detail(O1, SES1); d2 = detail(O2, SES2); d3 = detail(O3, SES3)
P1 = d1["payments"][0]["id"]              # admin recorded, full
P2 = [p["id"] for p in d2["payments"]]    # seller recorded, 3 receipts
P3 = d3["payments"][0]["id"]              # still due
check("G no token -> 401", RV(O1, P1, None, {"reason": "mistake"}), 401)
check("G customer -> 403", RV(O1, P1, USER, {"reason": "mistake"}), 403)
check("G seller token on admin route -> 403", RV(O1, P1, S1, {"reason": "mistake"}), 403)
check("G admin token on seller route -> 403", RV(O2, P2[0], ADMIN, {"reason": "mistake"}, SEL), 403)
check("G unknown order -> 404", RV(99999999, P1, ADMIN, {"reason": "mistake"}), 404)
check("G unknown payment -> 404", RV(O1, 99999999, ADMIN, {"reason": "mistake"}), 404)
check("G a payment of another order -> 404", RV(O1, P2[0], ADMIN, {"reason": "mistake"}), 404)
check("G bad payment id -> 400", RV(O1, "abc", ADMIN, {"reason": "mistake"}), 400)
check("G no reason -> 400", RV(O1, P1, ADMIN, {}), 400)
check("G blank reason -> 400", RV(O1, P1, ADMIN, {"reason": "   "}), 400)
check("G short reason -> 400", RV(O1, P1, ADMIN, {"reason": "ab"}), 400)
check("G long reason -> 400", RV(O1, P1, ADMIN, {"reason": "r" * 1001}), 400)
check("G unknown field -> 400", RV(O1, P1, ADMIN, {"reason": "mistake", "amount": 1}), 400)
check("G a payment never received -> 409", RV(O3, P3, ADMIN, {"reason": "mistake"}), 409, pred=lambda v: "nothing to reverse" in v["message"])
check("G another seller's order -> 404", RV(O3, P3, S1, {"reason": "mistake"}, SEL), 404)
check("G a seller cannot undo an admin's payment -> 403", RV(O1, P1, S1, {"reason": "mistake"}, SEL), 403, pred=lambda v: "admin recorded" in v["message"])
check("G ...nothing changed", (200, order_state(O1)), 200, pred=lambda v: v == f"paid|{PAY1:.2f}")

c, r = RV(O2, P2[1], S1, {"reason": "Cheque bounced"}, SEL)
check("G seller reverses the part payment they recorded", (c, r), 201, pred=lambda v: v["paymentStatus"] == "partially_paid" and v["amountPaid"] == round(PAY2 - 500.5, 2))
d2 = detail(O2, SES2)
check("G order is partially_paid again with the right total", (200, d2), 200, pred=lambda v: v["paymentStatus"] == "partially_paid" and v["totals"]["amountPaid"] == round(PAY2 - 500.5, 2) and v["totals"]["balanceDue"] == 500.5)
rv = next(p for p in d2["payments"] if p["id"] == P2[1])
check("G the receipt is kept, marked reversed, with who and why", (200, rv), 200, pred=lambda v: v["reversal"]["reason"] == "Cheque bounced" and v["reversal"]["by"] == {"name": "T Pay Seller 111", "type": "seller"} and v["reversal"]["at"] and v["status"] == "due")
check("G its proof files stay on record", (200, rv), 200, pred=lambda v: len(v["attachments"]) == 1)
last = d2["paymentHistory"][-1]
check("G history logs the reversal: from, to, money out, total, reason, who", (200, last), 200, pred=lambda v: v["fromStatus"] == "paid" and v["status"] == "partially_paid" and v["amount"] == -500.5 and v["amountPaidAfter"] == round(PAY2 - 500.5, 2) and "reversed: Cheque bounced" in v["note"] and v["by"]["type"] == "seller")
check("G reversing it again -> 409", RV(O2, P2[1], S1, {"reason": "again"}, SEL), 409, pred=lambda v: "already reversed" in v["message"])
check("G a reversed receipt does not count as received", (200, sql(f"select coalesce(sum(amount),0) from payment where \"orderId\"={O2} and status<>'due' and \"reversedAt\" is null")), 200, pred=lambda v: float(v) == round(PAY2 - 500.5, 2))
check("G paying the balance again adds a new receipt (the reversed one is not reused)", multi(f"{SEL}/{O2}/payments", S1, {**good, "transactionId": "BK-NEW"}, f1), 201)
d2 = detail(O2, SES2)
check("G order is paid again; the reversed row is still there; new row is the receipt", (200, d2), 200, pred=lambda v: v["paymentStatus"] == "paid" and len(v["payments"]) == 4 and v["payments"][3]["transactionId"] == "BK-NEW" and v["payments"][3]["status"] == "paid" and v["payments"][3]["reversal"] is None and v["payments"][1]["reversal"])
check("G history reads due > ... > reversed > paid", (200, [h["status"] for h in d2["paymentHistory"]]), 200, pred=lambda v: v == ["due", "partially_paid", "partially_paid", "paid", "partially_paid", "paid"])

c, r = RV(O1, P1, ADMIN, {"reason": "Customer disputed the transfer"})
check("G admin reverses a full payment", (c, r), 201, pred=lambda v: v["paymentStatus"] == "due" and v["amountPaid"] == 0)
check("G order is due again", (200, order_state(O1)), 200, pred=lambda v: v == "due|0.00")
d1 = detail(O1, SES1)
check("G history: paid to due, money out, by admin", (200, d1["paymentHistory"][-1]), 200, pred=lambda v: v["fromStatus"] == "paid" and v["status"] == "due" and v["amount"] == -PAY1 and v["amountPaidAfter"] == 0 and v["by"]["type"] == "admin")
check("G the customer sees the reversal too", (200, d1), 200, pred=lambda v: v["payments"][0]["reversal"]["reason"] == "Customer disputed the transfer")
check("G the order can be marked paid again", multi(f"{ADM}/{O1}/payments", ADMIN, {**good, "transactionId": "BK-AGAIN"}, f1), 201)
d1 = detail(O1, SES1)
check("G two rows now: the reversed one and the new receipt", (200, d1), 200, pred=lambda v: len(v["payments"]) == 2 and v["paymentStatus"] == "paid" and v["payments"][1]["transactionId"] == "BK-AGAIN")

c, v = call("GET", f"{AP}?reversed=true&limit=100", ADMIN)
check("G list: reversed=true shows only reversed receipts", (c, v), 200, pred=lambda v: {P1, P2[1]} <= {r["id"] for r in v["results"]} and all(r["reversal"] for r in v["results"]))
check("G list: reversed=false leaves them out", call("GET", f"{AP}?reversed=false&limit=100", ADMIN), 200, pred=lambda v: not ({P1, P2[1]} & {r["id"] for r in v["results"]}))
check("G list: status=due does not list reversed receipts", call("GET", f"{AP}?status=due&limit=100", ADMIN), 200, pred=lambda v: not ({P1, P2[1]} & {r["id"] for r in v["results"]}))
check("G list: status=due&reversed=true does", call("GET", f"{AP}?status=due&reversed=true&limit=100", ADMIN), 200, pred=lambda v: {P1, P2[1]} <= {r["id"] for r in v["results"]})
check("G list: bad reversed -> 400", call("GET", f"{AP}?reversed=maybe", ADMIN), 400)
check("G seller list: reversed filter works", call("GET", f"{SP}?reversed=true&limit=100", S1), 200, pred=lambda v: {P1, P2[1]} <= {r["id"] for r in v["results"]})
check("G payment details show the reversal", call("GET", f"{AP}/{P2[1]}", ADMIN), 200, pred=lambda v: v["reversal"]["reason"] == "Cheque bounced" and v["status"] == "due" and v["recordedBy"] is None)

# ================================================================= F integrity
check("F paid orders: receipts sum to amountPaid", (200, sql("select count(*) from \"order\" o where o.\"recipientName\" like 'T Pay %' and o.\"amountPaid\" <> coalesce((select sum(amount) from payment p where p.\"orderId\"=o.id and p.status<>'due'),0)")), 200, pred=lambda v: v == "0")
check("F history's last total equals amountPaid", (200, sql("select count(*) from \"order\" o where o.\"recipientName\" like 'T Pay %' and o.\"amountPaid\" <> (select \"amountPaidAfter\" from payment_status_history h where h.\"orderId\"=o.id order by h.id desc limit 1)")), 200, pred=lambda v: v == "0")
check("F history's last status equals the order's", (200, sql("select count(*) from \"order\" o where o.\"recipientName\" like 'T Pay %' and o.\"paymentStatus\" <> (select status from payment_status_history h where h.\"orderId\"=o.id order by h.id desc limit 1)")), 200, pred=lambda v: v == "0")
check("F no order is over-paid", (200, sql("select count(*) from \"order\" where \"amountPaid\" > \"payableAmount\"")), 200, pred=lambda v: v == "0")
check("F uploaded files exist on disk", (200, sql("select \"filePath\" from payment_attachments where \"orderId\"=" + str(O1) + " limit 1")), 200, pred=lambda v: os.path.exists(os.path.join(UPLOADS, v)))
before = len(os.listdir(os.path.join(UPLOADS, "order-payments")))
multi(f"{ADM}/{O1}/payments", ADMIN, good, f1)  # 409: already paid
check("F a rejected payment leaves no file behind", (200, len(os.listdir(os.path.join(UPLOADS, "order-payments")))), 200, pred=lambda v: v == before)

# ================================================================= summary
cleanup()
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
sys.exit(1 if failed else 0)
