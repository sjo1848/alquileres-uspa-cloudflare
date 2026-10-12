import bcrypt from "bcryptjs";

const SESSION = "alquileres_session";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64url(bytes) {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("bad base64url");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
}

function normalizeEmail(email) { return email.trim().toLowerCase(); }

function cookiePolicy(env) {
  const sameSite = env.COOKIE_SAME_SITE === "strict" || env.COOKIE_SAME_SITE === "none" ? env.COOKIE_SAME_SITE : "lax";
  const secure = env.COOKIE_SECURE === "true" || env.NODE_ENV === "production" || sameSite === "none";
  return { sameSite, secure };
}

function serializeCookie(token, env, clearing = false) {
  const { sameSite, secure } = cookiePolicy(env);
  const title = sameSite[0].toUpperCase() + sameSite.slice(1);
  const value = clearing ? "" : encodeURIComponent(token);
  const age = clearing ? "Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT" : "Max-Age=900";
  return `${SESSION}=${value}; Path=/; ${age}; HttpOnly; SameSite=${title}${secure ? "; Secure" : ""}`;
}

function tokenLifetimeSeconds(env) {
  const spec = env.JWT_EXPIRES_IN ?? "15m";
  const match = /^(\d+)(s|m|h|d)$/.exec(spec);
  if (!match) throw new Error("unsupported JWT_EXPIRES_IN in local parity fixture");
  const scale = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return Number(match[1]) * scale;
}

async function sign(user, secret, env) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const p = b64url(encoder.encode(JSON.stringify({ id: user.id, email: user.email, role: user.role, iat: now, exp: now + tokenLifetimeSeconds(env) })));
  const input = `${h}.${p}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(input)));
  return `${input}.${b64url(sig)}`;
}

async function verify(token, secret) {
  if (typeof token !== "string" || token.length > 8192) throw new Error("invalid token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid token");
  const header = JSON.parse(decoder.decode(fromB64url(parts[0])));
  const claims = JSON.parse(decoder.decode(fromB64url(parts[1])));
  if (header.alg !== "HS256" || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("invalid token");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("HMAC", key, fromB64url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`))) throw new Error("invalid token");
  return claims;
}

function getCookie(header, name) {
  return header?.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers });
}

function proofFields(env, fields) {
  return env.LOCAL_FIXTURE_ONLY === "true" ? fields : {};
}

async function bodyOf(request) {
  try { return await request.json(); } catch { return null; }
}

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function currentUser(request, env) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const rawCookie = getCookie(request.headers.get("cookie"), SESSION);
  const token = bearer !== null ? bearer : rawCookie === undefined ? null : rawCookie;
  if (!token) return null;
  const decodedToken = decodeURIComponent(token);
  try {
    const claims = await verify(decodedToken, env.JWT_SECRET);
    const user = await env.DB.prepare("SELECT id,email,role FROM users WHERE id=?").bind(claims.id).first();
    if (!user || user.email !== claims.email) return null;
    return user;
  } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.JWT_SECRET) return json({ error: "server misconfigured" }, 500);

    if (url.pathname.startsWith("/__fixture/") && env.LOCAL_FIXTURE_ONLY !== "true") return json({ error: "not found" }, 404);
    if (url.pathname === "/__fixture/sql" && request.method === "POST" && env.LOCAL_FIXTURE_ONLY === "true") {
      const input = await bodyOf(request);
      if (!input || typeof input.sql !== "string" || input.sql.length > 2000 || !/^(UPDATE users SET role|UPDATE users SET email|DELETE FROM users|SELECT id,email,role FROM users)/i.test(input.sql.trim())) return json({ error: "fixture SQL rejected" }, 400);
      try {
        const result = /^(SELECT)/i.test(input.sql.trim()) ? await env.DB.prepare(input.sql).all() : await env.DB.prepare(input.sql).run();
        return json({ result });
      } catch { return json({ error: "fixture SQL failed" }, 400); }
    }

    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/auth/register" && request.method === "POST") {
      try { tokenLifetimeSeconds(env); } catch { return json({ error: "server misconfigured" }, 500); }
      const input = await bodyOf(request);
      if (!input || !validEmail(input.email) || typeof input.password !== "string" || input.password.length < 8) return json({ error: "validation failed" }, 400);
      const email = normalizeEmail(input.email);
      const started = performance.now();
      const passwordHash = await bcrypt.hash(input.password, 12);
      const elapsedMs = performance.now() - started;
      const id = crypto.randomUUID();
      try {
        await env.DB.prepare("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,'OWNER')").bind(id, email, passwordHash).run();
      } catch (error) {
        const message = String(error?.message ?? error);
        if (!message.includes("UNIQUE constraint failed: users.email")) return json({ error: "registration failed" }, 500);
        return json({ error: "Email already registered", ...proofFields(env, { hashCost: bcrypt.getRounds(passwordHash), elapsedMs }) }, 409);
      }
      const user = { id, email, role: "OWNER" };
      return json({ user, ...proofFields(env, { hashCost: bcrypt.getRounds(passwordHash), elapsedMs }) }, 201, { "set-cookie": serializeCookie(await sign(user, env.JWT_SECRET, env), env) });
    }

    if (url.pathname === "/auth/login" && request.method === "POST") {
      try { tokenLifetimeSeconds(env); } catch { return json({ error: "server misconfigured" }, 500); }
      const input = await bodyOf(request);
      if (!input || !validEmail(input.email) || typeof input.password !== "string" || input.password.length < 8) return json({ error: "validation failed" }, 400);
      const email = normalizeEmail(input.email);
      const row = await env.DB.prepare("SELECT id,email,password_hash,role FROM users WHERE email=?").bind(email).first();
      const started = performance.now();
      const valid = row ? await bcrypt.compare(input.password, row.password_hash) : false;
      const elapsedMs = performance.now() - started;
      if (!row || !valid) return json({ error: "Invalid credentials", ...proofFields(env, { elapsedMs }) }, 401);
      const user = { id: row.id, email: row.email, role: row.role };
      return json({ user, ...proofFields(env, { elapsedMs }) }, 200, { "set-cookie": serializeCookie(await sign(user, env.JWT_SECRET, env), env) });
    }

    if (url.pathname === "/auth/logout" && request.method === "POST") return json({ ok: true }, 200, { "set-cookie": serializeCookie("", env, true) });

    if (url.pathname === "/auth/me" && request.method === "GET") {
      const user = await currentUser(request, env);
      return user ? json(user) : json({ error: "Invalid or expired token" }, 401);
    }

    if (url.pathname === "/auth/admin-check" && request.method === "GET") {
      const user = await currentUser(request, env);
      return user?.role === "ADMIN" ? json({ role: "ADMIN", foundation: true }) : json({ error: user ? "Insufficient role" : "Invalid or expired token" }, 401);
    }

    if (url.pathname.startsWith("/owner/listings/") && request.method === "GET") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "Invalid or expired token" }, 401);
      const listingId = url.pathname.split("/").at(-1);
      const listing = await env.DB.prepare("SELECT id,title FROM listings WHERE id=? AND owner_id=?").bind(listingId, user.id).first();
      return listing ? json(listing) : json({ error: "not found" }, 404);
    }

    return json({ error: "not found" }, 404);
  }
};
