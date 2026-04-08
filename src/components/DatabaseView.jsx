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
  getViews,
  createView,
  updateView,
  deleteView,
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

// Get available operators for a property type
function getOperatorsForType(type) {
  switch (type) {
    case 'text':
      return [
        { value: 'contains', label: 'contains' },
        { value: 'does_not_contain', label: 'does not contain' },
        { value: 'equals', label: 'equals' },
        { value: 'is_empty', label: 'is empty' },
        { value: 'is_not_empty', label: 'is not empty' },
      ];
    case 'number':
      return [
        { value: 'eq', label: '=' },
        { value: 'neq', label: '\u2260' },
        { value: 'gt', label: '>' },
        { value: 'lt', label: '<' },
        { value: 'gte', label: '>=' },
        { value: 'lte', label: '<=' },
        { value: 'is_empty', label: 'is empty' },
      ];
    case 'select':
    case 'multiselect':
      return [
        { value: 'is', label: 'is' },
        { value: 'is_not', label: 'is not' },
        { value: 'is_empty', label: 'is empty' },
      ];
    case 'checkbox':
      return [
        { value: 'is_checked', label: 'is checked' },
        { value: 'is_not_checked', label: 'is not checked' },
      ];
    case 'date':
      return [
        { value: 'is', label: 'is' },
        { value: 'before', label: 'before' },
        { value: 'after', label: 'after' },
        { value: 'is_empty', label: 'is empty' },
      ];
    default:
      return [
        { value: 'contains', label: 'contains' },
        { value: 'equals', label: 'equals' },
        { value: 'is_empty', label: 'is empty' },
        { value: 'is_not_empty', label: 'is not empty' },
      ];
  }
}

// Check if operator needs a value input
function operatorNeedsValue(operator) {
  return !['is_empty', 'is_not_empty', 'is_checked', 'is_not_checked'].includes(operator);
}

// Evaluate a single filter against a row
function evaluateFilter(filter, row, schema) {
  const { propId, operator, value } = filter;
  if (!propId) return true;

  const rawVal = row.properties[propId];
  const prop = schema.find((p) => p.id === propId);

  switch (operator) {
    case 'contains':
      return String(rawVal || '').toLowerCase().includes((value || '').toLowerCase());
    case 'does_not_contain':
      return !String(rawVal || '').toLowerCase().includes((value || '').toLowerCase());
    case 'equals':
    case 'is':
      return String(rawVal || '').toLowerCase() === (value || '').toLowerCase();
    case 'is_not':
      return String(rawVal || '').toLowerCase() !== (value || '').toLowerCase();
    case 'is_empty':
      return !rawVal || String(rawVal).trim() === '';
    case 'is_not_empty':
      return rawVal != null && String(rawVal).trim() !== '';
    case 'is_checked':
      return rawVal === true || rawVal === 'true';
    case 'is_not_checked':
      return rawVal !== true && rawVal !== 'true';
    case 'eq':
      return parseFloat(rawVal) === parseFloat(value);
    case 'neq':
      return parseFloat(rawVal) !== parseFloat(value);
    case 'gt':
      return parseFloat(rawVal || 0) > parseFloat(value || 0);
    case 'lt':
      return parseFloat(rawVal || 0) < parseFloat(value || 0);
    case 'gte':
      return parseFloat(rawVal || 0) >= parseFloat(value || 0);
    case 'lte':
      return parseFloat(rawVal || 0) <= parseFloat(value || 0);
    case 'before':
      if (!rawVal || !value) return false;
      return new Date(rawVal) < new Date(value);
    case 'after':
      if (!rawVal || !value) return false;
      return new Date(rawVal) > new Date(value);
    default:
      return true;
  }
}

// Apply multiple filters with AND/OR logic
function applyFilters(rows, filters, schema) {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((row) => {
    let result = evaluateFilter(filters[0], row, schema);
    for (let i = 1; i < filters.length; i++) {
      const f = filters[i];
      const matches = evaluateFilter(f, row, schema);
      if (f.logic === 'or') {
        result = result || matches;
      } else {
        result = result && matches;
      }
    }
    return result;
  });
}

