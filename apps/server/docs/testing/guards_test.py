#!/usr/bin/env python3
"""Black-box tests for the role guards. Tokens are forged here the way an attacker would try: edited claims on a real
signature, alg none, the shared secret of the old scheme, wrong audience/issuer/algorithm, expired, bad subjects, a
deactivated admin, and a changed password. A token forged with the right key and claims is accepted, which proves the
forgeries fail for the reason under test and not because the forger is broken. Needs JWT_ACCESS_SECRET (read from .env)."""
import base64, hashlib, hmac, json, os, subprocess, sys, time, uuid

ROOT = os.environ.get("API_ROOT", "http://localhost:3100/v1/api")
DB = os.environ.get("TEST_DB", "pigeon_nest_dev")
HERE = os.path.dirname(os.path.abspath(__file__))
ENV = {}
for line in open(os.path.join(HERE, "..", "..", ".env")):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.rstrip("\n").split("=", 1)
        ENV[k.strip()] = v.strip().strip('"').strip("'")
BASE = os.environ.get("JWT_ACCESS_SECRET") or ENV["JWT_ACCESS_SECRET"]
RUN = uuid.uuid4().hex[:6]
RUN_NUM = str(int(RUN, 16) % 100000).zfill(5)
results = []


def run(cmd):
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout
    text, code = out.rsplit("\n", 1)
    try:
        return int(code), (json.loads(text) if text else None)
    except ValueError:
        return int(code), text


def call(method, path, token=None, body=None, headers=None):
    cmd = ["curl", "-s", "-g", "-X", method, ROOT + path, "-w", "\n%{http_code}"]
    if token is not None:
        cmd += ["-H", f"Authorization: {token}" if token.startswith(("Bearer", "Basic", "bearer")) else f"Authorization: Bearer {token}"]
    for h in headers or []:
        cmd += ["-H", h]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    return run(cmd)


def check(name, got, expected, pred=None):
    ok = got[0] in (expected if isinstance(expected, (list, tuple, set)) else [expected])
    if ok and pred is not None:
        try:
            ok = bool(pred(got[1]))
        except Exception:  # noqa
            ok = False
    results.append((ok, name, "" if ok else f"expected {expected} got {got[0]} body={str(got[1])[:200]}"))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  <-- " + results[-1][2]))


def truth(name, cond, detail=""):
    results.append((bool(cond), name, "" if cond else detail))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  <-- " + str(detail)))


def sql(q):
    return subprocess.run(["psql", "-d", DB, "-tAc", q], capture_output=True, text=True).stdout.strip()


# ---------------------------------------------------------------- forging
def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64(text):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def jwt(claims, key, alg="HS256", header=None):
    head = header or {"alg": alg, "typ": "JWT"}
    signing = b64(json.dumps(head).encode()) + "." + b64(json.dumps(claims).encode())
    if alg == "none":
        return signing + "."
    digest = {"HS256": hashlib.sha256, "HS512": hashlib.sha512}[alg]
    return signing + "." + b64(hmac.new(key.encode(), signing.encode(), digest).digest())


def role_key(role):
    return hmac.new(BASE.encode(), f"pigeon-nest:jwt:{role}".encode(), hashlib.sha256).hexdigest()


def stamp(role, password_hash):
    return hmac.new(role_key(role).encode(), password_hash.encode(), hashlib.sha256).hexdigest()[:24]


def good(role, sub, password_hash, **over):
    now = int(time.time())
    claims = {"sub": sub, "type": role, "pwd": stamp(role, password_hash), "iat": now, "exp": now + 600, "iss": "pigeon-nest", "aud": role, "jti": uuid.uuid4().hex}
    claims.update(over)
    return jwt({k: v for k, v in claims.items() if v is not None}, role_key(role))


def edit_payload(token, **over):
    h, p, s = token.split(".")
    claims = json.loads(unb64(p))
    claims.update(over)
    return f"{h}.{b64(json.dumps(claims).encode())}.{s}"


def cleanup():
    sql("delete from admin_user where email like 't-grd-%'")
    sql("delete from cart where \"userId\" in (select id from \"user\" where email like 't-grd-%')")
    sql("delete from \"user\" where email like 't-grd-%'")
    sql("delete from seller_setting_history where \"sellerId\" in (select id from seller where name like 'T Grd %')")
    sql("delete from seller_status_change_history where \"sellerId\" in (select id from seller where name like 'T Grd %')")
    sql("delete from seller where name like 'T Grd %'")


