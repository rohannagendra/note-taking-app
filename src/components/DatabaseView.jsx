import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  createDatabase,
  getDatabase,
  getPageDatabase,
  updateDatabase,
  getDatabaseRows,
  addDatabaseRow,
  updateDatabaseRow,
  deleteDatabaseRow,
  deleteDatabase,
  getAllDatabases,
} from '../lib/database.js';
import DatabaseTableView from './DatabaseTableView.jsx';
import DatabaseBoardView from './DatabaseBoardView.jsx';
import DatabaseListView from './DatabaseListView.jsx';

const DEFAULT_SCHEMA = [
  { id: 'title', name: 'Name', type: 'text' },
  {
    id: 'status',
    name: 'Status',
    type: 'select',
    options: [
      { value: 'Not started', color: 'gray' },
      { value: 'In progress', color: 'blue' },
      { value: 'Done', color: 'green' },
    ],
  },
];

function generateId() {
  return 'prop_' + Math.random().toString(36).slice(2, 10);
}

function parseMultiSelectValue(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) { /* not JSON */ }
  if (typeof val === 'string' && val.trim()) {
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function DatabaseView({ pageId, onNavigate, linkedDatabaseId }) {
  const [database, setDatabase] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [availableDatabases, setAvailableDatabases] = useState([]);
  const [activeView, setActiveView] = useState('table');
  const [editingName, setEditingName] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState('text');
  const [filterProp, setFilterProp] = useState('');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [sorts, setSorts] = useState([]); // Array of { propId, dir }
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const nameRef = useRef(null);
  const saveTimer = useRef(null);

  // Load database for this page (or linked database)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let db;
        if (linkedDatabaseId) {
          db = await getDatabase(linkedDatabaseId);
        } else {
          db = await getPageDatabase(pageId);
        }
        if (cancelled) return;
        if (db) {
          const schema = typeof db.properties_schema === 'string'
            ? JSON.parse(db.properties_schema)
            : db.properties_schema || [];
          setDatabase({ ...db, properties_schema: schema });
          const loadedRows = await getDatabaseRows(db.id);
          if (!cancelled) setRows(loadedRows);
        } else {
          setDatabase(null);
          setRows([]);
        }
      } catch {
        if (!cancelled) {
          setDatabase(null);
          setRows([]);
        }
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [pageId, linkedDatabaseId]);

  const handleCreate = useCallback(async () => {
    const db = await createDatabase(pageId, 'Untitled Database', DEFAULT_SCHEMA);
    const schema = typeof db.properties_schema === 'string'
      ? JSON.parse(db.properties_schema)
      : db.properties_schema || [];
    setDatabase({ ...db, properties_schema: schema });
    setRows([]);
  }, [pageId]);

  const handleDeleteDatabase = useCallback(async () => {
    if (!database) return;
    await deleteDatabase(database.id);
    setDatabase(null);
    setRows([]);
  }, [database]);

  const handleUpdateName = useCallback(async () => {
    if (!database || !nameRef.current) return;
    const name = nameRef.current.innerText.trim() || 'Untitled Database';
    await updateDatabase(database.id, { name });
    setDatabase((prev) => ({ ...prev, name }));
    setEditingName(false);
  }, [database]);

  const handleAddProperty = useCallback(async (name, type) => {
    if (!database) return;
    const propName = name || newPropName.trim();
    const propType = type || newPropType;
    if (!propName && !name) {
      const existingCount = database.properties_schema.length;
      const autoName = `Property ${existingCount}`;
      const newProp = { id: generateId(), name: autoName, type: 'text' };
      const newSchema = [...database.properties_schema, newProp];
      await updateDatabase(database.id, { properties_schema: newSchema });
      setDatabase((prev) => ({ ...prev, properties_schema: newSchema }));
      return;
    }
    if (!propName) return;
    const newProp = {
      id: generateId(),
      name: propName,
      type: propType,
    };
    if (propType === 'select' || propType === 'multiselect') {
      newProp.options = [
        { value: 'Option 1', color: 'gray' },
        { value: 'Option 2', color: 'blue' },
        { value: 'Option 3', color: 'green' },
      ];
    }
    const newSchema = [...database.properties_schema, newProp];
    await updateDatabase(database.id, { properties_schema: newSchema });
    setDatabase((prev) => ({ ...prev, properties_schema: newSchema }));
    setNewPropName('');
    setNewPropType('text');
    setShowAddProperty(false);
  }, [database, newPropName, newPropType]);

  const handleDeleteProperty = useCallback(async (propId) => {
    if (!database) return;
    if (propId === 'title') return;
    const newSchema = database.properties_schema.filter((p) => p.id !== propId);
    await updateDatabase(database.id, { properties_schema: newSchema });
    setDatabase((prev) => ({ ...prev, properties_schema: newSchema }));
    const updatedRows = rows.map((r) => {
      const props = typeof r.properties === 'string'
        ? JSON.parse(r.properties)
        : { ...(r.properties || {}) };
      delete props[propId];
      return { ...r, properties: props };
    });
    setRows(updatedRows);
    for (const r of updatedRows) {
      const props = typeof r.properties === 'string'
        ? JSON.parse(r.properties)
        : r.properties || {};
      await updateDatabaseRow(r.id, props);
    }
  }, [database, rows]);

  const handleCreateOption = useCallback(async (propId, optionValue) => {
    if (!database) return;
    const newSchema = database.properties_schema.map((p) => {
      if (p.id !== propId) return p;
      const existingOptions = p.options || [];
      if (existingOptions.some((o) => o.value === optionValue)) return p;
      const colorIdx = existingOptions.length % 10;
      const colors = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
      return { ...p, options: [...existingOptions, { value: optionValue, color: colors[colorIdx] }] };
    });
    await updateDatabase(database.id, { properties_schema: newSchema });
    setDatabase((prev) => ({ ...prev, properties_schema: newSchema }));
  }, [database]);

  const handleUpdateProperty = useCallback(async (propId, updates, meta) => {
    if (!database) return;
    const newSchema = database.properties_schema.map((p) => {
      if (p.id !== propId) return p;
      return { ...p, ...updates };
    });
    await updateDatabase(database.id, { properties_schema: newSchema });
    setDatabase((prev) => ({ ...prev, properties_schema: newSchema }));

    if (updates.type) {
      const oldProp = database.properties_schema.find((p) => p.id === propId);
      if (oldProp && oldProp.type !== updates.type) {
        const defaultVal = updates.type === 'checkbox' ? false : (updates.type === 'multiselect' ? '[]' : '');
        const updatedRows = rows.map((r) => {
          const props = typeof r.properties === 'string'
            ? JSON.parse(r.properties)
            : { ...(r.properties || {}) };
          props[propId] = defaultVal;
          return { ...r, properties: props };
        });
        setRows(updatedRows);
        for (const r of updatedRows) {
          const props = typeof r.properties === 'string'
            ? JSON.parse(r.properties)
            : r.properties || {};
          await updateDatabaseRow(r.id, props);
        }
      }
    }

    if (meta?.renameOption) {
      const { from, to } = meta.renameOption;
      if (from !== to) {
        const prop = newSchema.find((p) => p.id === propId);
        const updatedRows = rows.map((r) => {
          const props = typeof r.properties === 'string'
            ? JSON.parse(r.properties)
            : { ...(r.properties || {}) };
          if (prop?.type === 'multiselect') {
            const vals = parseMultiSelectValue(props[propId]);
            const updated = vals.map((v) => v === from ? to : v);
            props[propId] = JSON.stringify(updated);
          } else {
            if (props[propId] === from) {
              props[propId] = to;
            }
          }
          return { ...r, properties: props };
        });
        setRows(updatedRows);
        for (const r of updatedRows) {
          const props = typeof r.properties === 'string'
            ? JSON.parse(r.properties)
            : r.properties || {};
          await updateDatabaseRow(r.id, props);
        }
      }
    }
  }, [database, rows]);

  const handleDuplicateProperty = useCallback(async (propId) => {
    if (!database) return;
    const original = database.properties_schema.find((p) => p.id === propId);
    if (!original) return;
    const newProp = {
      ...JSON.parse(JSON.stringify(original)),
      id: generateId(),
      name: original.name + ' (copy)',
    };
    const newSchema = [...database.properties_schema, newProp];
    await updateDatabase(database.id, { properties_schema: newSchema });
    setDatabase((prev) => ({ ...prev, properties_schema: newSchema }));
    const updatedRows = rows.map((r) => {
      const props = typeof r.properties === 'string'
        ? JSON.parse(r.properties)
        : { ...(r.properties || {}) };
      props[newProp.id] = props[propId] !== undefined ? props[propId] : '';
      return { ...r, properties: props };
    });
    setRows(updatedRows);
    for (const r of updatedRows) {
      const props = typeof r.properties === 'string'
        ? JSON.parse(r.properties)
        : r.properties || {};
      await updateDatabaseRow(r.id, props);
    }
  }, [database, rows]);

  const handleAddRow = useCallback(async (defaultProps = {}) => {
    if (!database) return;
    const props = {};
    database.properties_schema.forEach((col) => {
      if (col.type === 'checkbox') {
        props[col.id] = false;
      } else if (col.type === 'multiselect') {
        props[col.id] = '[]';
      } else {
        props[col.id] = '';
      }
    });
    Object.assign(props, defaultProps);
    const newRow = await addDatabaseRow(database.id, props);
    setRows((prev) => [...prev, newRow]);
    return newRow;
  }, [database]);

  const handleUpdateRow = useCallback(async (rowId, properties) => {
    clearTimeout(saveTimer.current);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const existingProps = typeof r.properties === 'string'
          ? JSON.parse(r.properties)
          : r.properties || {};
        return { ...r, properties: { ...existingProps, ...properties } };
      })
    );
    saveTimer.current = setTimeout(async () => {
      const row = rows.find((r) => r.id === rowId);
      const existingProps = row
        ? (typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties || {})
        : {};
      const merged = { ...existingProps, ...properties };
      await updateDatabaseRow(rowId, merged);
    }, 300);
  }, [rows]);

  const handleDeleteRow = useCallback(async (rowId) => {
    await deleteDatabaseRow(rowId);
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }, []);

  const handleSortBy = useCallback((propId) => {
    setSorts((prev) => {
      const existing = prev.findIndex((s) => s.propId === propId);
      if (existing !== -1) {
        // Toggle direction, or remove if already desc
        const current = prev[existing];
        if (current.dir === 'asc') {
          return prev.map((s, i) => i === existing ? { ...s, dir: 'desc' } : s);
        } else {
          return prev.filter((_, i) => i !== existing);
        }
      }
      return [...prev, { propId, dir: 'asc' }];
    });
  }, []);

  const handleAddSort = useCallback(() => {
    const schema = database?.properties_schema || [];
    // Find first property not already sorted
    const usedIds = new Set(sorts.map((s) => s.propId));
    const available = schema.find((p) => !usedIds.has(p.id));
    if (available) {
      setSorts((prev) => [...prev, { propId: available.id, dir: 'asc' }]);
    }
  }, [database, sorts]);

  const handleUpdateSort = useCallback((index, field, value) => {
    setSorts((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }, []);

  const handleRemoveSort = useCallback((index) => {
    setSorts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Parse row properties
  const parsedRows = rows.map((r) => ({
    ...r,
    properties: typeof r.properties === 'string'
      ? JSON.parse(r.properties || '{}')
      : r.properties || {},
  }));

  // Apply filter
  let displayRows = parsedRows;
  if (filterProp && filterValue) {
    const filterPropSchema = (database?.properties_schema || []).find((p) => p.id === filterProp);
    displayRows = displayRows.filter((r) => {
      const rawVal = r.properties[filterProp];
      const fv = filterValue.toLowerCase();

      // Multi-select: "contains" checks if array includes the filter value
      if (filterPropSchema?.type === 'multiselect') {
        const vals = parseMultiSelectValue(rawVal).map((v) => v.toLowerCase());
        switch (filterOp) {
          case 'contains': return vals.some((v) => v.includes(fv));
          case 'equals': return vals.some((v) => v === fv);
          case 'not_equals': return !vals.some((v) => v === fv);
          case 'is_empty': return vals.length === 0;
          case 'is_not_empty': return vals.length > 0;
          default: return true;
        }
      }

      const val = String(rawVal || '').toLowerCase();
      switch (filterOp) {
        case 'contains': return val.includes(fv);
        case 'equals': return val === fv;
        case 'not_equals': return val !== fv;
        case 'is_empty': return !val;
        case 'is_not_empty': return !!val;
        default: return true;
      }
    });
  }

  // Apply multiple sorts
  if (sorts.length > 0) {
    const schema = database?.properties_schema || [];
    displayRows = [...displayRows].sort((a, b) => {
      for (const sortItem of sorts) {
        const prop = schema.find((p) => p.id === sortItem.propId);
        let av = a.properties[sortItem.propId] || '';
        let bv = b.properties[sortItem.propId] || '';
        let cmp = 0;

        if (prop?.type === 'number') {
          av = parseFloat(av) || 0;
          bv = parseFloat(bv) || 0;
          cmp = av - bv;
        } else if (prop?.type === 'checkbox') {
          av = av === true || av === 'true' ? 1 : 0;
          bv = bv === true || bv === 'true' ? 1 : 0;
          cmp = av - bv;
        } else if (prop?.type === 'multiselect') {
          av = parseMultiSelectValue(av).join(', ').toLowerCase();
          bv = parseMultiSelectValue(bv).join(', ').toLowerCase();
          cmp = av.localeCompare(bv);
        } else {
          av = String(av).toLowerCase();
          bv = String(bv).toLowerCase();
          cmp = av.localeCompare(bv);
        }

        if (cmp !== 0) {
          return sortItem.dir === 'asc' ? cmp : -cmp;
        }
      }
      return 0;
    });
  }

  if (loading) {
    return (
      <div className="database-container">
        <div className="database-loading">Loading database...</div>
      </div>
    );
  }

  if (!database) {
    return (
      <div className="database-container">
        <div className="database-empty">
          <button className="database-create-btn" onClick={handleCreate}>
            + New database
          </button>
          <button
            className="database-create-btn"
            style={{ marginLeft: '8px' }}
            onClick={async () => {
              const dbs = await getAllDatabases();
              setAvailableDatabases(dbs.filter((d) => d.page_id !== pageId));
              setShowLinkPicker(true);
            }}
          >
            Link existing database
          </button>
        </div>
        {showLinkPicker && (
          <div className="database-link-picker">
            <div style={{ padding: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Select a database to link
            </div>
            {availableDatabases.length === 0 && (
              <div style={{ padding: '8px', color: 'var(--text-placeholder)', fontSize: '13px' }}>
                No other databases found
              </div>
            )}
            {availableDatabases.map((db) => (
              <button
                key={db.id}
                className="database-link-option"
                onClick={async () => {
                  setShowLinkPicker(false);
                  const schema = typeof db.properties_schema === 'string'
                    ? JSON.parse(db.properties_schema)
                    : db.properties_schema || [];
                  setDatabase({ ...db, properties_schema: schema, isLinked: true });
                  const loadedRows = await getDatabaseRows(db.id);
                  setRows(loadedRows);
                }}
              >
                <span style={{ marginRight: '6px' }}>{db.page_icon || '\uD83D\uDCC4'}</span>
                {db.name}
                <span style={{ marginLeft: '6px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                  from {db.page_title || 'Untitled'}
                </span>
              </button>
            ))}
            <button
              className="database-link-option"
              style={{ color: 'var(--text-tertiary)' }}
              onClick={() => setShowLinkPicker(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  const schema = database.properties_schema || [];

  return (
    <div className="database-container">
      {/* Database Header */}
      <div className="database-header">
        <div className="database-name-row">
          <div
            ref={nameRef}
            className="database-name"
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setEditingName(true)}
            onBlur={handleUpdateName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                nameRef.current?.blur();
              }
            }}
          >
            {database.name}
          </div>
        </div>

        {/* View Tabs */}
        <div className="database-toolbar">
          <div className="view-tabs">
            <button
              className={`view-tab${activeView === 'table' ? ' active' : ''}`}
              onClick={() => setActiveView('table')}
            >
              Table
            </button>
            <button
              className={`view-tab${activeView === 'board' ? ' active' : ''}`}
              onClick={() => setActiveView('board')}
            >
              Board
            </button>
            <button
              className={`view-tab${activeView === 'list' ? ' active' : ''}`}
              onClick={() => setActiveView('list')}
            >
              List
            </button>
          </div>

          <div className="database-actions">
            <button
              className={`db-action-btn${showFilter ? ' active' : ''}`}
              onClick={() => setShowFilter((v) => !v)}
            >
              Filter
            </button>
            <button
              className={`db-action-btn${showSort ? ' active' : ''}`}
              onClick={() => setShowSort((v) => !v)}
            >
              Sort{sorts.length > 0 ? ` (${sorts.length})` : ''}
            </button>
            <button
              className="db-action-btn"
              onClick={() => setShowAddProperty(true)}
            >
              + Property
            </button>
            <button
              className="db-action-btn"
              style={{ color: 'var(--red)' }}
              onClick={() => {
                if (window.confirm('Delete this database and all its rows? This cannot be undone.')) {
                  handleDeleteDatabase();
                }
              }}
              title="Delete database"
            >
              {'\uD83D\uDDD1\uFE0F'}
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {showFilter && (
          <div className="filter-bar">
            <select
              value={filterProp}
              onChange={(e) => setFilterProp(e.target.value)}
              className="filter-select"
            >
              <option value="">Select property...</option>
              {schema.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value)}
              className="filter-select"
            >
              <option value="contains">contains</option>
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="is_empty">is empty</option>
              <option value="is_not_empty">is not empty</option>
            </select>
            {filterOp !== 'is_empty' && filterOp !== 'is_not_empty' && (
              <input
                type="text"
                className="filter-input"
                placeholder="Value..."
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />
            )}
            <button
              className="filter-clear-btn"
              onClick={() => {
                setFilterProp('');
                setFilterValue('');
                setShowFilter(false);
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Sort Bar - Multiple Sorts */}
        {showSort && (
          <div className="sort-bar sort-bar-multi">
            {sorts.length === 0 && (
              <div className="sort-bar-empty">
                No sorts applied. Click "+ Add sort" to add one.
              </div>
            )}
            {sorts.map((sortItem, idx) => (
              <div key={idx} className="sort-row">
                <span className="sort-row-label">{idx === 0 ? 'Sort by' : 'then by'}</span>
                <select
                  value={sortItem.propId}
                  onChange={(e) => handleUpdateSort(idx, 'propId', e.target.value)}
                  className="filter-select"
                >
                  {schema.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={sortItem.dir}
                  onChange={(e) => handleUpdateSort(idx, 'dir', e.target.value)}
                  className="filter-select"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <button
                  className="sort-remove-btn"
                  onClick={() => handleRemoveSort(idx)}
                  title="Remove sort"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="sort-bar-actions">
              <button className="db-action-btn sort-add-btn" onClick={handleAddSort}>
                + Add sort
              </button>
              {sorts.length > 0 && (
                <button
                  className="filter-clear-btn"
                  onClick={() => {
                    setSorts([]);
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add Property Modal */}
        {showAddProperty && (
          <div className="add-property-bar">
            <input
              type="text"
              className="filter-input"
              placeholder="Property name..."
              value={newPropName}
              onChange={(e) => setNewPropName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddProperty();
                if (e.key === 'Escape') setShowAddProperty(false);
              }}
            />
            <select
              value={newPropType}
              onChange={(e) => setNewPropType(e.target.value)}
              className="filter-select"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Select</option>
              <option value="multiselect">Multi-select</option>
              <option value="checkbox">Checkbox</option>
              <option value="date">Date</option>
            </select>
            <button className="db-action-btn" onClick={() => handleAddProperty()}>
              Add
            </button>
            <button
              className="filter-clear-btn"
              onClick={() => setShowAddProperty(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Active View */}
      {activeView === 'table' && (
        <DatabaseTableView
          schema={schema}
          rows={displayRows}
          onAddRow={handleAddRow}
          onUpdateRow={handleUpdateRow}
          onDeleteRow={handleDeleteRow}
          onUpdateProperty={handleUpdateProperty}
          onDeleteProperty={handleDeleteProperty}
          onAddProperty={handleAddProperty}
          onDuplicateProperty={handleDuplicateProperty}
          onSortBy={handleSortBy}
          sorts={sorts}
          onCreateOption={handleCreateOption}
        />
      )}
      {activeView === 'board' && (
        <DatabaseBoardView
          schema={schema}
          rows={displayRows}
          onAddRow={handleAddRow}
          onUpdateRow={handleUpdateRow}
          onDeleteRow={handleDeleteRow}
        />
      )}
      {activeView === 'list' && (
        <DatabaseListView
          schema={schema}
          rows={displayRows}
          onAddRow={handleAddRow}
          onUpdateRow={handleUpdateRow}
          onDeleteRow={handleDeleteRow}
        />
      )}
    </div>
  );
}
