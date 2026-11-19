#!/usr/bin/env python3
"""Black-box tests: seller registration, login, access matrix, profile, admin requests."""
import base64, concurrent.futures as cf, hashlib, hmac, json, os, random, subprocess, sys, tempfile, time

# Configuration (override with environment variables). See seller-account-testing.md.
ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")  # psql database name
HERE = os.path.dirname(os.path.abspath(__file__))
UPLOADS = os.environ.get("UPLOADS_DIR", os.path.normpath(os.path.join(HERE, "..", "..", "uploads")))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "test-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
JWT_SECRET = os.environ.get("JWT_ACCESS_SECRET", "dev-secret-change-me")  # must equal the server's
TMP = tempfile.mkdtemp(prefix="seller-test-")  # scratch image fixtures
results = []
rnd = random.Random(int(time.time()))


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


def check(name, got, expected, pred=None, note=""):
    ok_status = got[0] in (expected if isinstance(expected, (list, tuple, set)) else [expected])
    ok_pred = True
    if ok_status and pred is not None:
        try:
            ok_pred = bool(pred(got[1]))
        except Exception as exc:  # noqa
            ok_pred, note = False, note + f" predicate error: {exc!r}"
    ok = ok_status and ok_pred
    detail = "" if ok else f"expected {expected} got {got[0]} {note} body={str(got[1])[:260]}"
    results.append((ok, name, detail))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  <-- " + detail))


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip()


def dbrow(sid):
    r = sql(f'select status, "activeStatus", coalesce("rejectionReason",\'\'), coalesce(name,\'\') from seller where id={sid}')
    st, act, why, name = (r.split("|") + ["", "", "", ""])[:4]
    return {"status": st, "active": act, "reason": why, "name": name}


def mkfile(name, data):
    p = os.path.join(TMP, name)
    open(p, "wb").write(data)
    return p


def forge(payload, secret=None):
    secret = secret or JWT_SECRET
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
    h, pl = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()), b64(json.dumps(payload).encode())
    sig = b64(hmac.new(secret.encode(), f"{h}.{pl}".encode(), hashlib.sha256).digest())
    return f"{h}.{pl}.{sig}"


def digits(n):
    return "".join(str(rnd.randint(0, 9)) for _ in range(n))


PHONES = {
    "BD": lambda: "+88017" + digits(8), "IN": lambda: "+9198" + digits(8), "US": lambda: "+1415555" + digits(4),
    "AE": lambda: "+97150" + digits(7), "SG": lambda: "+6581" + digits(6), "PK": lambda: "+92300" + digits(7),
}
phone = lambda c="BD": PHONES[c]()
PW = "Passw0rd!"

JPG = mkfile("a.jpg", b"\xff\xd8\xff-jpeg")
PNG = mkfile("t.png", b"\x89PNG\r\n\x1a\n-png")
TXT = mkfile("n.txt", b"just text")
EMPTY = mkfile("e.jpg", b"")

# ---------------------------------------------------------------- admin session / cleanup
def wipe():
    """Remove ONLY rows/files created by this suite (sellers named 'T-%', products 'T-elig-%')."""
    pids = "select id from seller_product where name like 'T-elig-%' or \"sellerId\" in (select id from seller where name like 'T-%')"
    sql(f'delete from seller_product where id in ({pids})')
    paths = sql("select concat_ws(E'\\n', \"avatarPath\", \"nidFrontImagePath\", \"nidBackImagePath\") from seller where name like 'T-%'")
    for rel in filter(None, paths.split("\n")):
        fp = os.path.join(UPLOADS, rel)
        if os.path.isfile(fp):
            os.remove(fp)
    sql("delete from seller where name like 'T-%'")


