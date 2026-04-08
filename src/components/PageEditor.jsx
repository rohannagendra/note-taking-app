import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getBlocks, addBlock, updateBlock, deleteBlock, reorderBlocks } from '../lib/blocks.js';
import { blocksToMarkdown, blocksToHtml, downloadMarkdown, exportTableToCSV, downloadCSV, downloadPDF } from '../lib/export.js';
import Block from './Block.jsx';
import IconPicker from './IconPicker.jsx';
import TagInput from './TagInput.jsx';
import FormattingToolbar from './FormattingToolbar.jsx';
import { getPageTags } from '../lib/tags.js';
import { getBacklinks } from '../lib/pages.js';
import DatabaseView from './DatabaseView.jsx';
import { getPageDatabase, getDatabaseRows } from '../lib/database.js';

export default function PageEditor({ page, onUpdatePage, allTags, onRefreshTags, onNavigate, fontFamily, onFontChange, onSaveAsTemplate, allPages }) {
  const [blocks, setBlocks] = useState([]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [pageTags, setPageTags] = useState([]);
  const [copied, setCopied] = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);
  const [backlinks, setBacklinks] = useState([]);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showCoverGradients, setShowCoverGradients] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { blockId, position: 'top'|'bottom' }
  const titleRef = useRef(null);
  const coverInputRef = useRef(null);
  const blockRefs = useRef({});
  const focusTargetRef = useRef(null);
  const saveTimer = useRef(null);
  const prevPageIdRef = useRef(null);

  // Set title text when page changes
  useEffect(() => {
    if (page && titleRef.current) {
      if (prevPageIdRef.current !== page.id) {
        titleRef.current.innerText = page.title || '';
        prevPageIdRef.current = page.id;
      }
    }
  }, [page?.id, page?.title]);

  // Load page tags when page changes
  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    async function loadTags() {
      const tags = await getPageTags(page.id);
      if (!cancelled) setPageTags(tags);
    }
    loadTags();
    return () => { cancelled = true; };
  }, [page?.id]);

  // Load backlinks when page changes
  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    async function loadBacklinks() {
      try {
        const links = await getBacklinks(page.id);
        if (!cancelled) setBacklinks(links);
      } catch {
        if (!cancelled) setBacklinks([]);
      }
    }
    loadBacklinks();
    return () => { cancelled = true; };
  }, [page?.id]);

  // Build breadcrumb trail
  const breadcrumbs = useMemo(() => {
    if (!page || !allPages || !page.parent_id) return [];
    const trail = [];
    let currentId = page.parent_id;
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parentPage = allPages.find((p) => p.id === currentId);
      if (!parentPage) break;
      trail.unshift(parentPage);
      currentId = parentPage.parent_id;
    }
    return trail;
  }, [page?.id, page?.parent_id, allPages]);

  const handleTagRefresh = useCallback(async () => {
    const tags = await getPageTags(page.id);
    setPageTags(tags);
    if (onRefreshTags) onRefreshTags();
  }, [page?.id, onRefreshTags]);

  // Load blocks when page changes
  useEffect(() => {
    if (!page) return;

    let cancelled = false;

    async function loadBlocks() {
      const loaded = await getBlocks(page.id);
      if (cancelled) return;

      if (loaded.length === 0) {
        const newBlock = await addBlock(page.id, { type: 'text', content: '', position: 0 });
        if (!cancelled) setBlocks([newBlock]);
      } else {
        setBlocks(loaded);
      }
    }

    loadBlocks();
    return () => { cancelled = true; };
  }, [page?.id]);

  // Focus management: after blocks update, focus the target block
  useEffect(() => {
    if (focusTargetRef.current) {
      const targetId = focusTargetRef.current;
      focusTargetRef.current = null;

      requestAnimationFrame(() => {
        const el = blockRefs.current[targetId];
        if (el) {
          const editable = el.querySelector('[contenteditable="true"]') || el.querySelector('[contenteditable]');
          if (editable) editable.focus();
        }
      });
    }
  }, [blocks]);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleTitleInput = useCallback(() => {
    if (!titleRef.current) return;
    const title = titleRef.current.innerText;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdatePage(page.id, { title: title || 'Untitled' });
    }, 300);
  }, [page?.id, onUpdatePage]);

  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus the first block
      if (blocks.length > 0) {
        const firstBlockId = blocks[0].id;
        const el = blockRefs.current[firstBlockId];
        if (el) {
          const editable = el.querySelector('[contenteditable="true"]') || el.querySelector('[contenteditable]');
          if (editable) editable.focus();
        }
      }
    }
  }, [blocks]);

  const handleIconSelect = useCallback((emoji) => {
    onUpdatePage(page.id, { icon: emoji });
  }, [page?.id, onUpdatePage]);

  const handleUpdateBlock = useCallback(async (blockId, updates) => {
    await updateBlock(blockId, updates);
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b))
    );
  }, []);

  const handleDeleteBlock = useCallback(async (blockId) => {
    setBlocks((prev) => {
      if (prev.length <= 1) return prev; // Keep at least one block

      const idx = prev.findIndex((b) => b.id === blockId);
      const remaining = prev.filter((b) => b.id !== blockId);
      const focusIdx = Math.max(0, idx - 1);
      if (remaining[focusIdx]) {
        focusTargetRef.current = remaining[focusIdx].id;
      }
      return remaining;
    });

    // Check length before deleting from DB
    if (blocks.length > 1) {
      await deleteBlock(blockId);
    }
  }, [blocks.length]);

  const handleAddBlock = useCallback(async (afterPosition, type = 'text', extra = {}) => {
    const newBlock = await addBlock(page.id, {
      type,
      content: extra.content || '',
      position: afterPosition + 1,
      props: extra.props || {},
    });

    // Reload blocks to get correct positions after shift
    const updatedBlocks = await getBlocks(page.id);
    setBlocks(updatedBlocks);
    focusTargetRef.current = newBlock.id;
  }, [page?.id]);

  const handleFocusBlock = useCallback((direction) => {
    const activeEl = document.activeElement;
    const blockEl = activeEl?.closest('[data-block-id]');
    const blockId = blockEl?.getAttribute('data-block-id')
      || activeEl?.getAttribute('data-block-id');

    if (!blockId) return;

    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;

    let targetIdx;
    if (direction === 'up') {
      targetIdx = idx - 1;
      if (targetIdx < 0) {
        if (titleRef.current) titleRef.current.focus();
        return;
      }
    } else {
      targetIdx = idx + 1;
      if (targetIdx >= blocks.length) return;
    }

    const targetBlock = blocks[targetIdx];
    const el = blockRefs.current[targetBlock.id];
    if (el) {
      const editable = el.querySelector('[contenteditable="true"]') || el.querySelector('[contenteditable]');
      if (editable) editable.focus();
    }
  }, [blocks]);

  // --- Drag & Drop handlers ---
  const handleBlockDragStart = useCallback((blockId) => {
    setDraggedBlockId(blockId);
  }, []);

  const handleBlockDragOver = useCallback((targetBlockId, e) => {
    if (!draggedBlockId || targetBlockId === draggedBlockId) {
      setDropTarget(null);
      return;
    }
    const el = blockRefs.current[targetBlockId];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'top' : 'bottom';
    setDropTarget((prev) => {
      if (prev && prev.blockId === targetBlockId && prev.position === position) return prev;
      return { blockId: targetBlockId, position };
    });
  }, [draggedBlockId]);

  const handleBlockDrop = useCallback(async () => {
    if (!draggedBlockId || !dropTarget) {
      setDraggedBlockId(null);
      setDropTarget(null);
      return;
    }

    const dragIdx = blocks.findIndex((b) => b.id === draggedBlockId);
    const dropIdx = blocks.findIndex((b) => b.id === dropTarget.blockId);
    if (dragIdx === -1 || dropIdx === -1) {
      setDraggedBlockId(null);
      setDropTarget(null);
      return;
    }

    // Build new order
    const newBlocks = blocks.filter((b) => b.id !== draggedBlockId);
    const draggedBlock = blocks[dragIdx];
    let insertIdx = newBlocks.findIndex((b) => b.id === dropTarget.blockId);
    if (dropTarget.position === 'bottom') insertIdx += 1;
    newBlocks.splice(insertIdx, 0, draggedBlock);

    setBlocks(newBlocks);
    setDraggedBlockId(null);
    setDropTarget(null);

    // Persist new order to database
    const blockIds = newBlocks.map((b) => b.id);
    await reorderBlocks(page.id, blockIds);
  }, [draggedBlockId, dropTarget, blocks, page?.id]);

  const handleBlockDragEnd = useCallback(() => {
    setDraggedBlockId(null);
    setDropTarget(null);
  }, []);

  const GRADIENT_PRESETS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  ];

  const handleCoverUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onUpdatePage(page.id, { cover_image: reader.result });
    };
    reader.readAsDataURL(file);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }, [page?.id, onUpdatePage]);

  const handleRemoveCover = useCallback(() => {
    onUpdatePage(page.id, { cover_image: null });
    setShowCoverGradients(false);
  }, [page?.id, onUpdatePage]);

  const handleSelectGradient = useCallback((gradient) => {
    onUpdatePage(page.id, { cover_image: gradient });
    setShowCoverGradients(false);
  }, [page?.id, onUpdatePage]);

  const fetchDatabaseData = useCallback(async () => {
    try {
      const db = await getPageDatabase(page.id);
      if (db) {
        const schema = typeof db.properties_schema === 'string'
          ? JSON.parse(db.properties_schema)
          : db.properties_schema || [];
        const dbRows = await getDatabaseRows(db.id);
        return { name: db.name, schema, rows: dbRows };
      }
    } catch {
      // No database for this page
    }
    return null;
  }, [page?.id]);

  const handleExportMarkdown = useCallback(async () => {
    const database = await fetchDatabaseData();
    const md = blocksToMarkdown(blocks, page.title, database);
    downloadMarkdown(md, page.title);
    setShowExportDropdown(false);
  }, [blocks, page?.title, fetchDatabaseData]);

  const handleExportCSV = useCallback(async () => {
    const database = await fetchDatabaseData();
    const csv = exportTableToCSV(blocks, page.title, database);
    downloadCSV(csv, page.title);
    setShowExportDropdown(false);
  }, [blocks, page?.title, fetchDatabaseData]);

  const handleExportPDF = useCallback(async () => {
    const database = await fetchDatabaseData();
    downloadPDF(blocks, page.title, database);
    setShowExportDropdown(false);
  }, [blocks, page?.title, fetchDatabaseData]);

  const handleCopy = useCallback(async () => {
    try {
      const database = await fetchDatabaseData();
      const htmlContent = blocksToHtml(blocks, page.title, database);
      const mdContent = blocksToMarkdown(blocks, page.title, database);

      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([mdContent], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardItem]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback: copy plain markdown
      try {
        const mdContent = blocksToMarkdown(blocks, page.title);
        await navigator.clipboard.writeText(mdContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
    }
  }, [blocks, page?.title, fetchDatabaseData]);

  const handleAddBlockAtEnd = useCallback(async () => {
    const lastPosition = blocks.length > 0 ? blocks[blocks.length - 1].position : -1;
    const newBlock = await addBlock(page.id, {
      type: 'text',
      content: '',
      position: lastPosition + 1,
    });
    setBlocks((prev) => [...prev, newBlock]);
    focusTargetRef.current = newBlock.id;
  }, [page?.id, blocks]);

  if (!page) return null;

  return (
    <div className="page-editor-container">
      <FormattingToolbar fontFamily={fontFamily} onFontChange={onFontChange} />
      <div className="page-editor">
        {/* Toolbar */}
        <div className="page-toolbar">
          <div style={{ position: 'relative' }}>
            <button
              className="page-toolbar-btn"
              onClick={() => setShowExportDropdown((v) => !v)}
            >
              <span>&#8595;</span> Export
            </button>
            {showExportDropdown && (
              <div
                className="export-dropdown"
                onMouseLeave={() => setShowExportDropdown(false)}
              >
                <button className="export-option" onClick={handleExportMarkdown}>
                  Markdown (.md)
                </button>
                <button className="export-option" onClick={handleExportCSV}>
                  CSV (.csv)
                </button>
                <button className="export-option" onClick={handleExportPDF}>
                  PDF
                </button>
              </div>
            )}
          </div>
          <button className="page-toolbar-btn" onClick={handleCopy}>
            {copied ? '\u2713 Copied!' : '\ud83d\udccb Copy'}
          </button>
          {onSaveAsTemplate && (
            <button
              className="page-toolbar-btn"
              onClick={async () => {
                try {
                  await onSaveAsTemplate(page.id);
                  setSavedAsTemplate(true);
                  setTimeout(() => setSavedAsTemplate(false), 2000);
                } catch (err) {
                  console.error('Failed to save as template:', err);
                }
              }}
            >
              {savedAsTemplate ? '\u2713 Saved!' : '\ud83d\udccb Save as Template'}
            </button>
          )}
        </div>

        {/* Cover Image */}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleCoverUpload}
        />
        {page.cover_image ? (
          <div className="page-cover">
            {page.cover_image.startsWith('linear-gradient') ? (
              <div
                className="page-cover-gradient"
                style={{ background: page.cover_image }}
              />
            ) : (
              <img src={page.cover_image} alt="Page cover" />
            )}
            <div className="page-cover-actions">
              <button
                className="cover-action-btn"
                onClick={() => coverInputRef.current?.click()}
              >
                Change cover
              </button>
              <button
                className="cover-action-btn"
                onClick={() => setShowCoverGradients((v) => !v)}
              >
                Gradient
              </button>
              <button
                className="cover-action-btn"
                onClick={handleRemoveCover}
              >
                Remove
              </button>
            </div>
            {showCoverGradients && (
              <div className="cover-gradient-picker">
                {GRADIENT_PRESETS.map((g, i) => (
                  <button
                    key={i}
                    className="cover-gradient-swatch"
                    style={{ background: g }}
                    onClick={() => handleSelectGradient(g)}
                    title={`Gradient ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="add-cover-btn-wrapper">
            <button
              className="add-cover-btn"
              onClick={() => coverInputRef.current?.click()}
            >
              Add cover
            </button>
            <button
              className="add-cover-btn"
              onClick={() => setShowCoverGradients((v) => !v)}
              style={{ marginLeft: 8 }}
            >
              Add gradient
            </button>
            {showCoverGradients && (
              <div className="cover-gradient-picker" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10 }}>
                {GRADIENT_PRESETS.map((g, i) => (
                  <button
                    key={i}
                    className="cover-gradient-swatch"
                    style={{ background: g }}
                    onClick={() => handleSelectGradient(g)}
                    title={`Gradient ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <div className="page-breadcrumbs">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <span
                  className="page-breadcrumb"
                  onClick={() => onNavigate && onNavigate(crumb.id)}
                >
                  {crumb.icon || '\uD83D\uDCC4'} {crumb.title || 'Untitled'}
                </span>
                <span className="page-breadcrumb-separator">/</span>
              </React.Fragment>
            ))}
            <span className="page-breadcrumb" style={{ color: 'var(--text-secondary)' }}>
              {page.icon || '\uD83D\uDCC4'} {page.title || 'Untitled'}
            </span>
          </div>
        )}

        {/* Page Icon */}
        <div style={{ position: 'relative' }}>
          <button
            className="page-icon-btn"
            onClick={() => setShowIconPicker((v) => !v)}
            title="Change icon"
          >
            {page.icon || '📄'}
          </button>
          {showIconPicker && (
            <IconPicker
              onSelect={handleIconSelect}
              onClose={() => setShowIconPicker(false)}
            />
          )}
        </div>

        {/* Page Title */}
        <div
          ref={titleRef}
          className="page-title-input"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Untitled"
          onInput={handleTitleInput}
          onKeyDown={handleTitleKeyDown}
        />

        {/* Tags */}
        <TagInput
          pageId={page.id}
          tags={pageTags}
          allTags={allTags || []}
          onAddTag={() => {}}
          onRemoveTag={() => {}}
          onRefresh={handleTagRefresh}
        />

        {/* Blocks */}
        <div className="page-blocks">
          {blocks.map((block) => (
            <div
              key={block.id}
              ref={(el) => {
                if (el) blockRefs.current[block.id] = el;
                else delete blockRefs.current[block.id];
              }}
            >
              <Block
                block={block}
                onUpdate={handleUpdateBlock}
                onDelete={handleDeleteBlock}
                onAddBlock={handleAddBlock}
                onFocusBlock={handleFocusBlock}
                onNavigate={onNavigate}
                onDragStart={handleBlockDragStart}
                onDragOver={handleBlockDragOver}
                onDrop={handleBlockDrop}
                onDragEnd={handleBlockDragEnd}
                isDragging={draggedBlockId === block.id}
                dragOverPosition={
                  dropTarget && dropTarget.blockId === block.id
                    ? dropTarget.position
                    : null
                }
              />
            </div>
          ))}
        </div>

        {/* Add block area */}
        <div
          className="add-block-area"
          onClick={handleAddBlockAtEnd}
          style={{
            padding: '8px 2px',
            color: 'var(--text-placeholder)',
            cursor: 'pointer',
            fontSize: '14px',
            userSelect: 'none',
            minHeight: '32px',
          }}
        >
          + Add a block
        </div>

        {/* Database View */}
        <DatabaseView pageId={page.id} onNavigate={onNavigate} />

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div className="backlinks-section">
            <div
              className="backlinks-header"
              onClick={() => setShowBacklinks((v) => !v)}
            >
              {showBacklinks ? '\u2199\uFE0F' : '\u2199'} {backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}
            </div>
            {showBacklinks && (
              <div className="backlinks-list">
                {backlinks.map((link) => (
                  <div
                    key={link.id}
                    className="backlink-item"
                    onClick={() => onNavigate && onNavigate(link.id)}
                  >
                    <span>{link.icon || '\ud83d\udcc4'}</span>
                    <span>{link.title || 'Untitled'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
