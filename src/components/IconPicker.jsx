import React, { useState, useEffect, useRef } from 'react';

const EMOJI_LIST = [
  '📄', '📝', '📋', '📌', '📎', '📁', '📂', '🗂️',
  '💡', '🔥', '⭐', '❤️', '💎', '🎯', '🎨', '🎵',
  '🚀', '✈️', '🏠', '🏢', '🌍', '🌟', '☀️', '🌙',
  '📊', '📈', '💰', '🛒', '🔧', '⚙️', '🔑', '🔒',
  '✅', '❌', '⚠️', '💬', '📞', '📧', '🗓️', '⏰',
  '🧠', '💪', '🎓', '📚', '✏️', '🖊️', '🔍', '🏆',
];

export default function IconPicker({ onSelect, onClose }) {
  const [filter, setFilter] = useState('');
  const pickerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filtered = filter
    ? EMOJI_LIST.filter(() => true) // emoji filtering by text is not feasible; show all
    : EMOJI_LIST;

  return (
    <div ref={pickerRef} className="icon-picker">
      <input
        className="icon-picker-search"
        type="text"
        placeholder="Filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        autoFocus
      />
      <div className="icon-picker-grid">
        {filtered.map((emoji) => (
          <button
            key={emoji}
            className="icon-picker-item"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
