# NŌTE — Notion-Clone Workspace with PGLite

## What This Is

A feature-rich Notion-clone workspace app that runs entirely in the browser. PostgreSQL via PGLite (WASM) persists all data to IndexedDB. Zero backend server. Fully offline-first.

## Tech Stack

- **Build**: Vite 6 + React 18
- **Database**: @electric-sql/pglite (PostgreSQL WASM → IndexedDB)
- **Styling**: Vanilla CSS matching Notion's exact design system (no Tailwind, no CSS-in-JS)
- **State**: React hooks + custom `useDB` hook for async query patterns
- **Export**: Custom block→Markdown serializer
- **Images**: Base64 storage in PGLite BYTEA column (for small images), or blob URL references

---

## Feature Set

### Core Editor
- Block-based contentEditable editor
- Slash `/` command menu to change block types
- Enter = new block, Backspace on empty = delete block
- Debounced auto-save (300ms) to PGLite on every keystroke

### Block Types
| type       | Renders as                         | Markdown export              |
|------------|-------------------------------------|------------------------------|
| text       | Paragraph                          | `content\n\n`                |
| h1         | # Heading 1 (30px, bold)           | `# content\n\n`             |
| h2         | ## Heading 2 (24px, semibold)      | `## content\n\n`            |
| h3         | ### Heading 3 (20px, semibold)     | `### content\n\n`           |
| bullet     | • Bulleted list item               | `- content\n`               |
| number     | 1. Numbered list item              | `1. content\n`              |
| todo       | ☐/☑ Checkbox                       | `- [x] content\n`           |
| quote      | Left-bordered blockquote           | `> content\n\n`             |
| callout    | 💡 Colored callout box             | `> 💡 content\n\n`          |
| code       | Monospace code block               | ````\ncontent\n````         |
| divider    | Horizontal rule                    | `---\n\n`                   |
| table      | Editable grid with rows/cols       | Markdown table syntax        |
| image      | Inline image with caption          | `![caption](data:...)\n\n`  |
| mention    | Inline link to another note        | `[[Page Title]]\n`          |

### Tables (New)
- Stored as a block with type `table`
- `content` field holds JSON: `{ headers: string[], rows: string[][] }`
- Rendered as an editable HTML `<table>` with contentEditable cells
- Row/column add/remove via toolbar icons on hover
- Tab key moves between cells, Enter adds a new row
- Export as pipe-delimited Markdown table

### Images (New)
- Block type `image`
- Click to upload, or paste from clipboard
- Images stored as base64 data URLs in the block's `content` field
- `props` JSONB holds `{ caption: string, width: number, align: 'left'|'center'|'right' }`
- Renders with optional caption below, click-to-resize handles
- Max display width: 100% of page width, stored originals up to 2MB
- Export as `![caption](data:image/...)` in Markdown

