import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createTag, addTagToPage, removeTagFromPage } from '../lib/tags.js';

export default function TagInput({ pageId, tags, allTags, onAddTag, onRemoveTag, onRefresh }) {
  const [inputValue, setInputValue] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Tags already on this page (by id) for filtering autocomplete
  const pageTagIds = new Set(tags.map((t) => t.id));

  // Filter autocomplete suggestions: match input, exclude already-added tags
  const suggestions = inputValue.trim()
    ? allTags.filter(
        (t) =>
          !pageTagIds.has(t.id) &&
          t.name.toLowerCase().includes(inputValue.trim().toLowerCase())
      )
    : [];

  // Check if exact match exists in allTags
  const exactMatch = allTags.find(
    (t) => t.name.toLowerCase() === inputValue.trim().toLowerCase()
  );

  // Show "Create" option if no exact match and input is non-empty
  const showCreateOption =
    inputValue.trim() && !exactMatch && !pageTagIds.has(exactMatch?.id);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddExistingTag = useCallback(
    async (tag) => {
      await addTagToPage(pageId, tag.id);
      setInputValue('');
      setShowAutocomplete(false);
      if (onAddTag) onAddTag(tag);
      if (onRefresh) onRefresh();
    },
    [pageId, onAddTag, onRefresh]
  );

  const handleCreateAndAddTag = useCallback(async () => {
    const name = inputValue.trim();
    if (!name) return;

    const tag = await createTag({ name });
    await addTagToPage(pageId, tag.id);
    setInputValue('');
    setShowAutocomplete(false);
    if (onAddTag) onAddTag(tag);
    if (onRefresh) onRefresh();
  }, [inputValue, pageId, onAddTag, onRefresh]);

  const handleRemoveTag = useCallback(
    async (tagId) => {
      await removeTagFromPage(pageId, tagId);
      if (onRemoveTag) onRemoveTag(tagId);
      if (onRefresh) onRefresh();
    },
    [pageId, onRemoveTag, onRefresh]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!showAutocomplete && !inputValue.trim()) return;

      const totalItems = suggestions.length + (showCreateOption ? 1 : 0);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % Math.max(totalItems, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev <= 0 ? Math.max(totalItems - 1, 0) : prev - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (totalItems === 0) {
          // No suggestions and no create option means nothing to do
          return;
        }

        if (highlightedIndex < suggestions.length) {
          // Select a suggestion
          handleAddExistingTag(suggestions[highlightedIndex]);
        } else if (showCreateOption) {
          // Create new tag
          handleCreateAndAddTag();
        } else if (suggestions.length > 0) {
          // Fallback: add first suggestion
          handleAddExistingTag(suggestions[0]);
        } else {
          // Input exists but exact match already on page -- create anyway
          handleCreateAndAddTag();
        }
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false);
        setInputValue('');
      }
    },
    [
      showAutocomplete,
      inputValue,
      suggestions,
      showCreateOption,
      highlightedIndex,
      handleAddExistingTag,
      handleCreateAndAddTag,
    ]
  );

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setShowAutocomplete(true);
  };

  const handleInputFocus = () => {
    if (inputValue.trim()) {
      setShowAutocomplete(true);
    }
  };

  const totalItems = suggestions.length + (showCreateOption ? 1 : 0);

  return (
    <div className="tag-input-container" ref={containerRef}>
      {/* Existing tag pills */}
      {tags.map((tag) => (
        <span key={tag.id} className={`tag-pill color-${tag.color || 'default'}`}>
          {tag.name}
          <button
            className="tag-remove"
            onClick={() => handleRemoveTag(tag.id)}
            title={`Remove tag "${tag.name}"`}
          >
            &times;
          </button>
        </span>
      ))}

      {/* Add tag input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          className="tag-add-input"
          type="text"
          placeholder="Add a tag..."
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
        />

        {/* Autocomplete dropdown */}
        {showAutocomplete && totalItems > 0 && (
          <div className="tag-autocomplete">
            {suggestions.map((tag, idx) => (
              <div
                key={tag.id}
                className={`tag-autocomplete-item${
                  idx === highlightedIndex ? ' highlighted' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddExistingTag(tag);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={
                  idx === highlightedIndex
                    ? { background: 'var(--bg-active)' }
                    : undefined
                }
              >
                <span
                  className="tag-color-dot"
                  style={{ background: `var(--tag-${tag.color || 'default'})` }}
                />
                {tag.name}
              </div>
            ))}

            {showCreateOption && (
              <div
                className={`tag-autocomplete-item${
                  highlightedIndex === suggestions.length ? ' highlighted' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreateAndAddTag();
                }}
                onMouseEnter={() => setHighlightedIndex(suggestions.length)}
                style={
                  highlightedIndex === suggestions.length
                    ? { background: 'var(--bg-active)' }
                    : undefined
                }
              >
                <span style={{ marginRight: '6px', color: 'var(--text-tertiary)' }}>
                  +
                </span>
                Create "{inputValue.trim()}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