wipe()
code, d = call("POST", "/admin/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ADMIN = d["accessToken"]
counter = [0]


def register(files=None, **over):
    counter[0] += 1
    f = {"name": f"T-reg-{counter[0]}", "phone": phone(), "password": PW}
    f.update(over)
    form = [(k, v) for k, v in f.items() if v is not None]
    form += [(n, f"@{p};type={m}") for n, p, m in (files or [])]
    return call("POST", "/seller/auth/register", form=form)


def login(ph, pw=PW):
    return call("POST", "/seller/auth/login", body={"phone": ph, "password": pw})


def new_seller(status="pending", active="inactive", reason=None):
    """Registers a seller then forces its state via admin PATCH. Returns dict(id, phone, token)."""
    c, d = register()
    assert c == 201, (c, d)
    sid, ph = d["seller"]["id"], d["seller"]["phone"]
    patch = {"status": status, "activeStatus": active}
    if reason:
        patch["rejectionReason"] = reason
    c2, _ = call("PATCH", f"/admin/sellers/{sid}", ADMIN, body=patch)
    assert c2 == 200
    return {"id": sid, "phone": ph, "token": d["accessToken"]}


def me(tok):
    return call("GET", "/seller/profile", tok)


def patch_profile(tok, **fields):
    return call("PATCH", "/seller/profile", tok, form=[(k, v) for k, v in fields.items()])


# ================================================================= A. REGISTRATION
print("\n== A. registration ==")
before = int(sql("select count(*) from seller"))


def upload_count():
    n = 0
    for sub in ("sellers",):
        for _, _, files in os.walk(os.path.join(UPLOADS, sub)):
            n += len(files)
    return n


files_before = upload_count()
bad_reg = [
    ("no name", dict(name=None)),
    ("blank name", dict(name="   ")),
    ("name 256 chars", dict(name="n" * 256)),
    ("no phone", dict(phone=None)),
    ("phone without country code", dict(phone="01712345678")),
    ("phone digits only with country code, no plus", dict(phone="8801712345678")),
    ("phone too short", dict(phone="+8801")),
    ("phone invalid for country", dict(phone="+999123456789")),
    ("phone letters", dict(phone="+88017abcdefgh")),
    ("phone empty", dict(phone="")),
    ("no password", dict(password=None)),
    ("password 7 chars", dict(password="Abcdef1")),
    ("password 73 chars", dict(password="a" * 73)),
    ("email invalid", dict(email="not-an-email")),
    ("email 256 chars", dict(email="a" * 250 + "@x.com")),
    ("status injection", dict(status="approved")),
    ("activeStatus injection", dict(activeStatus="active")),
    ("commissionRate injection", dict(commissionRate="50")),
    ("rejectionReason injection", dict(rejectionReason="x")),
    ("isActive (removed field)", dict(isActive="true")),
    ("passwordHash injection", dict(passwordHash="x")),
    ("id injection", dict(id="1")),
    ("unknown field", dict(foo="bar")),
]
for n, over in bad_reg:
    check(f"A register rejects: {n}", register(**over), 400)
for n, files in [
    ("avatar is text file", [("avatar", TXT, "text/plain")]),
    ("avatar text bytes with image mime", [("avatar", TXT, "image/jpeg")]),
    ("avatar zero bytes", [("avatar", EMPTY, "image/jpeg")]),
    ("nidFrontImage is text file", [("nidFrontImage", TXT, "text/plain")]),
    ("nidBackImage is text file", [("nidBackImage", TXT, "text/plain")]),
    ("unknown file field", [("passport", JPG, "image/jpeg")]),
    ("two avatars", [("avatar", JPG, "image/jpeg"), ("avatar", PNG, "image/png")]),
]:
    check(f"A register rejects: {n}", register(files=files), 400)
big = mkfile("big.jpg", b"\xff\xd8\xff" + b"\0" * (11 * 1024 * 1024))
check("A register rejects: 11MB avatar -> 413", register(files=[("avatar", big, "image/jpeg")]), 413)
os.remove(big)
check("A rejected registrations created nothing", (200, int(sql("select count(*) from seller"))), 200, pred=lambda n: n == before, note=f"before={before}")
check("A rejected registrations stored no files", (200, upload_count()), 200, pred=lambda n: n == files_before, note=f"before={files_before}")

p1 = phone()
c, r1 = register(phone=p1, name="  T-minimal  ")
check("A minimal registration -> 201", (c, r1), 201, pred=lambda d: d["accessToken"] and d["seller"]["id"])
check("A new seller is pending + inactive", (c, r1), 201, pred=lambda d: d["seller"]["status"] == "pending" and d["seller"]["activeStatus"] == "inactive")
check("A commission starts at 0, payout info empty", (c, r1), 201, pred=lambda d: d["seller"]["commissionRate"] == 0 and d["seller"]["payoutAccountInfo"] is None)
check("A name trimmed, phone stored as E.164", (c, r1), 201, pred=lambda d: d["seller"]["name"] == "T-minimal" and d["seller"]["phone"] == p1)
check("A response hides passwordHash", (c, r1), 201, pred=lambda d: "passwordHash" not in json.dumps(d))
check("A response includes access flags", (c, r1), 201, pred=lambda d: d["seller"]["access"]["canEditProfile"] is True and d["seller"]["access"]["canManage"] is False and d["seller"]["access"]["code"] == "SELLER_PENDING")
check("A email absent -> null, no images", (c, r1), 201, pred=lambda d: d["seller"]["email"] is None and d["seller"]["avatarUrl"] is None)
check("A password stored hashed (bcrypt)", (200, sql(f"select \"passwordHash\" from seller where id={r1['seller']['id']}")), 200, pred=lambda h: h.startswith("$2") and PW not in h)
check("A same phone again -> 400", register(phone=p1), 400)
spaced = p1[:4] + " " + p1[4:7] + "-" + p1[7:]
check("A same phone in spaced/dashed format -> 400 (canonicalised)", register(phone=spaced), 400)
for country in ["IN", "US", "AE", "SG", "PK"]:
    pn = phone(country)
    c, d = register(phone=pn)
    check(f"A {country} number registers, stored as E.164", (c, d), 201, pred=lambda d, pn=pn: d["seller"]["phone"] == pn)
c, d = register(phone="+971 50 " + digits(3) + " " + digits(4))
check("A spaced international input is normalised", (c, d), 201, pred=lambda d: " " not in d["seller"]["phone"] and d["seller"]["phone"].startswith("+97150"))
em = f"T-Mixed-{int(time.time())}@Example.com"
c, d = register(email=em)
check("A email is lowercased", (c, d), 201, pred=lambda d: d["seller"]["email"] == em.lower())
check("A same email, different case -> 400", register(email=em.upper()), 400)
c, d = register(email="")
check("A blank email treated as none", (c, d), 201, pred=lambda d: d["seller"]["email"] is None)
c, d = register(files=[("avatar", JPG, "image/jpeg"), ("nidFrontImage", PNG, "image/png"), ("nidBackImage", JPG, "image/jpeg")])
check("A registration with avatar + both NID images", (c, d), 201, pred=lambda d: all(d["seller"][k] for k in ("avatarUrl", "nidFrontImageUrl", "nidBackImageUrl")))
check("A registration files exist on disk", (200, [os.path.exists(os.path.join(UPLOADS, d["seller"][k])) for k in ("avatarPath", "nidFrontImagePath", "nidBackImagePath")]), 200, pred=lambda v: all(v))
pn = phone()
with cf.ThreadPoolExecutor(8) as pool:
    outs = list(pool.map(lambda _: register(phone=pn)[0], range(8)))
check("A 8 concurrent registrations of one phone -> one 201, rest 400, no 500", (200, outs), 200, pred=lambda o: o.count(201) == 1 and o.count(400) == 7, note=str(outs))
check("A ...exactly one row", (200, sql(f"select count(*) from seller where phone='{pn}'")), 200, pred=lambda v: v == "1")

# ================================================================= B. LOGIN
print("\n== B. login ==")
c, d = login(p1)
check("B login while pending -> 200", (c, d), 200, pred=lambda d: d["accessToken"] and d["seller"]["status"] == "pending")
check("B login response hides passwordHash", (c, d), 200, pred=lambda d: "passwordHash" not in json.dumps(d))
check("B login accepts spaced/dashed phone", login(spaced), 200)
check("B wrong password -> 401", login(p1, "WrongPass1!"), 401)
check("B unknown phone -> 401", login(phone()), 401)
w, u = login(p1, "WrongPass1!"), login(phone())
check("B wrong-password and unknown-phone give the same message", (200, (w[1]["message"], u[1]["message"])), 200, pred=lambda m: m[0] == m[1])
check("B local-format phone -> 400", login("01712345678"), 400)
check("B missing phone -> 400", call("POST", "/seller/auth/login", body={"password": PW}), 400)
check("B missing password -> 400", call("POST", "/seller/auth/login", body={"phone": p1}), 400)
check("B empty password -> 400", login(p1, ""), 400)
check("B non-string password -> 400", call("POST", "/seller/auth/login", body={"phone": p1, "password": 12345678}), 400)
check("B unknown field -> 400", call("POST", "/seller/auth/login", body={"phone": p1, "password": PW, "x": 1}), 400)
check("B password 129 chars -> 400", login(p1, "a" * 129), 400)
check("B empty JSON body -> 400", call("POST", "/seller/auth/login", body={}), 400)
check("B malformed JSON -> 400", call("POST", "/seller/auth/login", raw="{bad"), 400)
check("B admin credentials do not work on seller login", call("POST", "/seller/auth/login", body={"phone": "+8801700000000", "password": "Admin@123"}), 401)
check("B seller phone cannot log in to admin login", call("POST", "/admin/auth/login", body={"email": "x@y.com", "password": PW}), 401)
tok = login(p1)[1]["accessToken"]
claims = json.loads(base64.urlsafe_b64decode(tok.split(".")[1] + "=="))
check("B token carries seller id and type=seller", (200, claims), 200, pred=lambda c: c["type"] == "seller" and c["sub"] == r1["seller"]["id"])
for st, act, label in [("approved", "active", "approved+active"), ("rejected", "inactive", "rejected"), ("approved", "inactive", "approved+inactive"), ("approved", "suspended", "suspended")]:
    s = new_seller(st, act)
    check(f"B login works for {label}", login(s["phone"]), 200, pred=lambda d, st=st, act=act: d["seller"]["status"] == st and d["seller"]["activeStatus"] == act)

# ================================================================= C. ROLE SEPARATION
print("\n== C. role separation ==")
S_PEND = new_seller("pending", "inactive")
now = int(time.time())
expired = forge({"sub": S_PEND["id"], "type": "seller", "iat": now - 7200, "exp": now - 3600})
wrong = forge({"sub": S_PEND["id"], "type": "seller", "iat": now, "exp": now + 3600}, secret="nope")
check("C seller token on admin products -> 403", call("GET", "/admin/products", S_PEND["token"]), 403)
check("C seller token on admin sellers -> 403", call("GET", "/admin/sellers", S_PEND["token"]), 403)
check("C seller token on admin seller-requests -> 403", call("GET", "/admin/seller-requests", S_PEND["token"]), 403)
check("C seller token cannot approve -> 403", call("POST", f"/admin/seller-requests/{S_PEND['id']}/approve", S_PEND["token"]), 403)
check("C seller token cannot PATCH admin seller -> 403", call("PATCH", f"/admin/sellers/{S_PEND['id']}", S_PEND["token"], body={"activeStatus": "active"}), 403)
check("C admin token on seller profile -> 403", call("GET", "/seller/profile", ADMIN), 403)
check("C admin token cannot PATCH seller profile -> 403", call("PATCH", "/seller/profile", ADMIN, form=[("name", "x")]), 403)
for m, pth in [("GET", "/seller/profile"), ("PATCH", "/seller/profile"), ("PATCH", "/seller/profile/password")]:
    check(f"C {m} {pth} no token -> 401", call(m, pth), 401)
    check(f"C {m} {pth} garbage token -> 401", call(m, pth, "a.b.c"), 401)
    check(f"C {m} {pth} expired token -> 401", call(m, pth, expired), 401)
    check(f"C {m} {pth} wrong-secret token -> 401", call(m, pth, wrong), 401)
forged_admin_as_seller = forge({"sub": 1, "type": "admin", "iat": now, "exp": now + 3600})
check("C forged admin-typed token on seller profile -> 403", call("GET", "/seller/profile", forged_admin_as_seller), 403)
ghost = forge({"sub": 99999999, "type": "seller", "iat": now, "exp": now + 3600})
check("C valid token for a non-existent seller -> 401", call("GET", "/seller/profile", ghost), 401)

# ================================================================= D. ACCESS MATRIX + PROFILE
print("\n== D. access matrix & profile ==")
states = {
    "pending": new_seller("pending", "inactive"),
    "approved_active": new_seller("approved", "active"),
    "approved_inactive": new_seller("approved", "inactive"),
    "rejected": new_seller("rejected", "inactive", reason="Blurry NID"),
    "suspended": new_seller("approved", "suspended"),
    "pending_suspended": new_seller("pending", "suspended"),
    "approved_suspended": new_seller("approved", "suspended"),
}
expected_access = {
    "pending": (True, False, "SELLER_PENDING"), "approved_active": (True, True, None), "approved_inactive": (True, False, "SELLER_INACTIVE"),
    "rejected": (True, False, "SELLER_REJECTED"), "suspended": (False, False, "SELLER_SUSPENDED"),
    "pending_suspended": (False, False, "SELLER_SUSPENDED"), "approved_suspended": (False, False, "SELLER_SUSPENDED"),
}
for label, s in states.items():
    ep, mg, cd = expected_access[label]
    check(f"D [{label}] GET profile allowed with correct access flags", me(s["token"]), 200,
          pred=lambda d, ep=ep, mg=mg, cd=cd: d["access"]["canEditProfile"] == ep and d["access"]["canManage"] == mg and d["access"]["code"] == cd)
    c, d = patch_profile(s["token"], name=f"T-edit-{label}")
    if ep:
        check(f"D [{label}] profile edit allowed", (c, d), 200, pred=lambda d, label=label: d["name"] == f"T-edit-{label}")
    else:
        check(f"D [{label}] profile edit blocked -> 403 SELLER_SUSPENDED", (c, d), 403, pred=lambda d: d["code"] == "SELLER_SUSPENDED" and "suspended" in d["message"].lower())
        check(f"D [{label}] ...and nothing changed", (200, dbrow(s["id"])["name"]), 200, pred=lambda n, label=label: n != f"T-edit-{label}")
    c, d = call("PATCH", "/seller/profile/password", s["token"], body={"currentPassword": PW, "newPassword": "NewPassw0rd!"})
    check(f"D [{label}] password change {'allowed' if ep else 'blocked -> 403'}", (c, d), 200 if ep else 403)
    if ep:
        call("PATCH", "/seller/profile/password", s["token"], body={"currentPassword": "NewPassw0rd!", "newPassword": PW})

# status effects of editing
check("D editing keeps pending as pending", (200, dbrow(states["pending"]["id"])), 200, pred=lambda r: r["status"] == "pending" and r["active"] == "inactive")
check("D editing keeps approved+active untouched", (200, dbrow(states["approved_active"]["id"])), 200, pred=lambda r: r["status"] == "approved" and r["active"] == "active")
check("D editing keeps approved+inactive untouched", (200, dbrow(states["approved_inactive"]["id"])), 200, pred=lambda r: r["status"] == "approved" and r["active"] == "inactive")
rj = dbrow(states["rejected"]["id"])
check("D REJECTED seller who edits the profile -> pending again", (200, rj), 200, pred=lambda r: r["status"] == "pending" and r["active"] == "inactive")
check("D ...and the rejection reason is cleared", (200, rj), 200, pred=lambda r: r["reason"] == "")

R = new_seller("rejected", "inactive", reason="Blurry NID")
check("D rejected seller sees the rejection reason", me(R["token"]), 200, pred=lambda d: d["rejectionReason"] == "Blurry NID")
c, d = patch_profile(R["token"], name=me(R["token"])[1]["name"])
check("D rejected + no actual change -> stays rejected", (c, d), 200, pred=lambda d: d["status"] == "rejected" and d["rejectionReason"] == "Blurry NID")
c, d = call("PATCH", "/seller/profile/password", R["token"], body={"currentPassword": PW, "newPassword": "Another1Pass!"})
check("D rejected + password change only -> stays rejected", (200, dbrow(R["id"])), 200, pred=lambda r: r["status"] == "rejected" and r["reason"] == "Blurry NID")
call("PATCH", "/seller/profile/password", R["token"], body={"currentPassword": "Another1Pass!", "newPassword": PW})
c, d = patch_profile(R["token"], email=f"t-rej-{int(time.time())}@example.com")
check("D rejected + email change -> pending, reason cleared", (c, d), 200, pred=lambda d: d["status"] == "pending" and d["rejectionReason"] is None and d["activeStatus"] == "inactive")
R2 = new_seller("rejected", "inactive", reason="x")
c, d = call("PATCH", "/seller/profile", R2["token"], form=[("avatar", f"@{JPG};type=image/jpeg")])
check("D rejected + avatar upload -> pending", (c, d), 200, pred=lambda d: d["status"] == "pending" and d["avatarUrl"])
R3 = new_seller("rejected", "inactive", reason="x")
c, d = call("PATCH", "/seller/profile", R3["token"], form=[("nidFrontImage", f"@{PNG};type=image/png")])
check("D rejected + NID upload -> pending", (c, d), 200, pred=lambda d: d["status"] == "pending")
R4 = new_seller("rejected", "inactive", reason="x")
c, d = patch_profile(R4["token"], phone=phone("IN"))
check("D rejected + phone change -> pending", (c, d), 200, pred=lambda d: d["status"] == "pending")

P = new_seller("approved", "active")
for k, v in [("status", "approved"), ("activeStatus", "active"), ("isActive", "true"), ("commissionRate", "99"), ("rejectionReason", "x"),
             ("passwordHash", "x"), ("payoutAccountInfo", "{}"), ("id", "1"), ("foo", "bar")]:
    check(f"D seller cannot send '{k}' in profile PATCH -> 400", patch_profile(P["token"], **{k: v}), 400)
S = new_seller("approved", "inactive")
check("D inactive seller cannot self-activate -> 400", patch_profile(S["token"], activeStatus="active"), 400)
check("D ...still inactive", (200, dbrow(S["id"])["active"]), 200, pred=lambda a: a == "inactive")
check("D seller cannot self-approve (pending) -> 400", patch_profile(states["pending"]["token"], status="approved"), 400)

for n, f in [("name blank", dict(name="   ")), ("name 256 chars", dict(name="n" * 256)), ("email invalid", dict(email="nope")),
             ("phone local format", dict(phone="01712345678")), ("phone invalid", dict(phone="+8801")), ("phone empty", dict(phone=""))]:
    check(f"D profile rejects: {n}", patch_profile(P["token"], **f), 400)
other = new_seller("approved", "active")
check("D profile rejects: phone owned by another seller", patch_profile(P["token"], phone=other["phone"]), 400)
em2 = sql(f"select coalesce(email,'') from seller where id={other['id']}") or f"t-other-{int(time.time())}@example.com"
call("PATCH", f"/admin/sellers/{other['id']}", ADMIN, body={"email": f"t-owner-{int(time.time())}@example.com"})
owner_email = sql(f"select email from seller where id={other['id']}")
check("D profile rejects: email owned by another seller (any case)", patch_profile(P["token"], email=owner_email.upper()), 400)
check("D profile rejects: avatar text file", call("PATCH", "/seller/profile", P["token"], form=[("avatar", f"@{TXT};type=text/plain")]), 400)
check("D profile rejects: avatar text bytes w/ image mime", call("PATCH", "/seller/profile", P["token"], form=[("avatar", f"@{TXT};type=image/jpeg")]), 400)
check("D profile rejects: unknown file field", call("PATCH", "/seller/profile", P["token"], form=[("passport", f"@{JPG};type=image/jpeg")]), 400)
newph = phone("US")
c, d = patch_profile(P["token"], phone=newph, email=f"T-New-{int(time.time())}@Example.com", name="  T-renamed  ")
check("D profile update (phone/email/name) -> 200, normalised", (c, d), 200, pred=lambda d: d["phone"] == newph and d["email"].islower() and d["name"] == "T-renamed" and d["status"] == "approved")
check("D new phone can log in", login(newph), 200)
check("D old phone can no longer log in", login(P["phone"]), 401)
c, d = call("PATCH", "/seller/profile", P["token"], form=[("avatar", f"@{JPG};type=image/jpeg")])
old_avatar = d["avatarPath"]
c, d = call("PATCH", "/seller/profile", P["token"], form=[("avatar", f"@{PNG};type=image/png")])
check("D replacing avatar swaps the file", (c, d), 200, pred=lambda d: d["avatarPath"] != old_avatar)
check("D ...old avatar deleted from disk", (200, os.path.exists(os.path.join(UPLOADS, old_avatar))), 200, pred=lambda v: v is False)
check("D ...new avatar on disk", (200, os.path.exists(os.path.join(UPLOADS, d["avatarPath"]))), 200, pred=lambda v: v is True)
c, d = call("PATCH", "/seller/profile", P["token"], form=[])
check("D empty profile PATCH is a harmless no-op", (c, d), 200)
check("D profile view never exposes passwordHash", me(P["token"]), 200, pred=lambda d: "passwordHash" not in json.dumps(d))

# password change
PC = new_seller("approved", "active")
check("D password: wrong current -> 401", call("PATCH", "/seller/profile/password", PC["token"], body={"currentPassword": "bad", "newPassword": "Brand-new-1"}), 401)
check("D password: new == current -> 400", call("PATCH", "/seller/profile/password", PC["token"], body={"currentPassword": PW, "newPassword": PW}), 400)
check("D password: too short -> 400", call("PATCH", "/seller/profile/password", PC["token"], body={"currentPassword": PW, "newPassword": "short"}), 400)
check("D password: 73 chars -> 400", call("PATCH", "/seller/profile/password", PC["token"], body={"currentPassword": PW, "newPassword": "a" * 73}), 400)
check("D password: missing fields -> 400", call("PATCH", "/seller/profile/password", PC["token"], body={}), 400)
check("D password: unknown field -> 400", call("PATCH", "/seller/profile/password", PC["token"], body={"currentPassword": PW, "newPassword": "Brand-new-1", "x": 1}), 400)
check("D password change succeeds", call("PATCH", "/seller/profile/password", PC["token"], body={"currentPassword": PW, "newPassword": "Brand-new-1"}), 200, pred=lambda d: d == {"updated": True})
check("D old password stops working", login(PC["phone"], PW), 401)
check("D new password works", login(PC["phone"], "Brand-new-1"), 200)
check("D 72-char password accepted at the limit", call("PATCH", "/seller/profile/password", PC["token"], body={"currentPassword": "Brand-new-1", "newPassword": "a" * 72}), 200)
check("D ...and works for login", login(PC["phone"], "a" * 72), 200)

# live status changes apply to tokens already issued
L = new_seller("approved", "active")
check("D [live] approved+active token: access.canManage", me(L["token"]), 200, pred=lambda d: d["access"]["canManage"] is True)
call("PATCH", f"/admin/sellers/{L['id']}", ADMIN, body={"activeStatus": "suspended"})
check("D [live] admin suspends -> the SAME token is blocked at once", patch_profile(L["token"], name="T-x"), 403)
check("D [live] suspended token can still read status", me(L["token"]), 200, pred=lambda d: d["access"]["code"] == "SELLER_SUSPENDED")
call("PATCH", f"/admin/sellers/{L['id']}", ADMIN, body={"activeStatus": "active"})
check("D [live] admin reinstates -> the same token works again", patch_profile(L["token"], name="T-y"), 200)
call("PATCH", f"/admin/sellers/{L['id']}", ADMIN, body={"status": "rejected", "activeStatus": "inactive"})
check("D [live] admin rejects -> access drops to profile-only", me(L["token"]), 200, pred=lambda d: d["access"]["canManage"] is False and d["access"]["code"] == "SELLER_REJECTED")
sql(f"delete from seller where id={L['id']}")
check("D [live] seller deleted -> token rejected 401", me(L["token"]), 401)

# ================================================================= E. ADMIN REQUESTS
print("\n== E. admin seller-requests ==")
for m, pth in [("GET", "/admin/seller-requests"), ("POST", "/admin/seller-requests/1/approve"), ("POST", "/admin/seller-requests/1/reject")]:
    check(f"E {m} {pth} no token -> 401", call(m, pth), 401)
check("E list shows only pending sellers", call("GET", "/admin/seller-requests?limit=100", ADMIN), 200,
      pred=lambda d: len(d["results"]) > 0 and all(r["status"] == "pending" for r in d["results"]))
check("E list rows have NID/avatar urls and no passwordHash", call("GET", "/admin/seller-requests?limit=100", ADMIN), 200,
      pred=lambda d: all("nidFrontImageUrl" in r and "passwordHash" not in r for r in d["results"]))
check("E list newest first", call("GET", "/admin/seller-requests?limit=100", ADMIN), 200, pred=lambda d: [r["id"] for r in d["results"]] == sorted([r["id"] for r in d["results"]], reverse=True))
total_pending = int(sql("select count(*) from seller where status='pending'"))
seen, cur = [], None
while True:
    c, d = call("GET", "/admin/seller-requests?limit=5" + (f"&cursor={cur}" if cur else ""), ADMIN)
    seen += [r["id"] for r in d["results"]]
    cur = d["nextCursor"]
    if not cur:
        break
check("E cursor walk visits every pending seller once", (200, seen), 200, pred=lambda s: len(s) == total_pending and len(set(s)) == total_pending, note=f"expected {total_pending}")
approved_ids = [int(x) for x in sql("select id from seller where status='approved'").split()]
check("E approved sellers are not in the list", call("GET", "/admin/seller-requests?limit=100", ADMIN), 200, pred=lambda d: not set(approved_ids) & {r["id"] for r in d["results"]})
check("E search by phone", call("GET", f"/admin/seller-requests?search={S_PEND['phone'].replace('+', '%2B')}", ADMIN), 200, pred=lambda d: [r["id"] for r in d["results"]] == [S_PEND["id"]])
check("E search by partial phone", call("GET", f"/admin/seller-requests?search={S_PEND['phone'][-8:]}", ADMIN), 200, pred=lambda d: S_PEND["id"] in [r["id"] for r in d["results"]])
check("E search by name (case-insens.)", call("GET", "/admin/seller-requests?search=T-REG-1", ADMIN), 200, pred=lambda d: all("t-reg-1" in r["name"].lower() for r in d["results"]))
check("E search '%' matches literally (nothing)", call("GET", "/admin/seller-requests?search=%25", ADMIN), 200, pred=lambda d: d["results"] == [])
check("E unknown query param -> 400", call("GET", "/admin/seller-requests?foo=1", ADMIN), 400)
check("E limit=101 -> 400", call("GET", "/admin/seller-requests?limit=101", ADMIN), 400)
check("E huge cursor -> 400", call("GET", "/admin/seller-requests?cursor=99999999999", ADMIN), 400)

A1 = new_seller("pending", "inactive")
c, d = call("POST", f"/admin/seller-requests/{A1['id']}/approve", ADMIN)
check("E approve -> approved + active", (c, d), 200, pred=lambda d: d["status"] == "approved" and d["activeStatus"] == "active" and d["rejectionReason"] is None and "passwordHash" not in d)
check("E approved seller now has full access (existing token)", me(A1["token"]), 200, pred=lambda d: d["access"]["canManage"] is True and d["access"]["code"] is None)
check("E approve again -> 409", call("POST", f"/admin/seller-requests/{A1['id']}/approve", ADMIN), 409)
check("E reject an approved seller -> 409", call("POST", f"/admin/seller-requests/{A1['id']}/reject", ADMIN, body={}), 409)
check("E approved seller leaves the request list", call("GET", f"/admin/seller-requests?search={A1['phone'].replace('+', '%2B')}", ADMIN), 200, pred=lambda d: d["results"] == [])

R5 = new_seller("pending", "inactive")
c, d = call("POST", f"/admin/seller-requests/{R5['id']}/reject", ADMIN, body={"reason": "  NID photo is unreadable  "})
check("E reject with reason -> rejected + inactive", (c, d), 200, pred=lambda d: d["status"] == "rejected" and d["activeStatus"] == "inactive" and d["rejectionReason"] == "NID photo is unreadable")
check("E rejected seller reads the reason + access", me(R5["token"]), 200, pred=lambda d: d["rejectionReason"] == "NID photo is unreadable" and d["access"]["code"] == "SELLER_REJECTED")
check("E rejected seller can log in", login(R5["phone"]), 200)
check("E reject again -> 409", call("POST", f"/admin/seller-requests/{R5['id']}/reject", ADMIN, body={}), 409)
check("E approve a rejected seller directly -> 409 (must resubmit)", call("POST", f"/admin/seller-requests/{R5['id']}/approve", ADMIN), 409)
check("E rejected seller is not in the list", call("GET", f"/admin/seller-requests?search={R5['phone'].replace('+', '%2B')}", ADMIN), 200, pred=lambda d: d["results"] == [])
c, d = patch_profile(R5["token"], name="T-resubmitted")
check("E rejected seller resubmits by editing -> pending", (c, d), 200, pred=lambda d: d["status"] == "pending")
check("E ...and reappears in the request list", call("GET", f"/admin/seller-requests?search={R5['phone'].replace('+', '%2B')}", ADMIN), 200, pred=lambda d: [r["id"] for r in d["results"]] == [R5["id"]])
check("E ...and can be approved after resubmission", call("POST", f"/admin/seller-requests/{R5['id']}/approve", ADMIN), 200, pred=lambda d: d["status"] == "approved" and d["activeStatus"] == "active")

R6 = new_seller("pending", "inactive")
check("E reject without a body -> 200, no reason", call("POST", f"/admin/seller-requests/{R6['id']}/reject", ADMIN), 200, pred=lambda d: d["rejectionReason"] is None and d["status"] == "rejected")
R7 = new_seller("pending", "inactive")
check("E reject with blank reason -> no reason", call("POST", f"/admin/seller-requests/{R7['id']}/reject", ADMIN, body={"reason": "   "}), 200, pred=lambda d: d["rejectionReason"] is None)
R8 = new_seller("pending", "inactive")
check("E reject reason 1001 chars -> 400", call("POST", f"/admin/seller-requests/{R8['id']}/reject", ADMIN, body={"reason": "r" * 1001}), 400)
check("E reject reason wrong type -> 400", call("POST", f"/admin/seller-requests/{R8['id']}/reject", ADMIN, body={"reason": 5}), 400)
check("E reject unknown field -> 400", call("POST", f"/admin/seller-requests/{R8['id']}/reject", ADMIN, body={"reason": "x", "status": "approved"}), 400)
check("E reject reason 1000 chars ok", call("POST", f"/admin/seller-requests/{R8['id']}/reject", ADMIN, body={"reason": "r" * 1000}), 200)
SUSP = new_seller("pending", "suspended")
check("E approve a suspended pending seller -> 409", call("POST", f"/admin/seller-requests/{SUSP['id']}/approve", ADMIN), 409)
check("E reject a suspended pending seller -> 409", call("POST", f"/admin/seller-requests/{SUSP['id']}/reject", ADMIN, body={}), 409)
check("E ...suspension untouched", (200, dbrow(SUSP["id"])), 200, pred=lambda r: r["active"] == "suspended" and r["status"] == "pending")
for act in ("approve", "reject"):
    check(f"E {act} unknown seller -> 404", call("POST", f"/admin/seller-requests/987654/{act}", ADMIN, body={}), 404)
    for bad in ("abc", "0", "-1", "99999999999", "1.5"):
        check(f"E {act} id '{bad}' -> 400", call("POST", f"/admin/seller-requests/{bad}/{act}", ADMIN, body={}), 400)
check("E GET on approve path -> 404", call("GET", f"/admin/seller-requests/{A1['id']}/approve", ADMIN), 404)

# ================================================================= F. ADMIN SELLER API (activeStatus, phone)
print("\n== F. admin seller API ==")
c, d = call("POST", "/admin/sellers", ADMIN, form=[("name", "T-admin-made"), ("phone", phone("IN")), ("password", PW)])
check("F admin-created seller is approved + active", (c, d), 201, pred=lambda d: d["status"] == "approved" and d["activeStatus"] == "active" and "isActive" not in d)
AM = d["id"] if c == 201 else None
check("F admin-created seller can log in as seller", login(d["phone"]), 200, pred=lambda x: x["seller"]["access"]["canManage"] is True)
for n, form in [("local-format phone", [("name", "T-a"), ("phone", "01712345678"), ("password", PW)]),
                ("no phone", [("name", "T-a"), ("password", PW)]),
                ("duplicate phone", [("name", "T-a"), ("phone", d["phone"]), ("password", PW)]),
                ("password 73 chars", [("name", "T-a"), ("phone", phone()), ("password", "a" * 73)]),
                ("password 5 chars", [("name", "T-a"), ("phone", phone()), ("password", "a" * 5)]),
                ("isActive field (removed)", [("name", "T-a"), ("phone", phone()), ("password", PW), ("isActive", "true")]),
                ("activeStatus not accepted on create", [("name", "T-a"), ("phone", phone()), ("password", PW), ("activeStatus", "suspended")]),
                ("status not accepted on create", [("name", "T-a"), ("phone", phone()), ("password", PW), ("status", "pending")])]:
    check(f"F admin create rejects: {n}", call("POST", "/admin/sellers", ADMIN, form=form), 400)
check("F admin list filter activeStatus=suspended", call("GET", "/admin/sellers?activeStatus=suspended&limit=100", ADMIN), 200, pred=lambda d: all(r["activeStatus"] == "suspended" for r in d["results"]) and len(d["results"]) > 0)
check("F admin list filter activeStatus=active", call("GET", "/admin/sellers?activeStatus=active&limit=100", ADMIN), 200, pred=lambda d: all(r["activeStatus"] == "active" for r in d["results"]))
check("F admin list filter activeStatus invalid -> 400", call("GET", "/admin/sellers?activeStatus=banned", ADMIN), 400)
check("F admin list old isActive param -> 400", call("GET", "/admin/sellers?isActive=true", ADMIN), 400)
check("F admin list status+activeStatus combined", call("GET", "/admin/sellers?status=approved&activeStatus=suspended&limit=100", ADMIN), 200, pred=lambda d: all(r["status"] == "approved" and r["activeStatus"] == "suspended" for r in d["results"]))
check("F admin list search matches phone", call("GET", f"/admin/sellers?search={d['phone'].replace('+', '%2B')}", ADMIN), 200, pred=lambda x: [r["id"] for r in x["results"]] == [AM])
check("F admin list rows expose activeStatus + rejectionReason, no isActive", call("GET", "/admin/sellers?limit=3", ADMIN), 200, pred=lambda x: all("activeStatus" in r and "rejectionReason" in r and "isActive" not in r for r in x["results"]))
for v in ("active", "inactive", "suspended"):
    check(f"F admin sets activeStatus={v}", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"activeStatus": v}), 200, pred=lambda x, v=v: x["activeStatus"] == v)
