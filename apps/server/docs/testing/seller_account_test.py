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
ADMIN_INFO = d["admin"]  # {id, name, ...}: expected tracker values on history rows
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
    if status == "rejected" or active == "suspended":
        patch["reason"] = reason or "test setup"  # required by the API for these
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
call("PATCH", f"/admin/sellers/{L['id']}", ADMIN, body={"activeStatus": "suspended", "reason": "live test"})
check("D [live] admin suspends -> the SAME token is blocked at once", patch_profile(L["token"], name="T-x"), 403)
check("D [live] suspended token can still read status", me(L["token"]), 200, pred=lambda d: d["access"]["code"] == "SELLER_SUSPENDED")
call("PATCH", f"/admin/sellers/{L['id']}", ADMIN, body={"activeStatus": "active"})
check("D [live] admin reinstates -> the same token works again", patch_profile(L["token"], name="T-y"), 200)
call("PATCH", f"/admin/sellers/{L['id']}", ADMIN, body={"status": "rejected", "activeStatus": "inactive", "reason": "live test"})
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
check("E reject an approved seller -> 409", call("POST", f"/admin/seller-requests/{A1['id']}/reject", ADMIN, body={"reason": "x"}), 409)
check("E approved seller leaves the request list", call("GET", f"/admin/seller-requests?search={A1['phone'].replace('+', '%2B')}", ADMIN), 200, pred=lambda d: d["results"] == [])

R5 = new_seller("pending", "inactive")
c, d = call("POST", f"/admin/seller-requests/{R5['id']}/reject", ADMIN, body={"reason": "  NID photo is unreadable  "})
check("E reject with reason -> rejected + inactive", (c, d), 200, pred=lambda d: d["status"] == "rejected" and d["activeStatus"] == "inactive" and d["rejectionReason"] == "NID photo is unreadable")
check("E rejected seller reads the reason + access", me(R5["token"]), 200, pred=lambda d: d["rejectionReason"] == "NID photo is unreadable" and d["access"]["code"] == "SELLER_REJECTED")
check("E rejected seller can log in", login(R5["phone"]), 200)
check("E reject again -> 409", call("POST", f"/admin/seller-requests/{R5['id']}/reject", ADMIN, body={"reason": "x"}), 409)
check("E approve a rejected seller directly -> 409 (must resubmit)", call("POST", f"/admin/seller-requests/{R5['id']}/approve", ADMIN), 409)
check("E rejected seller is not in the list", call("GET", f"/admin/seller-requests?search={R5['phone'].replace('+', '%2B')}", ADMIN), 200, pred=lambda d: d["results"] == [])
c, d = patch_profile(R5["token"], name="T-resubmitted")
check("E rejected seller resubmits by editing -> pending", (c, d), 200, pred=lambda d: d["status"] == "pending")
check("E ...and reappears in the request list", call("GET", f"/admin/seller-requests?search={R5['phone'].replace('+', '%2B')}", ADMIN), 200, pred=lambda d: [r["id"] for r in d["results"]] == [R5["id"]])
check("E ...and can be approved after resubmission", call("POST", f"/admin/seller-requests/{R5['id']}/approve", ADMIN), 200, pred=lambda d: d["status"] == "approved" and d["activeStatus"] == "active")

R6 = new_seller("pending", "inactive")
check("E reject without a body -> 400 (reason required)", call("POST", f"/admin/seller-requests/{R6['id']}/reject", ADMIN), 400)
check("E ...seller untouched, still pending", (200, dbrow(R6["id"])), 200, pred=lambda r: r["status"] == "pending" and r["active"] == "inactive")
R7 = new_seller("pending", "inactive")
check("E reject with blank reason -> 400 (reason required)", call("POST", f"/admin/seller-requests/{R7['id']}/reject", ADMIN, body={"reason": "   "}), 400)
check("E reject with empty-string reason -> 400", call("POST", f"/admin/seller-requests/{R7['id']}/reject", ADMIN, body={"reason": ""}), 400)
check("E reject with null reason -> 400", call("POST", f"/admin/seller-requests/{R7['id']}/reject", ADMIN, body={"reason": None}), 400)
R8 = new_seller("pending", "inactive")
check("E reject reason 1001 chars -> 400", call("POST", f"/admin/seller-requests/{R8['id']}/reject", ADMIN, body={"reason": "r" * 1001}), 400)
check("E reject reason wrong type -> 400", call("POST", f"/admin/seller-requests/{R8['id']}/reject", ADMIN, body={"reason": 5}), 400)
check("E reject unknown field -> 400", call("POST", f"/admin/seller-requests/{R8['id']}/reject", ADMIN, body={"reason": "x", "status": "approved"}), 400)
check("E reject reason 1000 chars ok", call("POST", f"/admin/seller-requests/{R8['id']}/reject", ADMIN, body={"reason": "r" * 1000}), 200)
SUSP = new_seller("pending", "suspended")
check("E approve a suspended pending seller -> 409", call("POST", f"/admin/seller-requests/{SUSP['id']}/approve", ADMIN), 409)
check("E reject a suspended pending seller -> 409", call("POST", f"/admin/seller-requests/{SUSP['id']}/reject", ADMIN, body={"reason": "x"}), 409)
check("E ...suspension untouched", (200, dbrow(SUSP["id"])), 200, pred=lambda r: r["active"] == "suspended" and r["status"] == "pending")
for act in ("approve", "reject"):
    check(f"E {act} unknown seller -> 404", call("POST", f"/admin/seller-requests/987654/{act}", ADMIN, body={"reason": "x"}), 404)
    for bad in ("abc", "0", "-1", "99999999999", "1.5"):
        check(f"E {act} id '{bad}' -> 400", call("POST", f"/admin/seller-requests/{bad}/{act}", ADMIN, body={"reason": "x"}), 400)
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
    check(f"F admin sets activeStatus={v}", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"activeStatus": v, "reason": "f test"}), 200, pred=lambda x, v=v: x["activeStatus"] == v)
