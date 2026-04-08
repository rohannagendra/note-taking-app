import React, { useRef, useCallback } from 'react';

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

export default function DatabaseTableView({
  schema,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onDeleteProperty,
  onSortBy,
  sortProp,
  sortDir,
}) {
  const saveTimers = useRef({});

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

  return (
    <div className="database-table-wrapper">
      <table className="database-table">
        <thead>
          <tr>
            {schema.map((col) => (
              <th
                key={col.id}
                className="db-th"
                onClick={() => onSortBy && onSortBy(col.id)}
                title={`Sort by ${col.name}`}
              >
                <div className="db-th-content">
                  <span className="db-th-name">{col.name}</span>
                  <span className="db-th-type">{col.type}</span>
                  {renderSortIndicator(col.id)}
                </div>
                {col.id !== 'title' && onDeleteProperty && (
                  <button
                    className="db-th-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProperty(col.id);
                    }}
                    title="Delete property"
                  >
                    &times;
                  </button>
                )}
              </th>
            ))}
            <th className="db-th db-th-actions" style={{ width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const props = row.properties || {};
            return (
              <tr key={row.id} className="db-row">
                {schema.map((col) => (
                  <td key={col.id} className="db-cell">
                    {renderCell(col, props[col.id], row.id, {
                      handleCellEdit,
                      handleCellBlur,
                      handleCheckboxChange,
                      handleSelectChange,
                      handleDateChange,
                    })}
                  </td>
                ))}
                <td className="db-cell db-cell-actions">
                  <button
                    className="db-row-delete"
                    onClick={() => onDeleteRow(row.id)}
                    title="Delete row"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button className="db-add-row-btn" onClick={() => onAddRow()}>
        + New row
      </button>
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
        <div
          className="db-cell-number"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => handlers.handleCellEdit(rowId, col.id, e.currentTarget.innerText)}
          onBlur={(e) => handlers.handleCellBlur(rowId, col.id, e)}
          dangerouslySetInnerHTML={{ __html: escapeHtml(String(value || '')) }}
        />
      );
    case 'select':
      return (
        <select
          className="db-cell-select"
          value={value || ''}
          onChange={(e) => handlers.handleSelectChange(rowId, col.id, e.target.value)}
        >
          <option value="">--</option>
          {(col.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value}
            </option>
          ))}
        </select>
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
