import { createRemoteJWKSet, jwtVerify } from 'jose';

// This authorization is deliberately restricted to the one synthetic private Preview.
export const PREVIEW_ORIGIN = 'https://private-alquileres-uspa-lab.sjo1848.workers.dev';
export const PREVIEW_ISSUER = 'https://sebastian-ojeda-pages.cloudflareaccess.com';
export const PREVIEW_OPERATOR = 'sjo1848@gmail.com';
export const PREVIEW_OWNER_ID = 'synthetic-catalog-owner';
export const PREVIEW_OWNER_EMAIL = 'preview.owner@example.test';
export type PreviewAuthEnv = { AUTH_STRATEGY?: string; ACCESS_AUD?: string };

const keys = createRemoteJWKSet(new URL(`${PREVIEW_ISSUER}/cdn-cgi/access/certs`), {
  timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 300000,
});

export function previewAuthConfigured(env: PreviewAuthEnv, origin: string) {
  return env.AUTH_STRATEGY === 'ACCESS_PREVIEW' && origin === PREVIEW_ORIGIN
    && /^[a-f0-9]{64}$/.test(env.ACCESS_AUD ?? '');
}

export async function verifyPreviewOperator(assertion: string, env: PreviewAuthEnv, origin: string) {
  if (!previewAuthConfigured(env, origin) || !assertion || assertion.length > 16384) throw Error('Invalid Preview authentication');
  const { payload } = await jwtVerify(assertion, keys, {
    algorithms: ['RS256'], issuer: PREVIEW_ISSUER, audience: env.ACCESS_AUD,
    requiredClaims: ['exp', 'iat', 'sub', 'email', 'type'], maxTokenAge: '1h',
  });
  if (payload.type !== 'app' || payload.email !== PREVIEW_OPERATOR
    || typeof payload.sub !== 'string' || !payload.sub || payload.common_name !== undefined) {
    throw Error('Operator identity required');
  }
  return { expiresAt: payload.exp! };
}
