-- Authentication lifecycle used only by the explicitly enabled loopback harness.
-- Preserve existing local accounts while all newly inserted users default unverified.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
UPDATE users SET email_verified_at=created_at WHERE email_verified_at IS NULL;
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE auth_action_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('VERIFY_EMAIL','RESET_PASSWORD')),
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX auth_action_tokens_user_purpose ON auth_action_tokens(user_id,purpose,expires_at);

CREATE TABLE auth_rate_limits (
  bucket TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  updated_at INTEGER NOT NULL
);
