-- Explicit Google ADMIN provisionings and role-bound revocable sessions.
-- M3.6 applies this migration only to isolated local/test D1.
CREATE TABLE google_admin_identities (
  subject TEXT PRIMARY KEY NOT NULL CHECK(length(subject) BETWEEN 1 AND 255),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provisioned_at INTEGER NOT NULL,
  provisioned_by TEXT NOT NULL CHECK(length(provisioned_by) BETWEEN 1 AND 120),
  revoked_at INTEGER,
  CHECK(revoked_at IS NULL OR revoked_at>=provisioned_at)
);

CREATE TRIGGER google_admin_identity_requires_admin
BEFORE INSERT ON google_admin_identities
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND role='ADMIN')
BEGIN SELECT RAISE(ABORT,'Google ADMIN identity must target an existing ADMIN user'); END;

CREATE TRIGGER google_admin_identity_no_owner_collision
BEFORE INSERT ON google_admin_identities
WHEN EXISTS(SELECT 1 FROM google_identities WHERE provider='google' AND (subject=NEW.subject OR user_id=NEW.user_id))
BEGIN SELECT RAISE(ABORT,'Google identity is already linked to OWNER'); END;

CREATE TRIGGER google_admin_identity_immutable
BEFORE UPDATE ON google_admin_identities
WHEN OLD.subject<>NEW.subject OR OLD.user_id<>NEW.user_id OR OLD.provisioned_at<>NEW.provisioned_at OR OLD.provisioned_by<>NEW.provisioned_by
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN SELECT RAISE(ABORT,'Google ADMIN provisioning is immutable except for one-way revocation'); END;

CREATE TRIGGER google_admin_identity_no_delete
BEFORE DELETE ON google_admin_identities
BEGIN SELECT RAISE(ABORT,'Google ADMIN provisioning must be revoked, not deleted'); END;

CREATE TRIGGER google_owner_identity_requires_owner
BEFORE INSERT ON google_identities
WHEN NEW.provider='google' AND (
  NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND role='OWNER') OR
  EXISTS(SELECT 1 FROM google_admin_identities WHERE subject=NEW.subject OR user_id=NEW.user_id)
)
BEGIN SELECT RAISE(ABORT,'Google OWNER identity cannot target or collide with an ADMIN provisioning'); END;

CREATE TABLE google_admin_auth_sessions (
  session_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role='ADMIN'),
  session_version INTEGER NOT NULL CHECK(session_version>=0),
  browser_binding_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  last_seen_at INTEGER NOT NULL,
  CHECK(expires_at>created_at)
);
CREATE INDEX google_admin_auth_sessions_user_expiry ON google_admin_auth_sessions(user_id,expires_at);
CREATE UNIQUE INDEX google_admin_auth_sessions_active_browser
  ON google_admin_auth_sessions(browser_binding_hash) WHERE revoked_at IS NULL;

CREATE TRIGGER google_admin_session_requires_provisioned_admin
BEFORE INSERT ON google_admin_auth_sessions
WHEN NEW.role<>'ADMIN' OR NOT EXISTS(
  SELECT 1 FROM google_admin_identities i JOIN users u ON u.id=i.user_id
  WHERE i.user_id=NEW.user_id AND i.revoked_at IS NULL AND u.role='ADMIN'
    AND u.session_version=NEW.session_version
)
BEGIN SELECT RAISE(ABORT,'Google ADMIN session requires an active explicit provisioning'); END;
