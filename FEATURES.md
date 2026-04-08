# Features

## Block-Based Editor

The editor uses a contentEditable block-based architecture. Each block is an independent unit that can be created, edited, reordered, and deleted. New blocks are created with Enter; empty blocks are deleted with Backspace. All changes are debounce-saved (300ms) to the database automatically.

### Block Types (14 total)

| Block Type | Description |
|------------|-------------|
| Text | Plain paragraph block. Supports inline formatting. Default block type. |
| Heading 1 | Large section heading (30px, bold). |
| Heading 2 | Medium section heading (24px, semibold). |
| Heading 3 | Small section heading (20px, semibold). |
| Bulleted List | Unordered list item with bullet marker. |
| Numbered List | Ordered list item with automatic numbering. |
| To-do | Checkbox item with toggleable checked state. Checked items show strikethrough text. |
| Quote | Left-bordered blockquote. |
| Callout | Highlighted callout box with light background. |
| Code | Monospace code block with syntax-appropriate font. |
| Divider | Horizontal rule separator. |
| Table | Editable grid with headers, rows, and columns. Supports Tab/Shift+Tab cell navigation, Enter to add rows, and add/delete row and column controls. |
| Image | Image block with file upload, clipboard paste support, and editable caption. Images stored as base64, max 2MB. |
| Page Mention | Inline reference to another page. Renders as a clickable chip that navigates to the target page. Supports expandable embedded preview showing the referenced page's blocks read-only. Stale references (deleted pages) display a warning indicator. |

### Slash Command Menu

Typing `/` on an empty text block opens a command palette listing all 14 block types. The menu supports:

- Type-ahead filtering by block name or description
- Arrow key navigation with active item highlighting
- Enter to select, Escape to dismiss
- For structural blocks (divider, table, image, mention), a new block is created after the current one rather than converting the current block

### Text Formatting Toolbar

Selecting text within any block reveals a floating formatting toolbar with the following options:

- **Bold** (Ctrl/Cmd+B)
- **Italic** (Ctrl/Cmd+I)
- **Underline** (Ctrl/Cmd+U)
- **Strikethrough**
- **Inline code** -- wraps selection in `<code>` tags
- **Link** -- prompts for URL, wraps selection in an anchor tag; clicking again on a linked selection removes the link

### Text Color

The formatting toolbar includes a text color picker with 10 color options: Default, Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, and Red. Applied via `document.execCommand('foreColor')`.

### Text Highlight

The formatting toolbar includes a highlight color picker with 10 background color options matching the same palette as text colors. Applied via `document.execCommand('hiliteColor')`.

---

## Block Drag and Drop

Blocks can be reordered via drag and drop. Each block displays a drag handle (braille dots icon) on hover to the left of the block content. Dragging a block over another block shows a top or bottom drop indicator. The new order is persisted to the database after the drop.

---

## Block Comments

Each block has a comment button that opens a comment panel. Comments support:

- Adding new comments with Enter to submit
- Viewing all comments with relative timestamps (e.g., "5m ago", "2d ago")
- Deleting individual comments
- Comment count badge displayed on the block's comment button

---

## Page Management

### Creating Pages

New pages can be created from the sidebar footer, from within a project group, or with Ctrl/Cmd+N. Pages start with a default "Untitled" title and a single empty text block.

### Page Title and Icon

The page title is a contentEditable heading at the top of the editor with debounced auto-save. Each page has an emoji icon that can be changed via an emoji picker popover containing 48 common emoji options.

### Deleting Pages

Pages can be deleted from the sidebar via the delete button or context menu. Deleting a page cascades to remove all associated blocks, comments, and tag associations.

---

## Projects (Folder Grouping)

Pages can be organized into projects, which act as folders in the sidebar.

- **Create projects** from the sidebar footer
- **Rename projects** via the context menu (right-click or "..." button)
- **Change project icon** -- cycles through 16 preset folder/object emoji
- **Delete projects** -- pages are moved to Uncategorized (not deleted)
- **Move pages between projects** via context menu with a "Move to project" submenu listing all available projects plus "None (uncategorized)"
- **Collapsible groups** -- each project section can be expanded or collapsed
- **Page count** displayed next to each project name

Pages without a project appear under an "Uncategorized" section.

---

## Tags

Pages can have multiple tags displayed as colored pills below the page title.

### Tag Management

- Type a tag name and press Enter to add it
- Autocomplete dropdown suggests existing tags matching your input
- If no matching tag exists, a "Create" option appears to create a new tag
- Remove tags with the x button on each pill
- Tags are assigned one of 10 colors automatically (cycling through the palette)

