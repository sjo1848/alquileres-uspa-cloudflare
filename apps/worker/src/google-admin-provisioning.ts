export type ProvisionedGoogleAdmin = {
  id: string;
  email: string;
  role: 'ADMIN';
  session_version: number;
};

export type GoogleAdminLookup =
  | { kind: 'absent' }
  | { kind: 'active'; user: ProvisionedGoogleAdmin }
  | { kind: 'blocked' };

/**
 * Resolves ADMIN only through an active exact-sub provisioning. A revoked row
 * or a row whose target is no longer ADMIN is deliberately fail-closed rather
 * than falling through to public OWNER registration.
 */
export async function findProvisionedGoogleAdmin(db: D1Database, subject: string): Promise<GoogleAdminLookup> {
  const row = await db.prepare(`SELECT i.revoked_at AS revokedAt,u.id,u.email,u.role,u.session_version
    FROM google_admin_identities i LEFT JOIN users u ON u.id=i.user_id WHERE i.subject=?`)
    .bind(subject).first<any>();
  if (!row) return { kind: 'absent' };
  if (row.revokedAt !== null || row.role !== 'ADMIN' || typeof row.id !== 'string' || typeof row.email !== 'string')
    return { kind: 'blocked' };
  return { kind: 'active', user: { id: row.id, email: row.email, role: 'ADMIN', session_version: row.session_version ?? 0 } };
}

/**
 * Operator-only D1 helper. It is intentionally not wired to any HTTP route.
 * The caller must first cryptographically verify a fresh Google ID token and
 * pass its `sub`; the insert then binds that exact subject to an existing D1
 * user whose server-side role is ADMIN. Email is never consulted.
 */
export async function provisionGoogleAdminIdentity(
  db: D1Database,
  subject: string,
  adminUserId: string,
  provisionedBy: string,
): Promise<'provisioned' | 'target-not-admin' | 'identity-conflict'> {
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(subject) || !/^[A-Za-z0-9._:-]{1,100}$/.test(adminUserId) ||
      !/^[A-Za-z0-9._:@-]{1,120}$/.test(provisionedBy)) throw new Error('invalid Google ADMIN provisioning input');
  const inserted = await db.prepare(`INSERT INTO google_admin_identities(subject,user_id,provisioned_at,provisioned_by)
    SELECT ?,u.id,unixepoch(),? FROM users u
    WHERE u.id=? AND u.role='ADMIN'
      AND NOT EXISTS(SELECT 1 FROM google_identities g WHERE g.provider='google' AND (g.subject=? OR g.user_id=u.id))
      AND NOT EXISTS(SELECT 1 FROM google_admin_identities i WHERE i.subject=? OR i.user_id=u.id)`)
    .bind(subject, provisionedBy, adminUserId, subject, subject).run();
  if (inserted.meta.changes === 1) return 'provisioned';
  const target = await db.prepare("SELECT role FROM users WHERE id=?").bind(adminUserId).first<{ role: string }>();
  if (!target || target.role !== 'ADMIN') return 'target-not-admin';
  return 'identity-conflict';
}

export function adminIdentityCookieLifetime(activeOwnerExpiry: number | null, activeAdminExpiry: number | null, now: number): number {
  const expires = [activeOwnerExpiry, activeAdminExpiry].filter((value): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > now);
  return expires.length ? Math.max(300, Math.max(...expires) - now) : 300;
}
