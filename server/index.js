import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { createRoutes } from './routes.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'New Project',
  icon        TEXT DEFAULT '📁',
  color       TEXT DEFAULT '#E8E5E0',
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pages (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  icon        TEXT DEFAULT '📄',
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT DEFAULT 'default'
);

CREATE TABLE IF NOT EXISTS page_tags (
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'text',
  content     TEXT DEFAULT '',
  checked     BOOLEAN DEFAULT FALSE,
  props       JSONB DEFAULT '{}',
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id, position);
CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id, position);
CREATE INDEX IF NOT EXISTS idx_page_tags_page ON page_tags(page_id);
CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags(tag_id);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_block ON comments(block_id, created_at);
`;

const PORT = process.env.PORT || 3001;

async function main() {
  // Ensure data directory exists
  const dataDir = './data/note-workspace';
  fs.mkdirSync(dataDir, { recursive: true });

  // Initialize PGlite with filesystem storage
  const db = new PGlite(dataDir);
  await db.exec(SCHEMA_SQL);
  await db.exec(
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;'
  );
  console.log('PGlite initialized with filesystem storage at ./data/note-workspace');

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.use('/api', createRoutes(db));

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
