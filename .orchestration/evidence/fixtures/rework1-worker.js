import bcrypt from "bcryptjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), (c) => c.charCodeAt(0));
}

function cookieValue(header, name) {
  return header?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function signJwt(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64url(encoder.encode(JSON.stringify({ ...user, iat: now, exp: now + 900 })));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned)));
  return `${unsigned}.${b64url(signature)}`;
}

async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid token");
  const header = JSON.parse(decoder.decode(fromB64url(parts[0])));
  const payload = JSON.parse(decoder.decode(fromB64url(parts[1])));
  if (header.alg !== "HS256" || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("invalid token");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, fromB64url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error("invalid token");
  return payload;
}

async function currentUser(request, env) {
  const bearer = request.headers.get("authorization")?.startsWith("Bearer ")
    ? request.headers.get("authorization").slice(7)
    : null;
  const rawCookie = cookieValue(request.headers.get("cookie"), "alquileres_session");
  const token = bearer ?? (rawCookie ? decodeURIComponent(rawCookie) : null);
  if (!token) return null;
  try {
    const claims = await verifyJwt(token, env.JWT_SECRET);
    return await env.DB.prepare("SELECT id, email, role FROM users WHERE id = ? AND email = ?")
      .bind(claims.id, claims.email).first();
  } catch {
    return null;
  }
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/fixture/sql" && request.method === "POST") {
      if (env.LOCAL_FIXTURE_ONLY !== "true") return json({ error: "fixture route disabled" }, 404);
      const { sql } = await request.json();
      const statements = sql.split(";").map((statement) => statement.trim()).filter(Boolean);
      const results = [];
      for (const statement of statements) {
        const query = env.DB.prepare(statement);
        results.push(/^(SELECT|WITH)\b/i.test(statement) ? await query.all() : await query.run());
      }
      return json({ results });
    }

    if (url.pathname === "/fixture/r2-keys" && (request.method === "GET" || request.method === "DELETE")) {
      if (env.LOCAL_FIXTURE_ONLY !== "true") return json({ error: "fixture route disabled" }, 404);
      const prefix = url.searchParams.get("prefix") ?? "";
      const listing = await env.IMAGES.list({ prefix });
      const keys = listing.objects.map((object) => object.key).sort();
      if (request.method === "DELETE") {
        await Promise.all(keys.map((key) => env.IMAGES.delete(key)));
        return json({ deleted: keys.length });
      }
      return json({ keys });
    }

    if (url.pathname === "/fixture/r2-object" && request.method === "DELETE") {
      if (env.LOCAL_FIXTURE_ONLY !== "true") return json({ error: "fixture route disabled" }, 404);
      const { key } = await request.json();
      await env.IMAGES.delete(key);
      return json({ deleted: true });
    }

    if (url.pathname === "/auth/session" && request.method === "POST") {
      if (env.LOCAL_FIXTURE_ONLY !== "true") return json({ error: "fixture route disabled" }, 404);
      const { userId } = await request.json();
      const user = await env.DB.prepare("SELECT id, email, role FROM users WHERE id=?").bind(userId).first();
      if (!user) return json({ error: "not found" }, 404);
      const token = await signJwt(user, env.JWT_SECRET);
      const sameSite = env.COOKIE_SAME_SITE === "none" || env.COOKIE_SAME_SITE === "strict" ? env.COOKIE_SAME_SITE : "lax";
      const secure = env.COOKIE_SECURE === "true" || env.NODE_ENV === "production" || sameSite === "none";
      const serializedSameSite = sameSite[0].toUpperCase() + sameSite.slice(1);
      return json({ token }, 200, { "set-cookie": `alquileres_session=${encodeURIComponent(token)}; Path=/; Max-Age=900; HttpOnly; SameSite=${serializedSameSite}${secure ? "; Secure" : ""}` });
    }

    if (url.pathname === "/auth/verify-password" && request.method === "POST") {
      const { password, hash } = await request.json();
      const started = performance.now();
      const valid = await bcrypt.compare(password, hash);
      return json({ valid, elapsedMs: performance.now() - started });
    }
    if (url.pathname === "/auth/verify-password-sync" && request.method === "POST") {
      const { password, hash } = await request.json();
      const started = performance.now();
      const valid = bcrypt.compareSync(password, hash);
      return json({ valid, elapsedMs: performance.now() - started });
    }

    if (url.pathname === "/auth/me") {
      const user = await currentUser(request, env);
      return user ? json(user) : json({ error: "unauthorized" }, 401);
    }
    if (url.pathname === "/admin") {
      const user = await currentUser(request, env);
      return user?.role === "ADMIN" ? json({ role: user.role }) : json({ error: "unauthorized" }, 401);
    }
    if (url.pathname.startsWith("/owner/listings/")) {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "unauthorized" }, 401);
      const listingId = url.pathname.split("/").at(-1);
      const listing = await env.DB.prepare("SELECT id FROM listings WHERE id = ? AND owner_id = ?").bind(listingId, user.id).first();
      return listing ? json(listing) : json({ error: "not found" }, 404);
    }

    if (url.pathname === "/images" && request.method === "POST") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "unauthorized" }, 401);
      const { listingId, bytes, contentType, position, failDb, mutateNoCleanup } = await request.json();
      const listing = await env.DB.prepare("SELECT id FROM listings WHERE id = ? AND owner_id = ? AND status IN ('DRAFT','REJECTED')")
        .bind(listingId, user.id).first();
      if (!listing) return json({ error: "not found" }, 404);
      const id = crypto.randomUUID();
      const key = `listings/${listingId}/${id}.bin`;
      const body = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0));
      await env.IMAGES.put(key, body, { httpMetadata: { contentType } });
      try {
        if (failDb) throw new Error("injected D1 insert failure");
        await env.DB.prepare("INSERT INTO listing_images(id, listing_id, object_key, content_type, byte_size, position) VALUES(?,?,?,?,?,?)")
          .bind(id, listingId, key, contentType, body.byteLength, position).run();
      } catch (error) {
        const skipCleanupForMutation = mutateNoCleanup === true && env.LOCAL_FIXTURE_ONLY === "true";
        if (!skipCleanupForMutation) await env.IMAGES.delete(key);
        return json({ error: error.message }, 500);
      }
      return json({ id, listingId, contentType, byteSize: body.byteLength, position });
    }

    if (url.pathname === "/images/reorder" && request.method === "POST") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "unauthorized" }, 401);
      const { listingId, ids } = await request.json();
      const owner = await env.DB.prepare("SELECT id FROM listings WHERE id=? AND owner_id=? AND status IN ('DRAFT','REJECTED')").bind(listingId, user.id).first();
      if (!owner) return json({ error: "not found" }, 404);
      const existing = await env.DB.prepare("SELECT id FROM listing_images WHERE listing_id=? ORDER BY position").bind(listingId).all();
      if (ids.length !== existing.results.length || new Set(ids).size !== ids.length || ids.some((id) => !existing.results.some((row) => row.id === id))) return json({ error: "invalid order" }, 400);
      const statements = [env.DB.prepare("UPDATE listing_images SET position = position - ? WHERE listing_id=?").bind(existing.results.length + 1, listingId)];
      ids.forEach((id, position) => statements.push(env.DB.prepare("UPDATE listing_images SET position=? WHERE id=? AND listing_id=?").bind(position, id, listingId)));
      await env.DB.batch(statements);
      return json({ ids });
    }

    if (url.pathname.startsWith("/images/public/") && request.method === "GET") {
      const id = url.pathname.split("/").at(-1);
      const image = await env.DB.prepare("SELECT i.object_key, i.content_type, i.byte_size FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.id=? AND l.status='APPROVED' AND l.published=1")
        .bind(id).first();
      if (!image) return new Response("not found", { status: 404 });
      const object = await env.IMAGES.get(image.object_key);
      if (!object) return new Response("not found", { status: 404 });
      return new Response(object.body, { headers: { "content-type": image.content_type, "content-length": String(image.byte_size) } });
    }

    if (url.pathname.startsWith("/images/delete/") && request.method === "DELETE") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "unauthorized" }, 401);
      const id = url.pathname.split("/").at(-1);
      const image = await env.DB.prepare("SELECT i.id, i.listing_id, i.object_key, i.content_type, i.byte_size, l.owner_id, l.status FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.id=?")
        .bind(id).first();
      if (!image || image.owner_id !== user.id || !["DRAFT", "REJECTED"].includes(image.status)) return json({ error: "not found" }, 404);
      const object = await env.IMAGES.get(image.object_key);
      if (!object) return json({ error: "image object missing; metadata retained" }, 409);
      await env.IMAGES.delete(image.object_key);
      try {
        const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM listing_images WHERE listing_id=?").bind(image.listing_id).first();
        const statements = [];
        if (url.searchParams.has("failDb")) statements.push(env.DB.prepare("INSERT INTO injected_failure_table(id) VALUES(?)").bind(id));
        statements.push(env.DB.prepare("UPDATE listing_images SET position=position-? WHERE listing_id=? AND position>(SELECT position FROM listing_images WHERE id=?)").bind(count.n + 1, image.listing_id, id));
        statements.push(env.DB.prepare("DELETE FROM listing_images WHERE id=?").bind(id));
        statements.push(env.DB.prepare("UPDATE listing_images SET position=position+? WHERE listing_id=? AND position<0").bind(count.n, image.listing_id));
        await env.DB.batch(statements);
      } catch {
        if (object) await env.IMAGES.put(image.object_key, object.body, { httpMetadata: object.httpMetadata });
        return json({ error: "metadata delete failed; object restored" }, 500);
      }
      return json({ ok: true });
    }

    if (url.pathname.startsWith("/images/manage/") && request.method === "GET") {
      const user = await currentUser(request, env);
      if (!user) return json({ error: "unauthorized" }, 401);
      const id = url.pathname.split("/").at(-1);
      const image = await env.DB.prepare("SELECT i.object_key, i.content_type, i.byte_size, l.owner_id, l.status FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE i.id=?")
        .bind(id).first();
      if (!image || image.owner_id !== user.id || !["DRAFT", "REJECTED"].includes(image.status)) return json({ error: "not found" }, 404);
      const object = await env.IMAGES.get(image.object_key);
      if (!object) return json({ error: "image object missing" }, 404);
      const body = new Uint8Array(await object.arrayBuffer());
      return json({ contentType: image.content_type, byteSize: image.byte_size, bytes: btoa(String.fromCharCode(...body)) });
    }

    return json({ error: "not found" }, 404);
  },
};
