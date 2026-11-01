import { createRemoteJWKSet, importJWK, jwtVerify } from 'jose';

// This authorization is deliberately restricted to the one synthetic private Preview.
export const PREVIEW_ORIGIN = 'https://private-alquileres-uspa-lab.sjo1848.workers.dev';
export const PREVIEW_ISSUER = 'https://sebastian-ojeda-pages.cloudflareaccess.com';
export const PREVIEW_OPERATOR = 'sjo1848@gmail.com';
export const PREVIEW_OWNER_ID = 'synthetic-catalog-owner';
export const PREVIEW_OWNER_EMAIL = 'preview.owner@example.test';
export const PREVIEW_ADMIN_ID = 'synthetic-catalog-admin';
export const PREVIEW_ADMIN_EMAIL = 'preview.admin@example.test';
export type PreviewDemoRole = 'OWNER' | 'ADMIN';
export const PREVIEW_DEMO_USERS: Record<PreviewDemoRole, { id: string; email: string }> = {
  OWNER: { id: PREVIEW_OWNER_ID, email: PREVIEW_OWNER_EMAIL },
  ADMIN: { id: PREVIEW_ADMIN_ID, email: PREVIEW_ADMIN_EMAIL },
};
export type PreviewAuthEnv = {
  AUTH_STRATEGY?: string;
  ACCESS_AUD?: string;
  /** Exact Access service-token Client ID; unset means service auth is disabled. */
  PREVIEW_QA_SERVICE_CLIENT_ID?: string;
  /** Loopback-only signed identity harness for browser tests. Never set on remote Preview. */
  PREVIEW_AUTH_LOCAL_TEST?: string;
  PREVIEW_AUTH_TEST_JWK?: string;
  PREVIEW_AUTH_TEST_ISSUER?: string;
};

export type PreviewIdentity = {
  expiresAt: number;
  source: 'operator' | 'playwright-service';
  serviceClientId?: string;
  binding: string;
};

// Access currently supports application/policy sessions up to 30 days. Keep a
// hard upper bound while allowing the signed assertion to expire earlier.
const MAX_ACCESS_ASSERTION_AGE = '720h';

export function requiresPreviewAuth(origin: string) {
  // Include immutable Preview aliases and the disabled production hostname.
  return /^(?:[a-z0-9-]+-)?alquileres-uspa-lab\.sjo1848\.workers\.dev$/.test(new URL(origin).hostname);
}

const keys = createRemoteJWKSet(new URL(`${PREVIEW_ISSUER}/cdn-cgi/access/certs`), {
  timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 300000,
});

export function previewAuthConfigured(env: PreviewAuthEnv, origin: string) {
  if(env.AUTH_STRATEGY!=='ACCESS_PREVIEW'||! /^[a-f0-9]{64}$/.test(env.ACCESS_AUD ?? ''))return false;
  if(origin===PREVIEW_ORIGIN)return true;
  try{
    const url=new URL(origin);
    return env.PREVIEW_AUTH_LOCAL_TEST==='true'&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)
      &&typeof env.PREVIEW_AUTH_TEST_ISSUER==='string'&&typeof env.PREVIEW_AUTH_TEST_JWK==='string';
  }catch{return false;}
}

function localTestOrigin(env:PreviewAuthEnv,origin:string){
  if(env.PREVIEW_AUTH_LOCAL_TEST!=='true')return false;
  try{const url=new URL(origin);return url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname);}catch{return false;}
}

async function identityBinding(source:PreviewIdentity['source'],subject:string,clientId?:string){
  const material=`${source}\0${subject}\0${clientId??''}`;
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(material)))))
    .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

export async function verifyPreviewIdentity(assertion: string, env: PreviewAuthEnv, origin: string): Promise<PreviewIdentity> {
  if (!previewAuthConfigured(env, origin) || !assertion || assertion.length > 16384) throw Error('Invalid Preview authentication');
  const issuer=localTestOrigin(env,origin)?env.PREVIEW_AUTH_TEST_ISSUER!:PREVIEW_ISSUER;
  const verifier=localTestOrigin(env,origin)
    ?await importJWK(JSON.parse(env.PREVIEW_AUTH_TEST_JWK!), 'RS256')
    :keys;
  const { payload } = await jwtVerify(assertion, verifier, {
    algorithms: ['RS256'], issuer, audience: env.ACCESS_AUD,
    requiredClaims: ['exp', 'iat', 'sub', 'type'], maxTokenAge: MAX_ACCESS_ASSERTION_AGE,
  });
  if (payload.type !== 'app' || typeof payload.sub !== 'string') throw Error('Application identity required');
  if (payload.email === PREVIEW_OPERATOR && payload.sub && payload.common_name === undefined
    && payload.service_token_id === undefined && payload.service_token_status !== true) {
    return { expiresAt: payload.exp!, source: 'operator', binding: await identityBinding('operator',payload.sub) };
  }

  // Service tokens identify themselves by Client ID in the signed Access JWT.
  // It is accepted only when a future operator explicitly configures that exact
  // Preview-only Client ID; no role or user identity is taken from the token.
  const expectedClientId = env.PREVIEW_QA_SERVICE_CLIENT_ID;
  const assertedClientId = payload.service_token_id ?? payload.common_name;
  if (expectedClientId && /^[A-Za-z0-9._-]{8,128}$/.test(expectedClientId)
    && assertedClientId === expectedClientId && payload.common_name === expectedClientId
    && payload.sub === '' && payload.email === undefined
    && (payload.service_token_status === undefined || payload.service_token_status === true)) {
    return { expiresAt: payload.exp!, source: 'playwright-service', serviceClientId: expectedClientId,
      binding: await identityBinding('playwright-service','',expectedClientId) };
  }
  throw Error('Authorized Preview identity required');
}

export async function verifyPreviewOperator(assertion: string, env: PreviewAuthEnv, origin: string) {
  const identity = await verifyPreviewIdentity(assertion, env, origin);
  if (identity.source !== 'operator') throw Error('Human operator identity required');
  return identity;
}