cleanup()
c, d = call("POST", "/admin/auth/login", body={"email": os.environ.get("ADMIN_EMAIL", "test-admin@example.com"), "password": os.environ.get("ADMIN_PASSWORD", "Admin@123")})
ADMIN = d["accessToken"]
c, d = call("POST", "/seller/auth/register", body={"name": "T Grd Seller", "phone": f"+88017{RUN_NUM}111", "password": "Passw0rd!x"})
SELLER, SID = d["accessToken"], int(sql("select id from seller where name='T Grd Seller'"))
sql(f"update seller set status='approved', \"activeStatus\"='active' where id={SID}")
c, d = call("POST", "/user/auth/register", body={"name": "T Grd User", "phone": f"+88017{RUN_NUM}222", "password": "Passw0rd!x", "email": f"t-grd-u-{RUN}@example.com"})
USER, UID = d["accessToken"], d["user"]["id"]
c, d = call("POST", "/user/auth/register", body={"name": "T Grd User 2", "phone": f"+88017{RUN_NUM}333", "password": "Passw0rd!x", "email": f"t-grd-v-{RUN}@example.com"})
USER2, UID2 = d["accessToken"], d["user"]["id"]
ADMIN_ID = int(sql("select id from admin_user where email='test-admin@example.com'"))
ADMIN_HASH = sql(f"select \"passwordHash\" from admin_user where id={ADMIN_ID}")
SELLER_HASH = sql(f"select \"passwordHash\" from seller where id={SID}")
USER_HASH = sql(f"select \"passwordHash\" from \"user\" where id={UID}")

ROUTES = {"admin": "/admin/order", "seller": "/seller/order", "user": "/user/returns"}
TOKENS = {"admin": ADMIN, "seller": SELLER, "user": USER}

print("--- the tokens we issue")
for role, tok in TOKENS.items():
    h, p, _ = tok.split(".")
    head, claims = json.loads(unb64(h)), json.loads(unb64(p))
    truth(f"{role}: HS256, audience {role}, issuer, id, expiry, password stamp, nothing secret", head["alg"] == "HS256" and claims["aud"] == role and claims["iss"] == "pigeon-nest" and claims["type"] == role and claims["jti"] and claims["exp"] > claims["iat"] and len(claims["pwd"]) == 24 and set(claims) == {"sub", "type", "pwd", "iat", "exp", "iss", "aud", "jti"}, claims)
    check(f"{role}: own token opens own route", call("GET", ROUTES[role], tok), 200)
c, d1 = call("POST", "/admin/auth/login", body={"email": "test-admin@example.com", "password": "Admin@123"})
truth("two logins never give the same token (jti)", d1["accessToken"] != ADMIN)

print("--- header shapes")
for role, route in ROUTES.items():
    for label, value in (("no header", None), ("Bearer with no token", "Bearer"), ("Bearer and a space", "Bearer "), ("lowercase scheme", f"bearer {TOKENS[role]}"), ("Basic scheme", f"Basic {TOKENS[role]}"), ("two tokens", f"Bearer {TOKENS[role]} {TOKENS[role]}"), ("raw token without scheme", None)):
        if label == "raw token without scheme":
            check(f"{role}: {label} -> 401", call("GET", route, None, headers=[f"Authorization: {TOKENS[role]}"]), 401)
        else:
            check(f"{role}: {label} -> 401", call("GET", route, value) if value is not None else call("GET", route), 401)
    check(f"{role}: garbage token -> 401", call("GET", route, "abc.def.ghi"), 401)
    check(f"{role}: one-part token -> 401", call("GET", route, "abc"), 401)
    check(f"{role}: empty parts -> 401", call("GET", route, ".."), 401)

print("--- a real token of another role: signed by us, not allowed here -> 403")
for role, route in ROUTES.items():
    for other, tok in TOKENS.items():
        if other != role:
            check(f"{other} token on a {role} route -> 403", call("GET", route, tok), 403)

print("--- edited claims on a real signature -> 401")
for role, route in ROUTES.items():
    for label, over in (("type changed to admin", {"type": "admin"}), ("type changed to seller", {"type": "seller"}), ("sub changed", {"sub": 1}), ("aud changed", {"aud": "admin"}), ("exp pushed out", {"exp": 4102444800}), ("pwd removed", {"pwd": "x"})):
        check(f"{role}: {label} -> 401/403", call("GET", route, edit_payload(TOKENS[role], **over)), [401])
check("user token with sub switched to another customer -> 401", call("GET", "/user/returns", edit_payload(USER, sub=UID2)), 401)
check("seller token edited to type admin on an admin route -> 401", call("GET", "/admin/order", edit_payload(SELLER, type="admin", aud="admin")), 401)

