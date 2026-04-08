import React, { useCallback } from 'react';

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

export default function DatabaseListView({
  schema,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}) {
  const titleProp = schema.find((p) => p.id === 'title') || schema[0] || null;
  const otherProps = schema.filter((p) => p.id !== titleProp?.id);

  const handleCheckboxToggle = useCallback((rowId, propId, currentVal) => {
    const newVal = !(currentVal === true || currentVal === 'true');
    onUpdateRow(rowId, { [propId]: newVal });
  }, [onUpdateRow]);

  return (
    <div className="database-list">
      {rows.map((row) => {
        const props = row.properties || {};
        const title = props[titleProp?.id] || 'Untitled';
        return (
          <div key={row.id} className="db-list-row">
            <div className="db-list-title">{title}</div>
            <div className="db-list-props">
              {otherProps.map((col) => {
                const val = props[col.id];
                return (
                  <div key={col.id} className="db-list-prop">
                    <span className="db-list-prop-label">{col.name}</span>
                    {renderListValue(col, val, row.id, handleCheckboxToggle)}
                  </div>
                );
              })}
            </div>
            <button
              className="db-list-delete"
              onClick={() => onDeleteRow(row.id)}
              title="Delete row"
            >
              &times;
            </button>
          </div>
        );
      })}
      <button className="db-add-row-btn" onClick={() => onAddRow()}>
        + New row
      </button>
    </div>
  );
}

function renderListValue(col, value, rowId, onCheckboxToggle) {
  switch (col.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="db-cell-checkbox"
          checked={value === true || value === 'true'}
          onChange={() => onCheckboxToggle(rowId, col.id, value)}
        />
      );
    case 'select': {
      const opt = (col.options || []).find((o) => o.value === value);
      const color = opt?.color || 'default';
      if (!value) return <span className="db-list-prop-empty">--</span>;
      return (
        <span
          className="select-tag"
          style={{ backgroundColor: SELECT_COLORS[color] || SELECT_COLORS.default }}
        >
          {value}
        </span>
      );
    }
    case 'date':
      return <span className="db-list-prop-value">{value || '--'}</span>;
    case 'number':
      return <span className="db-list-prop-value">{value !== undefined && value !== '' ? value : '--'}</span>;
    default:
      return <span className="db-list-prop-value">{value || '--'}</span>;
  }
}