check("F admin PATCH activeStatus invalid -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"activeStatus": "banned"}), 400)
check("F admin PATCH isActive (removed) -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"isActive": True}), 400)
check("F admin PATCH phone local format -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"phone": "01712345678"}), 400)
check("F admin PATCH phone duplicate -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"phone": p1}), 400)
check("F admin PATCH phone normalised", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"phone": "+65 8123 4567"}), 200, pred=lambda x: x["phone"] == "+6581234567")
call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"status": "rejected", "reason": "manual"})
check("F admin PATCH status approved clears rejectionReason", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"status": "approved"}), 200, pred=lambda x: x["rejectionReason"] is None)
check("F admin PATCH reason 1001 chars -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"reason": "r" * 1001}), 400)
check("F admin PATCH old rejectionReason field -> 400", call("PATCH", f"/admin/sellers/{AM}", ADMIN, body={"rejectionReason": "x"}), 400)

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
        call("PATCH", f"/admin/sellers/{sid}", ADMIN, body={"status": "rejected", "reason": "g test"})
    check(f"G [{label}] seller cannot receive products -> 409", product_for(sid), 409)


# ================================================================= H. STATUS HISTORY
print("\n== H. status change history ==")


def hist(sid, extra=""):
    c, d = call("GET", f"/admin/seller-status-history?sellerId={sid}&limit=100{extra}", ADMIN)
    assert c == 200, (c, d)
    return d["results"]  # newest first


def hist_count(sid):
    return int(sql(f'select count(*) from seller_status_change_history where "sellerId"={sid}'))


# H1 registration
c, d = register(name="T-hist-reg")
HS = d["seller"]["id"]
HT = d["accessToken"]
rows = hist(HS)
check("H registration writes exactly one 'registered' row", (200, rows), 200, pred=lambda r: len(r) == 1 and r[0]["action"] == "registered")
check("H ...from nothing to pending + inactive", (200, rows), 200, pred=lambda r: r[0]["fromStatus"] is None and r[0]["fromActiveStatus"] is None and r[0]["toStatus"] == "pending" and r[0]["toActiveStatus"] == "inactive")
check("H ...tracker fields = the seller themself", (200, rows), 200, pred=lambda r: r[0]["createdBy"] == HS and r[0]["creatorType"] == "seller" and r[0]["creatorName"] == "T-hist-reg")
check("H ...no reason, has timestamp, includes seller summary", (200, rows), 200, pred=lambda r: r[0]["reason"] is None and r[0]["createdAt"] and r[0]["seller"]["id"] == HS and r[0]["seller"]["name"] == "T-hist-reg" and "passwordHash" not in json.dumps(r))
n_hist = int(sql("select count(*) from seller_status_change_history"))
register(phone="01712345678")  # invalid -> refused
register(phone=d["seller"]["phone"])  # duplicate -> refused
check("H failed registrations write no history", (200, int(sql("select count(*) from seller_status_change_history"))), 200, pred=lambda v: v == n_hist)

# H2 admin-created
c, d = call("POST", "/admin/sellers", ADMIN, form=[("name", "T-hist-admin"), ("phone", phone("IN")), ("password", PW)])
HA = d["id"]
rows = hist(HA)
check("H admin-created seller: one 'admin_created' row, approved + active", (200, rows), 200, pred=lambda r: len(r) == 1 and r[0]["action"] == "admin_created" and r[0]["toStatus"] == "approved" and r[0]["toActiveStatus"] == "active" and r[0]["fromStatus"] is None)
check("H ...tracker fields = the admin", (200, rows), 200, pred=lambda r: r[0]["createdBy"] == ADMIN_INFO["id"] and r[0]["creatorType"] == "admin" and r[0]["creatorName"] == ADMIN_INFO["name"])
before = int(sql("select count(*) from seller_status_change_history"))
call("POST", "/admin/sellers", ADMIN, form=[("name", "T-hist-bad"), ("phone", "01712345678"), ("password", PW)])
check("H failed admin create writes no history", (200, int(sql("select count(*) from seller_status_change_history"))), 200, pred=lambda n: n == before)

# H3 approve
c, d = call("POST", f"/admin/seller-requests/{HS}/approve", ADMIN)
rows = hist(HS)
check("H approve adds an 'approved' row on top", (200, rows), 200, pred=lambda r: len(r) == 2 and r[0]["action"] == "approved")
check("H ...pending/inactive -> approved/active, by the admin, no reason", (200, rows), 200, pred=lambda r: (r[0]["fromStatus"], r[0]["fromActiveStatus"], r[0]["toStatus"], r[0]["toActiveStatus"]) == ("pending", "inactive", "approved", "active") and r[0]["creatorType"] == "admin" and r[0]["createdBy"] == ADMIN_INFO["id"] and r[0]["reason"] is None)
n = hist_count(HS)
call("POST", f"/admin/seller-requests/{HS}/approve", ADMIN)
check("H refused approve (409) writes no history", (200, hist_count(HS)), 200, pred=lambda v: v == n)

# H4 reject (required reason)
RJ = new_seller("pending", "inactive")
n = hist_count(RJ["id"])
check("H reject with no reason is refused", call("POST", f"/admin/seller-requests/{RJ['id']}/reject", ADMIN, body={}), 400)
check("H ...writes no history and changes nothing", (200, (hist_count(RJ["id"]), dbrow(RJ["id"])["status"])), 200, pred=lambda v: v == (n, "pending"))
c, d = call("POST", f"/admin/seller-requests/{RJ['id']}/reject", ADMIN, body={"reason": "  Photos unclear  "})
rows = hist(RJ["id"])
check("H reject with reason adds a 'rejected' row", (200, rows), 200, pred=lambda r: r[0]["action"] == "rejected" and r[0]["reason"] == "Photos unclear" and r[0]["toStatus"] == "rejected" and r[0]["toActiveStatus"] == "inactive" and r[0]["fromStatus"] == "pending")
check("H ...the seller sees the same reason", me(RJ["token"]), 200, pred=lambda d: d["rejectionReason"] == "Photos unclear")

# H5 resubmission by the seller
n = hist_count(RJ["id"])
call("PATCH", "/seller/profile/password", RJ["token"], body={"currentPassword": PW, "newPassword": "Other-Pass1"})
call("PATCH", "/seller/profile/password", RJ["token"], body={"currentPassword": "Other-Pass1", "newPassword": PW})
patch_profile(RJ["token"], name=me(RJ["token"])[1]["name"])
check("H password change and no-op save write no history", (200, hist_count(RJ["id"])), 200, pred=lambda v: v == n)
patch_profile(RJ["token"], name="T-hist-resubmit")
rows = hist(RJ["id"])
check("H resubmission adds a 'resubmitted' row, rejected -> pending", (200, rows), 200, pred=lambda r: len(r) == n + 1 and r[0]["action"] == "resubmitted" and r[0]["fromStatus"] == "rejected" and r[0]["toStatus"] == "pending" and r[0]["toActiveStatus"] == "inactive")
check("H ...tracker fields = the seller (current name)", (200, rows), 200, pred=lambda r: r[0]["createdBy"] == RJ["id"] and r[0]["creatorType"] == "seller" and r[0]["creatorName"] == "T-hist-resubmit")
n = hist_count(RJ["id"])
patch_profile(RJ["token"], name="T-hist-resubmit-2")
check("H editing a pending seller writes no history", (200, hist_count(RJ["id"])), 200, pred=lambda v: v == n)

# H6 admin edits
AE = new_seller("approved", "active")
base = hist_count(AE["id"])
check("H admin suspend without reason -> 400", call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"activeStatus": "suspended"}), 400)
check("H ...unchanged and no history", (200, (dbrow(AE["id"])["active"], hist_count(AE["id"]))), 200, pred=lambda v: v == ("active", base))
check("H admin suspend with blank reason -> 400", call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"activeStatus": "suspended", "reason": "   "}), 400)
check("H admin reject via PATCH without reason -> 400", call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"status": "rejected"}), 400)
check("H ...unchanged and no history", (200, (dbrow(AE["id"])["status"], hist_count(AE["id"]))), 200, pred=lambda v: v == ("approved", base))
check("H admin suspend with reason -> 200", call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"activeStatus": "suspended", "reason": "Fake products reported"}), 200)
rows = hist(AE["id"])
check("H ...adds an 'admin_updated' row with the note", (200, rows), 200, pred=lambda r: len(r) == base + 1 and r[0]["action"] == "admin_updated" and r[0]["reason"] == "Fake products reported" and r[0]["fromActiveStatus"] == "active" and r[0]["toActiveStatus"] == "suspended" and r[0]["fromStatus"] == "approved" and r[0]["toStatus"] == "approved")
check("H ...tracker fields = the admin", (200, rows), 200, pred=lambda r: r[0]["creatorType"] == "admin" and r[0]["createdBy"] == ADMIN_INFO["id"] and r[0]["creatorName"] == ADMIN_INFO["name"])
n = hist_count(AE["id"])
call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"activeStatus": "suspended", "reason": "again"})
call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, form=None, body={"name": "T-hist-renamed"})
check("H setting the same status again, or editing only the name, writes no history", (200, hist_count(AE["id"])), 200, pred=lambda v: v == n)
check("H un-suspend needs no reason", call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"activeStatus": "active"}), 200)
check("H ...optional note is accepted and stored", call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"activeStatus": "inactive", "reason": "On holiday"}), 200)
rows = hist(AE["id"])
check("H ...rows reflect both changes in order", (200, rows), 200, pred=lambda r: (r[0]["toActiveStatus"], r[0]["reason"], r[1]["toActiveStatus"], r[1]["reason"]) == ("inactive", "On holiday", "active", None))
check("H reject via PATCH with reason -> status rejected + seller sees the reason", call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"status": "rejected", "reason": "Policy breach"}), 200, pred=lambda d: d["rejectionReason"] == "Policy breach")
check("H ...logged as admin_updated with that reason", (200, hist(AE["id"])[0]), 200, pred=lambda r: r["reason"] == "Policy breach" and r["toStatus"] == "rejected" and r["fromStatus"] == "approved")
check("H admin approving clears the rejection reason, note optional", call("PATCH", f"/admin/sellers/{AE['id']}", ADMIN, body={"status": "approved"}), 200, pred=lambda d: d["rejectionReason"] is None)

