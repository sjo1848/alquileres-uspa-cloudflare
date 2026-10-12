import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(dir, "..");
const wrangler = path.join(fixtureRoot, "node_modules/wrangler/bin/wrangler.js");
const secret = "cf-au-i01-synthetic-secret-only";
const portBase = 8792;
const results = [];

function record(name, detail = "PASS") { results.push({ name, result: "PASS", detail }); }
function runWrangler(args) {
  execFileSync(process.execPath, [wrangler, ...args], { cwd: fixtureRoot, stdio: "pipe", timeout: 60000 });
}
async function waitReady(base, child, outputRef) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`wrangler exited ${child.exitCode}: ${outputRef.value}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`wrangler health timeout: ${outputRef.value}`);
}
async function withWorker(port, vars, fn) {
  const args = ["dev", "--config", "i01-auth/wrangler.jsonc", "--local", "--port", String(port), "--ip", "127.0.0.1"];
  for (const [key, value] of Object.entries({ JWT_SECRET: secret, ...vars })) args.push("--var", `${key}:${value}`);
  const child = spawn(process.execPath, [wrangler, ...args], { cwd: fixtureRoot, stdio: ["ignore", "pipe", "pipe"] });
  const outputRef = { value: "" };
  child.stdout.on("data", data => { outputRef.value += data.toString(); });
  child.stderr.on("data", data => { outputRef.value += data.toString(); });
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitReady(base, child, outputRef);
    return await fn(base);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 4000))]);
  }
}
async function request(base, route, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}
function tokenFromCookie(header) {
  assert.ok(header?.startsWith("alquileres_session="), `unexpected Set-Cookie: ${header}`);
  return decodeURIComponent(header.split(";", 1)[0].slice("alquileres_session=".length));
}
function sessionCookie(header) { return header.split(";", 1)[0]; }
function b64url(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
async function fixtureSql(base, sql) {
  const result = await request(base, "/__fixture/sql", { method: "POST", body: { sql } });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  return result.data.result;
}

// Local D1 only. Every command uses --local; no Cloudflare account is accessed.
runWrangler(["d1", "execute", "cf-au-i01-auth-local", "--local", "--config", "i01-auth/wrangler.jsonc", "--file", "i01-auth/schema.sql"]);
runWrangler(["d1", "execute", "cf-au-i01-auth-local", "--local", "--config", "i01-auth/wrangler.jsonc", "--file", "i01-auth/seed.sql"]);

await withWorker(portBase - 2, { LOCAL_FIXTURE_ONLY: "true", COOKIE_SAME_SITE: "lax", NODE_ENV: "development" }, async base => {
  const coldSuccess = await request(base, "/auth/login", { method: "POST", body: { email: "owner.a@example.test", password: "synthetic-owner-password-1" } });
  assert.equal(coldSuccess.response.status, 200);
  const warmSuccess = await request(base, "/auth/login", { method: "POST", body: { email: "owner.a@example.test", password: "synthetic-owner-password-1" } });
  assert.equal(warmSuccess.response.status, 200);
  record("first and repeated successful bcrypt compares in fresh local Workerd process", `cold ${coldSuccess.data.elapsedMs.toFixed(1)} ms; warm ${warmSuccess.data.elapsedMs.toFixed(1)} ms`);
});
await withWorker(portBase - 1, { LOCAL_FIXTURE_ONLY: "true", COOKIE_SAME_SITE: "lax", NODE_ENV: "development" }, async base => {
  const coldFailure = await request(base, "/auth/login", { method: "POST", body: { email: "owner.a@example.test", password: "incorrect-password" } });
  assert.equal(coldFailure.response.status, 401);
  const warmFailure = await request(base, "/auth/login", { method: "POST", body: { email: "owner.a@example.test", password: "incorrect-password" } });
  assert.equal(warmFailure.response.status, 401);
  record("first and repeated wrong-password bcrypt compares in fresh local Workerd process", `cold ${coldFailure.data.elapsedMs.toFixed(1)} ms; warm ${warmFailure.data.elapsedMs.toFixed(1)} ms`);
});

await withWorker(portBase, { LOCAL_FIXTURE_ONLY: "true", COOKIE_SAME_SITE: "lax", NODE_ENV: "development" }, async base => {
  let result = await request(base, "/auth/register", { method: "POST", body: { email: "  New.Owner@Example.Test ", password: "new-owner-pass-1" } });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.user.email, "new.owner@example.test");
  assert.equal(result.data.user.role, "OWNER");
  assert.equal(result.data.hashCost, 12);
  assert.ok(!JSON.stringify(result.data).toLowerCase().includes("password_hash"));
  const registeredToken = tokenFromCookie(result.response.headers.get("set-cookie"));
  const nodeClaims = jwt.verify(registeredToken, secret, { algorithms: ["HS256"] });
  assert.equal(nodeClaims.email, "new.owner@example.test");
  record("register normalizes email, hashes cost 12, returns OWNER without hash, issues Node-verifiable JWT", `elapsed ${result.data.elapsedMs.toFixed(1)} ms; hash rounds ${result.data.hashCost}`);

  result = await request(base, "/auth/login", { method: "POST", body: { email: " NEW.OWNER@example.test ", password: "new-owner-pass-1" } });
  assert.equal(result.response.status, 200);
  const loginToken = tokenFromCookie(result.response.headers.get("set-cookie"));
  const loginClaims = jwt.verify(loginToken, secret, { algorithms: ["HS256"] });
  assert.equal(loginClaims.role, "OWNER");
  assert.equal(loginClaims.exp - loginClaims.iat, 900);
  record("login accepts source-normalized email and bcrypt cost-12 hash", `success compare ${result.data.elapsedMs.toFixed(1)} ms elapsed`);

  result = await request(base, "/auth/login", { method: "POST", body: { email: "new.owner@example.test", password: "incorrect-pass" } });
  assert.equal(result.response.status, 401);
  assert.equal(result.data.error, "Invalid credentials");
  const wrongPasswordElapsed = result.data.elapsedMs;
  result = await request(base, "/auth/login", { method: "POST", body: { email: "missing@example.test", password: "incorrect-pass" } });
  assert.equal(result.response.status, 401);
  assert.equal(result.data.error, "Invalid credentials");
  assert.ok(result.data.elapsedMs < wrongPasswordElapsed, "fixture should capture absent dummy-hash timing differential as a known risk");
  record("wrong-password and unknown-email share response; timing enumeration differential observed", `bcrypt wrong-password ${wrongPasswordElapsed.toFixed(1)} ms vs absent account ${result.data.elapsedMs.toFixed(1)} ms`);

  result = await request(base, "/auth/register", { method: "POST", body: { email: " NEW.OWNER@EXAMPLE.TEST ", password: "new-owner-pass-2" } });
  assert.equal(result.response.status, 409);
  assert.equal(result.data.error, "Email already registered");
  record("duplicate registration after trim/lowercase is rejected");

  for (const input of [
    { email: "not-an-email", password: "valid-password" },
    { email: "owner@example.test", password: "short" },
    { email: "owner@example.test", password: 12345678 },
    { email: "owner@example.test" },
  ]) {
    result = await request(base, "/auth/login", { method: "POST", body: input });
    assert.equal(result.response.status, 400);
  }
  record("email/password DTO invalid cases (malformed email, short/non-string/missing password) rejected");

  result = await request(base, "/auth/login", { method: "POST", body: { email: " OWNER.A@EXAMPLE.TEST ", password: "synthetic-owner-password-1" } });
  assert.equal(result.response.status, 200);
  const ownerToken = tokenFromCookie(result.response.headers.get("set-cookie"));
  assert.equal(jwt.verify(ownerToken, secret, { algorithms: ["HS256"] }).id, "owner-a");
  const ownerCookie = sessionCookie(result.response.headers.get("set-cookie"));
  result = await request(base, "/auth/me", { headers: { cookie: ownerCookie } });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.id, "owner-a");
  record("seeded existing source-compatible bcryptjs cost-12 hash authenticates and sets session cookie");

  const nodeIssued = jwt.sign({ id: "owner-a", email: "owner.a@example.test", role: "ADMIN" }, secret, { algorithm: "HS256", expiresIn: "15m" });
  result = await request(base, "/auth/me", { headers: { authorization: `Bearer ${nodeIssued}` } });
  assert.equal(result.response.status, 200);
  result = await request(base, "/auth/admin-check", { headers: { authorization: `Bearer ${nodeIssued}` } });
  assert.equal(result.response.status, 401, "live D1 role OWNER must override stale JWT ADMIN");
  const adminLogin = await request(base, "/auth/login", { method: "POST", body: { email: "admin@example.test", password: "synthetic-owner-password-1" } });
  assert.equal(adminLogin.response.status, 200);
  const adminToken = tokenFromCookie(adminLogin.response.headers.get("set-cookie"));
  result = await request(base, "/auth/admin-check", { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(result.response.status, 200);
  await fixtureSql(base, "UPDATE users SET role='OWNER' WHERE id='admin-a'");
  result = await request(base, "/auth/admin-check", { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(result.response.status, 401);
  record("Node jsonwebtoken token accepted; role is reloaded live and a DB downgrade revokes ADMIN immediately");

  result = await request(base, "/owner/listings/listing-a", { headers: { authorization: `Bearer ${ownerToken}` } });
  assert.equal(result.response.status, 200);
  result = await request(base, "/owner/listings/listing-b", { headers: { authorization: `Bearer ${ownerToken}` } });
  assert.equal(result.response.status, 404);
  record("OWNER own listing allowed and foreign listing hidden");

  const ownerParts = ownerToken.split(".");
  const changedSignature = `${ownerParts[2][0] === "A" ? "B" : "A"}${ownerParts[2].slice(1)}`;
  const invalidJwt = `Bearer ${ownerParts[0]}.${ownerParts[1]}.${changedSignature}`;
  result = await request(base, "/auth/me", { headers: { authorization: invalidJwt, cookie: ownerCookie } });
  assert.equal(result.response.status, 401, "Bearer header must take precedence over a valid cookie");
  result = await request(base, "/auth/me", { headers: { authorization: `Bearer ${ownerToken}`, cookie: "alquileres_session=bad" } });
  assert.equal(result.response.status, 200, "valid Bearer takes precedence over an invalid cookie");
  const encodedBearer = ownerToken.replaceAll(".", "%2E");
  result = await request(base, "/auth/me", { headers: { authorization: `Bearer ${encodedBearer}` } });
  assert.equal(result.response.status, 200, "source URI-decodes selected Bearer token before JWT verification");
  const encodedCookie = `alquileres_session=${ownerToken.replaceAll(".", "%2E")}`;
  result = await request(base, "/auth/me", { headers: { cookie: encodedCookie } });
  assert.equal(result.response.status, 200, "source URI-decodes selected cookie token before JWT verification");
  result = await request(base, "/auth/me", { headers: { cookie: "alquileres_session=%" } });
  assert.equal(result.response.status, 500, "source guard decodes cookie outside AuthService JWT error handling; malformed percent-encoding is a source-compatible unresolved edge");
  result = await request(base, "/auth/me", { headers: { authorization: "Bearer %" } });
  assert.equal(result.response.status, 500, "malformed selected Bearer has the same pre-verification decode behavior as source");
  record("Bearer precedence and URI decoding verified; malformed cookie/Bearer reproduces source-style unhandled decode error (500), unresolved security/error-contract risk");

  const expired = jwt.sign({ id: "owner-a", email: "owner.a@example.test", role: "OWNER" }, secret, { algorithm: "HS256", expiresIn: -1 });
  const parts = ownerToken.split(".");
  const noneAlg = `${b64url({ alg: "none", typ: "JWT" })}.${parts[1]}.`;
  for (const badToken of [expired, invalidJwt.slice("Bearer ".length), noneAlg, "a.b.c", ""] ) {
    result = await request(base, "/auth/me", { headers: { authorization: `Bearer ${badToken}` } });
    assert.equal(result.response.status, 401);
  }
  record("expired, tampered, alg=none, malformed and empty bearer tokens denied");

  const deletedUserToken = jwt.sign({ id: "owner-b", email: "owner.b@example.test", role: "OWNER" }, secret, { algorithm: "HS256", expiresIn: "15m" });
  await fixtureSql(base, "DELETE FROM users WHERE id='owner-b'");
  result = await request(base, "/auth/me", { headers: { authorization: `Bearer ${deletedUserToken}` } });
  assert.equal(result.response.status, 401);

  const logout = await request(base, "/auth/logout", { method: "POST" });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get("set-cookie"), /Max-Age=0/);
  assert.match(logout.response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  result = await request(base, "/auth/me", { headers: { authorization: `Bearer ${ownerToken}` } });
  assert.equal(result.response.status, 200, "source logout clears cookie and does not revoke an already issued bearer JWT");
  record("logout clears cookie; bearer JWT remains valid until expiry or failed DB revalidation, matching source semantics");

  await fixtureSql(base, "UPDATE users SET email='changed@example.test' WHERE id='owner-a'");
  result = await request(base, "/auth/me", { headers: { authorization: `Bearer ${ownerToken}` } });
  assert.equal(result.response.status, 401);
  record("deleted account and changed email invalidate previously issued JWT on next request");

  result = await request(base, "/__fixture/sql", { method: "POST", body: { sql: "UPDATE users SET role='ADMIN' WHERE id='owner-a'" } });
  assert.equal(result.response.status, 200);
  record("fixture mutation route is present only behind local explicit flag");
});

const cookieProfiles = [
  { sameSite: "lax", nodeEnv: "development", secure: false, label: "development default Lax" },
  { sameSite: "strict", nodeEnv: "development", secure: false, label: "development Strict" },
  { sameSite: "none", nodeEnv: "development", secure: true, label: "None auto-Secure" },
  { sameSite: "lax", nodeEnv: "production", secure: true, label: "production auto-Secure" },
  { sameSite: "lax", nodeEnv: "development", cookieSecure: "true", secure: true, label: "explicit Secure" },
];
await withWorker(portBase + 10, { LOCAL_FIXTURE_ONLY: "true", COOKIE_SAME_SITE: "lax", NODE_ENV: "development", JWT_EXPIRES_IN: "1m" }, async base => {
  const registration = await request(base, "/auth/register", { method: "POST", body: { email: "expiry@example.test", password: "expiry-password-1" } });
  assert.equal(registration.response.status, 201);
  const token = tokenFromCookie(registration.response.headers.get("set-cookie"));
  const claims = jwt.verify(token, secret, { algorithms: ["HS256"] });
  assert.equal(claims.exp - claims.iat, 60);
  record("configured JWT_EXPIRES_IN=1m controls issued JWT lifetime");
});
await withWorker(portBase + 11, { LOCAL_FIXTURE_ONLY: "true", COOKIE_SAME_SITE: "lax", NODE_ENV: "development", JWT_EXPIRES_IN: "120" }, async base => {
  const sourceStyleToken = jwt.sign({ id: "numeric-expiry", email: "numeric-expiry@example.test", role: "OWNER" }, secret, { algorithm: "HS256", expiresIn: "120" });
  const sourceStyleClaims = jwt.decode(sourceStyleToken);
  assert.equal(sourceStyleClaims.exp, sourceStyleClaims.iat, "jsonwebtoken interprets string 120 as 120ms and floors exp to iat");
  const registration = await request(base, "/auth/register", { method: "POST", body: { email: "numeric-expiry@example.test", password: "expiry-password-1" } });
  assert.equal(registration.response.status, 500, "fixture deliberately fails closed for bare numeric strings rather than matching jsonwebtoken's immediately expired exp=iat result");
  const users = await fixtureSql(base, "SELECT id,email,role FROM users WHERE email='numeric-expiry@example.test'");
  assert.deepEqual(users.results, [], "invalid expiry config must fail before creating a user");
  record("unsupported bare-numeric JWT_EXPIRES_IN fails closed before hashing or database writes");
});
for (let index = 0; index < cookieProfiles.length; index++) {
  const profile = cookieProfiles[index];
  await withWorker(portBase + index + 1, {
    COOKIE_SAME_SITE: profile.sameSite,
    NODE_ENV: profile.nodeEnv,
    ...(profile.cookieSecure ? { COOKIE_SECURE: profile.cookieSecure } : {}),
  }, async base => {
    const login = await request(base, "/auth/login", { method: "POST", body: { email: "profile-missing@example.test", password: "missing-pass-1" } });
    assert.equal(login.response.status, 401, "core worker only uses a throwaway D1 database which was reset between processes");
    const registration = await request(base, "/auth/register", { method: "POST", body: { email: `cookie${index}@example.test`, password: "cookie-password-1" } });
    assert.equal(registration.response.status, 201);
    const cookie = registration.response.headers.get("set-cookie");
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /Max-Age=900/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, new RegExp(`SameSite=${profile.sameSite[0].toUpperCase()}${profile.sameSite.slice(1)}`));
    assert.equal(cookie.includes("; Secure"), profile.secure);
    const cleared = await request(base, "/auth/logout", { method: "POST" });
    assert.match(cleared.response.headers.get("set-cookie"), /Max-Age=0/);
    for (const attr of ["Path=/", "HttpOnly", `SameSite=${profile.sameSite[0].toUpperCase()}${profile.sameSite.slice(1)}`]) assert.ok(cleared.response.headers.get("set-cookie").includes(attr));
    assert.equal(cleared.response.headers.get("set-cookie").includes("; Secure"), profile.secure);
    if (index === 0) {
      const hiddenFixture = await request(base, "/__fixture/sql", { method: "POST", body: { sql: "UPDATE users SET role='ADMIN' WHERE id='none'" } });
      assert.equal(hiddenFixture.response.status, 404, "fixture-only route must be inaccessible without explicit local flag");
      record("fixture mutation endpoint hidden when normal configuration omits local-only flag");
    }
    record(`cookie issue/clear attributes ${profile.label}`);
  });
  // Reset the local database before the next process to isolate profile evidence.
  runWrangler(["d1", "execute", "cf-au-i01-auth-local", "--local", "--config", "i01-auth/wrangler.jsonc", "--file", "i01-auth/schema.sql"]);
}

const out = path.join(fixtureRoot, "../CF-AU-I01-P0P1-AUTH-RESULTS.json");
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({
  task: "CF-AU-I01-P0P1",
  scope: "synthetic local Workerd + D1 only",
  runtime: process.version,
  wrangler: "4.149.0",
  bcryptjs: "3.0.2",
  total: results.length,
  passed: results.filter(item => item.result === "PASS").length,
  results,
  limitations: ["not source API implementation", "email validator is deliberately narrow and not a full class-validator replacement", "JWT_EXPIRES_IN proof supports unit-bearing s/m/h/d strings; bare numeric text is explicitly rejected by this fixture because jsonwebtoken interprets it as millisecond text rather than numeric seconds", "no provider-billed CPU telemetry", "no brute-force/rate-limit or CSRF proof", "logout clears client cookie but does not revoke bearer JWT", "timing differential for unknown account vs wrong password remains a security finding"],
}, null, 2)}\n`);
console.log(`CF-AU-I01 local auth proof: ${results.length}/${results.length} grouped checks passed; results at ${out}`);
