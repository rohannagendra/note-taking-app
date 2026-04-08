import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getRowComments, addRowComment, deleteRowComment } from '../lib/database.js';

function relativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function RowComments({ rowId, onClose, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const loadComments = useCallback(async () => {
    try {
      const data = await getRowComments(rowId);
      setComments(data);
      if (onCountChange) onCountChange(data.length);
    } catch (err) {
      console.error('Failed to load row comments:', err);
    } finally {
      setLoading(false);
    }
  }, [rowId, onCountChange]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    try {
      const newComment = await addRowComment(rowId, text);
      setComments((prev) => [...prev, newComment]);
      if (onCountChange) onCountChange(comments.length + 1);
    } catch (err) {
      console.error('Failed to add row comment:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRowComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      if (onCountChange) onCountChange(comments.length - 1);
    } catch (err) {
      console.error('Failed to delete row comment:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="block-comments-panel" style={{ margin: '0', borderRadius: '0 0 4px 4px' }}>
      <div className="block-comments-header">
        <span className="block-comments-title">Row Comments</span>
        <button className="block-comments-close" onClick={onClose}>&times;</button>
      </div>
      <div className="block-comments-list" ref={listRef}>
        {loading && <div className="comment-item comment-loading">Loading...</div>}
        {!loading && comments.length === 0 && (
          <div className="comment-item comment-empty">No comments yet</div>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="comment-item">
            <div className="comment-content">{comment.content}</div>
            <div className="comment-meta">
              <span className="comment-time">{relativeTime(comment.created_at)}</span>
              <button
                className="comment-delete-btn"
                onClick={() => handleDelete(comment.id)}
                title="Delete comment"
              >&times;</button>
            </div>
          </div>
        ))}
      </div>
      <textarea
        ref={inputRef}
        className="comment-input"
        placeholder="Add a comment..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
      />
    </div>
  );
}