# H7 concurrency: two admins approve the same pending seller
CC = new_seller("pending", "inactive")
with cf.ThreadPoolExecutor(6) as pool:
    outs = list(pool.map(lambda _: call("POST", f"/admin/seller-requests/{CC['id']}/approve", ADMIN)[0], range(6)))
approved_rows = int(sql(f"select count(*) from seller_status_change_history where \"sellerId\"={CC['id']} and action='approved'"))
check("H 6 simultaneous approvals -> one 200, five 409, no 500", (200, outs), 200, pred=lambda o: o.count(200) == 1 and o.count(409) == 5, note=str(outs))
check("H ...exactly one 'approved' history row", (200, approved_rows), 200, pred=lambda v: v == 1)

# H8 list endpoint
print("-- history list API")
for m, pth in [("GET", "/admin/seller-status-history")]:
    check("H list no token -> 401", call(m, pth), 401)
    check("H list garbage token -> 401", call(m, pth, "a.b.c"), 401)
    check("H list with a seller token -> 403 (admin only)", call(m, pth, HT), 403)
for m, pth in [("POST", "/admin/seller-status-history"), ("PATCH", "/admin/seller-status-history/1"), ("DELETE", "/admin/seller-status-history/1"), ("PUT", "/admin/seller-status-history/1")]:
    check(f"H {m} on the history is not allowed (read-only) -> 404", call(m, pth, ADMIN, body={}), 404)
allc, alld = call("GET", "/admin/seller-status-history?limit=100", ADMIN)
check("H list newest first across all sellers", (allc, alld), 200, pred=lambda d: [r["id"] for r in d["results"]] == sorted([r["id"] for r in d["results"]], reverse=True) and len(d["results"]) > 0)
total_for = hist_count(AE["id"])
seen, cur = [], None
while True:
    c, d = call("GET", f"/admin/seller-status-history?sellerId={AE['id']}&limit=2" + (f"&cursor={cur}" if cur else ""), ADMIN)
    seen += [r["id"] for r in d["results"]]
    cur = d["nextCursor"]
    if not cur:
        break
