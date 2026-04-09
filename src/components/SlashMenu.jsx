import React, { useState, useEffect, useRef, useCallback } from 'react';

const MENU_ITEMS = [
  { type: 'text',    icon: 'Aa',  label: 'Text',           desc: 'Plain text block' },
  { type: 'h1',      icon: 'H1',  label: 'Heading 1',      desc: 'Large heading' },
  { type: 'h2',      icon: 'H2',  label: 'Heading 2',      desc: 'Medium heading' },
  { type: 'h3',      icon: 'H3',  label: 'Heading 3',      desc: 'Small heading' },
  { type: 'bullet',  icon: '\u2022',  label: 'Bulleted List',  desc: 'Unordered list' },
  { type: 'number',  icon: '1.',  label: 'Numbered List',  desc: 'Ordered list' },
  { type: 'todo',    icon: '\u2611',  label: 'To-do',          desc: 'Checkbox item' },
  { type: 'quote',   icon: '\u201C',  label: 'Quote',          desc: 'Blockquote' },
  { type: 'callout', icon: '\u{1F4A1}',  label: 'Callout',        desc: 'Highlighted callout box' },
  { type: 'code',    icon: '<>',  label: 'Code',           desc: 'Code block' },
  { type: 'divider', icon: '\u2014',  label: 'Divider',        desc: 'Horizontal rule' },
  { type: 'table',   icon: '\u229E',  label: 'Table',          desc: 'Editable table grid' },
  { type: 'image',   icon: '\u{1F5BC}',  label: 'Image',          desc: 'Upload or embed image' },
  { type: 'mention', icon: '\u{1F4C4}',  label: 'Page Mention',   desc: 'Link to another page' },
  { type: 'database', icon: '\u{1F5C2}',  label: 'Database',        desc: 'Structured data with views' },
  { type: 'mermaid',  icon: '\u25C8',  label: 'Mermaid Diagram',  desc: 'Flowcharts, sequences, etc.' },
  { type: 'excalidraw', icon: '\u270F\uFE0F',  label: 'Drawing',          desc: 'Excalidraw whiteboard' },
];

// Block types that should create a new block instead of converting the current one
const CREATE_NEW_TYPES = new Set(['divider', 'table', 'image', 'mention', 'database', 'mermaid', 'excalidraw']);

export default function SlashMenu({ position, onSelect, onClose, filter }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef(null);

  const filteredItems = MENU_ITEMS.filter((item) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return item.label.toLowerCase().includes(q) ||
           item.type.toLowerCase().includes(q) ||
           item.desc.toLowerCase().includes(q);
  });

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  // Scroll active item into view
  useEffect(() => {
    if (menuRef.current) {
      const activeEl = menuRef.current.querySelector('.slash-menu-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleSelect = useCallback((item) => {
    onSelect(item.type, CREATE_NEW_TYPES.has(item.type));
  }, [onSelect]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredItems[activeIndex]) {
          handleSelect(filteredItems[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [filteredItems, activeIndex, handleSelect, onClose]);

  if (filteredItems.length === 0) {
    return (
      <>
        <div className="slash-menu-overlay" onClick={onClose} />
        <div
          className="slash-menu"
          style={{ top: position.top, left: position.left }}
          ref={menuRef}
        >
          <div className="slash-menu-header">No results</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="slash-menu-overlay" onClick={onClose} />
      <div
        className="slash-menu"
        style={{ top: position.top, left: position.left }}
        ref={menuRef}
      >
        <div className="slash-menu-header">Basic blocks</div>
        {filteredItems.map((item, index) => (
          <button
            key={item.type}
            className={`slash-menu-item${index === activeIndex ? ' active' : ''}`}
            onClick={() => handleSelect(item)}
            onMouseEnter={() => setActiveIndex(index)}
          >
            <span className="menu-item-icon">{item.icon}</span>
            <span className="menu-item-text">
              <span className="menu-item-label">{item.label}</span>
              <span className="menu-item-desc">{item.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
