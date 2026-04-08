import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchPages } from '../lib/pages.js';

export default function MentionSearch({ position, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const searchTimer = useRef(null);

  // Auto-focus the input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Search pages when query changes (debounced)
  useEffect(() => {
    clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const pages = await searchPages(query);
        setResults(pages.slice(0, 6));
        setActiveIndex(0);
      } catch (err) {
        console.error('MentionSearch query failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(searchTimer.current);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (resultsRef.current) {
      const activeEl = resultsRef.current.querySelector('.mention-search-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleSelect = useCallback((page) => {
    onSelect({
      id: page.id,
      title: page.title,
      icon: page.icon,
    });
  }, [onSelect]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => {
        if (results.length === 0) return 0;
        return (prev + 1) % results.length;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => {
        if (results.length === 0) return 0;
        return (prev - 1 + results.length) % results.length;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (results[activeIndex]) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }, [results, activeIndex, handleSelect, onClose]);

  return (
    <>
      <div className="mention-search-overlay" onClick={onClose} />
      <div
        className="mention-search"
        style={{ top: position.top, left: position.left }}
      >
        <input
          ref={inputRef}
          className="mention-search-input"
          type="text"
          placeholder="Search for a page..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="mention-search-results" ref={resultsRef}>
          {loading && results.length === 0 && (
            <div className="mention-search-empty">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="mention-search-empty">
              {query ? 'No pages found' : 'Type to search pages'}
            </div>
          )}
          {results.map((page, index) => (
            <div
              key={page.id}
              className={`mention-search-item${index === activeIndex ? ' active' : ''}`}
              onClick={() => handleSelect(page)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="search-item-icon">{page.icon || '\u{1F4C4}'}</span>
              <span className="search-item-title">{page.title || 'Untitled'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
