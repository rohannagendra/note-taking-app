import React, { useRef, useCallback, useState, useEffect } from 'react';
import TextBlock from './blocks/TextBlock.jsx';
import HeadingBlock from './blocks/HeadingBlock.jsx';
import ListBlock from './blocks/ListBlock.jsx';
import QuoteBlock from './blocks/QuoteBlock.jsx';
import CalloutBlock from './blocks/CalloutBlock.jsx';
import CodeBlock from './blocks/CodeBlock.jsx';
import DividerBlock from './blocks/DividerBlock.jsx';
import TableBlock from './blocks/TableBlock.jsx';
import ImageBlock from './blocks/ImageBlock.jsx';
import MentionBlock from './blocks/MentionBlock.jsx';
import FileBlock from './blocks/FileBlock.jsx';
import MermaidBlock from './blocks/MermaidBlock.jsx';
const ExcalidrawBlock = React.lazy(() => import('./blocks/ExcalidrawBlock.jsx'));
import BlockComments from './BlockComments.jsx';
import { getComments } from '../lib/blocks.js';

function getEditableElement(wrapper) {
  if (!wrapper) return null;
  // Find the contentEditable element inside the block wrapper
  return wrapper.querySelector('[contenteditable="true"]') ||
         wrapper.querySelector('[contenteditable]');
}

const Block = React.forwardRef(function Block(
  {
    block,
    onUpdate,
    onDelete,
    onAddBlock,
    onFocusBlock,
    blockIndex,
    onNavigate,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragging,
    dragOverPosition,
  },
  ref
) {
  const wrapperRef = useRef(null);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getComments(block.id)
      .then((data) => {
        if (!cancelled) setCommentCount(data.length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [block.id]);

  // Expose focus method via the forwarded ref
  React.useImperativeHandle(ref, () => ({
    focus() {
      const el = getEditableElement(wrapperRef.current);
      if (el) {
        el.focus();
        // Place cursor at end
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    },
    getElement() {
      return wrapperRef.current;
    },
  }));

  const handleDragStart = useCallback((e) => {
    // Set drag data and visual feedback
    e.dataTransfer.setData('text/plain', block.id);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(block.id);
  }, [block.id, onDragStart]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOver) onDragOver(block.id, e);
  }, [block.id, onDragOver]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (onDrop) onDrop(block.id);
  }, [block.id, onDrop]);

  const handleDragEnd = useCallback(() => {
    if (onDragEnd) onDragEnd();
  }, [onDragEnd]);

  // Build class names for drag state
  let wrapperClass = 'block-wrapper';
  if (isDragging) wrapperClass += ' dragging';
  if (dragOverPosition === 'top') wrapperClass += ' drag-over-top';
  if (dragOverPosition === 'bottom') wrapperClass += ' drag-over-bottom';

  const renderBlock = () => {
    const commonProps = {
      block,
      onUpdate,
      onDelete,
      onAddBlock,
      onFocusBlock,
    };

    switch (block.type) {
      case 'text':
        return <TextBlock {...commonProps} />;
      case 'h1':
      case 'h2':
      case 'h3':
        return <HeadingBlock {...commonProps} />;
      case 'bullet':
      case 'number':
        return <ListBlock {...commonProps} blockIndex={blockIndex} />;
      case 'todo':
        return <ListBlock {...commonProps} />;
      case 'quote':
        return <QuoteBlock {...commonProps} />;
      case 'callout':
        return <CalloutBlock {...commonProps} />;
      case 'code':
        return <CodeBlock {...commonProps} />;
      case 'divider':
        return <DividerBlock />;
      case 'table':
        return <TableBlock {...commonProps} />;
      case 'image':
        return <ImageBlock {...commonProps} />;
      case 'file':
        return <FileBlock {...commonProps} />;
      case 'mention':
        return <MentionBlock {...commonProps} onNavigate={onNavigate} />;
      case 'mermaid':
        return <MermaidBlock {...commonProps} />;
      case 'excalidraw':
        return (
          <React.Suspense fallback={<div className="excalidraw-loading">Loading...</div>}>
            <ExcalidrawBlock {...commonProps} />
          </React.Suspense>
        );
      default:
        return <TextBlock {...commonProps} />;
    }
  };

  return (
    <div
      className={wrapperClass}
      ref={wrapperRef}
      data-block-id={block.id}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <div className="block-actions-left">
        <button
          className="block-delete-btn"
          onClick={() => onDelete(block.id)}
          title="Delete block"
        >
          &times;
        </button>
        <span
          className="drag-handle"
          aria-hidden="true"
          draggable
          onDragStart={handleDragStart}
        >&#x2801;&#x2802;</span>
      </div>
      <div className="block-content">
        {renderBlock()}
      </div>
      <button
        className="block-comment-btn"
        onClick={() => setShowComments((v) => !v)}
        title="Comments"
      >
        {'\uD83D\uDCAC'}
        {commentCount > 0 && <span className="comment-badge">{commentCount}</span>}
      </button>
      {showComments && (
        <BlockComments
          blockId={block.id}
          onClose={() => setShowComments(false)}
          onCountChange={setCommentCount}
        />
      )}
    </div>
  );
});

export default Block;
