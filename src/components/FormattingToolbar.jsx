import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function FormattingToolbar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState({});
  const toolbarRef = useRef(null);
  const isApplyingFormat = useRef(false);

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
    });
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (isApplyingFormat.current) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setVisible(false);
      return;
    }

    const range = sel.getRangeAt(0);
    const selectedText = sel.toString().trim();
    if (!selectedText) {
      setVisible(false);
      return;
    }

    // Check if selection is within a contentEditable block inside .page-blocks
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    const pageBlocks = container.closest('.page-blocks');
    const editableEl = container.closest('[contenteditable="true"]');
    if (!pageBlocks || !editableEl) {
      setVisible(false);
      return;
    }

    const rect = range.getBoundingClientRect();
    const toolbarWidth = 228;
    const toolbarHeight = 36;

    let left = rect.left + rect.width / 2 - toolbarWidth / 2;
    let top = rect.top - toolbarHeight - 8;

    // Keep within viewport
    if (left < 8) left = 8;
    if (left + toolbarWidth > window.innerWidth - 8) {
      left = window.innerWidth - toolbarWidth - 8;
    }
    if (top < 8) {
      top = rect.bottom + 8;
    }

    setPosition({ top, left });
    setVisible(true);
    updateActiveFormats();
  }, [updateActiveFormats]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      let container = sel.getRangeAt(0).commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
      const editableEl = container.closest('[contenteditable="true"]');
      const pageBlocks = container.closest('.page-blocks');
      if (!editableEl || !pageBlocks) return;

      if (e.key === 'b') {
        e.preventDefault();
        applyFormat('bold');
      } else if (e.key === 'i') {
        e.preventDefault();
        applyFormat('italic');
      } else if (e.key === 'u') {
        e.preventDefault();
        applyFormat('underline');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const applyFormat = useCallback((command, value) => {
    isApplyingFormat.current = true;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      isApplyingFormat.current = false;
      return;
    }

    // Save current selection
    const range = sel.getRangeAt(0);

    if (command === 'code') {
      const selectedText = sel.toString();
      const isInCode = !!range.commonAncestorContainer.parentElement?.closest('code');
      if (isInCode) {
        // Remove code formatting - unwrap from code tag
        const codeEl = range.commonAncestorContainer.parentElement.closest('code');
        if (codeEl) {
          const parent = codeEl.parentNode;
          while (codeEl.firstChild) {
            parent.insertBefore(codeEl.firstChild, codeEl);
          }
          parent.removeChild(codeEl);
        }
      } else {
        document.execCommand('insertHTML', false, `<code>${selectedText}</code>`);
      }
    } else if (command === 'link') {
      const existingLink = range.commonAncestorContainer.parentElement?.closest('a');
      if (existingLink) {
        // Remove link
        document.execCommand('unlink', false, null);
      } else {
        const url = prompt('Enter URL:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
      }
    } else {
      document.execCommand(command, false, value || null);
    }

    // Restore selection and update state
    requestAnimationFrame(() => {
      updateActiveFormats();
      isApplyingFormat.current = false;
    });
  }, [updateActiveFormats]);

  const handleMouseDown = useCallback((e) => {
    // Prevent the toolbar click from stealing focus / collapsing selection
    e.preventDefault();
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="formatting-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={handleMouseDown}
    >
      <button
        className={`formatting-btn${activeFormats.bold ? ' active' : ''}`}
        onClick={() => applyFormat('bold')}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        className={`formatting-btn${activeFormats.italic ? ' active' : ''}`}
        onClick={() => applyFormat('italic')}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        className={`formatting-btn${activeFormats.underline ? ' active' : ''}`}
        onClick={() => applyFormat('underline')}
        title="Underline (Ctrl+U)"
      >
        <span style={{ textDecoration: 'underline' }}>U</span>
      </button>
      <button
        className={`formatting-btn${activeFormats.strikeThrough ? ' active' : ''}`}
        onClick={() => applyFormat('strikeThrough')}
        title="Strikethrough"
      >
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </button>
      <div className="formatting-separator" />
      <button
        className="formatting-btn"
        onClick={() => applyFormat('code')}
        title="Inline code"
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>&lt;/&gt;</span>
      </button>
      <div className="formatting-separator" />
      <button
        className="formatting-btn"
        onClick={() => applyFormat('link')}
        title="Link"
      >
        <span style={{ fontSize: '13px' }}>&#128279;</span>
      </button>
    </div>
  );
}
