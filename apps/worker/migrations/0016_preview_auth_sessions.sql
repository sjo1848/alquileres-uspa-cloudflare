-- Per-browser synthetic Preview sessions; no effect on production/password users.
CREATE TABLE preview_auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN')),
  identity_source TEXT NOT NULL CHECK (identity_source IN ('operator','playwright-service')),
  identity_binding TEXT NOT NULL,
  service_client_id TEXT,
  session_version INTEGER NOT NULL CHECK (session_version >= 0),
  refresh_token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  last_seen_at INTEGER NOT NULL,
  CHECK (expires_at > created_at),
  CHECK (
    (identity_source='operator' AND service_client_id IS NULL) OR
    (identity_source='playwright-service' AND service_client_id IS NOT NULL)
  )
);
CREATE INDEX preview_auth_sessions_user_expiry
  ON preview_auth_sessions(user_id, expires_at);
