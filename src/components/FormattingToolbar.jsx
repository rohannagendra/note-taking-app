import React, { useState, useEffect, useRef, useCallback } from 'react';

const TEXT_COLORS = [
  { name: 'Default', value: '#37352F' },
  { name: 'Gray', value: '#9B9A97' },
  { name: 'Brown', value: '#64473A' },
  { name: 'Orange', value: '#D9730D' },
  { name: 'Yellow', value: '#DFAB01' },
  { name: 'Green', value: '#0F7B6C' },
  { name: 'Blue', value: '#0B6E99' },
  { name: 'Purple', value: '#6940A5' },
  { name: 'Pink', value: '#AD1A72' },
  { name: 'Red', value: '#E03E3E' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Default', value: 'transparent' },
  { name: 'Gray', value: 'rgba(155,154,151,0.4)' },
  { name: 'Brown', value: 'rgba(140,46,0,0.2)' },
  { name: 'Orange', value: 'rgba(245,93,0,0.2)' },
  { name: 'Yellow', value: 'rgba(233,168,0,0.2)' },
  { name: 'Green', value: 'rgba(0,135,107,0.2)' },
  { name: 'Blue', value: 'rgba(0,120,223,0.2)' },
  { name: 'Purple', value: 'rgba(103,36,222,0.2)' },
  { name: 'Pink', value: 'rgba(221,0,129,0.2)' },
  { name: 'Red', value: 'rgba(255,0,26,0.2)' },
];

export default function FormattingToolbar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState({});
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const toolbarRef = useRef(null);
  const textColorRef = useRef(null);
  const highlightRef = useRef(null);
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
    const toolbarWidth = 300;
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

  // Close dropdowns on click outside
  useEffect(() => {
    if (!showTextColor && !showHighlight) return;

    const handleClickOutside = (e) => {
      if (
        textColorRef.current && !textColorRef.current.contains(e.target) &&
        highlightRef.current && !highlightRef.current.contains(e.target)
      ) {
        setShowTextColor(false);
        setShowHighlight(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTextColor, showHighlight]);

  // Close dropdowns when toolbar hides
  useEffect(() => {
    if (!visible) {
      setShowTextColor(false);
      setShowHighlight(false);
    }
  }, [visible]);

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

  const applyTextColor = useCallback((color) => {
    isApplyingFormat.current = true;
    if (color === '#37352F') {
      // Reset to default - apply default text color
      document.execCommand('foreColor', false, '#37352F');
    } else {
      document.execCommand('foreColor', false, color);
    }
    setShowTextColor(false);
    requestAnimationFrame(() => {
      updateActiveFormats();
      isApplyingFormat.current = false;
    });
  }, [updateActiveFormats]);

  const applyHighlight = useCallback((color) => {
    isApplyingFormat.current = true;
    if (color === 'transparent') {
      document.execCommand('hiliteColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, color);
    }
    setShowHighlight(false);
    requestAnimationFrame(() => {
      updateActiveFormats();
      isApplyingFormat.current = false;
    });
  }, [updateActiveFormats]);

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
      <div className="formatting-separator" />
      {/* Text Color Button */}
      <div ref={textColorRef} style={{ position: 'relative' }}>
        <button
          className={`formatting-btn${showTextColor ? ' active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowHighlight(false);
            setShowTextColor((prev) => !prev);
          }}
          title="Text color"
        >
          <span style={{ fontWeight: 700, fontSize: '14px', borderBottom: '3px solid #E03E3E', lineHeight: '1', paddingBottom: '1px' }}>A</span>
        </button>
        {showTextColor && (
          <div className="color-picker-dropdown" onMouseDown={(e) => e.preventDefault()}>
            <div className="color-picker-label">Text color</div>
            <div className="color-picker-grid">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.name}
                  className="color-swatch"
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyTextColor(c.value);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Highlight Button */}
      <div ref={highlightRef} style={{ position: 'relative' }}>
        <button
          className={`formatting-btn${showHighlight ? ' active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowTextColor(false);
            setShowHighlight((prev) => !prev);
          }}
          title="Highlight color"
        >
          <span style={{ fontWeight: 700, fontSize: '13px', backgroundColor: 'rgba(233,168,0,0.4)', padding: '0 3px', borderRadius: '2px', lineHeight: '1.2' }}>H</span>
        </button>
        {showHighlight && (
          <div className="color-picker-dropdown" onMouseDown={(e) => e.preventDefault()}>
            <div className="color-picker-label">Highlight</div>
            <div className="color-picker-grid">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.name}
                  className="color-swatch"
                  style={{
                    backgroundColor: c.value === 'transparent' ? '#FFFFFF' : c.value,
                    border: c.value === 'transparent' ? '2px solid var(--border-heavy)' : '2px solid transparent',
                  }}
                  title={c.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyHighlight(c.value);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
