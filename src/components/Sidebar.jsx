import React, { useState, useRef, useEffect } from 'react';
import ProjectGroup from './ProjectGroup.jsx';
import TagFilter from './TagFilter.jsx';
import { searchPages } from '../lib/pages.js';

export default function Sidebar({
  pages,
  activePage,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  collapsed,
  onToggleCollapse,
  searchQuery,
  onSearchChange,
  projects,
  onCreateProject,
  onDeleteProject,
  onUpdateProject,
  onMovePageToProject,
  onCreatePageInProject,
  allTags,
  activeTagId,
  onSelectTag,
  onSync,
  theme,
  onToggleTheme,
}) {
  const [uncategorizedExpanded, setUncategorizedExpanded] = useState(true);
  const [pageMenu, setPageMenu] = useState(null); // { pageId, top, left }
  const [moveSubmenuOpen, setMoveSubmenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [serverSearchResults, setServerSearchResults] = useState(null);
  const searchTimerRef = useRef(null);

  useEffect(() => {
    if (!searchQuery) {
      setServerSearchResults(null);
      clearTimeout(searchTimerRef.current);
      return;
    }
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchPages(searchQuery);
        setServerSearchResults(results);
      } catch {
        // On error, keep using client-side filtering
      }
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await onSync();
      setSyncMessage(`Synced ${result.count} page${result.count !== 1 ? 's' : ''}`);
    } catch (err) {
      setSyncMessage('Sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const filteredPages = searchQuery
    ? pages.filter((p) =>
        (p.title || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pages;

  // Group pages by project
  const sortedProjects = [...(projects || [])].sort((a, b) => a.position - b.position);
  const uncategorizedPages = filteredPages.filter((p) => !p.project_id);
  const pagesByProject = {};
  sortedProjects.forEach((proj) => {
    pagesByProject[proj.id] = filteredPages.filter((p) => p.project_id === proj.id);
  });

  const handlePageContextMenu = (e, pageId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPageMenu({ pageId, top: rect.bottom + 2, left: rect.left });
    setMoveSubmenuOpen(false);
  };

  const closePageMenu = () => {
    setPageMenu(null);
    setMoveSubmenuOpen(false);
  };

  const handleMovePageTo = (pageId, projectId) => {
    onMovePageToProject(pageId, projectId);
    closePageMenu();
  };

  return (
    <>
      {/* Collapsed state: show only toggle button */}
      {collapsed && (
        <div style={{ padding: '10px 8px', flexShrink: 0 }}>
          <button
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            title="Expand sidebar"
          >
            &#9776;
          </button>
        </div>
      )}

      <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span style={{ fontSize: '18px' }}>N</span>
            NŌTE
          </div>
          <button
            className="sidebar-toggle"
            onClick={onToggleTheme}
            title="Toggle theme"
          >
            {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
          </button>
          <button
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
          >
            &#9776;
          </button>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Tag filter */}
        <TagFilter
          tags={allTags || []}
          activeTagId={activeTagId}
          onSelectTag={onSelectTag}
        />

        {/* Content */}
        <div className="sidebar-content">
          {/* Project groups */}
          {sortedProjects.map((proj) => (
            <ProjectGroup
              key={proj.id}
              project={proj}
              pages={pagesByProject[proj.id] || []}
              activePage={activePage}
              onSelectPage={onSelectPage}
              onDeletePage={onDeletePage}
              onUpdateProject={onUpdateProject}
              onDeleteProject={onDeleteProject}
              onCreatePageInProject={onCreatePageInProject}
              onMovePageToProject={onMovePageToProject}
              allProjects={sortedProjects}
            />
          ))}

          {/* Uncategorized section */}
          <div className="sidebar-section">
            <div
              className="sidebar-section-header"
              onClick={() => setUncategorizedExpanded((v) => !v)}
            >
              <div className="sidebar-section-title">
                <span className={`chevron${uncategorizedExpanded ? '' : ' collapsed'}`}>
                  &#9662;
                </span>
                Uncategorized
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    marginLeft: '4px',
                    textTransform: 'none',
                    letterSpacing: '0',
                  }}
                >
                  {uncategorizedPages.length}
                </span>
              </div>
              <div className="sidebar-section-actions">
                <button
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreatePage();
                  }}
                  title="New page"
                >
                  +
                </button>
              </div>
            </div>

            {uncategorizedExpanded &&
              uncategorizedPages.map((page) => (
                <div
                  key={page.id}
                  className={`sidebar-page-item${activePage === page.id ? ' active' : ''}`}
                  onClick={() => onSelectPage(page.id)}
                >
                  <span className="page-icon">{page.icon || '📄'}</span>
                  <span className="page-title">{page.title || 'Untitled'}</span>
                  <div className="page-actions">
                    <button
                      className="icon-btn"
                      onClick={(e) => handlePageContextMenu(e, page.id)}
                      title="Page options"
                    >
                      ···
                    </button>
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(page.id);
                      }}
                      title="Delete page"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}

            {uncategorizedExpanded && uncategorizedPages.length === 0 && !searchQuery && (
              <div
                style={{
                  padding: '4px 12px 4px 32px',
                  fontSize: '13px',
                  color: 'var(--text-placeholder)',
                }}
              >
                No pages
              </div>
            )}

            {filteredPages.length === 0 && searchQuery && (
              <div
                style={{
                  padding: '12px 24px',
                  color: 'var(--text-tertiary)',
                  fontSize: '13px',
                }}
              >
                No pages found
              </div>
            )}
          </div>
        </div>

        {/* Page context menu for uncategorized pages */}
        {pageMenu && (
          <>
            <div className="context-menu-overlay" onClick={closePageMenu} />
            <div className="context-menu" style={{ top: pageMenu.top, left: pageMenu.left }}>
              <button
                className="context-menu-item"
                onClick={() => setMoveSubmenuOpen((v) => !v)}
                style={{ position: 'relative' }}
              >
                <span>📂</span> Move to project
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)' }}>▸</span>
              </button>
              {moveSubmenuOpen && (
                <div className="move-project-dropdown" style={{ position: 'relative', marginTop: '2px' }}>
                  <button
                    className={`move-project-item${
                      pages.find((p) => p.id === pageMenu.pageId)?.project_id === null ? ' active' : ''
                    }`}
                    onClick={() => handleMovePageTo(pageMenu.pageId, null)}
                  >
                    <span>📄</span> None (uncategorized)
                  </button>
                  {sortedProjects.map((proj) => (
                    <button
                      key={proj.id}
                      className="move-project-item"
                      onClick={() => handleMovePageTo(pageMenu.pageId, proj.id)}
                    >
                      <span>{proj.icon || '📁'}</span> {proj.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="context-menu-separator" />
              <button
                className="context-menu-item danger"
                onClick={() => {
                  onDeletePage(pageMenu.pageId);
                  closePageMenu();
                }}
              >
                <span>🗑️</span> Delete
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-action-btn" onClick={onCreatePage}>
            <span className="btn-icon">+</span>
            New page
          </button>
          <button className="sidebar-action-btn" onClick={onCreateProject}>
            <span className="btn-icon">📁</span>
            New project
          </button>
          <button
            className="sidebar-action-btn"
            onClick={handleSync}
            disabled={syncing}
            title="Export all pages as Markdown to data/markdown/"
          >
            <span className="btn-icon">{syncing ? '...' : '↓'}</span>
            {syncing ? 'Syncing...' : syncMessage || 'Sync'}
          </button>
        </div>
      </div>
    </>
  );
}
