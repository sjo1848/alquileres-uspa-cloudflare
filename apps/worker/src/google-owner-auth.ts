import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type GoogleOwnerAuthEnv = {
  DB: D1Database;
  AUTH_STRATEGY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_SESSION_TTL_SECONDS?: string;
  GOOGLE_AUTH_LOCAL_TEST?: string;
  GOOGLE_AUTH_TEST_JWKS?: string;
  JWT_SECRET?: string;
  COOKIE_SECURE?: string;
  COOKIE_SAME_SITE?: string;
  NODE_ENV?: string;
};

export type GoogleIdentityClaims = JWTPayload & {
  sub: string;
  email: string;
  email_verified: boolean;
  nonce: string;
};

const encoder = new TextEncoder();
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const browserCookieName = '__Host-alquileres_google_browser';

export function googleSessionTtl(env: GoogleOwnerAuthEnv): number {
  const raw = env.GOOGLE_SESSION_TTL_SECONDS ?? '604800';
  if (!/^\d{1,8}$/.test(raw)) throw new Error('invalid Google session TTL');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 300 || value > 2_592_000) throw new Error('invalid Google session TTL');
  return value;
}

export function googleAuthConfigured(request: Request, env: GoogleOwnerAuthEnv): boolean {
  if (env.AUTH_STRATEGY !== 'GOOGLE' || !env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID.length > 255 ||
      env.COOKIE_SECURE !== 'true') return false;
  try {
    googleSessionTtl(env);
    const sameSite=(env.COOKIE_SAME_SITE??'lax').toLowerCase();
    if(sameSite!=='lax'&&sameSite!=='strict')return false;
    if (typeof env.JWT_SECRET !== 'string' || encoder.encode(env.JWT_SECRET).byteLength < 32) return false;
  } catch { return false; }
  if (env.GOOGLE_AUTH_LOCAL_TEST === 'true') {
    const host = new URL(request.url).hostname;
    return (host === '127.0.0.1' || host === 'localhost' || host === '[::1]') && validLocalJwks(env.GOOGLE_AUTH_TEST_JWKS);
  }
  return true;
}

function validLocalJwks(raw: string | undefined): boolean {
  if (!raw || raw.length > 16_384) return false;
  try {
    const parsed = JSON.parse(raw) as { keys?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.keys) || parsed.keys.length < 1 || parsed.keys.length > 5) return false;
    const ids=new Set<string>();
    return parsed.keys.every((key) => {
      if(key.kty !== 'RSA' || key.alg !== 'RS256' || typeof key.kid !== 'string' || ids.has(key.kid) ||
          typeof key.n !== 'string' || typeof key.e !== 'string' ||
          ['d','p','q','dp','dq','qi','oth'].some(name=>name in key))return false;
      ids.add(key.kid);return true;
    });
  } catch { return false; }
}

