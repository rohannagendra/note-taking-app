import React, { useRef, useEffect, useCallback, useState } from 'react';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType) {
  if (!mimeType) return '\uD83D\uDCC1';
  if (mimeType.startsWith('application/pdf')) return '\uD83D\uDCC4';
  if (mimeType.startsWith('text/')) return '\uD83D\uDCC3';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return '\uD83D\uDCCA';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return '\uD83D\uDCCA';
  if (mimeType.includes('word') || mimeType.includes('document'))
    return '\uD83D\uDCC4';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed'))
    return '\uD83D\uDCE6';
  if (mimeType.startsWith('audio/')) return '\uD83C\uDFB5';
  if (mimeType.startsWith('video/')) return '\uD83C\uDFAC';
  return '\uD83D\uDCCE';
}

export default function FileBlock({ block, onUpdate, onDelete, onAddBlock }) {
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);

  const props = typeof block.props === 'string'
    ? JSON.parse(block.props || '{}')
    : (block.props || {});
  const fileName = props.file_name || '';
  const fileSize = props.file_size || 0;
  const mimeType = props.mime_type || '';
  const src = block.content || '';

  const processFile = useCallback(
    (file) => {
      if (!file) return;
      if (file.size > MAX_SIZE) {
        alert('File must be under 10MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        onUpdate(block.id, {
          content: base64,
          props: {
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
          },
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

  // Drag-and-drop onto the block
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDownload = useCallback(() => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName || 'attachment';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [src, fileName]);

  const handleReplace = useCallback((e) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  // Empty state - no file attached yet
  if (!src) {
    return (
      <div
        className="block-file-wrapper"
        ref={wrapperRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="block-file-placeholder" onClick={handlePlaceholderClick}>
          <span className="placeholder-icon">{'\uD83D\uDCCE'}</span>
          <span>Click to attach a file or drag & drop</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // Display state - file attached
  const icon = getFileIcon(mimeType);

  return (
    <div className="block-file-wrapper" ref={wrapperRef}>
      <div className="block-file-display" onClick={handleDownload}>
        <span className="block-file-icon">{icon}</span>
        <div className="block-file-info">
          <span className="block-file-name">{fileName}</span>
          <span className="block-file-meta">
            {formatFileSize(fileSize)}
            {mimeType && ` \u2022 ${mimeType.split('/').pop().toUpperCase()}`}
          </span>
        </div>
        <div className="block-file-actions">
          <button
            className="block-file-action-btn"
            onClick={handleReplace}
            title="Replace file"
          >
            {'\u21BB'}
          </button>
          <button
            className="block-file-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            title="Download"
          >
            {'\u2B07'}
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
