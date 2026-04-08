import React, { useRef, useCallback } from 'react';
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

function getEditableElement(wrapper) {
  if (!wrapper) return null;
  // Find the contentEditable element inside the block wrapper
  return wrapper.querySelector('[contenteditable="true"]') ||
         wrapper.querySelector('[contenteditable]');
}

const Block = React.forwardRef(function Block(
  { block, onUpdate, onDelete, onAddBlock, onFocusBlock, blockIndex, onNavigate },
  ref
) {
  const wrapperRef = useRef(null);

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
      case 'mention':
        return <MentionBlock {...commonProps} onNavigate={onNavigate} />;
      default:
        return <TextBlock {...commonProps} />;
    }
  };

  return (
    <div className="block-wrapper" ref={wrapperRef} data-block-id={block.id}>
      <span className="drag-handle" aria-hidden="true">&#x2801;&#x2802;</span>
      <div className="block-content">
        {renderBlock()}
      </div>
    </div>
  );
});

export default Block;
