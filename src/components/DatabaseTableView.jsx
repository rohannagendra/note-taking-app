import React, { useRef, useCallback, useState, useEffect } from 'react';
import RowComments from './RowComments.jsx';

const SELECT_COLORS = {
  gray: 'var(--tag-gray)',
  brown: 'var(--tag-brown)',
  orange: 'var(--tag-orange)',
  yellow: 'var(--tag-yellow)',
  green: 'var(--tag-green)',
  blue: 'var(--tag-blue)',
  purple: 'var(--tag-purple)',
  pink: 'var(--tag-pink)',
  red: 'var(--tag-red)',
  default: 'var(--tag-default)',
};

const COLOR_LIST = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

const TYPE_ICONS = {
  text: 'Aa',
  number: '#',
  select: '\u25BC',
  checkbox: '\u2611',
  date: '\uD83D\uDCC5',
};

const TYPE_LABELS = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  checkbox: 'Checkbox',
  date: 'Date',
};

const NUMBER_FORMATS = {
  number: { label: 'Number', example: '1234.5' },
  currency: { label: 'Currency ($)', example: '$1,234.50' },
  percent: { label: 'Percent', example: '12.5%' },
  commas: { label: 'With commas', example: '1,234' },
};

function formatNumber(value, format) {
  if (value === '' || value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return String(value);
  switch (format) {
    case 'currency':
      return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'percent':
      return num + '%';
    case 'commas':
      return num.toLocaleString('en-US', { maximumFractionDigits: 10 });
    default:
      return String(num);
  }
}

export default function DatabaseTableView({
  schema,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onUpdateProperty,
  onDeleteProperty,
  onAddProperty,
  onDuplicateProperty,
  onSortBy,
  sortProp,
  sortDir,
  onCreateOption,
  onBulkDelete,
}) {
  const saveTimers = useRef({});
  const [commentsOpenRowId, setCommentsOpenRowId] = useState(null);
  const [commentCounts, setCommentCounts] = useState({});
  const [menuCol, setMenuCol] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [submenu, setSubmenu] = useState(null); // 'type' | 'options' | null
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [colorPickerOption, setColorPickerOption] = useState(null);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const menuRef = useRef(null);
  const renameInputRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuCol) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuCol]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  const closeMenu = () => {
    setMenuCol(null);
    setSubmenu(null);
    setRenaming(false);
    setRenameValue('');
    setColorPickerOption(null);
    setNewOptionValue('');
    setDeleteConfirm(false);
  };

  const handleHeaderClick = (col, e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapperRect = e.currentTarget.closest('.database-table-wrapper')?.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom - (wrapperRect?.top || 0),
      left: rect.left - (wrapperRect?.left || 0),
    });
    setMenuCol(col);
    setSubmenu(null);
    setRenaming(false);
    setDeleteConfirm(false);
  };

  const handleRenameStart = () => {
    setRenaming(true);
    setRenameValue(menuCol.name);
    setSubmenu(null);
  };

  const handleRenameConfirm = () => {
    const newName = renameValue.trim();
    if (newName && newName !== menuCol.name && onUpdateProperty) {
      onUpdateProperty(menuCol.id, { name: newName });
    }
    setRenaming(false);
    closeMenu();
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      setRenaming(false);
    }
  };

  const handleTypeChange = (newType) => {
    if (newType === menuCol.type) return;
    const updates = { type: newType };
    if (newType === 'select' && !menuCol.options) {
      updates.options = [
        { value: 'Option 1', color: 'gray' },
        { value: 'Option 2', color: 'blue' },
        { value: 'Option 3', color: 'green' },
      ];
    }
    if (onUpdateProperty) {
      onUpdateProperty(menuCol.id, updates);
    }
    closeMenu();
  };

  const handleDuplicate = () => {
    if (onDuplicateProperty) {
      onDuplicateProperty(menuCol.id);
    }
    closeMenu();
  };

  const handleDelete = () => {
    // Check if any rows have data in this column
    const hasData = rows.some((r) => {
      const val = (r.properties || {})[menuCol.id];
      return val !== undefined && val !== '' && val !== false && val !== null;
    });
    if (hasData && !deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    if (onDeleteProperty) {
      onDeleteProperty(menuCol.id);
    }
    closeMenu();
  };

  // Options editing handlers
  const handleOptionRename = (optIndex, newName) => {
    if (!menuCol || !menuCol.options) return;
    const oldValue = menuCol.options[optIndex].value;
    const newOptions = menuCol.options.map((o, i) =>
      i === optIndex ? { ...o, value: newName } : o
    );
    if (onUpdateProperty) {
      onUpdateProperty(menuCol.id, { options: newOptions }, { renameOption: { from: oldValue, to: newName } });
    }
    // Update local menuCol so UI reflects the change
    setMenuCol((prev) => ({ ...prev, options: newOptions }));
  };

  const handleOptionColorChange = (optIndex, color) => {
    if (!menuCol || !menuCol.options) return;
    const newOptions = menuCol.options.map((o, i) =>
      i === optIndex ? { ...o, color } : o
    );
    if (onUpdateProperty) {
      onUpdateProperty(menuCol.id, { options: newOptions });
    }
    setMenuCol((prev) => ({ ...prev, options: newOptions }));
    setColorPickerOption(null);
  };

  const handleOptionDelete = (optIndex) => {
    if (!menuCol || !menuCol.options) return;
    const newOptions = menuCol.options.filter((_, i) => i !== optIndex);
    if (onUpdateProperty) {
      onUpdateProperty(menuCol.id, { options: newOptions });
    }
    setMenuCol((prev) => ({ ...prev, options: newOptions }));
  };

  const handleAddOption = () => {
    if (!newOptionValue.trim() || !menuCol) return;
    const colorIndex = (menuCol.options || []).length % COLOR_LIST.length;
    const newOption = { value: newOptionValue.trim(), color: COLOR_LIST[colorIndex] };
    const newOptions = [...(menuCol.options || []), newOption];
    if (onUpdateProperty) {
      onUpdateProperty(menuCol.id, { options: newOptions });
    }
    setMenuCol((prev) => ({ ...prev, options: newOptions }));
    setNewOptionValue('');
  };

  const handleCellEdit = useCallback((rowId, propId, value) => {
    const key = `${rowId}_${propId}`;
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      onUpdateRow(rowId, { [propId]: value });
    }, 300);
  }, [onUpdateRow]);

  const handleCellBlur = useCallback((rowId, propId, e) => {
    const value = e.currentTarget.innerText;
    const key = `${rowId}_${propId}`;
    clearTimeout(saveTimers.current[key]);
    onUpdateRow(rowId, { [propId]: value });
  }, [onUpdateRow]);

  const handleCheckboxChange = useCallback((rowId, propId, checked) => {
    onUpdateRow(rowId, { [propId]: checked });
  }, [onUpdateRow]);

  const handleSelectChange = useCallback((rowId, propId, value) => {
    onUpdateRow(rowId, { [propId]: value });
  }, [onUpdateRow]);

  const handleDateChange = useCallback((rowId, propId, value) => {
    onUpdateRow(rowId, { [propId]: value });
  }, [onUpdateRow]);

  const renderSortIndicator = (propId) => {
    if (sortProp !== propId) return null;
    return (
      <span className="sort-indicator">
        {sortDir === 'asc' ? ' \u2191' : ' \u2193'}
      </span>
    );
  };

  const isTitle = (col) => col.id === 'title';

  const allSelected = rows.length > 0 && rows.every((r) => selectedRows.has(r.id));
  const someSelected = selectedRows.size > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((r) => r.id)));
    }
  };

  const handleSelectRow = (rowId) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (onBulkDelete) {
      await onBulkDelete(selectedRows);
    } else {
      for (const id of selectedRows) {
        await onDeleteRow(id);
      }
    }
    setSelectedRows(new Set());
  };

  return (
    <div className="database-table-wrapper" style={{ position: 'relative' }}>
      {someSelected && (
        <div className="db-bulk-bar">
          <span style={{ fontWeight: 500 }}>{selectedRows.size} selected</span>
          <button
            className="db-bulk-delete-btn"
            onClick={handleBulkDelete}
          >
            Delete
          </button>
          <button
            className="db-bulk-deselect-btn"
            onClick={() => setSelectedRows(new Set())}
          >
            Deselect all
          </button>
        </div>
      )}
      <table className="database-table">
        <thead>
          <tr>
            <th className="db-th db-th-select">
              <input
                type="checkbox"
                className="db-select-checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={handleSelectAll}
              />
            </th>
            {schema.map((col) => (
              <th
                key={col.id}
                className="db-th"
                onClick={(e) => handleHeaderClick(col, e)}
                title={`Click to edit property "${col.name}"`}
              >
                <div className="db-th-content">
                  <span className="type-icon">{TYPE_ICONS[col.type] || 'Aa'}</span>
                  <span className="db-th-name">{col.name}</span>
                  {renderSortIndicator(col.id)}
                </div>
              </th>
            ))}
            <th
              className="db-th db-th-add-property"
              onClick={() => onAddProperty && onAddProperty()}
              title="Add a property"
            >
              <span style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>+</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const props = row.properties || {};
            const rowCommentCount = commentCounts[row.id] || 0;
            return (
              <React.Fragment key={row.id}>
                <tr className={`db-row${selectedRows.has(row.id) ? ' db-row-selected' : ''}`}>
                  <td className="db-cell db-cell-select-col">
                    <input
                      type="checkbox"
                      className="db-select-checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={() => handleSelectRow(row.id)}
                    />
                  </td>
                  {schema.map((col) => (
                    <td key={col.id} className="db-cell">
                      {renderCell(col, props[col.id], row.id, {
                        handleCellEdit,
                        handleCellBlur,
                        handleCheckboxChange,
                        handleSelectChange,
                        handleDateChange,
                        onCreateOption,
                      })}
                    </td>
                  ))}
                  <td className="db-cell db-cell-actions">
                    <button
                      className="db-row-comment-btn"
                      onClick={() => setCommentsOpenRowId(commentsOpenRowId === row.id ? null : row.id)}
                      title="Comments"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        fontSize: '14px',
                        color: rowCommentCount > 0 ? 'var(--accent-blue)' : 'var(--text-placeholder)',
                        opacity: rowCommentCount > 0 ? 1 : undefined,
                      }}
                    >
                      {rowCommentCount > 0 ? `\uD83D\uDCAC ${rowCommentCount}` : '\uD83D\uDCAC'}
                    </button>
                    <button
                      className="db-row-delete"
                      onClick={() => onDeleteRow(row.id)}
                      title="Delete row"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
                {commentsOpenRowId === row.id && (
                  <tr>
                    <td colSpan={schema.length + 2} style={{ padding: 0 }}>
                      <RowComments
                        rowId={row.id}
                        onClose={() => setCommentsOpenRowId(null)}
                        onCountChange={(count) => setCommentCounts((prev) => ({ ...prev, [row.id]: count }))}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <button className="db-add-row-btn" onClick={() => onAddRow()}>
        + New row
      </button>

      {/* Property Menu */}
      {menuCol && (
        <div
          ref={menuRef}
          className="property-menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {/* Rename mode */}
          {renaming ? (
            <div style={{ padding: '4px' }}>
              <input
                ref={renameInputRef}
                className="property-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameConfirm}
              />
            </div>
          ) : submenu === 'type' ? (
            /* Type submenu */
            <div className="property-menu-submenu">
              <button
                className="property-menu-item"
                onClick={() => setSubmenu(null)}
                style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}
              >
                ← Back
              </button>
              <div className="property-menu-separator" />
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <button
                  key={type}
                  className="property-menu-item"
                  onClick={() => handleTypeChange(type)}
                  disabled={isTitle(menuCol) && type !== menuCol.type}
                >
                  <span className="type-option">
                    <span className="type-icon">{TYPE_ICONS[type]}</span>
                    <span>{label}</span>
                  </span>
                  {menuCol.type === type && (
                    <span style={{ marginLeft: 'auto', color: 'var(--accent-blue)' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          ) : submenu === 'format' ? (
            /* Number format submenu */
            <div className="property-menu-submenu">
              <button
                className="property-menu-item"
                onClick={() => setSubmenu(null)}
                style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}
              >
                ← Back
              </button>
              <div className="property-menu-separator" />
              {Object.entries(NUMBER_FORMATS).map(([key, { label, example }]) => (
                <button
                  key={key}
                  className="property-menu-item"
                  onClick={() => {
                    if (onUpdateProperty) {
                      onUpdateProperty(menuCol.id, { format: key });
                    }
                    setMenuCol((prev) => ({ ...prev, format: key }));
                    closeMenu();
                  }}
                >
                  <span className="type-option">
                    <span style={{ minWidth: '90px' }}>{label}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{example}</span>
                  </span>
                  {(menuCol.format || 'number') === key && (
                    <span style={{ marginLeft: 'auto', color: 'var(--accent-blue)' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          ) : submenu === 'options' ? (
            /* Options editor submenu */
            <div className="option-editor">
              <button
                className="property-menu-item"
                onClick={() => setSubmenu(null)}
                style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}
              >
                ← Back
              </button>
              <div className="property-menu-separator" />
              {(menuCol.options || []).map((opt, idx) => (
                <div key={idx} className="option-row">
                  <div
                    className="option-color-dot"
                    style={{ background: SELECT_COLORS[opt.color] || SELECT_COLORS.default }}
                    onClick={() => setColorPickerOption(colorPickerOption === idx ? null : idx)}
                    title="Change color"
                  />
                  <input
                    className="option-name-input"
                    value={opt.value}
                    onChange={(e) => {
                      // Local update while typing
                      const newOpts = menuCol.options.map((o, i) =>
                        i === idx ? { ...o, value: e.target.value } : o
                      );
                      setMenuCol((prev) => ({ ...prev, options: newOpts }));
                    }}
                    onBlur={(e) => handleOptionRename(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                  />
                  <span
                    className="option-delete-btn"
                    onClick={() => handleOptionDelete(idx)}
                    title="Delete option"
                  >
                    ×
                  </span>
                  {colorPickerOption === idx && (
                    <div className="option-color-picker">
                      {COLOR_LIST.map((c) => (
                        <div
                          key={c}
                          className="option-color-dot"
                          style={{
                            background: SELECT_COLORS[c],
                            outline: opt.color === c ? '2px solid var(--accent-blue)' : 'none',
                            outlineOffset: '1px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOptionColorChange(idx, c);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <input
                className="add-option-input"
                placeholder="Add an option..."
                value={newOptionValue}
                onChange={(e) => setNewOptionValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddOption();
                  if (e.key === 'Escape') setSubmenu(null);
                }}
              />
            </div>
          ) : (
            /* Main menu */
            <>
              <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {menuCol.name}
              </div>
              <button className="property-menu-item" onClick={handleRenameStart}>
                <span style={{ width: '20px', textAlign: 'center' }}>✏️</span>
                Rename
              </button>
              {!isTitle(menuCol) && (
                <button className="property-menu-item" onClick={() => setSubmenu('type')}>
                  <span style={{ width: '20px', textAlign: 'center' }}>{TYPE_ICONS[menuCol.type]}</span>
                  Type
                  <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                    {TYPE_LABELS[menuCol.type]} →
                  </span>
                </button>
              )}
              {menuCol.type === 'select' && (
                <button className="property-menu-item" onClick={() => setSubmenu('options')}>
                  <span style={{ width: '20px', textAlign: 'center' }}>⚙️</span>
                  Edit options
                  <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: '12px' }}>→</span>
                </button>
              )}
              {menuCol.type === 'number' && (
                <button className="property-menu-item" onClick={() => setSubmenu('format')}>
                  <span style={{ width: '20px', textAlign: 'center' }}>🔢</span>
                  Format
                  <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                    {NUMBER_FORMATS[menuCol.format || 'number']?.label || 'Number'} →
                  </span>
                </button>
              )}
              <button className="property-menu-item" onClick={() => { onSortBy && onSortBy(menuCol.id); closeMenu(); }}>
                <span style={{ width: '20px', textAlign: 'center' }}>↕</span>
                Sort
                {sortProp === menuCol.id && (
                  <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                    {sortDir === 'asc' ? 'Ascending' : 'Descending'}
                  </span>
                )}
              </button>
              {!isTitle(menuCol) && (
                <button className="property-menu-item" onClick={handleDuplicate}>
                  <span style={{ width: '20px', textAlign: 'center' }}>⧉</span>
                  Duplicate
                </button>
              )}
              {!isTitle(menuCol) && (
                <>
                  <div className="property-menu-separator" />
                  {deleteConfirm ? (
                    <div style={{ padding: '6px 10px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        This column has data. Delete anyway?
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="property-menu-item danger"
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={handleDelete}
                        >
                          Delete
                        </button>
                        <button
                          className="property-menu-item"
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => setDeleteConfirm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="property-menu-item danger" onClick={handleDelete}>
                      <span style={{ width: '20px', textAlign: 'center' }}>🗑</span>
                      Delete property
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NumberCell({ value, onEdit, onBlur, format }) {
  const ref = useRef(null);
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerText = value != null ? String(value) : '';
    }
  }, [value]);

  const validate = (text) => {
    if (text === '') return true;
    return !isNaN(Number(text)) && text.trim() !== '';
  };

  const handleInput = (e) => {
    const text = e.currentTarget.innerText;
    if (validate(text)) {
      setInvalid(false);
      onEdit(text);
    } else {
      setInvalid(true);
    }
  };

  const handleFocus = () => {
    setFocused(true);
    // Show raw number when focused
    if (ref.current) {
      ref.current.innerText = value != null ? String(value) : '';
    }
  };

  const handleBlur = (e) => {
    setFocused(false);
    const text = e.currentTarget.innerText;
    if (!validate(text)) {
      e.currentTarget.innerText = value != null ? String(value) : '';
      setInvalid(false);
      return;
    }
    setInvalid(false);
    onBlur(text);
  };

  // Show formatted value when not focused
  const displayValue = !focused && format && format !== 'number'
    ? formatNumber(value, format)
    : String(value || '');

  return (
    <div
      ref={ref}
      className={'db-cell-number' + (invalid ? ' db-cell-invalid' : '')}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      dangerouslySetInnerHTML={{ __html: escapeHtml(displayValue) }}
    />
  );
}

function SelectCell({ value, options, onChange, onCreateOption }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = (options || []).filter((o) =>
    o.value.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = options?.some((o) => o.value.toLowerCase() === search.trim().toLowerCase());
  const currentOpt = options?.find((o) => o.value === value);

  return (
    <div className="select-cell-wrapper" ref={ref}>
      <div className="select-cell-trigger" onClick={() => setOpen(!open)}>
        {value ? (
          <span
            className="select-cell-tag"
            style={{ background: SELECT_COLORS[currentOpt?.color] || SELECT_COLORS.default }}
          >
            {value}
          </span>
        ) : (
          <span className="select-cell-placeholder">Select...</span>
        )}
      </div>
      {open && (
        <div className="select-cell-dropdown">
          <input
            ref={inputRef}
            className="select-cell-search"
            type="text"
            placeholder="Search or create..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search.trim()) {
                if (filtered.length > 0) {
                  onChange(filtered[0].value);
                } else if (onCreateOption) {
                  onCreateOption(search.trim());
                  onChange(search.trim());
                }
                setSearch('');
                setOpen(false);
              }
              if (e.key === 'Escape') {
                setSearch('');
                setOpen(false);
              }
            }}
          />
          <div className="select-cell-options">
            {value && (
              <div
                className="select-cell-option select-cell-option-clear"
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              >
                Clear
              </div>
            )}
            {filtered.map((opt) => (
              <div
                key={opt.value}
                className={'select-cell-option' + (opt.value === value ? ' active' : '')}
                onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
              >
                <span
                  className="select-cell-option-tag"
                  style={{ background: SELECT_COLORS[opt.color] || SELECT_COLORS.default }}
                >
                  {opt.value}
                </span>
                {opt.value === value && <span className="select-cell-check">✓</span>}
              </div>
            ))}
            {search.trim() && !exactMatch && onCreateOption && (
              <div
                className="select-cell-option select-cell-option-create"
                onClick={() => {
                  onCreateOption(search.trim());
                  onChange(search.trim());
                  setSearch('');
                  setOpen(false);
                }}
              >
                <span style={{ color: 'var(--accent-blue)', marginRight: '6px' }}>+</span>
                Create "<strong>{search.trim()}</strong>"
              </div>
            )}
            {filtered.length === 0 && !search.trim() && (
              <div className="select-cell-empty">No options</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderCell(col, value, rowId, handlers) {
  switch (col.type) {
    case 'text':
      return (
        <div
          className="db-cell-text"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => handlers.handleCellEdit(rowId, col.id, e.currentTarget.innerText)}
          onBlur={(e) => handlers.handleCellBlur(rowId, col.id, e)}
          dangerouslySetInnerHTML={{ __html: escapeHtml(value || '') }}
        />
      );
    case 'number':
      return (
        <NumberCell
          value={value}
          format={col.format}
          onEdit={(val) => handlers.handleCellEdit(rowId, col.id, val)}
          onBlur={(val) => handlers.handleCellBlur(rowId, col.id, { currentTarget: { innerText: val } })}
        />
      );
    case 'select':
      return (
        <SelectCell
          value={value}
          options={col.options || []}
          onChange={(val) => handlers.handleSelectChange(rowId, col.id, val)}
          onCreateOption={handlers.onCreateOption ? (optVal) => handlers.onCreateOption(col.id, optVal) : null}
        />
      );
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="db-cell-checkbox"
          checked={value === true || value === 'true'}
          onChange={(e) => handlers.handleCheckboxChange(rowId, col.id, e.target.checked)}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className="db-cell-date"
          value={value || ''}
          onChange={(e) => handlers.handleDateChange(rowId, col.id, e.target.value)}
        />
      );
    default:
      return (
        <div
          className="db-cell-text"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => handlers.handleCellEdit(rowId, col.id, e.currentTarget.innerText)}
          onBlur={(e) => handlers.handleCellBlur(rowId, col.id, e)}
          dangerouslySetInnerHTML={{ __html: escapeHtml(value || '') }}
        />
      );
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