check("H cursor walk (limit 2) returns every row of one seller exactly once, newest first", (200, seen), 200, pred=lambda s: len(s) == total_for and len(set(s)) == total_for and s == sorted(s, reverse=True), note=f"expected {total_for}")
check("H sellerId filter only returns that seller", (200, hist(AE["id"])), 200, pred=lambda r: all(x["sellerId"] == AE["id"] for x in r))
check("H filter action=approved", call("GET", "/admin/seller-status-history?action=approved&limit=100", ADMIN), 200, pred=lambda d: len(d["results"]) > 0 and all(r["action"] == "approved" for r in d["results"]))
check("H filter action=baseline returns the migrated rows", call("GET", "/admin/seller-status-history?action=baseline&limit=100", ADMIN), 200, pred=lambda d: len(d["results"]) > 0 and all(r["creatorName"] == "System" and r["fromStatus"] is None for r in d["results"]))
check("H filter toStatus=rejected", call("GET", "/admin/seller-status-history?toStatus=rejected&limit=100", ADMIN), 200, pred=lambda d: all(r["toStatus"] == "rejected" for r in d["results"]) and len(d["results"]) > 0)
check("H filter toActiveStatus=suspended", call("GET", "/admin/seller-status-history?toActiveStatus=suspended&limit=100", ADMIN), 200, pred=lambda d: all(r["toActiveStatus"] == "suspended" for r in d["results"]) and len(d["results"]) > 0)
check("H combined filters (action + sellerId)", call("GET", f"/admin/seller-status-history?sellerId={AE['id']}&action=admin_updated&limit=100", ADMIN), 200, pred=lambda d: all(r["action"] == "admin_updated" and r["sellerId"] == AE["id"] for r in d["results"]) and len(d["results"]) >= 4)
check("H search by seller phone", call("GET", f"/admin/seller-status-history?search={RJ['phone'].replace('+', '%2B')}&limit=100", ADMIN), 200, pred=lambda d: len(d["results"]) > 0 and all(r["seller"]["id"] == RJ["id"] for r in d["results"]))
check("H search by seller name (case-insensitive)", call("GET", "/admin/seller-status-history?search=T-HIST-ADMIN&limit=100", ADMIN), 200, pred=lambda d: len(d["results"]) >= 1 and all("t-hist-admin" in r["seller"]["name"].lower() for r in d["results"]))
check("H search '%' matches literally (nothing)", call("GET", "/admin/seller-status-history?search=%25&limit=100", ADMIN), 200, pred=lambda d: d["results"] == [])
check("H no match returns an empty page", call("GET", "/admin/seller-status-history?search=zzzzzz-nothing", ADMIN), 200, pred=lambda d: d["results"] == [] and d["nextCursor"] is None)
for n_, q in [("sellerId=0", "sellerId=0"), ("sellerId=abc", "sellerId=abc"), ("sellerId=-1", "sellerId=-1"), ("sellerId too big", "sellerId=99999999999"), ("sellerId=1.5", "sellerId=1.5"),
              ("invalid action", "action=hacked"), ("invalid toStatus", "toStatus=banned"), ("invalid toActiveStatus", "toActiveStatus=gone"),
              ("unknown param", "foo=1"), ("limit=101", "limit=101"), ("huge cursor", "cursor=99999999999"), ("search 201 chars", "search=" + "a" * 201)]:
    check(f"H list rejects: {n_}", call("GET", f"/admin/seller-status-history?{q}", ADMIN), 400)
check("H unknown seller id returns an empty page, not an error", call("GET", "/admin/seller-status-history?sellerId=987654321", ADMIN), 200, pred=lambda d: d["results"] == [])

# H9 baseline migration: every pre-existing (non test) seller has a timeline
no_hist = sql("select count(*) from seller s where s.name not like 'T-%' and not exists (select 1 from seller_status_change_history h where h.\"sellerId\"=s.id)")
check("H every non-test seller has at least one history row (baseline migration)", (200, no_hist), 200, pred=lambda v: v == "0")
check("H history rows are removed with a hard-deleted seller (FK cascade)", (200, (sql(f"delete from seller where id={CC['id']}") or "x", sql(f"select count(*) from seller_status_change_history where \"sellerId\"={CC['id']}"))), 200, pred=lambda v: v[1] == "0")

# ================================================================= I. PRODUCT STATUS + SELLER PRODUCT API
print("\n== I. product status, active status, seller product API ==")
SKU = lambda: [{"price": 10, "variants": [{"attributeId": 2, "attributeValueId": 6}]}]


def pbody(name, **extra):
    counter[0] += 1
    return {"categoryId": 16, "name": f"T-prod-{counter[0]}-{name}", "skus": SKU(), **extra}


def phist(pid, extra=""):
    c, d = call("GET", f"/admin/product-status-history?productId={pid}&limit=100{extra}", ADMIN)
    assert c == 200, (c, d)
    return d["results"]  # newest first


def prow(pid):
    r = sql(f'select status, "activeStatus", coalesce("rejectionReason",\'\'), coalesce("suspensionReason",\'\') from seller_product where id={pid}')
    a, b, c_, d_ = (r.split("|") + ["", "", "", ""])[:4]
    return {"status": a, "active": b, "rej": c_, "susp": d_}


PA = new_seller("approved", "active")
PB = new_seller("approved", "active")
PA_T, PB_T = PA["token"], PB["token"]

# --- seller access to the product API
check("I seller products: no token -> 401", call("GET", "/seller/products"), 401)
check("I seller products: admin token -> 403", call("GET", "/seller/products", ADMIN), 403)
for label, st, ac in [("pending", "pending", "inactive"), ("approved+inactive", "approved", "inactive"), ("approved+suspended", "approved", "suspended"), ("rejected", "rejected", "inactive")]:
    sx = new_seller(st, ac)
    check(f"I [{label}] seller cannot use the product API -> 403", call("GET", "/seller/products", sx["token"]), 403)
    check(f"I [{label}] seller cannot create a product -> 403", call("POST", "/seller/products", sx["token"], body=pbody("x")), 403)