print("--- forged with the wrong key, algorithm or header")
now = int(time.time())
for role, route in ROUTES.items():
    claims = {"sub": 1, "type": role, "iat": now, "exp": now + 600}
    full = {"sub": 1, "type": role, "pwd": "x" * 24, "iat": now, "exp": now + 600, "iss": "pigeon-nest", "aud": role, "jti": "a"}
    check(f"{role}: alg none -> 401", call("GET", route, jwt(full, "", "none")), 401)
    check(f"{role}: alg none with a header of different case -> 401", call("GET", route, jwt(full, "", "none", {"alg": "None", "typ": "JWT"})), 401)
    check(f"{role}: signed with the base secret, old style claims -> 401", call("GET", route, jwt(claims, BASE)), 401)
    check(f"{role}: signed with the base secret, every claim present -> 401", call("GET", route, jwt(full, BASE)), 401)
    check(f"{role}: signed with another role's real key -> 401", call("GET", route, jwt(full, role_key("seller" if role != "seller" else "admin"))), [401, 403])
    check(f"{role}: right key but HS512 -> 401", call("GET", route, jwt(full, role_key(role), "HS512")), 401)
    check(f"{role}: empty signature -> 401", call("GET", route, jwt(full, role_key(role)).rsplit(".", 1)[0] + "."), 401)
    check(f"{role}: no signature part -> 401", call("GET", route, jwt(full, role_key(role)).rsplit(".", 1)[0]), 401)

print("--- a token forged with the right key is accepted only when every claim is right")
H = {"admin": ADMIN_HASH, "seller": SELLER_HASH, "user": USER_HASH}
S = {"admin": ADMIN_ID, "seller": SID, "user": UID}
for role, route in ROUTES.items():
    ok = good(role, S[role], H[role])
    check(f"{role}: faithful forgery is accepted (so the refusals below mean something)", call("GET", route, ok), 200)
    check(f"{role}: expired -> 401", call("GET", route, good(role, S[role], H[role], iat=now - 700, exp=now - 100)), 401)
    check(f"{role}: not valid yet (nbf) -> 401", call("GET", route, good(role, S[role], H[role], nbf=now + 3600)), 401)
    check(f"{role}: wrong audience -> 401", call("GET", route, good(role, S[role], H[role], aud="user" if role != "user" else "admin")), [401, 403])
    check(f"{role}: no audience -> 401", call("GET", route, good(role, S[role], H[role], aud=None)), 401)
    check(f"{role}: wrong issuer -> 401", call("GET", route, good(role, S[role], H[role], iss="someone-else")), 401)
    check(f"{role}: no issuer -> 401", call("GET", route, good(role, S[role], H[role], iss=None)), 401)
    check(f"{role}: type claim not the role -> 401", call("GET", route, good(role, S[role], H[role], type="admin" if role != "admin" else "user")), 401)
    check(f"{role}: no password stamp -> 401", call("GET", route, good(role, S[role], H[role], pwd=None)), 401)
    check(f"{role}: wrong password stamp -> 401", call("GET", route, good(role, S[role], H[role], pwd="0" * 24)), 401)
    check(f"{role}: stamp of another account's password -> 401", call("GET", route, good(role, S[role], "$2a$10$somethingelse")), 401)
    for label, sub in (("string sub", str(S[role])), ("float sub", S[role] + 0.5), ("zero sub", 0), ("negative sub", -S[role]), ("huge sub", 10**30), ("null sub", None), ("array sub", [S[role]]), ("object sub", {"id": S[role]})):
        check(f"{role}: {label} -> 401", call("GET", route, good(role, sub, H[role])), 401)
    check(f"{role}: account that does not exist -> 401", call("GET", route, good(role, 987654321, H[role])), 401)

print("--- an admin is checked on every request")
sql(f"insert into admin_user (name, email, \"passwordHash\", role, \"isActive\") values ('T Grd Admin', 't-grd-a-{RUN}@example.com', '$2a$10$gtestgtestgtestgtestgu', 'admin', true)")
GA = int(sql(f"select id from admin_user where email='t-grd-a-{RUN}@example.com'"))
GH = "$2a$10$gtestgtestgtestgtestgu"
tok = good("admin", GA, GH)
check("a second admin's token works", call("GET", "/admin/order", tok), 200)
sql(f"update admin_user set \"isActive\"=false where id={GA}")
check("deactivated admin -> 401 on the next request", call("GET", "/admin/order", tok), 401)
sql(f"update admin_user set \"isActive\"=true where id={GA}")
check("reactivated admin works again", call("GET", "/admin/order", tok), 200)
sql(f"update admin_user set \"passwordHash\"='$2a$10$changedchangedchangedch' where id={GA}")
check("changed admin password ends the old token -> 401", call("GET", "/admin/order", tok), 401)
sql(f"delete from admin_user where id={GA}")
check("deleted admin -> 401", call("GET", "/admin/order", tok), 401)
check("an admin cannot reach a seller route", call("GET", "/seller/order", ADMIN), 403)

