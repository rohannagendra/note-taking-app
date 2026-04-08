import React, { useState, useRef, useEffect, useCallback } from 'react';
import MentionSearch from '../MentionSearch.jsx';
import SlashMenu from '../SlashMenu.jsx';
import { createDatabase, getPageDatabase } from '../../lib/database.js';

export default function TextBlock({ block, onUpdate, onDelete, onAddBlock, onFocusBlock }) {
  const ref = useRef(null);
  const saveTimer = useRef(null);
  const localContent = useRef(block.content || '');
  const [mentionSearch, setMentionSearch] = useState(null);
  const [slashMenu, setSlashMenu] = useState(null); // { top, left }
  const [slashFilter, setSlashFilter] = useState('');
  const slashActive = useRef(false);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = block.content || '';
    }
    localContent.current = block.content || '';
  }, [block.content]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(null);
    setSlashFilter('');
    slashActive.current = false;
  }, []);

  const handleInput = useCallback(() => {
    const html = ref.current.innerHTML;
    const text = ref.current.innerText;
    localContent.current = html;

    // Track slash filter text
    if (slashActive.current) {
      if (text.startsWith('/')) {
        setSlashFilter(text.slice(1));
      } else {
        // User deleted the slash
        closeSlashMenu();
      }
    }

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(block.id, { content: html });
    }, 300);
  }, [block.id, onUpdate, closeSlashMenu]);

  const handleKeyDown = useCallback((e) => {
    // If slash menu is open, let it handle Enter/Escape/Arrow keys
    if (slashActive.current) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSlashMenu();
        return;
      }
      // ArrowUp, ArrowDown, Enter are handled by SlashMenu's document listener
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
        return; // Let SlashMenu's capture-phase handler deal with it
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      clearTimeout(saveTimer.current);
      onUpdate(block.id, { content: ref.current.innerHTML });
      onAddBlock(block.position, 'text');
    }

    if (e.key === 'Backspace' && ref.current.innerText === '') {
      e.preventDefault();
      clearTimeout(saveTimer.current);
      onDelete(block.id);
    }

    // Detect "/" on empty block to open slash menu
    if (e.key === '/' && ref.current.innerText === '') {
      // Let the character be typed, then show menu
      requestAnimationFrame(() => {
        const rect = ref.current.getBoundingClientRect();
        setSlashMenu({
          top: rect.bottom + 4,
          left: rect.left,
        });
        setSlashFilter('');
        slashActive.current = true;
      });
    }

    // Detect [[ for mention search
    if (e.key === '[') {
      const text = ref.current.innerText;
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const offset = sel.focusOffset;
        if (offset >= 1 && text[offset - 1] === '[') {
          e.preventDefault();
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setMentionSearch({
            top: rect.bottom + 4,
            left: rect.left,
          });
          ref.current.innerText = text.slice(0, offset - 1) + text.slice(offset);
          localContent.current = ref.current.innerText;
        }
      }
    }

    if (e.key === 'ArrowUp') {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.startOffset === 0 && range.collapsed) {
          e.preventDefault();
          onFocusBlock('up');
        }
      }
    }

    if (e.key === 'ArrowDown') {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const atEnd = range.endOffset === (range.endContainer.textContent || '').length && range.collapsed;
        if (atEnd) {
          e.preventDefault();
          onFocusBlock('down');
        }
      }
    }
  }, [block.id, block.position, onUpdate, onAddBlock, onDelete, onFocusBlock, closeSlashMenu]);

  const handleSlashSelect = useCallback(async (type, createNew) => {
    closeSlashMenu();
    // Clear the "/" from the block content
    clearTimeout(saveTimer.current);

    if (type === 'database') {
      // Create a database for this page instead of a block
      ref.current.innerHTML = '';
      onUpdate(block.id, { content: '' });
      try {
        const existing = await getPageDatabase(block.page_id);
        if (!existing) {
          const defaultSchema = [
            { id: 'title', name: 'Name', type: 'text' },
            { id: 'status', name: 'Status', type: 'select', options: [
              { value: 'Not started', color: 'gray' },
              { value: 'In progress', color: 'blue' },
              { value: 'Done', color: 'green' },
            ]},
          ];
          await createDatabase(block.page_id, 'Untitled Database', defaultSchema);
        }
      } catch (err) {
        console.error('Failed to create database:', err);
      }
      return;
    }

    if (createNew) {
      // For divider, table, image, mention — create a new block after this one
      ref.current.innerHTML = '';
      onUpdate(block.id, { content: '' });
      onAddBlock(block.position, type);
    } else {
      // Convert current block type
      ref.current.innerHTML = '';
      onUpdate(block.id, { content: '', type });
    }
  }, [block.id, block.page_id, block.position, onUpdate, onAddBlock, closeSlashMenu]);

  const handleMentionSelect = useCallback((page) => {
    setMentionSearch(null);
    clearTimeout(saveTimer.current);
    onUpdate(block.id, { content: ref.current.innerHTML });
    onAddBlock(block.position, 'mention', {
      content: page.id,
      props: { page_title: page.title, page_icon: page.icon },
    });
  }, [block.id, block.position, onUpdate, onAddBlock]);

  const handleMentionClose = useCallback(() => {
    setMentionSearch(null);
  }, []);

  return (
    <>
      <div
        ref={ref}
        className="block-text"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Type '/' for commands..."
        data-block-id={block.id}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
      {slashMenu && (
        <SlashMenu
          position={slashMenu}
          filter={slashFilter}
          onSelect={handleSlashSelect}
          onClose={closeSlashMenu}
        />
      )}
      {mentionSearch && (
        <MentionSearch
          position={mentionSearch}
          onSelect={handleMentionSelect}
          onClose={handleMentionClose}
        />
      )}
    </>
  );
}