# --- seller creates
c, d = call("POST", "/seller/products", PA_T, body=pbody("first"))
P1 = d["id"] if c == 201 else 0
check("I seller creates a product -> approved + active by default", (c, d), 201, pred=lambda x: x["status"] == "approved" and x["activeStatus"] == "active" and x["sellerId"] == PA["id"])
check("I created product has no isActive / isPublished fields", (c, d), 201, pred=lambda x: "isActive" not in x and "isPublished" not in x)
h = phist(P1)
check("I create writes exactly one history row (seller_created, by the seller)", (200, h), 200, pred=lambda r: len(r) == 1 and r[0]["action"] == "seller_created" and r[0]["fromStatus"] is None and r[0]["toStatus"] == "approved" and r[0]["toActiveStatus"] == "active" and r[0]["creatorType"] == "seller" and r[0]["createdBy"] == PA["id"] and r[0]["creatorName"] == dbrow(PA["id"])["name"])
check("I seller can start a product inactive", call("POST", "/seller/products", PA_T, body=pbody("inact", activeStatus="inactive")), 201, pred=lambda x: x["activeStatus"] == "inactive" and x["status"] == "approved")
check("I seller cannot send status on create -> 400", call("POST", "/seller/products", PA_T, body=pbody("s", status="pending")), 400)
check("I seller cannot create a suspended product -> 400", call("POST", "/seller/products", PA_T, body=pbody("s", activeStatus="suspended")), 400)
check("I seller cannot send sellerId on create -> 400", call("POST", "/seller/products", PA_T, body=pbody("s", sellerId=PB["id"])), 400)
check("I seller cannot send isFeatured on create -> 400", call("POST", "/seller/products", PA_T, body=pbody("s", isFeatured=True)), 400)
check("I seller cannot send reason on create -> 400", call("POST", "/seller/products", PA_T, body=pbody("s", reason="x")), 400)
check("I old field isActive is rejected on create -> 400", call("POST", "/seller/products", PA_T, body=pbody("s", isActive=True)), 400)
check("I old field isPublished is rejected on create -> 400", call("POST", "/seller/products", PA_T, body=pbody("s", isPublished=True)), 400)
check("I seller create: missing skus -> 400", call("POST", "/seller/products", PA_T, body={"categoryId": 16, "name": "T-prod-noskus"}), 400)

# --- ownership
check("I seller sees own product in list", call("GET", "/seller/products?limit=100", PA_T), 200, pred=lambda d: any(r["id"] == P1 for r in d["results"]) and all(r["sellerId"] == PA["id"] for r in d["results"]))
check("I other seller does not see it in list", call("GET", "/seller/products?limit=100", PB_T), 200, pred=lambda d: all(r["id"] != P1 for r in d["results"]))
check("I other seller GET product -> 404", call("GET", f"/seller/products/{P1}", PB_T), 404)
check("I other seller PATCH product -> 404", call("PATCH", f"/seller/products/{P1}", PB_T, body={"name": "T-prod-hack"}), 404)
check("I other seller DELETE product -> 404", call("DELETE", f"/seller/products/{P1}", PB_T), 404)
check("I other seller media-files -> 404", call("PATCH", f"/seller/products/{P1}/media-files", PB_T, form=[("removeThumbnail", "true")]), 404)
check("I seller list rejects sellerId filter -> 400", call("GET", f"/seller/products?sellerId={PB['id']}", PA_T), 400)
check("I seller list filter status=approved", call("GET", "/seller/products?status=approved&limit=100", PA_T), 200, pred=lambda d: len(d["results"]) >= 1 and all(r["status"] == "approved" for r in d["results"]))
check("I seller list filter activeStatus=inactive", call("GET", "/seller/products?activeStatus=inactive&limit=100", PA_T), 200, pred=lambda d: len(d["results"]) >= 1 and all(r["activeStatus"] == "inactive" for r in d["results"]))
check("I seller list filter status=rejected is empty", call("GET", "/seller/products?status=rejected", PA_T), 200, pred=lambda d: d["results"] == [])
check("I seller list invalid status -> 400", call("GET", "/seller/products?status=live", PA_T), 400)
check("I seller list invalid activeStatus -> 400", call("GET", "/seller/products?activeStatus=gone", PA_T), 400)

# --- seller edits
check("I seller can edit name/description", call("PATCH", f"/seller/products/{P1}", PA_T, body={"description": "new text"}), 200, pred=lambda x: x["description"] == "new text")
check("I seller sets inactive", call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "inactive"}), 200, pred=lambda x: x["activeStatus"] == "inactive")
check("I seller sets active again", call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "active"}), 200, pred=lambda x: x["activeStatus"] == "active")
h = phist(P1)
check("I seller toggles write seller_updated rows with before/after", (200, h), 200, pred=lambda r: len(r) == 3 and r[0]["action"] == "seller_updated" and r[0]["fromActiveStatus"] == "inactive" and r[0]["toActiveStatus"] == "active" and r[1]["fromActiveStatus"] == "active" and r[1]["toActiveStatus"] == "inactive" and r[0]["creatorType"] == "seller")
check("I seller cannot set suspended -> 400", call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "suspended"}), 400)
for v in ("pending", "rejected", "approved"):
    check(f"I seller cannot send status={v} -> 400", call("PATCH", f"/seller/products/{P1}", PA_T, body={"status": v}), 400)
check("I seller cannot send reason -> 400", call("PATCH", f"/seller/products/{P1}", PA_T, body={"reason": "x"}), 400)
check("I seller cannot send isFeatured -> 400", call("PATCH", f"/seller/products/{P1}", PA_T, body={"isFeatured": True}), 400)
before = len(phist(P1))
check("I seller no-op PATCH (same activeStatus) -> 200", call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "active"}), 200)
check("I no-op PATCH wrote no history row", (200, len(phist(P1))), 200, pred=lambda n: n == before)
check("I seller PATCH status null -> 400", call("PATCH", f"/seller/products/{P1}", PA_T, raw='{"activeStatus":null}'), 400)

