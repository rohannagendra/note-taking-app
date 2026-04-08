import React, { useState, useRef, useCallback, useEffect } from 'react';

const DEFAULT_TABLE = {
  headers: ['Column 1', 'Column 2', 'Column 3'],
  rows: [['', '', '']],
};

function parseTableContent(content) {
  if (!content) return { ...DEFAULT_TABLE, rows: DEFAULT_TABLE.rows.map((r) => [...r]) };
  try {
    const data = JSON.parse(content);
    if (
      Array.isArray(data.headers) &&
      data.headers.length > 0 &&
      Array.isArray(data.rows)
    ) {
      return data;
    }
  } catch {
    // ignore
  }
  return {
    headers: [...DEFAULT_TABLE.headers],
    rows: DEFAULT_TABLE.rows.map((r) => [...r]),
  };
}

export default function TableBlock({ block, onUpdate, onDelete, onAddBlock }) {
  const [tableData, setTableData] = useState(() => parseTableContent(block.content));
  const [deleteColIndex, setDeleteColIndex] = useState(null);
  const [deleteRowIndex, setDeleteRowIndex] = useState(null);
  const saveTimer = useRef(null);
  const tableRef = useRef(null);

  // Sync from props when block.content changes externally
  useEffect(() => {
    if (document.activeElement && tableRef.current && tableRef.current.contains(document.activeElement)) {
      return; // don't overwrite while editing
    }
    setTableData(parseTableContent(block.content));
  }, [block.content]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const saveData = useCallback(
    (data) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onUpdate(block.id, { content: JSON.stringify(data) });
      }, 300);
    },
    [block.id, onUpdate]
  );

  const updateCell = useCallback(
    (rowIndex, colIndex, value) => {
      setTableData((prev) => {
        const next = {
          headers: [...prev.headers],
          rows: prev.rows.map((r) => [...r]),
        };
        if (rowIndex === -1) {
          next.headers[colIndex] = value;
        } else {
          next.rows[rowIndex][colIndex] = value;
        }
        saveData(next);
        return next;
      });
    },
    [saveData]
  );

  const addColumn = useCallback(() => {
    setTableData((prev) => {
      const colNum = prev.headers.length + 1;
      const next = {
        headers: [...prev.headers, `Column ${colNum}`],
        rows: prev.rows.map((r) => [...r, '']),
      };
      saveData(next);
      return next;
    });
  }, [saveData]);

  const addRow = useCallback(() => {
    setTableData((prev) => {
      const next = {
        headers: [...prev.headers],
        rows: [...prev.rows.map((r) => [...r]), new Array(prev.headers.length).fill('')],
      };
      saveData(next);
      return next;
    });
  }, [saveData]);

  const deleteColumn = useCallback(
    (colIndex) => {
      setTableData((prev) => {
        if (prev.headers.length <= 1) return prev;
        const next = {
          headers: prev.headers.filter((_, i) => i !== colIndex),
          rows: prev.rows.map((r) => r.filter((_, i) => i !== colIndex)),
        };
        saveData(next);
        return next;
      });
      setDeleteColIndex(null);
    },
    [saveData]
  );

  const deleteRow = useCallback(
    (rowIndex) => {
      setTableData((prev) => {
        if (prev.rows.length <= 1) return prev;
        const next = {
          headers: [...prev.headers],
          rows: prev.rows.filter((_, i) => i !== rowIndex),
        };
        saveData(next);
        return next;
      });
      setDeleteRowIndex(null);
    },
    [saveData]
  );

  const handleCellKeyDown = useCallback(
    (e, rowIndex, colIndex) => {
      const { headers, rows } = tableData;
      const totalCols = headers.length;
      const totalRows = rows.length;

      if (e.key === 'Tab') {
        e.preventDefault();
        let nextRow = rowIndex;
        let nextCol = colIndex;

        if (e.shiftKey) {
          // Move backward
          nextCol--;
          if (nextCol < 0) {
            nextRow--;
            nextCol = totalCols - 1;
          }
          // If we're in header row and try to go back from first cell, do nothing
          if (nextRow < -1) return;
        } else {
          // Move forward
          nextCol++;
          if (nextCol >= totalCols) {
            nextRow++;
            nextCol = 0;
          }
          // If past last cell of last row, do nothing
          if (nextRow >= totalRows) return;
        }

        // Focus the target cell
        if (tableRef.current) {
          const selector =
            nextRow === -1
              ? `th[data-col="${nextCol}"]`
              : `td[data-row="${nextRow}"][data-col="${nextCol}"]`;
          const cell = tableRef.current.querySelector(selector);
          if (cell) {
            cell.focus();
            // Place cursor at end
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(cell);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // If we're in the last row, add a new row
        if (rowIndex === totalRows - 1) {
          addRow();
          // Focus will happen after re-render via setTimeout
          setTimeout(() => {
            if (tableRef.current) {
              const cell = tableRef.current.querySelector(
                `td[data-row="${totalRows}"][data-col="0"]`
              );
              if (cell) cell.focus();
            }
          }, 0);
        }
      }
    },
    [tableData, addRow]
  );

  const handleCellInput = useCallback(
    (e, rowIndex, colIndex) => {
      const text = e.currentTarget.innerText;
      updateCell(rowIndex, colIndex, text);
    },
    [updateCell]
  );

  const handleHeaderClick = useCallback(
    (e, colIndex) => {
      // Toggle delete column option
      e.stopPropagation();
      setDeleteColIndex((prev) => (prev === colIndex ? null : colIndex));
      setDeleteRowIndex(null);
    },
    []
  );

  // Close popups on outside click
  useEffect(() => {
    const handleClick = () => {
      setDeleteColIndex(null);
      setDeleteRowIndex(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="block-table-wrapper" ref={tableRef}>
      <table className="block-table">
        <thead>
          <tr>
            {tableData.headers.map((header, colIndex) => (
              <th
                key={colIndex}
                data-col={colIndex}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => handleCellInput(e, -1, colIndex)}
                onKeyDown={(e) => handleCellKeyDown(e, -1, colIndex)}
                onClick={(e) => handleHeaderClick(e, colIndex)}
                style={{ position: 'relative', minWidth: 80 }}
              >
                {header}
                {deleteColIndex === colIndex && tableData.headers.length > 1 && (
                  <button
                    className="table-action-btn"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 10,
                      background: 'white',
                      border: '1px solid var(--border-default)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      padding: '4px 8px',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      borderRadius: 4,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteColumn(colIndex);
                    }}
                  >
                    Delete column
                  </button>
                )}
              </th>
            ))}
            <th
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                width: 30,
                minWidth: 30,
              }}
            >
              <button
                className="table-action-btn"
                onClick={addColumn}
                title="Add column"
                style={{ width: 28, height: 28, fontSize: 16 }}
              >
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onMouseEnter={() => setDeleteRowIndex(rowIndex)}
              onMouseLeave={() => setDeleteRowIndex(null)}
              style={{ position: 'relative' }}
            >
              {row.map((cell, colIndex) => (
                <td
                  key={colIndex}
                  data-row={rowIndex}
                  data-col={colIndex}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => handleCellInput(e, rowIndex, colIndex)}
                  onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                  style={{ minWidth: 80 }}
                >
                  {cell}
                </td>
              ))}
              <td
                style={{
                  border: 'none',
                  padding: 0,
                  width: 30,
                  minWidth: 30,
                  verticalAlign: 'middle',
                }}
              >
                {deleteRowIndex === rowIndex && tableData.rows.length > 1 && (
                  <button
                    className="table-action-btn"
                    onClick={() => deleteRow(rowIndex)}
                    title="Delete row"
                    style={{ width: 28, height: 28, fontSize: 12 }}
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="block-table-actions">
        <button className="table-action-btn" onClick={addRow}>
          + Add row
        </button>
      </div>
    </div>
  );
}
