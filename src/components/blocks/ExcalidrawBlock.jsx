import React, { useRef, useState, useEffect, useCallback } from 'react';
import '@excalidraw/excalidraw/index.css';

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
  const saveDrawing = useCallback(async () => {
    if (!excalidrawAPI) return null;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    // Deep clone via JSON to strip proxies/methods
    const cleanElements = JSON.parse(JSON.stringify(elements));
    const content = JSON.stringify({
      elements: cleanElements,
      appState: { viewBackgroundColor: appState.viewBackgroundColor || '#ffffff' },
    });

    // Generate SVG snapshot for export/sync
    let svgSnapshot = '';
    try {
      if (cleanElements.length > 0) {
        const exportToSvg = await getExportToSvg();
        const svg = await exportToSvg({
          elements: cleanElements,
          appState: { ...appState, exportWithDarkMode: false },
          files: null,
        });
        svgSnapshot = svg.outerHTML;
      }
    } catch (err) {
      console.warn('Failed to generate SVG snapshot:', err);
    }

    await onUpdate(block.id, {
      content,
      props: { ...(block.props || {}), svg_snapshot: svgSnapshot },
    });
    return content;
  }, [excalidrawAPI, block.id, block.props, onUpdate]);

  // Debounced onChange handler
  const handleChange = useCallback(
    (elements, appState) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (!excalidrawAPI) return;
        const sceneElements = excalidrawAPI.getSceneElements();
        const currentState = excalidrawAPI.getAppState();
        const cleanElements = JSON.parse(JSON.stringify(sceneElements));
        const content = JSON.stringify({
          elements: cleanElements,
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
    const handleKeyDown = async (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(saveTimer.current);
        await saveDrawing();
        setMode('view');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mode, saveDrawing]);

  const handleDone = useCallback(async () => {
    clearTimeout(saveTimer.current);
    await saveDrawing();
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
      <div className="excalidraw-block-view" ref={containerRef}>
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

  // EDIT mode — full screen overlay
  return (
    <>
      <div className="excalidraw-block-view" ref={containerRef}>
        <div className="excalidraw-view">
          <div className="excalidraw-placeholder">
            <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>{'\u270F\uFE0F'}</span>
            <span>Editing in full screen...</span>
          </div>
        </div>
      </div>
      <div className="excalidraw-fullscreen">
        <div className="excalidraw-fullscreen-toolbar">
          <button className="excalidraw-cancel-btn" onClick={handleCancel}>Cancel</button>
          <button className="excalidraw-done-btn" onClick={handleDone}>Save & Close</button>
        </div>
        <React.Suspense fallback={<div className="excalidraw-loading">Loading drawing editor...</div>}>
          <div className="excalidraw-fullscreen-editor">
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
      </div>
    </>
  );
}
