import React, { useState, useRef, useEffect } from 'react';

export default function ProjectGroup({
  project,
  pages,
  activePage,
  onSelectPage,
  onDeletePage,
  onUpdateProject,
  onDeleteProject,
  onCreatePageInProject,
  onMovePageToProject,
  onToggleFavorite,
  allProjects,
}) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [pageMenu, setPageMenu] = useState(null); // { pageId, top, left }
  const [moveSubmenuOpen, setMoveSubmenuOpen] = useState(false);

  const renameRef = useRef(null);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  const handleMenuClick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 2, left: rect.left });
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleRename = () => {
    closeMenu();
    setRenameValue(project.name);
    setRenaming(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project.name) {
      onUpdateProject(project.id, { name: trimmed });
    }
    setRenaming(false);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenaming(false);
    }
  };

  const handleDelete = () => {
    closeMenu();
    if (window.confirm(`Delete project "${project.name}"? Pages will be moved to Uncategorized.`)) {
      onDeleteProject(project.id);
    }
  };

  const handleChangeIcon = () => {
    closeMenu();
    const icons = ['📁', '📂', '🗂️', '📋', '📌', '🎯', '💼', '🏠', '🚀', '⭐', '💡', '🔧', '📚', '🎨', '🔬', '🌍'];
    const currentIdx = icons.indexOf(project.icon);
    const nextIcon = icons[(currentIdx + 1) % icons.length];
    onUpdateProject(project.id, { icon: nextIcon });
  };

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

  const handleMovePageTo = (pageId, targetProjectId) => {
    onMovePageToProject(pageId, targetProjectId);
    closePageMenu();
  };

  return (
    <div className="project-group">
      {/* Header */}
      <div className="project-group-header" onClick={() => setExpanded((v) => !v)}>
        <div className="project-group-title">
          <span className={`chevron${expanded ? '' : ' collapsed'}`}>&#9662;</span>
          <span className="project-icon">{project.icon || '📁'}</span>
          {renaming ? (
            <input
              ref={renameRef}
              className="project-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="project-name">{project.name}</span>
          )}
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              marginLeft: '4px',
              flexShrink: 0,
            }}
          >
            {pages.length}
          </span>
        </div>
        <div className="project-group-actions">
          <button
            ref={menuBtnRef}
            className="icon-btn"
            onClick={handleMenuClick}
            title="Project options"
          >
            ···
          </button>
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCreatePageInProject(project.id);
            }}
            title="New page in project"
          >
            +
          </button>
        </div>
      </div>

      {/* Project context menu */}
      {menuOpen && (
        <>
          <div className="context-menu-overlay" onClick={closeMenu} />
          <div className="context-menu" style={{ top: menuPos.top, left: menuPos.left }}>
            <button className="context-menu-item" onClick={handleRename}>
              <span>✏️</span> Rename
            </button>
            <button className="context-menu-item" onClick={handleChangeIcon}>
              <span>🎭</span> Change Icon
            </button>
            <div className="context-menu-separator" />
            <button className="context-menu-item danger" onClick={handleDelete}>
              <span>🗑️</span> Delete
            </button>
          </div>
        </>
      )}

      {/* Pages */}
      {expanded && (
        <div className="project-group-pages">
          {pages.map((page) => (
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

          {pages.length === 0 && (
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
        </div>
      )}

      {/* Page context menu with move-to-project submenu */}
      {pageMenu && (
        <>
          <div className="context-menu-overlay" onClick={closePageMenu} />
          <div className="context-menu" style={{ top: pageMenu.top, left: pageMenu.left }}>
            <button
              className="context-menu-item"
              onClick={() => {
                const page = pages.find(p => p.id === pageMenu.pageId);
                if (page && onToggleFavorite) onToggleFavorite(page.id, !page.is_favorite);
                closePageMenu();
              }}
            >
              <span>{pages.find(p => p.id === pageMenu.pageId)?.is_favorite ? '\u2606' : '\u2B50'}</span>
              {pages.find(p => p.id === pageMenu.pageId)?.is_favorite ? ' Remove from favorites' : ' Add to favorites'}
            </button>
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
                  className={`move-project-item${pages.find(p => p.id === pageMenu.pageId)?.project_id === null ? ' active' : ''}`}
                  onClick={() => handleMovePageTo(pageMenu.pageId, null)}
                >
                  <span>📄</span> None (uncategorized)
                </button>
                {allProjects
                  .filter((p) => p.id !== project.id)
                  .map((proj) => (
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
    </div>
  );
}