# --- admin: pending keeps seller access
check("I admin sets status pending without a reason", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "pending"}), 200, pred=lambda x: x["status"] == "pending")
check("I pending: seller can still edit", call("PATCH", f"/seller/products/{P1}", PA_T, body={"description": "while pending"}), 200)
check("I pending: seller can still toggle active/inactive", call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "inactive"}), 200)
check("I pending: seller still cannot change status", call("PATCH", f"/seller/products/{P1}", PA_T, body={"status": "approved"}), 400)
call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "active"})
h = phist(P1)
adm = [r for r in h if r["action"] == "admin_updated"]
check("I admin change row: admin_updated, creatorType admin, tracker = admin", (200, adm), 200, pred=lambda r: len(r) == 1 and r[0]["fromStatus"] == "approved" and r[0]["toStatus"] == "pending" and r[0]["creatorType"] == "admin" and r[0]["createdBy"] == ADMIN_INFO["id"] and r[0]["creatorName"] == ADMIN_INFO["name"])

# --- admin reject
check("I admin reject without reason -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "rejected"}), 400)
check("I admin reject with blank reason -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "rejected", "reason": "   "}), 400)
check("I failed rejects changed nothing", (200, prow(P1)), 200, pred=lambda r: r["status"] == "pending")
check("I reason 1001 chars -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "rejected", "reason": "r" * 1001}), 400)
check("I admin rejects with a reason", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "rejected", "reason": "Photos missing"}), 200, pred=lambda x: x["status"] == "rejected" and x["rejectionReason"] == "Photos missing")
check("I rejected: seller PATCH -> 403 PRODUCT_REJECTED with reason", call("PATCH", f"/seller/products/{P1}", PA_T, body={"description": "x"}), 403, pred=lambda x: x.get("code") == "PRODUCT_REJECTED" and "Photos missing" in x["message"])
check("I rejected: seller cannot toggle active -> 403", call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "inactive"}), 403)
check("I rejected: seller cannot delete -> 403", call("DELETE", f"/seller/products/{P1}", PA_T), 403)
check("I rejected: seller cannot change media -> 403", call("PATCH", f"/seller/products/{P1}/media-files", PA_T, form=[("removeThumbnail", "true")]), 403)
check("I rejected: seller can still read it, sees the reason", call("GET", f"/seller/products/{P1}", PA_T), 200, pred=lambda x: x["status"] == "rejected" and x["rejectionReason"] == "Photos missing")
check("I rejected: still listed for the seller", call("GET", "/seller/products?status=rejected", PA_T), 200, pred=lambda d: [r["id"] for r in d["results"]] == [P1])
check("I rejected: nothing changed by the blocked calls", (200, prow(P1)), 200, pred=lambda r: r["status"] == "rejected" and r["active"] == "active")
check("I admin may still edit a rejected product", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"seoTitle": "admin edit"}), 200)
check("I admin re-reject (already rejected) needs no new reason", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "rejected", "seoTitle": "again"}), 200, pred=lambda x: x["rejectionReason"] == "Photos missing")
check("I admin approves -> clears rejection reason, seller unlocked", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "approved"}), 200, pred=lambda x: x["status"] == "approved" and x["rejectionReason"] is None)
check("I approved again: seller can edit", call("PATCH", f"/seller/products/{P1}", PA_T, body={"description": "back"}), 200)

# --- admin suspend
check("I admin suspend without reason -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"activeStatus": "suspended"}), 400)
check("I admin suspends with a reason", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"activeStatus": "suspended", "reason": "Policy breach"}), 200, pred=lambda x: x["activeStatus"] == "suspended" and x["suspensionReason"] == "Policy breach")
check("I suspended: seller PATCH -> 403 PRODUCT_SUSPENDED with reason", call("PATCH", f"/seller/products/{P1}", PA_T, body={"description": "x"}), 403, pred=lambda x: x.get("code") == "PRODUCT_SUSPENDED" and "Policy breach" in x["message"])
check("I suspended: seller cannot set active -> 403", call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "active"}), 403)
check("I suspended: seller cannot delete -> 403", call("DELETE", f"/seller/products/{P1}", PA_T), 403)
check("I suspended: seller cannot change media -> 403", call("PATCH", f"/seller/products/{P1}/media-files", PA_T, form=[("removeThumbnail", "true")]), 403)
check("I suspended: seller can still read it", call("GET", f"/seller/products/{P1}", PA_T), 200, pred=lambda x: x["activeStatus"] == "suspended" and x["suspensionReason"] == "Policy breach")
check("I admin sets inactive -> clears suspension reason", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"activeStatus": "inactive"}), 200, pred=lambda x: x["activeStatus"] == "inactive" and x["suspensionReason"] is None)
check("I un-suspended: seller can edit and set active", call("PATCH", f"/seller/products/{P1}", PA_T, body={"activeStatus": "active"}), 200)
check("I rejected AND suspended together needs one reason", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "rejected", "activeStatus": "suspended", "reason": "both"}), 200, pred=lambda x: x["rejectionReason"] == "both" and x["suspensionReason"] == "both")
check("I both locks: seller blocked", call("PATCH", f"/seller/products/{P1}", PA_T, body={"description": "x"}), 403)
call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "approved", "activeStatus": "active"})

