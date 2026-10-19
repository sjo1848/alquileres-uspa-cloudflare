"""Checks that the ADMIN schema migration preserves synthetic legacy events."""
import json
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / 'apps/worker/migrations/0009_admin_audit_shape_and_review_queue_index.sql'
ACTION_MIGRATION = ROOT / 'apps/worker/migrations/0010_source_admin_audit_action_names.sql'


class AdminAuditMigrationTests(unittest.TestCase):
    def test_admin_api_paths_are_dispatched_to_the_worker_before_spa_fallback(self):
        for name in ('wrangler.jsonc', 'wrangler.preview.example.jsonc', 'wrangler.owner-e2e.runtime.jsonc'):
            config = json.loads((ROOT / 'apps/worker' / name).read_text())
            self.assertIn('/admin/*', config['assets']['run_worker_first'], name)

    def test_owner_api_paths_are_dispatched_to_the_worker_before_spa_fallback(self):
        for name in ('wrangler.jsonc', 'wrangler.preview.example.jsonc', 'wrangler.owner-e2e.runtime.jsonc'):
            config = json.loads((ROOT / 'apps/worker' / name).read_text())
            self.assertIn('/owner/*', config['assets']['run_worker_first'], name)

    def test_owner_api_and_direct_worker_first_routes_do_not_capture_public_detail_pages(self):
        for name in ('wrangler.jsonc', 'wrangler.preview.example.jsonc', 'wrangler.owner-e2e.runtime.jsonc'):
            config = json.loads((ROOT / 'apps/worker' / name).read_text())
            patterns = config['assets']['run_worker_first']
            self.assertIn('/api/*', patterns, name)
            for route in ('/listings/*/availability', '/listings/*/reconfirm', '/listings/*/images', '/listings/*/images/*'):
                self.assertIn(route, patterns, name)
            self.assertNotIn('/listings/*', patterns, name)

    def test_preserves_existing_events_and_accepts_source_shaped_generic_events(self):
        db = sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        db.execute('PRAGMA foreign_keys=ON')
        db.executescript('''
          CREATE TABLE users(id TEXT PRIMARY KEY);
          INSERT INTO users VALUES ('admin'),('owner');
          CREATE TABLE listings(id TEXT PRIMARY KEY, owner_id TEXT, status TEXT, publication_status TEXT, created_at TEXT);
          CREATE TABLE admin_audit_events (
            id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), listing_id TEXT NOT NULL,
            target_owner_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL CHECK(action IN ('LISTING_APPROVED','LISTING_PUBLISHED','LISTING_REJECTED')),
            reason TEXT, created_at TEXT NOT NULL
          );
          CREATE INDEX admin_audit_events_listing_idx ON admin_audit_events(listing_id,created_at DESC);
          CREATE INDEX admin_audit_events_recent_idx ON admin_audit_events(created_at DESC,id DESC);
          INSERT INTO admin_audit_events VALUES ('legacy','admin','listing-1','owner','LISTING_REJECTED','synthetic reason','2026-01-01T00:00:00.000Z');
          INSERT INTO admin_audit_events VALUES ('legacy-approved','admin','listing-2','owner','LISTING_APPROVED',NULL,'2026-01-02T00:00:00.000Z');
          INSERT INTO admin_audit_events VALUES ('legacy-published','admin','listing-3','owner','LISTING_PUBLISHED',NULL,'2026-01-03T00:00:00.000Z');
        ''')

        db.executescript(MIGRATION.read_text())

        columns = {row[1] for row in db.execute('PRAGMA table_info(admin_audit_events)')}
        self.assertTrue({'entity_type', 'entity_id', 'listing_id', 'target_owner_id', 'metadata'} <= columns)
        legacy = db.execute('SELECT entity_type,entity_id,listing_id,target_owner_id,metadata,reason FROM admin_audit_events WHERE id=?', ('legacy',)).fetchone()
        self.assertEqual(legacy, ('LISTING', 'listing-1', 'listing-1', 'owner', '{"reason":"synthetic reason"}', 'synthetic reason'))
        self.assertEqual(json.loads(legacy[4]), {'reason': 'synthetic reason'})

        db.executescript(ACTION_MIGRATION.read_text())
        normalized = dict(db.execute('SELECT id,action FROM admin_audit_events WHERE id LIKE \'legacy%\''))
        self.assertEqual(normalized, {'legacy': 'ADMIN_LISTING_REJECTED', 'legacy-approved': 'ADMIN_LISTING_APPROVED', 'legacy-published': 'ADMIN_LISTING_PUBLISHED'})

        db.execute('INSERT INTO admin_audit_events(id,actor_id,action,entity_type,entity_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)', ('generic','admin','OWNER_ASSISTED','USER','synthetic-user','{"synthetic":true}','2026-01-02T00:00:00.000Z'))
        generic = db.execute('SELECT entity_type,entity_id,listing_id,target_owner_id,metadata FROM admin_audit_events WHERE id=?', ('generic',)).fetchone()
        self.assertEqual(generic, ('USER', 'synthetic-user', None, None, '{"synthetic":true}'))
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute('INSERT INTO admin_audit_events(id,actor_id,action,entity_type,metadata,created_at) VALUES(?,?,?,?,?,?)', ('bad-json','admin','OWNER_ASSISTED','USER','not-json','2026-01-03T00:00:00.000Z'))

        plan = ' '.join(str(row[3]) for row in db.execute("EXPLAIN QUERY PLAN SELECT l.id FROM listings l JOIN users u ON u.id=l.owner_id WHERE (l.status='SUBMITTED' OR (l.status='APPROVED' AND l.publication_status='UNPUBLISHED')) ORDER BY l.created_at DESC,l.id DESC LIMIT 101"))
        self.assertIn('listings_admin_review_queue_created_idx', plan)
        self.assertNotIn('USE TEMP B-TREE FOR ORDER BY', plan)


if __name__ == '__main__':
    unittest.main()
