import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Server-side markdown serializer — mirrors src/lib/export.js logic.
 */
function blocksToMarkdown(blocks, pageTitle) {
  let md = '';

  if (pageTitle) {
    md += `# ${pageTitle}\n\n`;
  }

  let numberIndex = 1;
  let prevType = null;

  for (const block of blocks) {
    if (block.type !== 'number' && prevType === 'number') {
      numberIndex = 1;
    }

    switch (block.type) {
      case 'text':
        md += `${block.content || ''}\n\n`;
        break;
      case 'h1':
        md += `# ${block.content || ''}\n\n`;
        break;
      case 'h2':
        md += `## ${block.content || ''}\n\n`;
        break;
      case 'h3':
        md += `### ${block.content || ''}\n\n`;
        break;
      case 'bullet':
        md += `- ${block.content || ''}\n`;
        break;
      case 'number':
        md += `${numberIndex}. ${block.content || ''}\n`;
        numberIndex++;
        break;
      case 'todo': {
        const checkbox = block.checked ? '[x]' : '[ ]';
        md += `- ${checkbox} ${block.content || ''}\n`;
        break;
      }
      case 'quote':
        md += `> ${block.content || ''}\n\n`;
        break;
      case 'callout':
        md += `> ${block.content || ''}\n\n`;
        break;
      case 'code':
        md += `\`\`\`\n${block.content || ''}\n\`\`\`\n\n`;
        break;
      case 'divider':
        md += `---\n\n`;
        break;
      case 'table': {
        try {
          const data = JSON.parse(block.content || '{}');
          const headers = data.headers || [];
          const rows = data.rows || [];
          if (headers.length > 0) {
            md += `| ${headers.join(' | ')} |\n`;
            md += `| ${headers.map(() => '---').join(' | ')} |\n`;
            for (const row of rows) {
              const cells = headers.map((_, i) => row[i] || '');
              md += `| ${cells.join(' | ')} |\n`;
            }
            md += '\n';
          }
        } catch {
          md += `${block.content || ''}\n\n`;
        }
        break;
      }
      case 'image': {
        const props = typeof block.props === 'string' ? JSON.parse(block.props || '{}') : (block.props || {});
        const caption = props.caption || '';
        const src = block.content || '';
        if (src.length > 50000) {
          md += `![${caption}][image]\n\n`;
        } else {
          md += `![${caption}](${src})\n\n`;
        }
        break;
      }
      case 'mention': {
        const props = typeof block.props === 'string' ? JSON.parse(block.props || '{}') : (block.props || {});
        const title = props.page_title || 'Untitled';
        md += `[[${title}]]\n\n`;
        break;
      }
      default:
        md += `${block.content || ''}\n\n`;
        break;
    }

    prevType = block.type;
  }

  return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function sanitizeFilename(title) {
  return (title || 'untitled')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase() || 'untitled';
}

const TAG_COLORS = [
  'default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'
];

export function createRoutes(db) {
  const router = Router();

  // ============ PAGES ============

  // GET /api/pages
  router.get('/pages', async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM pages ORDER BY position ASC, created_at DESC'
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/pages/search?q=...
  router.get('/pages/search', async (req, res) => {
    try {
      const query = req.query.q || '';
      const result = await db.query(
        `SELECT DISTINCT p.* FROM pages p
         LEFT JOIN page_tags pt ON p.id = pt.page_id
         LEFT JOIN tags t ON pt.tag_id = t.id
         WHERE p.title ILIKE $1 OR t.name ILIKE $1
           OR p.id IN (SELECT DISTINCT page_id FROM blocks WHERE content ILIKE $1)
         ORDER BY p.position ASC`,
        [`%${query}%`]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/pages/:id
  router.get('/pages/:id', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM pages WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Page not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/pages
  router.post('/pages', async (req, res) => {
    try {
      const { title, icon, projectId } = req.body;
      const id = crypto.randomUUID();
      const posResult = await db.query('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages');
      const position = posResult.rows[0].pos;

      await db.query(
        `INSERT INTO pages (id, title, icon, project_id, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, title || 'Untitled', icon || '📄', projectId || null, position]
      );

      const result = await db.query('SELECT * FROM pages WHERE id = $1', [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/pages/:id
  router.patch('/pages/:id', async (req, res) => {
    try {
      const updates = req.body;
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        fields.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }
      if (updates.icon !== undefined) {
        fields.push(`icon = $${paramIndex++}`);
        values.push(updates.icon);
      }
      if (updates.project_id !== undefined) {
        fields.push(`project_id = $${paramIndex++}`);
        values.push(updates.project_id);
      }
      if (updates.position !== undefined) {
        fields.push(`position = $${paramIndex++}`);
        values.push(updates.position);
      }
      if (updates.is_favorite !== undefined) {
        fields.push(`is_favorite = $${paramIndex++}`);
        values.push(updates.is_favorite);
      }

      fields.push(`updated_at = NOW()`);

      if (fields.length === 1) {
        // only updated_at, nothing meaningful to update
        return res.json({ ok: true });
      }

      values.push(req.params.id);
      await db.query(
        `UPDATE pages SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/pages/:id
  router.delete('/pages/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM pages WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============ BLOCKS ============

  // GET /api/pages/:pageId/blocks
  router.get('/pages/:pageId/blocks', async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM blocks WHERE page_id = $1 ORDER BY position ASC',
        [req.params.pageId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/pages/:pageId/blocks
  router.post('/pages/:pageId/blocks', async (req, res) => {
    try {
      const pageId = req.params.pageId;
      let { type, content, position, checked, props } = req.body;
      const id = crypto.randomUUID();

      if (position === undefined || position === null) {
        const posResult = await db.query(
          'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM blocks WHERE page_id = $1',
          [pageId]
        );
        position = posResult.rows[0].pos;
      }

      // Shift blocks at or after this position down
      await db.query(
        'UPDATE blocks SET position = position + 1 WHERE page_id = $1 AND position >= $2',
        [pageId, position]
      );

      await db.query(
        `INSERT INTO blocks (id, page_id, type, content, checked, props, position)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          id,
          pageId,
          type || 'text',
          content || '',
          checked || false,
          JSON.stringify(props || {}),
          position,
        ]
      );

      const result = await db.query('SELECT * FROM blocks WHERE id = $1', [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/blocks/:id
  router.patch('/blocks/:id', async (req, res) => {
    try {
      const updates = req.body;
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.type !== undefined) {
        fields.push(`type = $${paramIndex++}`);
        values.push(updates.type);
      }
      if (updates.content !== undefined) {
        fields.push(`content = $${paramIndex++}`);
        values.push(updates.content);
      }
      if (updates.checked !== undefined) {
        fields.push(`checked = $${paramIndex++}`);
        values.push(updates.checked);
      }
      if (updates.props !== undefined) {
        fields.push(`props = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(updates.props));
      }
      if (updates.position !== undefined) {
        fields.push(`position = $${paramIndex++}`);
        values.push(updates.position);
      }

      if (fields.length === 0) {
        return res.json({ ok: true });
      }

      values.push(req.params.id);
      await db.query(
        `UPDATE blocks SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/blocks/:id
  router.delete('/blocks/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM blocks WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/pages/:pageId/blocks/reorder
  router.put('/pages/:pageId/blocks/reorder', async (req, res) => {
    try {
      const pageId = req.params.pageId;
      const { blockIds } = req.body;

      for (let i = 0; i < blockIds.length; i++) {
        await db.query(
          'UPDATE blocks SET position = $1 WHERE id = $2 AND page_id = $3',
          [i, blockIds[i], pageId]
        );
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============ PROJECTS ============

  // GET /api/projects
  router.get('/projects', async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM projects ORDER BY position ASC, created_at ASC'
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/projects
  router.post('/projects', async (req, res) => {
    try {
      const { name, icon, color } = req.body;
      const id = crypto.randomUUID();
      const posResult = await db.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM projects'
      );
      const position = posResult.rows[0].pos;

      await db.query(
        `INSERT INTO projects (id, name, icon, color, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, name || 'New Project', icon || '📁', color || '#E8E5E0', position]
      );

      const result = await db.query('SELECT * FROM projects WHERE id = $1', [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/projects/:id
  router.patch('/projects/:id', async (req, res) => {
    try {
      const updates = req.body;
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.icon !== undefined) {
        fields.push(`icon = $${paramIndex++}`);
        values.push(updates.icon);
      }
      if (updates.color !== undefined) {
        fields.push(`color = $${paramIndex++}`);
        values.push(updates.color);
      }
      if (updates.position !== undefined) {
        fields.push(`position = $${paramIndex++}`);
        values.push(updates.position);
      }

      if (fields.length === 0) {
        return res.json({ ok: true });
      }

      values.push(req.params.id);
      await db.query(
        `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/projects/:id
  router.delete('/projects/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============ TAGS ============

  // GET /api/tags
  router.get('/tags', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM tags ORDER BY name ASC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/tags
  router.post('/tags', async (req, res) => {
    try {
      let { name, color } = req.body;
      const id = crypto.randomUUID();

      if (!color) {
        const countResult = await db.query('SELECT COUNT(*) AS cnt FROM tags');
        const count = parseInt(countResult.rows[0].cnt, 10);
        color = TAG_COLORS[count % TAG_COLORS.length];
      }

      await db.query(
        `INSERT INTO tags (id, name, color) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING`,
        [id, name, color]
      );

      const result = await db.query('SELECT * FROM tags WHERE name = $1', [name]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/tags/:id
  router.delete('/tags/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM tags WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/pages/:pageId/tags
  router.post('/pages/:pageId/tags', async (req, res) => {
    try {
      const { tagId } = req.body;
      await db.query(
        `INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.params.pageId, tagId]
      );
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/pages/:pageId/tags/:tagId
  router.delete('/pages/:pageId/tags/:tagId', async (req, res) => {
    try {
      await db.query(
        'DELETE FROM page_tags WHERE page_id = $1 AND tag_id = $2',
        [req.params.pageId, req.params.tagId]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/pages/:pageId/tags
  router.get('/pages/:pageId/tags', async (req, res) => {
    try {
      const result = await db.query(
        `SELECT t.* FROM tags t
         INNER JOIN page_tags pt ON t.id = pt.tag_id
         WHERE pt.page_id = $1
         ORDER BY t.name ASC`,
        [req.params.pageId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/tags/:tagId/pages
  router.get('/tags/:tagId/pages', async (req, res) => {
    try {
      const result = await db.query(
        `SELECT p.* FROM pages p
         INNER JOIN page_tags pt ON p.id = pt.page_id
         WHERE pt.tag_id = $1
         ORDER BY p.position ASC`,
        [req.params.tagId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============ BACKLINKS ============

  // GET /api/pages/:id/backlinks
  router.get('/pages/:id/backlinks', async (req, res) => {
    try {
      const result = await db.query(
        `SELECT DISTINCT p.id, p.title, p.icon FROM pages p
         INNER JOIN blocks b ON b.page_id = p.id
         WHERE b.type = 'mention' AND b.content = $1
         ORDER BY p.title ASC`,
        [req.params.id]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============ IMPORT ============

  // POST /api/import — parse markdown text into a new page with blocks
  router.post('/import', async (req, res) => {
    try {
      const { markdown, title: providedTitle } = req.body;
      if (!markdown || typeof markdown !== 'string') {
        return res.status(400).json({ error: 'markdown field is required' });
      }
      const lines = markdown.split('\n');
      const blocks = [];
      let firstH1 = null;
      let inCodeBlock = false;
      let codeLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith('```')) {
          if (inCodeBlock) {
            blocks.push({ type: 'code', content: codeLines.join('\n'), checked: false, props: {} });
            codeLines = [];
            inCodeBlock = false;
          } else {
            inCodeBlock = true;
            codeLines = [];
          }
          continue;
        }
        if (inCodeBlock) { codeLines.push(line); continue; }
        if (line.trim() === '') continue;
        if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
          blocks.push({ type: 'divider', content: '', checked: false, props: {} });
          continue;
        }
        if (line.trimStart().startsWith('|')) {
          const tableLines = [line];
          let j = i + 1;
          while (j < lines.length && lines[j].trimStart().startsWith('|')) { tableLines.push(lines[j]); j++; }
          i = j - 1;
          const dataRows = tableLines.filter((tl) => !/^\s*\|[\s\-:|]+\|\s*$/.test(tl));
          const parseCells = (tl) => tl.split('|').map((c) => c.trim()).filter((c) => c !== '');
          if (dataRows.length > 0) {
            const headers = parseCells(dataRows[0]);
            const rows = dataRows.slice(1).map(parseCells);
            blocks.push({ type: 'table', content: JSON.stringify({ headers, rows }), checked: false, props: {} });
          }
          continue;
        }
        const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
        if (imgMatch) {
          blocks.push({ type: 'image', content: imgMatch[2], checked: false, props: { caption: imgMatch[1], width: 100, align: 'center' } });
          continue;
        }
        const mentionMatch = line.match(/^\[\[([^\]]+)\]\]\s*$/);
        if (mentionMatch) {
          const mentionTitle = mentionMatch[1];
          const pageResult = await db.query('SELECT id, title, icon FROM pages WHERE title = $1 LIMIT 1', [mentionTitle]);
          const targetPage = pageResult.rows[0];
          blocks.push({ type: 'mention', content: targetPage ? targetPage.id : '', checked: false, props: { page_title: mentionTitle, page_icon: targetPage ? (targetPage.icon || '📄') : '📄', embedded: false } });
          continue;
        }
        const todoMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
        if (todoMatch) {
          blocks.push({ type: 'todo', content: todoMatch[2], checked: todoMatch[1].toLowerCase() === 'x', props: {} });
          continue;
        }
        const h3Match = line.match(/^###\s+(.*)/);
        if (h3Match) { blocks.push({ type: 'h3', content: h3Match[1], checked: false, props: {} }); continue; }
        const h2Match = line.match(/^##\s+(.*)/);
        if (h2Match) { blocks.push({ type: 'h2', content: h2Match[1], checked: false, props: {} }); continue; }
        const h1Match = line.match(/^#\s+(.*)/);
        if (h1Match) { if (!firstH1) firstH1 = h1Match[1]; blocks.push({ type: 'h1', content: h1Match[1], checked: false, props: {} }); continue; }
        const bulletMatch = line.match(/^[-*]\s+(.*)/);
        if (bulletMatch) { blocks.push({ type: 'bullet', content: bulletMatch[1], checked: false, props: {} }); continue; }
        const numberMatch = line.match(/^\d+\.\s+(.*)/);
        if (numberMatch) { blocks.push({ type: 'number', content: numberMatch[1], checked: false, props: {} }); continue; }
        const quoteMatch = line.match(/^>\s+(.*)/);
        if (quoteMatch) { blocks.push({ type: 'quote', content: quoteMatch[1], checked: false, props: {} }); continue; }
        blocks.push({ type: 'text', content: line, checked: false, props: {} });
      }
      if (inCodeBlock && codeLines.length > 0) {
        blocks.push({ type: 'code', content: codeLines.join('\n'), checked: false, props: {} });
      }
      const pageTitle = providedTitle || firstH1 || 'Imported Note';
      const pageId = crypto.randomUUID();
      const posResult = await db.query('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages');
      const pagePosition = posResult.rows[0].pos;
      await db.query('INSERT INTO pages (id, title, icon, position) VALUES ($1, $2, $3, $4)', [pageId, pageTitle, '📄', pagePosition]);
      for (let idx = 0; idx < blocks.length; idx++) {
        const b = blocks[idx];
        const blockId = crypto.randomUUID();
        await db.query(
          `INSERT INTO blocks (id, page_id, type, content, checked, props, position) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
          [blockId, pageId, b.type, b.content, b.checked, JSON.stringify(b.props), idx]
        );
      }
      if (blocks.length === 0) {
        const blockId = crypto.randomUUID();
        await db.query(`INSERT INTO blocks (id, page_id, type, content, position) VALUES ($1, $2, 'text', '', 0)`, [blockId, pageId]);
      }
      const result = await db.query('SELECT * FROM pages WHERE id = $1', [pageId]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Import error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============ SYNC ============

  // POST /api/sync — export all pages as markdown files to ./data/markdown/
  router.post('/sync', async (req, res) => {
    try {
      const markdownDir = path.resolve('./data/markdown');
      fs.mkdirSync(markdownDir, { recursive: true });

      // Clear existing markdown files
      const existingFiles = fs.readdirSync(markdownDir).filter((f) => f.endsWith('.md'));
      for (const file of existingFiles) {
        fs.unlinkSync(path.join(markdownDir, file));
      }

      // Get all pages
      const pagesResult = await db.query(
        'SELECT * FROM pages ORDER BY position ASC, created_at DESC'
      );
      const pages = pagesResult.rows;

      const writtenFiles = [];

      for (const page of pages) {
        // Get blocks for this page
        const blocksResult = await db.query(
          'SELECT * FROM blocks WHERE page_id = $1 ORDER BY position ASC',
          [page.id]
        );
        const blocks = blocksResult.rows;

        const markdown = blocksToMarkdown(blocks, page.title);
        const filename = sanitizeFilename(page.title) + '.md';
        const filePath = path.join(markdownDir, filename);

        fs.writeFileSync(filePath, markdown, 'utf-8');
        writtenFiles.push({ title: page.title, filename });
      }

      // Create index.md with links to all pages
      let indexMd = '# Index\n\n';
      for (const file of writtenFiles) {
        indexMd += `- [${file.title}](./${file.filename})\n`;
      }
      indexMd += '';
      fs.writeFileSync(path.join(markdownDir, 'index.md'), indexMd, 'utf-8');

      res.json({
        success: true,
        count: writtenFiles.length,
        path: './data/markdown/',
      });
    } catch (err) {
      console.error('Sync error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