check("F admin PATCH activeStatus invalid -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"activeStatus": "banned"}), 400)
check("F admin PATCH isActive (removed) -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"isActive": True}), 400)
check("F admin PATCH phone local format -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"phone": "01712345678"}), 400)
check("F admin PATCH phone duplicate -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"phone": p1}), 400)
check("F admin PATCH phone normalised", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"phone": "+65 8123 4567"}), 200, pred=lambda x: x["phone"] == "+6581234567")
call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"status": "rejected", "rejectionReason": "manual"})
check("F admin PATCH status approved clears rejectionReason", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"status": "approved"}), 200, pred=lambda x: x["rejectionReason"] is None)
check("F admin PATCH rejectionReason 1001 chars -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"rejectionReason": "r" * 1001}), 400)

# product eligibility follows approved + active
print("\n== G. product eligibility ==")
def product_for(sid):
    return call("POST", "/admin/products", ADMIN, body={"sellerId": sid, "categoryId": 16, "name": f"T-elig-{sid}-{counter[0]}",
                "skus": [{"price": 10, "variants": [{"attributeId": 2, "attributeValueId": 6}]}]})
counter[0] += 1
check("G approved+active seller can receive products", product_for(states["approved_active"]["id"]), 201)
for label in ("pending", "approved_inactive", "rejected", "approved_suspended", "pending_suspended"):
    sid = states[label]["id"]
    if label == "rejected":  # became pending after the edit test
        call("PATCH", f"/admin/sellers/{sid}", ADMIN, body={"status": "rejected"})
    check(f"G [{label}] seller cannot receive products -> 409", product_for(sid), 409)

# ================================================================= summary
passed = sum(1 for ok, *_ in results if ok)
failed = [(n, dt) for ok, n, dt in results if not ok]
print(f"\n==== {passed}/{len(results)} passed, {len(failed)} failed ====")
for n, dt in failed:
    print(" -", n, "\n     ", dt)
wipe()
import shutil
shutil.rmtree(TMP, ignore_errors=True)
sys.exit(1 if failed else 0)
