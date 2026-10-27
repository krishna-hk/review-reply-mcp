-- Personal connection links. The link holds a secret token; only its hash is stored.
-- No foreign key on purpose: "delete my data" must not delete the owner's link.
CREATE TABLE invites (
  token_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

-- Requests per owner per minute, for rate limiting.
CREATE TABLE rate_limits (
  owner_id TEXT NOT NULL,
  minute TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, minute)
);
