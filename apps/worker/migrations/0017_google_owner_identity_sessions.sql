-- Google identities and revocable OWNER sessions; applied only to isolated local D1 in M3.5.
CREATE TABLE google_identities (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'google'),
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, subject)
);

CREATE TABLE google_login_challenges (
  binding_hash TEXT NOT NULL,
  nonce_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (binding_hash, nonce_hash)
);
CREATE INDEX google_login_challenges_expiry ON google_login_challenges(expires_at);

CREATE TABLE google_auth_sessions (
  session_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role = 'OWNER'),
  session_version INTEGER NOT NULL CHECK (session_version >= 0),
  browser_binding_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  last_seen_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX google_auth_sessions_user_expiry ON google_auth_sessions(user_id, expires_at);
CREATE UNIQUE INDEX google_auth_sessions_active_browser
  ON google_auth_sessions(browser_binding_hash) WHERE revoked_at IS NULL;
