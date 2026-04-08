import React, { useRef, useEffect, useCallback, useState } from 'react';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export default function ImageBlock({ block, onUpdate, onDelete, onAddBlock }) {
  const fileInputRef = useRef(null);
  const captionRef = useRef(null);
  const saveTimer = useRef(null);
  const wrapperRef = useRef(null);

  const props = typeof block.props === 'string'
    ? JSON.parse(block.props || '{}')
    : (block.props || {});
  const caption = props.caption || '';
  const width = props.width || 100;
  const align = props.align || 'center';
  const src = block.content || '';

  // Sync caption to DOM
  useEffect(() => {
    if (captionRef.current && document.activeElement !== captionRef.current) {
      captionRef.current.innerText = caption;
    }
  }, [caption]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const processFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      if (file.size > MAX_SIZE) {
        alert('Image must be under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        onUpdate(block.id, {
          content: base64,
          props: { caption: '', width: 100, align: 'center' },
        });
      };
      reader.readAsDataURL(file);
    },
    [block.id, onUpdate]
  );

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handlePlaceholderClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Clipboard paste handler
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processFile(file);
          return;
        }
      }
    };

    wrapper.addEventListener('paste', handlePaste);
    return () => wrapper.removeEventListener('paste', handlePaste);
  }, [processFile]);

  const handleCaptionInput = useCallback(() => {
    const text = captionRef.current?.innerText || '';
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(block.id, {
        props: { ...props, caption: text },
      });
    }, 300);
  }, [block.id, onUpdate, props]);

  // Empty state
  if (!src) {
    return (
      <div className="block-image-wrapper" ref={wrapperRef}>
        <div className="block-image-placeholder" onClick={handlePlaceholderClick}>
          <span className="placeholder-icon">{'\uD83D\uDDBC'}</span>
          <span>Click to add an image</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // Display state
  return (
    <div className="block-image-wrapper" ref={wrapperRef}>
      <div className={`block-image-display align-${align}`}>
        <img
          src={src}
          alt={caption || 'Image'}
          style={{ width: `${width}%` }}
          onClick={() => fileInputRef.current?.click()}
        />
      </div>
      <div
        ref={captionRef}
        className="block-image-caption"
        contentEditable
        suppressContentEditableWarning
        onInput={handleCaptionInput}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
