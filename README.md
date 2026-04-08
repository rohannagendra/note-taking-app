# NOTE

A Notion-inspired workspace app with a block-based editor, project organization, tagging, and full-text search, powered by PGLite (PostgreSQL compiled to WASM) with an Express backend for persistent on-disk storage.

<!-- screenshot here -->

## Tech Stack

- **Frontend**: React 19, Vite 8
- **Backend**: Express 5 (Node.js)
- **Database**: PGLite (PostgreSQL WASM) with filesystem storage
- **Styling**: Vanilla CSS (Notion design system)
- **Concurrency**: concurrently (runs server + client in one command)

## Prerequisites

- Node.js 18+

## Quick Start

```bash
git clone <repository-url>
cd note-taking-app
npm install
npm run dev
```

Running `npm run dev` starts both the Express backend on port 3001 and the Vite dev server on port 5173. The Vite dev server proxies `/api` requests to the backend automatically.

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Data Storage

All data is persisted to disk at `./data/note-workspace/` via PGLite's filesystem storage driver. The database is a full PostgreSQL instance running in Node.js -- no external database server required. Deleting the `data/` directory resets all data.

The bulk sync feature exports all pages as Markdown files to `./data/markdown/`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend (port 3001) and frontend (port 5173) concurrently |
| `npm run server` | Start only the Express backend |
| `npm run client` | Start only the Vite dev server |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the production build |

## Project Structure

```
notesapp/
├── package.json
├── vite.config.js
├── index.html
├── CLAUDE.md                        # AI assistant instructions
├── server/
│   ├── index.js                     # Express server + PGLite init + schema
│   └── routes.js                    # REST API routes (pages, blocks, projects, tags, comments, sync, import)
├── src/
│   ├── main.jsx                     # React entry point
│   ├── styles/
│   │   └── notion.css               # Full design system (light + dark mode)
│   ├── lib/
│   │   ├── db.js                    # API fetch helper
│   │   ├── pages.js                 # Page CRUD + search + favorites + sync + import
│   │   ├── blocks.js                # Block CRUD + reorder + comments
│   │   ├── projects.js              # Project CRUD
│   │   ├── tags.js                  # Tag CRUD + page-tag associations
│   │   └── export.js                # Block-to-Markdown and Block-to-HTML serializers
│   └── components/
│       ├── App.jsx                  # Root shell: sidebar + editor state management
│       ├── Sidebar.jsx              # Navigation, search, sort, tag filter, sync, import
│       ├── ProjectGroup.jsx         # Collapsible project folder in sidebar
│       ├── PageEditor.jsx           # Page title, icon, tags, block list, export, backlinks
│       ├── Block.jsx                # Block wrapper with drag handle + comments
│       ├── SlashMenu.jsx            # "/" command palette (14 block types)
│       ├── FormattingToolbar.jsx    # Floating toolbar for text formatting + colors
│       ├── MentionSearch.jsx        # "[[" page search popup
│       ├── IconPicker.jsx           # Emoji grid for page icons
│       ├── TagInput.jsx             # Tag pills with autocomplete
│       ├── TagFilter.jsx            # Sidebar tag filter chips
│       ├── BlockComments.jsx        # Per-block comment thread
│       └── blocks/
│           ├── TextBlock.jsx        # Paragraph with slash menu + mention trigger
│           ├── HeadingBlock.jsx     # H1, H2, H3
│           ├── ListBlock.jsx        # Bullet, numbered, to-do
│           ├── QuoteBlock.jsx       # Blockquote
│           ├── CalloutBlock.jsx     # Highlighted callout box
│           ├── CodeBlock.jsx        # Monospace code block
│           ├── DividerBlock.jsx     # Horizontal rule
│           ├── TableBlock.jsx       # Editable table grid
│           ├── ImageBlock.jsx       # Image upload with caption
│           └── MentionBlock.jsx     # Page reference with embedded preview
└── data/                            # Created at runtime
    ├── note-workspace/              # PGLite database files
    └── markdown/                    # Synced Markdown exports
```

## License

MIT
