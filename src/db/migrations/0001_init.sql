-- Review Reply MCP: first schema. SQLite syntax, works on Cloudflare D1 and local SQLite.
-- Every table carries owner_id so every query can be scoped to one owner.

CREATE TABLE owners (
  owner_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE business_profiles (
  owner_id TEXT PRIMARY KEY REFERENCES owners(owner_id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type TEXT,
  tone TEXT,
  signature TEXT,
  policies TEXT NOT NULL DEFAULT '[]',   -- JSON list
  never_say TEXT NOT NULL DEFAULT '[]',  -- JSON list
  languages TEXT NOT NULL DEFAULT '["en"]',
  updated_at TEXT NOT NULL
);

CREATE TABLE reviews (
  owner_id TEXT NOT NULL REFERENCES owners(owner_id) ON DELETE CASCADE,
  review_id TEXT NOT NULL,
  source TEXT NOT NULL,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  text TEXT NOT NULL DEFAULT '',
  review_date TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  author_name TEXT NOT NULL DEFAULT '',
  existing_owner_reply TEXT NOT NULL DEFAULT '',
  fingerprint TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, review_id),
  UNIQUE (owner_id, fingerprint)
);

CREATE TABLE tags (
  owner_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative')),
  tagged_at TEXT NOT NULL,
  -- one sentiment per theme per review (labelling guide rule 2)
  PRIMARY KEY (owner_id, review_id, theme),
  FOREIGN KEY (owner_id, review_id) REFERENCES reviews(owner_id, review_id) ON DELETE CASCADE
);

-- One row per tagged review: its lane and why.
CREATE TABLE review_flags (
  owner_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('normal', 'restricted', 'spam')),
  category TEXT CHECK (category IS NULL OR category IN ('health_safety', 'legal_threat', 'discrimination', 'fraud', 'other_serious', 'injection_attempt', 'spam')),
  reason TEXT,
  flagged_at TEXT NOT NULL,
  closed_at TEXT,
  PRIMARY KEY (owner_id, review_id),
  FOREIGN KEY (owner_id, review_id) REFERENCES reviews(owner_id, review_id) ON DELETE CASCADE
);

CREATE TABLE drafts (
  owner_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  draft_text TEXT NOT NULL,
  restricted INTEGER NOT NULL DEFAULT 0 CHECK (restricted IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'rejected')),
  edited_text TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  PRIMARY KEY (owner_id, review_id),
  FOREIGN KEY (owner_id, review_id) REFERENCES reviews(owner_id, review_id) ON DELETE CASCADE
);

CREATE TABLE fixes (
  owner_id TEXT NOT NULL REFERENCES owners(owner_id) ON DELETE CASCADE,
  fix_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  description TEXT NOT NULL,
  date_done TEXT NOT NULL,
  PRIMARY KEY (owner_id, fix_id)
);

CREATE TABLE usage (
  owner_id TEXT NOT NULL REFERENCES owners(owner_id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  reviews_tagged INTEGER NOT NULL DEFAULT 0,
  drafts_written INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, month)
);

CREATE INDEX idx_tags_theme ON tags(owner_id, theme, sentiment);
CREATE INDEX idx_reviews_date ON reviews(owner_id, review_date);
CREATE INDEX idx_flags_open ON review_flags(owner_id, lane, closed_at);
