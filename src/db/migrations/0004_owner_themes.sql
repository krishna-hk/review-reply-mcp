-- Each owner defines their own themes (and optional umbrella groups) instead of a fixed restaurant list.
CREATE TABLE owner_themes (
  owner_id TEXT NOT NULL REFERENCES owners(owner_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  group_name TEXT,
  PRIMARY KEY (owner_id, name)
);

-- Which starting point was used, and any extra tagging rules the owner added.
CREATE TABLE theme_settings (
  owner_id TEXT PRIMARY KEY REFERENCES owners(owner_id) ON DELETE CASCADE,
  preset TEXT,
  rules TEXT NOT NULL DEFAULT '[]',  -- JSON list of short rules
  updated_at TEXT NOT NULL
);
