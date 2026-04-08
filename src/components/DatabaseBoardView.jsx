import React, { useMemo, useCallback } from 'react';

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

export default function DatabaseBoardView({
  schema,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}) {
  // Find the grouping property — first select property, or 'status'
  const groupProp = useMemo(() => {
    const statusProp = schema.find((p) => p.id === 'status' && p.type === 'select');
    if (statusProp) return statusProp;
    return schema.find((p) => p.type === 'select') || null;
  }, [schema]);

  // Get the title property
  const titleProp = useMemo(() => {
    return schema.find((p) => p.id === 'title') || schema[0] || null;
  }, [schema]);

  // Other visible properties (not group prop, not title)
  const otherProps = useMemo(() => {
    return schema.filter(
      (p) => p.id !== (groupProp?.id) && p.id !== (titleProp?.id)
    );
  }, [schema, groupProp, titleProp]);

  // Group rows by the select property
  const columns = useMemo(() => {
    if (!groupProp) {
      return [{ value: 'All', color: 'default', rows: rows }];
    }
    const options = groupProp.options || [];
    const cols = options.map((opt) => ({
      value: opt.value,
      color: opt.color || 'default',
      rows: rows.filter((r) => {
        const val = r.properties?.[groupProp.id];
        return val === opt.value;
      }),
    }));
    // Add "No value" column for rows without the group property set
    const ungrouped = rows.filter((r) => {
      const val = r.properties?.[groupProp.id];
      return !val || !options.some((o) => o.value === val);
    });
    if (ungrouped.length > 0) {
      cols.push({ value: 'No value', color: 'default', rows: ungrouped });
    }
    return cols;
  }, [groupProp, rows]);

  const handleAddInColumn = useCallback(async (columnValue) => {
    if (!groupProp) {
      onAddRow({});
      return;
    }
    onAddRow({ [groupProp.id]: columnValue });
  }, [groupProp, onAddRow]);

  if (!groupProp) {
    return (
      <div className="database-board-no-select">
        <p>Board view requires a Select property to group by.</p>
        <p>Add a select property to use board view.</p>
      </div>
    );
  }

  return (
    <div className="database-board">
      {columns.map((col) => (
        <div key={col.value} className="board-column">
          <div className="board-column-header">
            <span
              className="board-column-tag"
              style={{ backgroundColor: SELECT_COLORS[col.color] || SELECT_COLORS.default }}
            >
              {col.value}
            </span>
            <span className="board-column-count">{col.rows.length}</span>
          </div>
          <div className="board-column-cards">
            {col.rows.map((row) => {
              const props = row.properties || {};
              const title = props[titleProp?.id] || 'Untitled';
              return (
                <div key={row.id} className="board-card">
                  <div className="board-card-title">{title}</div>
                  <div className="board-card-props">
                    {otherProps.map((p) => {
                      const val = props[p.id];
                      if (!val && val !== false && val !== 0) return null;
                      return (
                        <div key={p.id} className="board-card-prop">
                          {renderPropValue(p, val)}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="board-card-delete"
                    onClick={() => onDeleteRow(row.id)}
                    title="Delete"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
          <button
            className="board-add-btn"
            onClick={() => handleAddInColumn(col.value)}
          >
            + New
          </button>
        </div>
      ))}
    </div>
  );
}

function renderPropValue(prop, value) {
  switch (prop.type) {
    case 'checkbox':
      return (
        <span className="board-prop-checkbox">
          {value === true || value === 'true' ? '\u2611' : '\u2610'} {prop.name}
        </span>
      );
    case 'select': {
      const opt = (prop.options || []).find((o) => o.value === value);
      const color = opt?.color || 'default';
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
      return <span className="board-prop-date">{value}</span>;
    case 'number':
      return <span className="board-prop-number">{value}</span>;
    default:
      return <span className="board-prop-text">{String(value)}</span>;
  }
}