### Note Mentions / Embeds (New)
- Block type `mention` — inline reference to another page
- Typing `[[` triggers a page search popup (like Notion's @ mention)
- Renders as a clickable chip: `📄 Page Title`
- Clicking navigates to that page
- `content` stores the target page ID
- `props` JSONB holds `{ page_title: string, page_icon: string }`
- Embedded view (toggle): shows a read-only preview of the referenced page's blocks inline
- Stale references: if target page is deleted, chip shows "Deleted page" in red

### Projects (New — Sidebar Grouping)
- Pages can belong to a project (folder-like grouping)
- Sidebar shows projects as collapsible groups
- Pages not in any project appear under "Uncategorized"
- Projects have: id, name, icon, color, position
- Drag pages between projects (stretch goal — implement as dropdown for MVP)
- "Move to project" context menu on page items
- Create/rename/delete projects from sidebar

### Tags (New — Search & Filtering)
- Pages can have multiple tags
- Tags are stored in a junction table (page_tags)
- Tags shown as colored pills below page title
- Sidebar filter: click a tag to filter page list
- Search bar searches both page titles AND tag names
- Tag management: add tags inline (type + Enter), remove with × button
- Predefined tag colors (8 Notion-style colors)

### Markdown Export
- Per-page "Export to Markdown" button in page toolbar
- Serializes all blocks including tables, images, mentions
- Downloads as `.md` file with sanitized filename
- Tables export as GitHub-flavored Markdown tables
- Images export as base64 data URLs (or `[image]` placeholder for large files)
- Mentions export as `[[Page Title]]` wikilink syntax

---

## Database Schema

```sql
-- Projects (folder grouping)
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'New Project',
  icon        TEXT DEFAULT '📁',
  color       TEXT DEFAULT '#E8E5E0',
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Pages
CREATE TABLE IF NOT EXISTS pages (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  icon        TEXT DEFAULT '📄',
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT DEFAULT 'default'
);

-- Page ↔ Tag junction
CREATE TABLE IF NOT EXISTS page_tags (
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

-- Blocks
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id, position);
CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id, position);
CREATE INDEX IF NOT EXISTS idx_page_tags_page ON page_tags(page_id);
CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags(tag_id);
```

---

## File Structure

```
note-app/
├── CLAUDE.md                          ← This file
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx                       ← React root
│   ├── styles/
│   │   └── notion.css                 ← Full Notion design system
│   ├── lib/
│   │   ├── db.js                      ← PGLite singleton + schema init
│   │   ├── pages.js                   ← Page CRUD
│   │   ├── blocks.js                  ← Block CRUD
│   │   ├── projects.js                ← Project CRUD
│   │   ├── tags.js                    ← Tag CRUD + page_tags junction
│   │   └── export.js                  ← Block[] → Markdown serializer
│   └── components/
│       ├── App.jsx                    ← Shell: sidebar + editor
│       ├── Sidebar.jsx                ← Project groups, page tree, search, tag filter
│       ├── ProjectGroup.jsx           ← Collapsible project section in sidebar
│       ├── PageEditor.jsx             ← Title, icon, tags, blocks, export btn
│       ├── Block.jsx                  ← Single block router (delegates to type-specific)
│       ├── blocks/
│       │   ├── TextBlock.jsx          ← contentEditable paragraph
│       │   ├── HeadingBlock.jsx       ← H1/H2/H3
│       │   ├── ListBlock.jsx          ← Bullet, numbered, todo
│       │   ├── QuoteBlock.jsx         ← Blockquote
│       │   ├── CalloutBlock.jsx       ← Callout box
│       │   ├── CodeBlock.jsx          ← Code block
│       │   ├── DividerBlock.jsx       ← Horizontal rule
│       │   ├── TableBlock.jsx         ← Editable table grid
│       │   ├── ImageBlock.jsx         ← Image upload + caption
│       │   └── MentionBlock.jsx       ← Note reference / embed
│       ├── SlashMenu.jsx              ← "/" command palette
│       ├── MentionSearch.jsx          ← "[[" page search popup
│       ├── IconPicker.jsx             ← Emoji grid popover
│       ├── TagInput.jsx               ← Tag pills + add input
│       └── TagFilter.jsx              ← Sidebar tag filter chips
```

---

## Design System — Mirror Notion Exactly

### Colors
```css
--text-primary:       rgb(55, 53, 47);
--text-secondary:     rgba(55, 53, 47, 0.65);
--text-tertiary:      rgba(55, 53, 47, 0.45);
--text-placeholder:   rgba(55, 53, 47, 0.35);
--bg-primary:         #ffffff;
--bg-sidebar:         #fbfbfa;
--bg-hover:           rgba(55, 53, 47, 0.04);
--bg-active:          rgba(55, 53, 47, 0.08);
--border-default:     rgba(55, 53, 47, 0.09);
--border-heavy:       rgba(55, 53, 47, 0.16);
--accent-blue:        rgb(35, 131, 226);
--accent-blue-bg:     rgba(35, 131, 226, 0.08);
--red:                rgb(235, 87, 87);
--callout-bg:         rgba(241, 241, 239, 0.6);
--code-bg:            rgba(135, 131, 120, 0.15);
```

### Tag Colors (Notion's 8)
```css
--tag-default:   rgba(206, 205, 202, 0.5);    /* gray */
--tag-gray:      rgba(155, 154, 151, 0.4);
--tag-brown:     rgba(140, 46, 0, 0.2);
--tag-orange:    rgba(245, 93, 0, 0.2);
--tag-yellow:    rgba(233, 168, 0, 0.2);
--tag-green:     rgba(0, 135, 107, 0.2);
--tag-blue:      rgba(0, 120, 223, 0.2);
--tag-purple:    rgba(103, 36, 222, 0.2);
--tag-pink:      rgba(221, 0, 129, 0.2);
--tag-red:       rgba(255, 0, 26, 0.2);
```

### Typography
```css
--font-sans:  -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
--font-mono:  iawriter-mono, Nitti, Menlo, Courier, monospace;
```

### Sizing
- Sidebar width: 248px
- Page max-width: 708px
- Page horizontal padding: 96px
- Page title: 40px / 700 weight
- Body text: 16px / 1.5 line-height
- Code: 14px mono
- Block hover border-radius: 3px
- Menu shadows: `0 0 0 1px rgba(15,15,15,.05), 0 3px 6px rgba(15,15,15,.1), 0 9px 24px rgba(15,15,15,.2)`

### Interactions
- Hover on blocks: subtle gray background
- Drag handle (6-dot grip): appears on hover, left of block
- Menu items: instant highlight, no transition >80ms
- Sidebar items: 4px border-radius, 30px min-height
- Buttons: no borders, transparent bg, hover to reveal
- All menus: shadow, 4px radius, 4px padding

---

## Component Specifications

### TableBlock.jsx
```
State: { headers: string[], rows: string[][] }
Stored in: block.content as JSON string

Rendering:
┌─────────┬─────────┬─────────┐
│ Header1 │ Header2 │ Header3 │  ← contentEditable, bold, bg: var(--bg-hover)
├─────────┼─────────┼─────────┤
│ Cell    │ Cell    │ Cell    │  ← contentEditable cells
│ Cell    │ Cell    │ Cell    │
└─────────┴─────────┴─────────┘
         [+ col]              [+ row]

Keyboard:
- Tab → next cell (wraps to next row)
- Shift+Tab → previous cell
- Enter → new row at end
- Cell changes debounce-saved (300ms)

Toolbar (on hover over table):
- "+ column" button right of last header
- "+ row" button below last row
- Click column header → option to delete column
- Click row start → option to delete row

CSS:
- Borders: 1px solid var(--border-default)
- Cell padding: 6px 10px
- Header bg: var(--bg-hover)
- Min column width: 80px
- Table width: 100%
```

### ImageBlock.jsx
```
State: { src: string (base64 data URL), caption: string, width: number }
Stored in: block.content = base64 src, block.props = { caption, width, align }

Rendering:
┌──────────────────────────────┐
│                              │
│         [image]              │  ← <img> with max-width
│                              │
├──────────────────────────────┤
│  Caption text here           │  ← contentEditable, centered, gray
└──────────────────────────────┘

Upload methods:
1. Click "Add an image" placeholder → file input (accept="image/*")
2. Paste image from clipboard (listen for 'paste' event)
3. Drag and drop onto the block

Processing:
- Read file as base64 via FileReader
- Validate: max 2MB, must be image/*
- Store full base64 in block.content
- Default width: 100%, resizable via drag handles (stretch goal)

CSS:
- Image: border-radius 4px, centered
- Caption: font-size 14px, color var(--text-tertiary), text-align center, margin-top 6px
- Placeholder: dashed border, 120px height, centered icon + text
```

### MentionBlock.jsx + MentionSearch.jsx
```
Trigger: User types "[[" anywhere in a text block
→ Opens MentionSearch popup positioned at caret

MentionSearch:
- Text input auto-focused
- Queries pages table: WHERE title ILIKE '%search%'
- Shows max 6 results with icon + title
- Arrow keys + Enter to select, Escape to close
- On select: inserts a mention block after current block

MentionBlock rendering:
┌─────────────────────────────────┐
│ 📄 Referenced Page Title    ▸   │  ← clickable chip
└─────────────────────────────────┘

- Clicking navigates to that page (sets activePage)
- If referenced page was deleted: "⚠️ Deleted page" in red
- Optional: expand toggle (▸/▾) to show embedded preview
  - Embedded preview: renders target page's blocks read-only, indented, gray border-left

Storage:
- block.content = target page ID
- block.props = { page_title, page_icon, embedded: false }
- On load, resolve current title/icon from pages table (props are cache)
```

### Sidebar.jsx (Enhanced)
```
Layout:
┌──────────────────────────┐
│ [N] NŌTE          [≡]   │  ← logo + collapse toggle
├──────────────────────────┤
│ 🔍 Search…               │  ← searches titles + tags
├──────────────────────────┤
│ Tags: [work] [idea] [+] │  ← clickable filter chips
├──────────────────────────┤
│ ▾ 📁 Project Alpha   [+]│  ← collapsible project group
│   📄 Page One            │
│   📄 Page Two            │
│ ▾ 📁 Project Beta    [+]│
│   📄 Page Three          │
├──────────────────────────┤
│ ▾ Uncategorized       [+]│  ← pages with no project
│   📄 Loose Page          │
├──────────────────────────┤
│ [+ New page]             │
│ [+ New project]          │
└──────────────────────────┘

Behaviors:
- Search: filter by title ILIKE or tag name ILIKE
- Tag filter: clicking a tag chip filters to pages with that tag
- Click tag again to deselect
- Projects: collapsible, right-click or ··· for rename/delete
- Page items: right-click or ··· for "Move to project…" submenu
- "Move to project" shows dropdown of all projects + "None"
```

### TagInput.jsx
```
Renders below page title in editor:

  [work ×] [urgent ×] [+ Add tag...]

- Existing tags shown as colored pills with × remove button
- Text input at end: type tag name + Enter to add
- Autocomplete dropdown: shows existing tags matching input
- If typed tag doesn't exist, creates new one in tags table
- Each tag gets a color (cycles through Notion's 8 tag colors)
- Remove: deletes from page_tags junction, NOT from tags table
```

---

## Implementation Order (for Claude Code)

Phase 1 — Foundation
1. `npm create vite@latest note-app -- --template react && cd note-app`
2. `npm install @electric-sql/pglite`
3. Create `src/lib/db.js` — PGLite singleton, full schema with all 5 tables
4. Create `src/styles/notion.css` — complete Notion design system
5. Create `src/lib/pages.js`, `src/lib/blocks.js` — basic CRUD

Phase 2 — Core Editor
6. Create `Block.jsx` + all files in `blocks/` subfolder (TextBlock, HeadingBlock, etc.)
7. Create `SlashMenu.jsx`
8. Create `PageEditor.jsx` — title, icon picker, block list
9. Create `Sidebar.jsx` — basic page list (no projects/tags yet)
10. Create `App.jsx` — wire sidebar + editor
11. Test: create pages, edit blocks, slash menu, persistence across refresh

Phase 3 — Tables & Images
12. Create `blocks/TableBlock.jsx` — editable grid
13. Create `blocks/ImageBlock.jsx` — upload, paste, display, caption
14. Add table + image to SlashMenu options
15. Update `export.js` to handle table + image markdown serialization

Phase 4 — Projects
16. Create `src/lib/projects.js` — project CRUD
17. Create `ProjectGroup.jsx` — collapsible sidebar group
18. Update `Sidebar.jsx` — group pages by project, add project management
19. Update `PageEditor.jsx` — "Move to project" in page toolbar
20. Update page create flow — optional project assignment

Phase 5 — Tags
21. Create `src/lib/tags.js` — tag CRUD + junction table operations
22. Create `TagInput.jsx` — tag pills with add/remove
23. Create `TagFilter.jsx` — sidebar tag chips for filtering
24. Update `Sidebar.jsx` — integrate tag filter into search
25. Update `PageEditor.jsx` — tag input below title

Phase 6 — Mentions & Embeds
26. Create `MentionSearch.jsx` — "[[" triggered page search popup
27. Create `blocks/MentionBlock.jsx` — clickable page reference chip
28. Wire mention insertion into text block keydown handler
29. Add optional embedded preview toggle
30. Handle stale references (deleted pages)

Phase 7 — Polish
31. Export: update `export.js` for all new block types
32. Loading states, error handling, empty states
33. Keyboard shortcuts: Ctrl+N (new page), Ctrl+Shift+E (export)
34. Performance: virtualize block list for pages with 100+ blocks (stretch)
35. Responsive: sidebar auto-collapses below 768px

---

## Key Technical Decisions

### PGLite Initialization
```javascript
// db.js — singleton pattern
import { PGlite } from '@electric-sql/pglite';
let instance = null;
export async function getDB() {
  if (instance) return instance;
  instance = new PGlite('idb://note-workspace');
  await instance.exec(SCHEMA_SQL);
  return instance;
}
```

### ContentEditable + React
- NEVER use dangerouslySetInnerHTML for active editing — it fights the cursor
- On mount: set `ref.current.innerText = content`
- On input: read `ref.current.innerText`, save to state + debounce DB write
- Only sync from state → DOM when `document.activeElement !== ref.current`

### Debounced Saves
```javascript
const saveTimer = useRef(null);
const handleInput = () => {
  const text = ref.current.innerText;
  setLocalContent(text);
  clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => updateBlock(id, { content: text }), 300);
};
```

### Image Handling
- FileReader.readAsDataURL for base64 encoding
- Validate size < 2MB before storing
- For clipboard paste: listen for `paste` event, check `clipboardData.items` for image types
- Store in block.content as full data URL string

### Table JSON Storage
```javascript
// block.content for type="table"
JSON.stringify({
  headers: ["Name", "Status", "Priority"],
  rows: [
    ["Task 1", "Done", "High"],
    ["Task 2", "In Progress", "Medium"]
  ]
})
```

### Mention Resolution
```javascript
// On MentionBlock mount, resolve current page info
const resolved = await db.query(
  'SELECT id, title, icon FROM pages WHERE id = $1', [block.content]
);
// If no result → page was deleted → show stale indicator
```

---

## Gotchas & Warnings

1. PGLite WASM must be excluded from Vite's dependency optimizer:
   ```javascript
   // vite.config.js
   optimizeDeps: { exclude: ['@electric-sql/pglite'] }
   ```

2. PGLite init is async — show a loading spinner until `getDB()` resolves

3. contentEditable cursor position resets if you re-render the DOM — always guard with `document.activeElement !== ref`

4. Base64 images can be large — don't store more than ~2MB per image or PGLite/IndexedDB may slow down

5. JSONB in PGLite: use `::jsonb` cast in queries if needed; `props` column default is `'{}'`

6. Foreign key ON DELETE SET NULL for project_id — deleting a project doesn't delete pages, just ungroups them

7. Tag uniqueness: use UNIQUE constraint on tags.name, handle INSERT conflict with `ON CONFLICT DO NOTHING`

8. Mention resolution is async — MentionBlock needs a loading/skeleton state while querying

---

## Testing Checklist

- [ ] Create page → appears in sidebar → blocks editable
- [ ] Slash menu → all 14 block types create correctly
- [ ] Table: add rows, add columns, edit cells, Tab navigation, delete row/col
- [ ] Image: file upload, clipboard paste, caption editing, displays correctly
- [ ] Mention: type [[, search pages, select, chip renders, click navigates
- [ ] Mention: delete referenced page → chip shows "Deleted page"
- [ ] Projects: create, rename, delete, move pages between projects
- [ ] Tags: add to page, remove from page, filter sidebar by tag
- [ ] Search: finds pages by title AND by tag name
- [ ] Export: all block types serialize correctly to Markdown
- [ ] Persistence: refresh browser → all data intact
- [ ] Delete page → blocks cascade deleted, removed from sidebar
- [ ] Multiple pages: switch between them, no data bleed

