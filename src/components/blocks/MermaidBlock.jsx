import React, { useState, useRef, useCallback, useEffect } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
});

const DEFAULT_TEMPLATE = 'graph TD\n    A[Start] --> B[End]';

export default function MermaidBlock({ block, onUpdate, onDelete, onAddBlock }) {
  const [mode, setMode] = useState(block.content ? 'view' : 'edit');
  const [code, setCode] = useState(block.content || '');
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const saveTimer = useRef(null);
  const renderCounter = useRef(0);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const renderDiagram = useCallback(async (source) => {
    if (!source || !source.trim()) {
      setSvgHtml('');
      setError('');
      return;
    }
    renderCounter.current += 1;
    const id = `mermaid-${block.id}-${renderCounter.current}`;
    try {
      const { svg } = await mermaid.render(id, source);
      setSvgHtml(svg);
      setError('');
    } catch (err) {
      setError(err.message || 'Invalid mermaid syntax');
      // Clean up any failed render element mermaid may have left in the DOM
      const el = document.getElementById('d' + id);
      if (el) el.remove();
    }
  }, [block.id]);

  // Render on mount if we have content
  useEffect(() => {
    if (block.content) {
      renderDiagram(block.content);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveContent = useCallback((value) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(block.id, { content: value });
    }, 300);
  }, [block.id, onUpdate]);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setCode(value);
    saveContent(value);
  }, [saveContent]);

  const handleBlur = useCallback(async () => {
    const source = code.trim();
    if (!source) {
      setMode('view');
      setSvgHtml('');
      setError('');
      return;
    }
    // Try to render; if valid, switch to view mode
    renderCounter.current += 1;
    const id = `mermaid-${block.id}-${renderCounter.current}`;
    try {
      const { svg } = await mermaid.render(id, source);
      setSvgHtml(svg);
      setError('');
      setMode('view');
    } catch (err) {
      setError(err.message || 'Invalid mermaid syntax');
      const el = document.getElementById('d' + id);
      if (el) el.remove();
      // Keep editor open on error
    }
  }, [code, block.id]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Backspace' && !code) {
      e.preventDefault();
      onDelete(block.id);
    }
  }, [code, block.id, onDelete, handleBlur]);

  const enterEditMode = useCallback(() => {
    setMode('edit');
    setError('');
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  }, []);

  const handlePlaceholderClick = useCallback(() => {
    setCode(DEFAULT_TEMPLATE);
    setMode('edit');
    saveContent(DEFAULT_TEMPLATE);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  }, [saveContent]);

  // View mode: show rendered SVG or placeholder
  if (mode === 'view') {
    if (!code && !svgHtml) {
      return (
        <div className="mermaid-block">
          <div className="mermaid-placeholder" onClick={handlePlaceholderClick}>
            Click to add a Mermaid diagram
          </div>
        </div>
      );
    }

    return (
      <div className="mermaid-block">
        <div
          className="mermaid-view"
          onClick={enterEditMode}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>
    );
  }

  // Edit mode: textarea with mermaid syntax
  return (
    <div className="mermaid-block">
      <div className="mermaid-edit">
        <textarea
          ref={textareaRef}
          className="mermaid-textarea"
          value={code}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Enter mermaid syntax..."
          spellCheck={false}
        />
        {error && (
          <div className="mermaid-error">{error}</div>
        )}
        <div className="mermaid-toolbar">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleBlur();
            }}
          >
            Render
          </button>
        </div>
      </div>
    </div>
  );
}
