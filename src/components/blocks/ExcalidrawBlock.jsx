import React, { useRef, useState, useEffect, useCallback } from 'react';

const ExcalidrawComp = React.lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw }))
);

let exportToSvgFn = null;
const getExportToSvg = async () => {
  if (!exportToSvgFn) {
    const mod = await import('@excalidraw/excalidraw');
    exportToSvgFn = mod.exportToSvg;
  }
  return exportToSvgFn;
};

export default function ExcalidrawBlock({ block, onUpdate, onDelete, onAddBlock }) {
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [svgPreview, setSvgPreview] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const saveTimer = useRef(null);
  const containerRef = useRef(null);

  // Parse stored data
  const parseData = useCallback(() => {
    try {
      if (block.content) {
        return JSON.parse(block.content);
      }
    } catch {
      // ignore
    }
    return { elements: [], appState: { viewBackgroundColor: '#ffffff' } };
  }, [block.content]);

  const data = parseData();
  const hasDrawing = data.elements && data.elements.length > 0;

  // Generate SVG preview for view mode
  useEffect(() => {
    if (mode !== 'view' || !hasDrawing) {
      setSvgPreview(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const exportToSvg = await getExportToSvg();
        const svg = await exportToSvg({
          elements: data.elements,
          appState: {
            ...data.appState,
            exportWithDarkMode: false,
          },
          files: null,
        });
        if (!cancelled) {
          setSvgPreview(svg.outerHTML);
        }
      } catch (err) {
        console.warn('Failed to generate Excalidraw SVG preview:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [mode, hasDrawing, block.content]);

  // Save drawing data
  const saveDrawing = useCallback(() => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const content = JSON.stringify({
      elements: elements.map((el) => ({ ...el })),
      appState: { viewBackgroundColor: appState.viewBackgroundColor || '#ffffff' },
    });
    onUpdate(block.id, { content });
  }, [excalidrawAPI, block.id, onUpdate]);

  // Debounced onChange handler
  const handleChange = useCallback(
    (elements, appState) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (!excalidrawAPI) return;
        const sceneElements = excalidrawAPI.getSceneElements();
        const currentState = excalidrawAPI.getAppState();
        const content = JSON.stringify({
          elements: sceneElements.map((el) => ({ ...el })),
          appState: { viewBackgroundColor: currentState.viewBackgroundColor || '#ffffff' },
        });
        onUpdate(block.id, { content });
      }, 500);
    },
    [excalidrawAPI, block.id, onUpdate]
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Handle Escape key to exit edit mode
  useEffect(() => {
    if (mode !== 'edit') return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        saveDrawing();
        setMode('view');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mode, saveDrawing]);

  const handleDone = useCallback(() => {
    saveDrawing();
    setMode('view');
  }, [saveDrawing]);

  const handleCancel = useCallback(() => {
    setMode('view');
  }, []);

  const handleClickPreview = useCallback(() => {
    setMode('edit');
  }, []);

  // VIEW mode
  if (mode === 'view') {
    return (
      <div className="excalidraw-block" ref={containerRef}>
        <div className="excalidraw-view" onClick={handleClickPreview} title="Click to edit drawing">
          {hasDrawing && svgPreview ? (
            <div dangerouslySetInnerHTML={{ __html: svgPreview }} />
          ) : (
            <div className="excalidraw-placeholder">
              <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>{'\u270F\uFE0F'}</span>
              <span>Click to start drawing</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // EDIT mode
  return (
    <div className="excalidraw-block" ref={containerRef}>
      <React.Suspense fallback={<div className="excalidraw-loading">Loading drawing editor...</div>}>
        <div className="excalidraw-editor">
          <ExcalidrawComp
            initialData={{
              elements: data.elements || [],
              appState: {
                ...(data.appState || {}),
                viewBackgroundColor: data.appState?.viewBackgroundColor || '#ffffff',
              },
            }}
            onChange={handleChange}
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
          />
        </div>
      </React.Suspense>
      <div className="excalidraw-toolbar">
        <button className="excalidraw-cancel-btn" onClick={handleCancel}>Cancel</button>
        <button className="excalidraw-done-btn" onClick={handleDone}>Done</button>
      </div>
    </div>
  );
}
