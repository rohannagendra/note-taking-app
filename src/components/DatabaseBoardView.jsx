import React, { useMemo, useCallback, useState, useRef } from 'react';
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

export default function DatabaseBoardView({
  schema,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}) {
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [commentsOpenRowId, setCommentsOpenRowId] = useState(null);
  const [commentCounts, setCommentCounts] = useState({});
  const dragCounter = useRef({});

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

  // --- Drag & Drop handlers ---
  const handleDragStart = useCallback((e, row, sourceColumnValue) => {
    setDraggedCard({ rowId: row.id, sourceColumn: sourceColumnValue });
    e.dataTransfer.effectAllowed = 'move';
    // Set a minimal drag image data so the browser allows the drag
    e.dataTransfer.setData('text/plain', row.id);
    // Add dragging class after a tick so the browser captures the element first
    requestAnimationFrame(() => {
      e.target.classList.add('dragging');
    });
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.target.classList.remove('dragging');
    setDraggedCard(null);
    setDragOverColumn(null);
    dragCounter.current = {};
  }, []);

  const handleColumnDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleColumnDragEnter = useCallback((e, columnValue) => {
    e.preventDefault();
    if (!dragCounter.current[columnValue]) {
      dragCounter.current[columnValue] = 0;
    }
    dragCounter.current[columnValue]++;
    setDragOverColumn(columnValue);
  }, []);

  const handleColumnDragLeave = useCallback((e, columnValue) => {
    if (dragCounter.current[columnValue]) {
      dragCounter.current[columnValue]--;
    }
    if (dragCounter.current[columnValue] <= 0) {
      dragCounter.current[columnValue] = 0;
      setDragOverColumn((prev) => prev === columnValue ? null : prev);
    }
  }, []);

  const handleColumnDrop = useCallback((e, targetColumnValue) => {
    e.preventDefault();
    setDragOverColumn(null);
    dragCounter.current = {};

    if (!draggedCard || !groupProp) return;
    if (draggedCard.sourceColumn === targetColumnValue) {
      setDraggedCard(null);
      return;
    }

    // Find the row and update its property
    const row = rows.find((r) => r.id === draggedCard.rowId);
    if (!row) {
      setDraggedCard(null);
      return;
    }

    const updatedProperties = {
      ...row.properties,
      [groupProp.id]: targetColumnValue === 'No value' ? '' : targetColumnValue,
    };

    onUpdateRow(row.id, updatedProperties);
    setDraggedCard(null);
  }, [draggedCard, groupProp, rows, onUpdateRow]);

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
        <div
          key={col.value}
          className={`board-column${dragOverColumn === col.value ? ' drag-over' : ''}`}
          onDragOver={handleColumnDragOver}
          onDragEnter={(e) => handleColumnDragEnter(e, col.value)}
          onDragLeave={(e) => handleColumnDragLeave(e, col.value)}
          onDrop={(e) => handleColumnDrop(e, col.value)}
        >
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
              const rowCommentCount = commentCounts[row.id] || 0;
              return (
                <div key={row.id}>
                  <div
                    className="board-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, row, col.value)}
                    onDragEnd={handleDragEnd}
                  >
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <button
                        className="board-card-comment-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCommentsOpenRowId(commentsOpenRowId === row.id ? null : row.id);
                        }}
                        title="Comments"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          fontSize: '12px',
                          color: rowCommentCount > 0 ? 'var(--accent-blue)' : 'var(--text-placeholder)',
                        }}
                      >
                        {rowCommentCount > 0 ? `\uD83D\uDCAC ${rowCommentCount}` : '\uD83D\uDCAC'}
                      </button>
                    </div>
                    <button
                      className="board-card-delete"
                      onClick={() => onDeleteRow(row.id)}
                      title="Delete"
                    >
                      &times;
                    </button>
                  </div>
                  {commentsOpenRowId === row.id && (
                    <RowComments
                      rowId={row.id}
                      onClose={() => setCommentsOpenRowId(null)}
                      onCountChange={(count) => setCommentCounts((prev) => ({ ...prev, [row.id]: count }))}
                    />
                  )}
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
