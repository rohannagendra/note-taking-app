import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  createDatabase,
  getPageDatabase,
  updateDatabase,
  getDatabaseRows,
  addDatabaseRow,
  updateDatabaseRow,
  deleteDatabaseRow,
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

export default function DatabaseView({ pageId, onNavigate }) {
  const [database, setDatabase] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('table');
  const [editingName, setEditingName] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState('text');
  const [filterProp, setFilterProp] = useState('');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [sortProp, setSortProp] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const nameRef = useRef(null);
  const saveTimer = useRef(null);

  // Load database for this page
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const db = await getPageDatabase(pageId);
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
  }, [pageId]);

  const handleCreate = useCallback(async () => {
    const db = await createDatabase(pageId, 'Untitled Database', DEFAULT_SCHEMA);
    const schema = typeof db.properties_schema === 'string'
      ? JSON.parse(db.properties_schema)
      : db.properties_schema || [];
    setDatabase({ ...db, properties_schema: schema });
    setRows([]);
  }, [pageId]);

  const handleUpdateName = useCallback(async () => {
    if (!database || !nameRef.current) return;
    const name = nameRef.current.innerText.trim() || 'Untitled Database';
    await updateDatabase(database.id, { name });
    setDatabase((prev) => ({ ...prev, name }));
    setEditingName(false);
  }, [database]);

  const handleAddProperty = useCallback(async (name, type) => {
    if (!database) return;
    // Support both old-style (from toolbar) and new quick-add (from table header)
    const propName = name || newPropName.trim();
    const propType = type || newPropType;
    if (!propName && !name) {
      // Quick add from table header: auto-name
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
    if (propType === 'select') {
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
    // Remove the property key from all rows
    const updatedRows = rows.map((r) => {
      const props = typeof r.properties === 'string'
        ? JSON.parse(r.properties)
        : { ...(r.properties || {}) };
      delete props[propId];
      return { ...r, properties: props };
    });
    setRows(updatedRows);
    // Persist each row update
    for (const r of updatedRows) {
      const props = typeof r.properties === 'string'
        ? JSON.parse(r.properties)
        : r.properties || {};
      await updateDatabaseRow(r.id, props);
    }
  }, [database, rows]);

  const handleUpdateProperty = useCallback(async (propId, updates, meta) => {
    if (!database) return;
    const newSchema = database.properties_schema.map((p) => {
      if (p.id !== propId) return p;
      return { ...p, ...updates };
    });
    await updateDatabase(database.id, { properties_schema: newSchema });
    setDatabase((prev) => ({ ...prev, properties_schema: newSchema }));

    // If type changed, optionally clear incompatible values
    if (updates.type) {
      const oldProp = database.properties_schema.find((p) => p.id === propId);
      if (oldProp && oldProp.type !== updates.type) {
        const defaultVal = updates.type === 'checkbox' ? false : '';
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

    // If a select option was renamed, update row values
    if (meta?.renameOption) {
      const { from, to } = meta.renameOption;
      if (from !== to) {
        const updatedRows = rows.map((r) => {
          const props = typeof r.properties === 'string'
            ? JSON.parse(r.properties)
            : { ...(r.properties || {}) };
          if (props[propId] === from) {
            props[propId] = to;
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
    // Copy values from original column to new column in all rows
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
    // Optimistic update
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
    if (sortProp === propId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortProp(propId);
      setSortDir('asc');
    }
  }, [sortProp]);

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
    displayRows = displayRows.filter((r) => {
      const val = String(r.properties[filterProp] || '').toLowerCase();
      const fv = filterValue.toLowerCase();
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

  // Apply sort
  if (sortProp) {
    const schema = database?.properties_schema || [];
    const prop = schema.find((p) => p.id === sortProp);
    displayRows = [...displayRows].sort((a, b) => {
      let av = a.properties[sortProp] || '';
      let bv = b.properties[sortProp] || '';
      if (prop?.type === 'number') {
        av = parseFloat(av) || 0;
        bv = parseFloat(bv) || 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      if (prop?.type === 'checkbox') {
        av = av === true || av === 'true' ? 1 : 0;
        bv = bv === true || bv === 'true' ? 1 : 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
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
            + Add a database
          </button>
        </div>
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
              Sort
            </button>
            <button
              className="db-action-btn"
              onClick={() => setShowAddProperty(true)}
            >
              + Property
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

        {/* Sort Bar */}
        {showSort && (
          <div className="sort-bar">
            <select
              value={sortProp}
              onChange={(e) => setSortProp(e.target.value)}
              className="filter-select"
            >
              <option value="">No sort</option>
              {schema.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="filter-select"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
            <button
              className="filter-clear-btn"
              onClick={() => {
                setSortProp('');
                setShowSort(false);
              }}
            >
              Clear
            </button>
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
              <option value="checkbox">Checkbox</option>
              <option value="date">Date</option>
            </select>
            <button className="db-action-btn" onClick={handleAddProperty}>
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
          sortProp={sortProp}
          sortDir={sortDir}
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
