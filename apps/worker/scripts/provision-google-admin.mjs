import { createRemoteJWKSet, jwtVerify } from 'jose';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleAdminProvisioningToken(token, clientId, jwks = GOOGLE_JWKS) {
  if (typeof token !== 'string' || token.length < 1 || token.length > 16_384 ||
      typeof clientId !== 'string' || clientId.length < 1 || clientId.length > 255) {
    throw new Error('A bounded ID token and GOOGLE_CLIENT_ID are required.');
  }
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ['RS256'], issuer: GOOGLE_ISSUERS, audience: clientId,
    maxTokenAge: '5 minutes', clockTolerance: 5,
  });
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if ((audiences.length > 1 && payload.azp !== clientId) ||
      (payload.azp !== undefined && payload.azp !== clientId) ||
      typeof payload.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(payload.sub) ||
      payload.email_verified !== true || typeof payload.nonce !== 'string' || payload.nonce.length < 16) {
    throw new Error('The Google token is not eligible for controlled provisioning.');
  }
  return { subject: payload.sub };
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildGoogleAdminProvisionSql(subject, userId, provisionedBy) {
  if (typeof subject !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(subject) ||
      typeof userId !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(userId) ||
      typeof provisionedBy !== 'string' || !/^[A-Za-z0-9._:@-]{1,120}$/.test(provisionedBy)) {
    throw new Error('Invalid subject, ADMIN user ID, or provisioning actor.');
  }
  return `INSERT INTO google_admin_identities(subject,user_id,provisioned_at,provisioned_by)\n` +
    `SELECT ${sqlString(subject)},u.id,unixepoch(),${sqlString(provisionedBy)} FROM users u\n` +
    `WHERE u.id=${sqlString(userId)} AND u.role='ADMIN'\n` +
    `AND NOT EXISTS(SELECT 1 FROM google_identities g WHERE g.provider='google' AND (g.subject=${sqlString(subject)} OR g.user_id=u.id))\n` +
    `AND NOT EXISTS(SELECT 1 FROM google_admin_identities i WHERE i.subject=${sqlString(subject)} OR i.user_id=u.id);\n` +
    `SELECT changes() AS provisioned;`;
}

async function readBoundedStdin(limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) throw new Error('ID token input exceeds the allowed size.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main(args) {
  const [userIdFlag, userId, actorFlag, actor] = args;
  if (userIdFlag !== '--user-id' || actorFlag !== '--provisioned-by' || !userId || !actor) {
    throw new Error('Usage: GOOGLE_CLIENT_ID=... node scripts/provision-google-admin.mjs --user-id <existing-admin-id> --provisioned-by <operator-ref> < google-id-token');
  }
  const token = await readBoundedStdin(16_384);
  const { subject } = await verifyGoogleAdminProvisioningToken(token, process.env.GOOGLE_CLIENT_ID);
  const sql = buildGoogleAdminProvisionSql(subject, userId, actor);
  // This tool does not connect to D1 or execute SQL. Review the one-use
  // statement and apply it only through a separately authorized procedure.
  process.stdout.write(`${sql}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : 'Google ADMIN provisioning failed.');
    process.exitCode = 1;
  });
}
