import React, { useRef, useEffect, useCallback } from 'react';

const HEADING_CONFIG = {
  h1: { className: 'block-h1', placeholder: 'Heading 1' },
  h2: { className: 'block-h2', placeholder: 'Heading 2' },
  h3: { className: 'block-h3', placeholder: 'Heading 3' },
};

export default function HeadingBlock({ block, onUpdate, onDelete, onAddBlock, onFocusBlock }) {
  const ref = useRef(null);
  const saveTimer = useRef(null);
  const config = HEADING_CONFIG[block.type] || HEADING_CONFIG.h1;

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = block.content || '';
    }
  }, [block.content]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleInput = useCallback(() => {
    const html = ref.current.innerHTML;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(block.id, { content: html });
    }, 300);
  }, [block.id, onUpdate]);

  const handleKeyDown = useCallback((e) => {
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
  }, [block.id, block.position, onUpdate, onAddBlock, onDelete, onFocusBlock]);

  return (
    <div
      ref={ref}
      className={config.className}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={config.placeholder}
      data-block-id={block.id}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    />
  );
}
