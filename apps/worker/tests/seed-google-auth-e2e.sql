PRAGMA foreign_keys=ON;
INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at,session_version)
VALUES('google-admin-e2e','google-admin@example.test','local-only-no-password-login','ADMIN',
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),0);
INSERT INTO google_admin_identities(subject,user_id,provisioned_at,provisioned_by)
VALUES('local-google-admin-sub','google-admin-e2e',unixepoch(),'local-isolated-e2e-fixture');
