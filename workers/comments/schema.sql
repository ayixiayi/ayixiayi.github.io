-- Comments table: plain-text editorial comments with 1-level replies
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  parent_id TEXT,
  author TEXT NOT NULL,
  website TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'deleted')),
  is_owner INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_slug_status_created
  ON comments (slug, status, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id
  ON comments (parent_id);

-- Sliding-window rate limiting keyed by SHA-256 IP hash
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_created
  ON rate_limits (ip_hash, created_at);
