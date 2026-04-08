import React from 'react';

export default function TagFilter({ tags, activeTagId, onSelectTag }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="tag-filter">
      <span className="tag-filter-label">Tags:</span>
      {tags.map((tag) => (
        <button
          key={tag.id}
          className={`tag-filter-chip color-${tag.color || 'default'}${
            activeTagId === tag.id ? ' active' : ''
          }`}
          onClick={() => onSelectTag(activeTagId === tag.id ? null : tag.id)}
          title={
            activeTagId === tag.id
              ? `Clear filter "${tag.name}"`
              : `Filter by "${tag.name}"`
          }
        >
          {tag.name}
        </button>
      ))}
    </div>
  );
}