### Sidebar Tag Filtering

All tags appear as clickable filter chips in the sidebar. Clicking a tag filters the page list to show only pages with that tag. Clicking the same tag again clears the filter.

---

## Favorites

Pages can be marked as favorites via the context menu. Favorited pages appear in a dedicated "Favorites" section at the top of the sidebar with a filled star icon. The favorites section is collapsible and only appears when at least one page is favorited.

---

## Page Sorting

The sidebar includes a sort dropdown with 7 options:

- Manual (position order)
- Title A to Z
- Title Z to A
- Created newest first
- Created oldest first
- Modified newest first
- Modified oldest first

The selected sort preference is persisted to localStorage.

---

## Search

The sidebar search bar performs full-text search across:

- Page titles
- Tag names
- Block content

Search is debounced (300ms) and queries the server-side API which runs a SQL query joining pages, tags, and blocks tables using ILIKE pattern matching.

---

## Page Mentions and Backlinks

### Mentions

Typing `[[` in a text block triggers a page search popup. The popup shows up to 6 matching pages with their icons and titles. Selecting a page inserts a mention block after the current block.

Mention blocks render as clickable chips showing the page icon and title. Clicking a mention navigates to the referenced page. If the referenced page has been deleted, the chip displays "Deleted page" with a warning icon.

### Embedded Preview

Each mention block has an expand/collapse toggle. Expanding it loads and displays the referenced page's blocks in a read-only inline preview, supporting all block types including tables, images, and nested mentions.

### Backlinks

At the bottom of each page, a backlinks section shows all pages that contain a mention block pointing to the current page. Clicking a backlink navigates to that page. The section is collapsible and shows the backlink count.

---

## Dark Mode

The CSS design system includes a full dark mode theme activated by setting `data-theme="dark"` on the root element. The sidebar includes a theme toggle button. Dark mode adjusts all colors including the editor, sidebar, menus, toolbars, comments panel, and overlays.

---

## Markdown Export

### Per-Page Export

Each page has an "Export to Markdown" button in the toolbar that serializes all blocks to a Markdown string and downloads it as a `.md` file. The export handles:

- Headings with `#` syntax
- Bulleted and numbered lists
- To-do items with `- [x]` / `- [ ]` checkbox syntax
- Blockquotes with `>` prefix
- Fenced code blocks with triple backticks
- Tables as GitHub-flavored Markdown pipe tables
- Images as `![caption](data:...)` or `[image]` placeholder for large files
- Mentions as `[[Page Title]]` wikilink syntax
- Dividers as `---`
- Inline formatting (bold, italic, strikethrough, code, links) converted from HTML tags to Markdown syntax

### Rich Text Clipboard Copy

The "Copy" button in the page toolbar copies the page content to the clipboard in two formats simultaneously:

- `text/html` -- styled HTML with inline CSS for pasting into rich text editors
- `text/plain` -- Markdown fallback for plain text contexts

### Bulk Sync to Disk

The "Sync" button in the sidebar footer exports all pages as individual Markdown files to `./data/markdown/` on the server filesystem. It also generates an `index.md` with links to all exported pages. The sync clears previous exports before writing new files.

---

## Markdown Import

The sidebar supports importing `.md` files as new pages. The import parser handles:

- Headings (H1, H2, H3)
- Bulleted and numbered lists
- To-do items with checkbox syntax
- Blockquotes
- Fenced code blocks (with multi-line support)
- Horizontal rules
- Pipe-delimited Markdown tables
- Image references (`![caption](url)`)
- Wikilink mentions (`[[Page Title]]`) with automatic page ID resolution
- Plain text paragraphs

The first H1 heading found becomes the page title, or the file is titled "Imported Note" if no H1 is present.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+N | Create a new page |
| Ctrl/Cmd+B | Bold selected text |
| Ctrl/Cmd+I | Italicize selected text |
| Ctrl/Cmd+U | Underline selected text |
| Enter | Create a new block below the current one |
| Shift+Enter | Line break within the current block |
| Backspace (on empty block) | Delete the current block and focus the previous one |
| / (on empty block) | Open the slash command menu |
| [[ | Open the page mention search |
| Arrow Up/Down | Navigate between blocks when cursor is at the start/end |
| Tab (in table) | Move to the next cell |
| Shift+Tab (in table) | Move to the previous cell |
| Enter (in table) | Add a new row when on the last row |
| Escape | Close slash menu, mention search, or autocomplete |