export default function DatabaseView({ pageId, onNavigate, linkedDatabaseId }) {
  const [database, setDatabase] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [availableDatabases, setAvailableDatabases] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState('text');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const nameRef = useRef(null);
  const saveTimer = useRef(null);
  const viewSaveTimer = useRef(null);

  // Views state
  const [views, setViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null);
  const [showNewView, setShowNewView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewType, setNewViewType] = useState('table');
  const [viewMenuId, setViewMenuId] = useState(null);
  const [renamingViewId, setRenamingViewId] = useState(null);
  const [renamingViewName, setRenamingViewName] = useState('');

  // Filters and sorts derived from active view
  const [filters, setFilters] = useState([]);
  const [sortProp, setSortProp] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [activeView, setActiveView] = useState('table');

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

          // Load views
          const loadedViews = await getViews(db.id);
          if (!cancelled) {
            if (loadedViews.length === 0) {
              // Create a default view
              const defaultView = await createView(db.id, {
                name: 'Table',
                view_type: 'table',
                filters: [],
                sorts: [],
              });
              setViews([defaultView]);
              setActiveViewId(defaultView.id);
              setActiveView('table');
              setFilters([]);
              setSortProp('');
              setSortDir('asc');
            } else {
              setViews(loadedViews);
              const first = loadedViews[0];
              setActiveViewId(first.id);
              setActiveView(first.view_type || 'table');
              const parsedFilters = typeof first.filters === 'string'
                ? JSON.parse(first.filters || '[]')
                : first.filters || [];
              setFilters(parsedFilters);
              const parsedSorts = typeof first.sorts === 'string'
                ? JSON.parse(first.sorts || '[]')
                : first.sorts || [];
              if (parsedSorts.length > 0) {
                setSortProp(parsedSorts[0].propId || '');
                setSortDir(parsedSorts[0].dir || 'asc');
              } else {
                setSortProp('');
                setSortDir('asc');
              }
              if (parsedFilters.length > 0) {
                setShowFilter(true);
              }
            }
          }
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

  // Auto-save filters/sorts to active view (debounced)
  const saveViewSettings = useCallback((viewId, newFilters, newSortProp, newSortDir) => {
    clearTimeout(viewSaveTimer.current);
    viewSaveTimer.current = setTimeout(async () => {
      const sorts = newSortProp ? [{ propId: newSortProp, dir: newSortDir }] : [];
      await updateView(viewId, { filters: newFilters, sorts });
    }, 500);
  }, []);

  // When filters or sorts change, auto-save to the active view
  useEffect(() => {
    if (activeViewId) {
      saveViewSettings(activeViewId, filters, sortProp, sortDir);
    }
  }, [filters, sortProp, sortDir, activeViewId, saveViewSettings]);

  // Switch to a view
  const handleSwitchView = useCallback((view) => {
    setActiveViewId(view.id);
    setActiveView(view.view_type || 'table');
    const parsedFilters = typeof view.filters === 'string'
      ? JSON.parse(view.filters || '[]')
      : view.filters || [];
    setFilters(parsedFilters);
    const parsedSorts = typeof view.sorts === 'string'
      ? JSON.parse(view.sorts || '[]')
      : view.sorts || [];
    if (parsedSorts.length > 0) {
      setSortProp(parsedSorts[0].propId || '');
      setSortDir(parsedSorts[0].dir || 'asc');
    } else {
      setSortProp('');
      setSortDir('asc');
    }
    if (parsedFilters.length > 0) {
      setShowFilter(true);
    } else {
      setShowFilter(false);
    }
    setShowSort(parsedSorts.length > 0);
    setViewMenuId(null);
  }, []);

  // Create a new view
  const handleCreateView = useCallback(async () => {
    if (!database || !newViewName.trim()) return;
    const view = await createView(database.id, {
      name: newViewName.trim(),
      view_type: newViewType,
      filters: [],
      sorts: [],
    });
    setViews((prev) => [...prev, view]);
    setShowNewView(false);
    setNewViewName('');
    setNewViewType('table');
    handleSwitchView(view);
  }, [database, newViewName, newViewType, handleSwitchView]);

  // Rename a view
  const handleRenameView = useCallback(async (viewId) => {
    if (!renamingViewName.trim()) {
      setRenamingViewId(null);
      return;
    }
    await updateView(viewId, { name: renamingViewName.trim() });
    setViews((prev) =>
      prev.map((v) => (v.id === viewId ? { ...v, name: renamingViewName.trim() } : v))
    );
    setRenamingViewId(null);
    setRenamingViewName('');
  }, [renamingViewName]);

  // Delete a view
  const handleDeleteView = useCallback(async (viewId) => {
    if (views.length <= 1) return;
    await deleteView(viewId);
    const remaining = views.filter((v) => v.id !== viewId);
    setViews(remaining);
    if (activeViewId === viewId && remaining.length > 0) {
      handleSwitchView(remaining[0]);
    }
    setViewMenuId(null);
  }, [views, activeViewId, handleSwitchView]);

  // Filter management
  const handleAddFilter = useCallback(() => {
    const dbSchema = database?.properties_schema || [];
    const firstProp = dbSchema[0];
    const defaultOp = firstProp ? getOperatorsForType(firstProp.type)[0].value : 'contains';
    setFilters((prev) => [
      ...prev,
      {
        propId: firstProp?.id || '',
        operator: defaultOp,
        value: '',
        logic: 'and',
      },
    ]);
    setShowFilter(true);
  }, [database]);

  const handleUpdateFilter = useCallback((index, updates) => {
    setFilters((prev) => {
      const newFilters = [...prev];
      newFilters[index] = { ...newFilters[index], ...updates };
      // When property changes, reset operator to first valid one for that type
      if (updates.propId !== undefined && updates.operator === undefined) {
        const dbSchema = database?.properties_schema || [];
        const prop = dbSchema.find((p) => p.id === updates.propId);
        const ops = getOperatorsForType(prop?.type || 'text');
        newFilters[index].operator = ops[0].value;
        newFilters[index].value = '';
      }
      return newFilters;
    });
  }, [database]);

  const handleRemoveFilter = useCallback((index) => {
    setFilters((prev) => {
      const newFilters = prev.filter((_, i) => i !== index);
      return newFilters;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters([]);
    setShowFilter(false);
  }, []);

  const handleCreate = useCallback(async () => {
    const db = await createDatabase(pageId, 'Untitled Database', DEFAULT_SCHEMA);
    const schema = typeof db.properties_schema === 'string'
      ? JSON.parse(db.properties_schema)
      : db.properties_schema || [];
    setDatabase({ ...db, properties_schema: schema });
    setRows([]);
    // Create default view
    const defaultView = await createView(db.id, {
      name: 'Table',
      view_type: 'table',
      filters: [],
      sorts: [],
    });
    setViews([defaultView]);
    setActiveViewId(defaultView.id);
    setActiveView('table');
    setFilters([]);
  }, [pageId]);

  const handleDeleteDatabase = useCallback(async () => {
    if (!database) return;
    await deleteDatabase(database.id);
    setDatabase(null);
    setRows([]);
    setViews([]);
    setActiveViewId(null);
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

  const handleReorderProperties = useCallback(async (newSchema) => {
    if (!database) return;
    await updateDatabase(database.id, { properties_schema: newSchema });
    setDatabase((prev) => ({ ...prev, properties_schema: newSchema }));
  }, [database]);

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

  // Apply multiple filters
  const schema = database?.properties_schema || [];
  let displayRows = applyFilters(parsedRows, filters, schema);

  // Apply sort
  if (sortProp) {
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
                  const dbSchema = typeof db.properties_schema === 'string'
                    ? JSON.parse(db.properties_schema)
                    : db.properties_schema || [];
                  setDatabase({ ...db, properties_schema: dbSchema, isLinked: true });
                  const loadedRows = await getDatabaseRows(db.id);
                  setRows(loadedRows);
                  const loadedViews = await getViews(db.id);
                  if (loadedViews.length === 0) {
                    const defaultView = await createView(db.id, {
                      name: 'Table',
                      view_type: 'table',
                      filters: [],
                      sorts: [],
                    });
                    setViews([defaultView]);
                    setActiveViewId(defaultView.id);
                    setActiveView('table');
                  } else {
                    setViews(loadedViews);
                    handleSwitchView(loadedViews[0]);
                  }
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
            {views.map((view) => (
              <div key={view.id} className="view-tab-wrapper">
                {renamingViewId === view.id ? (
                  <input
                    className="view-tab-rename-input"
                    value={renamingViewName}
                    onChange={(e) => setRenamingViewName(e.target.value)}
                    onBlur={() => handleRenameView(view.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameView(view.id);
                      if (e.key === 'Escape') {
                        setRenamingViewId(null);
                        setRenamingViewName('');
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    className={`view-tab${activeViewId === view.id ? ' active' : ''}`}
                    onClick={() => handleSwitchView(view)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setViewMenuId(viewMenuId === view.id ? null : view.id);
                    }}
                  >
                    {view.view_type === 'table' && '\uD83D\uDCCA'}
                    {view.view_type === 'board' && '\uD83D\uDCCB'}
                    {view.view_type === 'list' && '\uD83D\uDCC3'}
                    {' '}{view.name}
                  </button>
                )}
                {activeViewId === view.id && (
                  <button
                    className="view-tab-more"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewMenuId(viewMenuId === view.id ? null : view.id);
                    }}
                    title="View options"
                  >
                    ···
                  </button>
                )}
                {viewMenuId === view.id && (
                  <div className="view-tab-menu">
                    <button
                      className="view-tab-menu-item"
                      onClick={() => {
                        setRenamingViewId(view.id);
                        setRenamingViewName(view.name);
                        setViewMenuId(null);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="view-tab-menu-item"
                      disabled={views.length <= 1}
                      onClick={() => handleDeleteView(view.id)}
                      style={views.length <= 1 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            {showNewView ? (
              <div className="new-view-form">
                <input
                  className="view-tab-rename-input"
                  placeholder="View name..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateView();
                    if (e.key === 'Escape') {
                      setShowNewView(false);
                      setNewViewName('');
                    }
                  }}
                  autoFocus
                />
                <select
                  className="filter-select"
                  value={newViewType}
                  onChange={(e) => setNewViewType(e.target.value)}
                  style={{ minWidth: '80px', fontSize: '12px' }}
                >
                  <option value="table">Table</option>
                  <option value="board">Board</option>
                  <option value="list">List</option>
                </select>
                <button className="db-action-btn" onClick={handleCreateView}>Add</button>
                <button
                  className="filter-clear-btn"
                  onClick={() => { setShowNewView(false); setNewViewName(''); }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="view-tab view-tab-add"
                onClick={() => setShowNewView(true)}
                title="Add a view"
              >
                +
              </button>
            )}
          </div>

          <div className="database-actions">
            <button
              className={`db-action-btn${showFilter ? ' active' : ''}${filters.length > 0 ? ' has-filters' : ''}`}
              onClick={() => {
                if (!showFilter && filters.length === 0) {
                  handleAddFilter();
                } else {
                  setShowFilter((v) => !v);
                }
              }}
            >
              Filter{filters.length > 0 ? ` (${filters.length})` : ''}
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

        {/* Multi-Filter Bar */}
        {showFilter && (
          <div className="multi-filter-bar">
            {filters.map((filter, index) => {
              const prop = schema.find((p) => p.id === filter.propId);
              const operators = getOperatorsForType(prop?.type || 'text');
              const needsValue = operatorNeedsValue(filter.operator);
              const isSelectType = prop?.type === 'select' || prop?.type === 'multiselect';

              return (
                <div key={index} className="filter-row">
                  {index > 0 ? (
                    <select
                      className="filter-logic-select"
                      value={filter.logic || 'and'}
                      onChange={(e) => handleUpdateFilter(index, { logic: e.target.value })}
                    >
                      <option value="and">AND</option>
                      <option value="or">OR</option>
                    </select>
                  ) : (
                    <span className="filter-where-label">Where</span>
                  )}
                  <select
                    value={filter.propId}
                    onChange={(e) => handleUpdateFilter(index, { propId: e.target.value })}
                    className="filter-select"
                  >
                    <option value="">Select property...</option>
                    {schema.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(e) => handleUpdateFilter(index, { operator: e.target.value })}
                    className="filter-select"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  {needsValue && (
                    isSelectType && prop?.options ? (
                      <select
                        className="filter-select"
                        value={filter.value}
                        onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                      >
                        <option value="">Select...</option>
                        {prop.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                        ))}
                      </select>
                    ) : prop?.type === 'date' ? (
                      <input
                        type="date"
                        className="filter-input"
                        value={filter.value}
                        onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                      />
                    ) : prop?.type === 'number' ? (
                      <input
                        type="number"
                        className="filter-input"
                        placeholder="Value..."
                        value={filter.value}
                        onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                      />
                    ) : (
                      <input
                        type="text"
                        className="filter-input"
                        placeholder="Value..."
                        value={filter.value}
                        onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                      />
                    )
                  )}
                  <button
                    className="filter-remove-btn"
                    onClick={() => handleRemoveFilter(index)}
                    title="Remove filter"
                  >
                    {'\u00D7'}
                  </button>
                </div>
              );
            })}
            <div className="filter-actions">
              <button className="filter-add-btn" onClick={handleAddFilter}>
                + Add filter
              </button>
              {filters.length > 0 && (
                <button className="filter-clear-btn" onClick={handleClearFilters}>
                  Clear all
                </button>
              )}
            </div>
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
          sortProp={sortProp}
          sortDir={sortDir}
          onCreateOption={handleCreateOption}
          onReorderProperties={handleReorderProperties}
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