print("--- seller and customer: status, deletion, password")
sql(f"update seller set \"activeStatus\"='inactive' where id={SID}")
check("seller route still opens for read-only 'any' routes when inactive", call("GET", "/seller/profile", SELLER), 200)
sql(f"update seller set \"activeStatus\"='active' where id={SID}")
sql(f"update seller set \"passwordHash\"='{SELLER_HASH}x' where id={SID}")
check("seller token dies when the password changes", call("GET", "/seller/profile", SELLER), 401)
sql(f"update seller set \"passwordHash\"='{SELLER_HASH}' where id={SID}")
check("...and works again with the original password", call("GET", "/seller/profile", SELLER), 200)
sql(f"update \"user\" set \"passwordHash\"='{USER_HASH}x' where id={UID}")
check("customer token dies when the password changes", call("GET", "/user/returns", USER), 401)
check("...also on the optional-token cart route", call("GET", "/user/carts", USER), 401)
sql(f"update \"user\" set \"passwordHash\"='{USER_HASH}' where id={UID}")
check("...and works again with the original password", call("GET", "/user/returns", USER), 200)

print("--- the cart routes (optional customer)")
check("cart: a valid customer", call("GET", "/user/carts", USER), 200)
check("cart: guest with a session header", call("GET", "/user/carts", None, headers=["x-cart-session: tgrd" + RUN + "aaaa"]), 200)
check("cart: a seller token -> 403", call("GET", "/user/carts", SELLER), 403)
check("cart: an admin token -> 403", call("GET", "/user/carts", ADMIN), 403)
check("cart: a forged token is not treated as a guest -> 401", call("GET", "/user/carts", edit_payload(USER, sub=UID2), headers=["x-cart-session: tgrd" + RUN + "aaaa"]), 401)
check("cart: alg none is not treated as a guest -> 401", call("GET", "/user/carts", jwt({"sub": UID, "type": "user"}, "", "none")), 401)
check("cart: a customer's token with the base secret -> 401", call("GET", "/user/carts", jwt({"sub": UID, "type": "user", "iat": now, "exp": now + 600}, BASE)), 401)

print("--- a customer cannot act as another customer")
c, mine = call("GET", "/user/returns", USER)
check("customer 1 and 2 each see their own list", call("GET", "/user/returns", USER2), 200, pred=lambda v: v["results"] == [])

print("--- every authenticated route refuses a missing token (sweep)")
paths = {
    "admin": ["/admin/dashboard", "/admin/dashboard/attention", "/admin/auth/me", "/admin/order", "/admin/returns", "/admin/commission/balances", "/admin/commission/changes", "/admin/settings", "/admin/products", "/admin/sellers", "/admin/users", "/admin/proposals", "/admin/payment-gateways", "/admin/carts"],
    "seller": ["/seller/dashboard", "/seller/dashboard/attention", "/seller/order", "/seller/returns", "/seller/commission/balance", "/seller/profile", "/seller/proposals", "/seller/products", "/seller/dashboard"],
    "user": ["/user/returns", "/user/profile", "/user/proposals", "/user/wishlist", "/user/addresses"],
}
for role, plist in paths.items():
    for pth in plist:
        code, _ = call("GET", pth)
        if code == 404:
            continue
        check(f"{pth}: no token -> 401", (code, None), 401)
        code2, _ = call("GET", pth, edit_payload(TOKENS[role], type="admin" if role != "admin" else "seller"))
        check(f"{pth}: edited token -> 401", (code2, None), 401)
        for other, tok in TOKENS.items():
            if other != role:
                check(f"{pth}: {other} token -> 403", call("GET", pth, tok), 403)

cleanup()
failed = [r for r in results if not r[0]]
print(f"\n==== {len(results) - len(failed)}/{len(results)} passed, {len(failed)} failed ====")
for _, n, dd in failed:
    print("FAILED:", n, dd)
sys.exit(1 if failed else 0)