# --- admin create
check("I admin create defaults to approved + active", call("POST", "/admin/products", ADMIN, body=pbody("adm", sellerId=PA["id"])), 201, pred=lambda x: x["status"] == "approved" and x["activeStatus"] == "active")
check("I admin create rejected without reason -> 400", call("POST", "/admin/products", ADMIN, body=pbody("adm", sellerId=PA["id"], status="rejected")), 400)
check("I admin create suspended without reason -> 400", call("POST", "/admin/products", ADMIN, body=pbody("adm", sellerId=PA["id"], activeStatus="suspended")), 400)
c, d = call("POST", "/admin/products", ADMIN, body=pbody("adm", sellerId=PA["id"], status="pending", activeStatus="suspended", reason="start locked"))
P2 = d["id"] if c == 201 else 0
check("I admin create pending + suspended with reason", (c, d), 201, pred=lambda x: x["status"] == "pending" and x["activeStatus"] == "suspended" and x["suspensionReason"] == "start locked" and x["rejectionReason"] is None)
check("I admin_created history row carries the reason", (200, phist(P2)), 200, pred=lambda r: len(r) == 1 and r[0]["action"] == "admin_created" and r[0]["reason"] == "start locked" and r[0]["creatorType"] == "admin")
check("I old field isActive rejected for admin create -> 400", call("POST", "/admin/products", ADMIN, body=pbody("adm", sellerId=PA["id"], isActive=True)), 400)
check("I old field isPublished rejected for admin PATCH -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"isPublished": True}), 400)
check("I old field isActive rejected for admin PATCH -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"isActive": False}), 400)
check("I invalid status value -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "live"}), 400)
check("I invalid activeStatus value -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, body={"activeStatus": "gone"}), 400)
check("I status null -> 400", call("PATCH", f"/admin/products/{P1}", ADMIN, raw='{"status":null}'), 400)
check("I admin no-op status PATCH writes no history", (200, (len(phist(P1)), call("PATCH", f"/admin/products/{P1}", ADMIN, body={"status": "approved"})[0], len(phist(P1)))), 200, pred=lambda v: v[1] == 200 and v[0] == v[2])

# --- admin list filters + fields
check("I admin list shows status + activeStatus on every row", call("GET", "/admin/products?limit=100", ADMIN), 200, pred=lambda d: all(r["status"] in ("approved", "pending", "rejected") and r["activeStatus"] in ("active", "inactive", "suspended") and "isActive" not in r for r in d["results"]))
check("I admin list filter status=pending", call("GET", "/admin/products?status=pending&limit=100", ADMIN), 200, pred=lambda d: any(r["id"] == P2 for r in d["results"]) and all(r["status"] == "pending" for r in d["results"]))
check("I admin list filter activeStatus=suspended", call("GET", "/admin/products?activeStatus=suspended&limit=100", ADMIN), 200, pred=lambda d: any(r["id"] == P2 for r in d["results"]) and all(r["activeStatus"] == "suspended" for r in d["results"]))
check("I admin list combined filters", call("GET", f"/admin/products?status=pending&activeStatus=suspended&sellerId={PA['id']}", ADMIN), 200, pred=lambda d: [r["id"] for r in d["results"]] == [P2])
check("I admin list invalid status -> 400", call("GET", "/admin/products?status=live", ADMIN), 400)
check("I admin list old isActive filter -> 400", call("GET", "/admin/products?isActive=true", ADMIN), 400)
check("I admin list old isPublished filter -> 400", call("GET", "/admin/products?isPublished=true", ADMIN), 400)
check("I admin product details carries status fields", call("GET", f"/admin/products/{P2}", ADMIN), 200, pred=lambda x: x["status"] == "pending" and x["activeStatus"] == "suspended")

# --- history API
check("I product history: no token -> 401", call("GET", "/admin/product-status-history"), 401)
check("I product history: seller token -> 403", call("GET", "/admin/product-status-history", PA_T), 403)
check("I product history filter toStatus=rejected", call("GET", f"/admin/product-status-history?productId={P1}&toStatus=rejected", ADMIN), 200, pred=lambda d: len(d["results"]) >= 1 and all(r["toStatus"] == "rejected" for r in d["results"]))
check("I product history filter toActiveStatus=suspended", call("GET", f"/admin/product-status-history?productId={P1}&toActiveStatus=suspended", ADMIN), 200, pred=lambda d: len(d["results"]) >= 1 and all(r["toActiveStatus"] == "suspended" for r in d["results"]))
check("I product history filter action=seller_updated", call("GET", f"/admin/product-status-history?productId={P1}&action=seller_updated", ADMIN), 200, pred=lambda d: len(d["results"]) >= 1 and all(r["action"] == "seller_updated" for r in d["results"]))
check("I product history rows include product + seller summary", call("GET", f"/admin/product-status-history?productId={P1}&limit=1", ADMIN), 200, pred=lambda d: d["results"][0]["product"]["id"] == P1 and d["results"][0]["product"]["seller"]["id"] == PA["id"])
check("I product history search by product name", call("GET", f"/admin/product-status-history?search=T-prod-&limit=100", ADMIN), 200, pred=lambda d: len(d["results"]) > 0 and all("t-prod-" in r["product"]["name"].lower() for r in d["results"]))
check("I product history search by seller name", call("GET", f"/admin/product-status-history?search={dbrow(PA['id'])['name']}&limit=100", ADMIN), 200, pred=lambda d: len(d["results"]) > 0 and all(r["product"]["seller"]["id"] == PA["id"] for r in d["results"]))
check("I product history search '%' is literal", call("GET", "/admin/product-status-history?search=%25&limit=100", ADMIN), 200, pred=lambda d: d["results"] == [])
total = len(phist(P1))
pg1 = call("GET", f"/admin/product-status-history?productId={P1}&limit=2", ADMIN)
check("I product history cursor page 1", pg1, 200, pred=lambda d: len(d["results"]) == 2 and d["nextCursor"] is not None)
pg2 = call("GET", f"/admin/product-status-history?productId={P1}&limit=100&cursor={pg1[1]['nextCursor']}", ADMIN)
check("I product history cursor page 2 continues without overlap", pg2, 200, pred=lambda d: len(d["results"]) == total - 2 and not ({r["id"] for r in d["results"]} & {r["id"] for r in pg1[1]["results"]}) and max(r["id"] for r in d["results"]) < min(r["id"] for r in pg1[1]["results"]))
for n_, q in [("productId=0", "productId=0"), ("productId=abc", "productId=abc"), ("productId too big", "productId=99999999999"), ("invalid action", "action=hacked"), ("invalid toStatus", "toStatus=banned"), ("invalid toActiveStatus", "toActiveStatus=gone"), ("unknown param", "foo=1"), ("limit=101", "limit=101"), ("search 201 chars", "search=" + "a" * 201)]:
    check(f"I product history rejects: {n_}", call("GET", f"/admin/product-status-history?{q}", ADMIN), 400)
check("I product history unknown product id -> empty page", call("GET", "/admin/product-status-history?productId=987654321", ADMIN), 200, pred=lambda d: d["results"] == [])
check("I product history is read-only (POST -> 404)", call("POST", "/admin/product-status-history", ADMIN, body={}), 404)

# --- concurrency: 6 parallel seller edits racing an admin suspend never write to a frozen product
import concurrent.futures as cf
c, d = call("POST", "/seller/products", PA_T, body=pbody("race"))
PR = d["id"]
def seller_edit(i):
    return call("PATCH", f"/seller/products/{PR}", PA_T, body={"description": f"race {i}"})[0]
def admin_suspend():
    return call("PATCH", f"/admin/products/{PR}", ADMIN, body={"activeStatus": "suspended", "reason": "race"})[0]
with cf.ThreadPoolExecutor(8) as ex:
    futs = [ex.submit(seller_edit, i) for i in range(3)] + [ex.submit(admin_suspend)] + [ex.submit(seller_edit, i) for i in range(3, 6)]
    codes = [f.result() for f in futs]
check("I race: only 200/403 outcomes, admin suspend lands", (200, codes), 200, pred=lambda v: set(v) <= {200, 403} and v[3] == 200)
check("I race: product ends suspended", (200, prow(PR)), 200, pred=lambda r: r["active"] == "suspended")
check("I race: late seller edits are 403", call("PATCH", f"/seller/products/{PR}", PA_T, body={"description": "late"}), 403)

# --- seller delete + history survives
c, d = call("POST", "/seller/products", PA_T, body=pbody("del"))
PD = d["id"]
check("I seller deletes own approved product", call("DELETE", f"/seller/products/{PD}", PA_T), 200)
check("I deleted product is gone for the seller", call("GET", f"/seller/products/{PD}", PA_T), 404)
check("I deleted product keeps its history (admin view)", (200, phist(PD)), 200, pred=lambda r: len(r) == 1 and r[0]["product"]["id"] == PD)

# --- visibility rule (derived): approved AND active
vis = sql("select count(*) from seller_product where status='approved' and \"activeStatus\"='active' and \"deletedAt\" is null")
check("I visible products (approved+active) are countable via the two fields", (200, vis), 200, pred=lambda v: int(v) >= 1)

# --- seller dashboard numbers
check("I dashboard: no token -> 401", call("GET", "/seller/dashboard"), 401)
check("I dashboard: admin token -> 403", call("GET", "/seller/dashboard", ADMIN), 403)
check("I dashboard: inactive seller -> 403", call("GET", "/seller/dashboard", new_seller("approved", "inactive")["token"]), 403)
_cnt = lambda where: int(sql(f'select count(*) from seller_product where "sellerId"={PA["id"]} and "deletedAt" is null' + (f" and {where}" if where else "")))
check("I dashboard: counts match the database", call("GET", "/seller/dashboard", PA_T), 200, pred=lambda d: (
    d["totalProducts"] == _cnt("") and d["status"]["approved"] == _cnt("status='approved'") and d["status"]["pending"] == _cnt("status='pending'")
    and d["status"]["rejected"] == _cnt("status='rejected'") and d["activeStatus"]["active"] == _cnt("\"activeStatus\"='active'")
    and d["activeStatus"]["inactive"] == _cnt("\"activeStatus\"='inactive'") and d["activeStatus"]["suspended"] == _cnt("\"activeStatus\"='suspended'")
    and d["visibleProducts"] == _cnt("status='approved' and \"activeStatus\"='active'")
    and d["lockedProducts"] == _cnt("status='rejected' or \"activeStatus\"='suspended'")))
check("I dashboard: sku totals", call("GET", "/seller/dashboard", PA_T), 200, pred=lambda d: d["totalSkus"] == int(sql(f'select count(*) from seller_product_sku s join seller_product p on p.id=s."sellerProductId" where p."sellerId"={PA["id"]} and p."deletedAt" is null and s."deletedAt" is null')) and d["outOfStockSkus"] <= d["totalSkus"])
_before = call("GET", "/seller/dashboard", PB_T)[1]["totalProducts"]
call("POST", "/seller/products", PB_T, body=pbody("dash"))
check("I dashboard: a new product raises only that seller's total and visible counts", call("GET", "/seller/dashboard", PB_T), 200, pred=lambda d: d["totalProducts"] == _before + 1)
check("I dashboard: other sellers' products are not counted", call("GET", "/seller/dashboard", PA_T), 200, pred=lambda d: d["totalProducts"] == _cnt(""))

# --- catalog lookups for the seller product form
for path_ in ("/seller/catalog/categories/tree", "/seller/catalog/collections", "/seller/catalog/attributes"):
    check(f"I {path_}: no token -> 401", call("GET", path_), 401)
    check(f"I {path_}: admin token -> 403", call("GET", path_, ADMIN), 403)
check("I seller catalog: category tree", call("GET", "/seller/catalog/categories/tree", PA_T), 200, pred=lambda d: isinstance(d, list) and len(d) > 0 and "children" in d[0])
check("I seller catalog: collections page", call("GET", "/seller/catalog/collections?limit=100", PA_T), 200, pred=lambda d: "results" in d and all(r["isActive"] for r in d["results"]))
check("I seller catalog: cannot ask for inactive collections", call("GET", "/seller/catalog/collections?isActive=false&limit=100", PA_T), 200, pred=lambda d: all(r["isActive"] for r in d["results"]))
check("I seller catalog: attributes carry their values", call("GET", "/seller/catalog/attributes?limit=100", PA_T), 200, pred=lambda d: len(d["results"]) > 0 and all(r["isActive"] and "values" in r for r in d["results"]))
_sx = new_seller("approved", "inactive")
check("I seller catalog: inactive seller -> 403", call("GET", "/seller/catalog/attributes", _sx["token"]), 403)

# --- baseline migration
no_ph = sql("select count(*) from seller_product p where p.name not like 'T-%' and not exists (select 1 from seller_product_status_change_history h where h.\"sellerProductId\"=p.id)")
check("I every non-test product has at least one history row (baseline migration)", (200, no_ph), 200, pred=lambda v: v == "0")
check("I product history rows are removed with a hard-deleted product (FK cascade)", (200, (sql(f"delete from seller_product where id={PR}") or "x", sql(f"select count(*) from seller_product_status_change_history where \"sellerProductId\"={PR}"))), 200, pred=lambda v: v[1] == "0")

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
