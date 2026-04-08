import React, { useRef, useEffect, useCallback } from 'react';

export default function CodeBlock({ block, onUpdate, onDelete, onAddBlock, onFocusBlock }) {
  const ref = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerText = block.content || '';
    }
  }, [block.content]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleInput = useCallback(() => {
    const text = ref.current.innerText;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(block.id, { content: text });
    }, 300);
  }, [block.id, onUpdate]);

  const handleKeyDown = useCallback((e) => {
    // Allow Enter for newlines in code blocks (no new block creation)
    // Shift+Enter also just adds newline (default behavior)

    // Tab inserts two spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode('  ');
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        handleInput();
      }
      return;
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
  }, [block.id, onDelete, onFocusBlock, handleInput]);

  return (
    <div
      ref={ref}
      className="block-code"
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Code"
      data-block-id={block.id}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    />
  );
}