export function browserBindingCookie(request: Request): string | undefined {
  const raw = request.headers.get('Cookie');
  const value = raw?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${browserCookieName}=`))?.slice(browserCookieName.length + 1);
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) return undefined;
  return value;
}

export function browserCookie(value: string, maxAge: number, clear = false): string {
  return `${browserCookieName}=${clear ? '' : value}; Path=/; ${clear ? 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : `Max-Age=${Math.max(0, Math.floor(maxAge))}`}; HttpOnly; Secure; SameSite=Strict`;
}

export function randomOpaqueValue(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashOpaqueValue(value: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function issueGoogleChallenge(db: D1Database, request: Request) {
  const binding = browserBindingCookie(request) ?? randomOpaqueValue();
  const nonce = randomOpaqueValue();
  const bindingHash = await hashOpaqueValue(binding);
  const nonceHash = await hashOpaqueValue(nonce);
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + 300;
  // One current nonce per browser: re-issuing invalidates a possibly intercepted prior challenge.
  // D1 batch executes atomically; parallel challenge requests for one browser
  // cannot leave more than the final nonce consumable.
  await db.batch([
    db.prepare('DELETE FROM google_login_challenges WHERE expires_at<=? OR binding_hash=?')
      .bind(createdAt, bindingHash),
    db.prepare('INSERT INTO google_login_challenges(binding_hash,nonce_hash,expires_at,created_at) VALUES(?,?,?,?)')
      .bind(bindingHash, nonceHash, expiresAt, createdAt),
  ]);
  return { binding, nonce, expiresAt };
}

export async function consumeGoogleChallenge(db: D1Database, binding: string, nonce: string): Promise<boolean> {
  const bindingHash = await hashOpaqueValue(binding);
  const nonceHash = await hashOpaqueValue(nonce);
  const result = await db.prepare('DELETE FROM google_login_challenges WHERE binding_hash=? AND nonce_hash=? AND expires_at>?')
    .bind(bindingHash, nonceHash, Math.floor(Date.now() / 1000)).run();
  return result.meta.changes === 1;
}

export async function verifyGoogleIdToken(token: string, env: GoogleOwnerAuthEnv, request: Request): Promise<GoogleIdentityClaims | null> {
  if (token.length > 16_384 || !env.GOOGLE_CLIENT_ID) return null;
  try {
    const keySet = env.GOOGLE_AUTH_LOCAL_TEST === 'true'
      ? createLocalJWKSet(JSON.parse(env.GOOGLE_AUTH_TEST_JWKS ?? '{}'))
      : GOOGLE_JWKS;
    const verified = await jwtVerify(token, keySet, {
      algorithms: ['RS256'],
      issuer: GOOGLE_ISSUERS,
      audience: env.GOOGLE_CLIENT_ID,
      maxTokenAge: '10 minutes',
      clockTolerance: 5,
    });
    const claims = verified.payload as GoogleIdentityClaims;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if ((audiences.length > 1 && claims.azp !== env.GOOGLE_CLIENT_ID) ||
        (claims.azp !== undefined && claims.azp !== env.GOOGLE_CLIENT_ID) ||
        typeof claims.sub !== 'string' || claims.sub.length < 1 || claims.sub.length > 255 ||
        typeof claims.email !== 'string' || claims.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) ||
        claims.email_verified !== true ||
        typeof claims.nonce !== 'string' || claims.nonce.length > 128 ||
        (env.GOOGLE_AUTH_LOCAL_TEST === 'true' && !isLoopback(request))) return null;
    return claims;
  } catch { return null; }
}

function isLoopback(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
}

export type OwnerIdentityResult =
  | { kind: 'owner'; user: { id: string; email: string; role: 'OWNER'; session_version: number } }
  | { kind: 'email_conflict' }
  | { kind: 'not_owner' };

export async function findOrCreateGoogleOwner(db: D1Database, claims: GoogleIdentityClaims): Promise<OwnerIdentityResult> {
  const email = claims.email.trim().toLowerCase();
  const linked = await db.prepare(`SELECT u.id,u.email,u.role,u.session_version FROM google_identities g
    JOIN users u ON u.id=g.user_id WHERE g.provider='google' AND g.subject=?`).bind(claims.sub).first<any>();
  if (linked) {
    if (linked.role !== 'OWNER') return { kind: 'not_owner' };
    if (linked.email !== email) {
      const conflict=await db.prepare('SELECT id FROM users WHERE lower(email)=? AND id<>?').bind(email,linked.id).first();
      if(conflict)return {kind:'email_conflict'};
      await db.prepare('UPDATE users SET email=?,updated_at=? WHERE id=? AND role=\'OWNER\'')
        .bind(email, new Date().toISOString(), linked.id).run();
      linked.email = email;
    }
    return { kind: 'owner', user: { id: linked.id, email: linked.email, role: 'OWNER', session_version: linked.session_version ?? 0 } };
  }

  const existingEmail = await db.prepare('SELECT id FROM users WHERE lower(email)=?').bind(email).first();
  // Email similarity is not proof of identity: never attach Google `sub` to a pre-existing account.
  if (existingEmail) return { kind: 'email_conflict' };

  const userId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const unusablePassword = `!google-auth-disabled:${randomOpaqueValue()}`;
  try {
    await db.batch([
      db.prepare(`INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at,session_version)
        VALUES(?,?,?,'OWNER',?,?,NULL,0)`).bind(userId, email, unusablePassword, timestamp, timestamp),
      db.prepare(`INSERT INTO google_identities(id,provider,subject,user_id,created_at,updated_at)
        VALUES(?,'google',?,?,?,?)`).bind(crypto.randomUUID(), claims.sub, userId, timestamp, timestamp),
    ]);
  } catch {
    // Resolve a concurrent first sign-in through the unique Google subject; never trust email as a fallback.
    const raced = await db.prepare(`SELECT u.id,u.email,u.role,u.session_version FROM google_identities g
      JOIN users u ON u.id=g.user_id WHERE g.provider='google' AND g.subject=?`).bind(claims.sub).first<any>();
    if (raced?.role === 'OWNER') return { kind: 'owner', user: { id: raced.id, email: raced.email, role: 'OWNER', session_version: raced.session_version ?? 0 } };
    if (raced) return { kind: 'not_owner' };
    if(await db.prepare('SELECT id FROM users WHERE lower(email)=?').bind(email).first())return {kind:'email_conflict'};
    throw new Error('Google identity creation failed');
  }
  return { kind: 'owner', user: { id: userId, email, role: 'OWNER', session_version: 0 } };
}
