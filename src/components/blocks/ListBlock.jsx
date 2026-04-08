import React, { useRef, useEffect, useCallback } from 'react';

export default function ListBlock({ block, onUpdate, onDelete, onAddBlock, onFocusBlock, blockIndex }) {
  const ref = useRef(null);
  const saveTimer = useRef(null);

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
      onAddBlock(block.position, block.type);
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
  }, [block.id, block.type, block.position, onUpdate, onAddBlock, onDelete, onFocusBlock]);

  const handleCheckboxChange = useCallback(() => {
    onUpdate(block.id, { checked: !block.checked });
  }, [block.id, block.checked, onUpdate]);

  if (block.type === 'todo') {
    return (
      <div className="block-todo">
        <input
          type="checkbox"
          className="block-todo-checkbox"
          checked={!!block.checked}
          onChange={handleCheckboxChange}
        />
        <div
          ref={ref}
          className={`block-todo-content${block.checked ? ' checked' : ''}`}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="To-do"
          data-block-id={block.id}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  // Bullet or number
  const marker = block.type === 'bullet'
    ? '\u2022'
    : `${(blockIndex !== undefined ? blockIndex : 0) + 1}.`;

  return (
    <div className="block-list-item">
      <span className="block-list-bullet">{marker}</span>
      <div
        ref={ref}
        className="block-list-content"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={block.type === 'bullet' ? 'List item' : 'List item'}
        data-block-id={block.id}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
