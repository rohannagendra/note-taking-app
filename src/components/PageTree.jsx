import React, { useState, useRef, useEffect } from 'react';

const MAX_DEPTH = 5;

export default function PageTree({
  pages,
  parentId,
  level,
  activePage,
  onSelectPage,
  onDeletePage,
  onToggleFavorite,
  onMovePageToProject,
  onSetParentPage,
  allProjects,
}) {
  const thisLevel = level || 0;

  // Filter pages whose parent_id matches parentId
  const children = pages.filter((p) => {
    if (parentId === null || parentId === undefined) {
      return !p.parent_id;
    }
    return p.parent_id === parentId;
  });

  if (children.length === 0) return null;

  return (
    <div className="page-tree-children">
      {children.map((page) => (
        <PageTreeItem
          key={page.id}
          page={page}
          pages={pages}
          level={thisLevel}
          activePage={activePage}
          onSelectPage={onSelectPage}
          onDeletePage={onDeletePage}
          onToggleFavorite={onToggleFavorite}
          onMovePageToProject={onMovePageToProject}
          onSetParentPage={onSetParentPage}
          allProjects={allProjects}
        />
      ))}
    </div>
  );
}

function PageTreeItem({
  page,
  pages,
  level,
  activePage,
  onSelectPage,
  onDeletePage,
  onToggleFavorite,
  onMovePageToProject,
  onSetParentPage,
  allProjects,
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [moveSubmenuOpen, setMoveSubmenuOpen] = useState(false);
  const [moveUnderSubmenuOpen, setMoveUnderSubmenuOpen] = useState(false);
  const menuRef = useRef(null);

  const hasChildren = pages.some((p) => p.parent_id === page.id);
  const canNest = level < MAX_DEPTH;

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleMenuClick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 2, left: rect.left });
    setMenuOpen(true);
    setMoveSubmenuOpen(false);
    setMoveUnderSubmenuOpen(false);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMoveSubmenuOpen(false);
    setMoveUnderSubmenuOpen(false);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  // Collect all descendant IDs to prevent circular nesting
  const getDescendantIds = (pageId) => {
    const ids = new Set();
    const queue = [pageId];
    while (queue.length > 0) {
      const current = queue.shift();
      const children = pages.filter((p) => p.parent_id === current);
      for (const child of children) {
        if (!ids.has(child.id)) {
          ids.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return ids;
  };

  // Pages that this page can be moved under (excluding self, descendants, and current parent)
  const descendantIds = getDescendantIds(page.id);
  const moveUnderCandidates = pages.filter(
    (p) => p.id !== page.id && !descendantIds.has(p.id)
  );

  return (
    <>
      <div
        className={`sidebar-page-item page-tree-item${activePage === page.id ? ' active' : ''}`}
        onClick={() => onSelectPage(page.id)}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <span
          className="page-tree-toggle"
          onClick={handleToggle}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span className="page-icon">{page.icon || '\uD83D\uDCC4'}</span>
        <span className="page-title">{page.title || 'Untitled'}</span>
        <div className="page-actions">
          <button
            className="icon-btn"
            onClick={handleMenuClick}
            title="Page options"
          >
            &middot;&middot;&middot;
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

      {/* Context menu */}
      {menuOpen && (
        <>
          <div className="context-menu-overlay" onClick={closeMenu} />
          <div
            className="context-menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            ref={menuRef}
          >
            <button
              className="context-menu-item"
              onClick={() => {
                onToggleFavorite(page.id, !page.is_favorite);
                closeMenu();
              }}
            >
              <span>{page.is_favorite ? '\u2606' : '\u2B50'}</span>
              {page.is_favorite ? ' Remove from favorites' : ' Add to favorites'}
            </button>

            {/* Move to project */}
            <button
              className="context-menu-item"
              onClick={() => {
                setMoveSubmenuOpen((v) => !v);
                setMoveUnderSubmenuOpen(false);
              }}
            >
              <span>\uD83D\uDCC2</span> Move to project
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)' }}>{'\u25B8'}</span>
            </button>
            {moveSubmenuOpen && (
              <div className="move-project-dropdown" style={{ position: 'relative', marginTop: '2px' }}>
                <button
                  className={`move-project-item${!page.project_id ? ' active' : ''}`}
                  onClick={() => {
                    onMovePageToProject(page.id, null);
                    closeMenu();
                  }}
                >
                  <span>\uD83D\uDCC4</span> None (uncategorized)
                </button>
                {(allProjects || []).map((proj) => (
                  <button
                    key={proj.id}
                    className="move-project-item"
                    onClick={() => {
                      onMovePageToProject(page.id, proj.id);
                      closeMenu();
                    }}
                  >
                    <span>{proj.icon || '\uD83D\uDCC1'}</span> {proj.name}
                  </button>
                ))}
              </div>
            )}

            {/* Move under page */}
            <button
              className="context-menu-item"
              onClick={() => {
                setMoveUnderSubmenuOpen((v) => !v);
                setMoveSubmenuOpen(false);
              }}
            >
              <span>\u21B3</span> Move under...
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)' }}>{'\u25B8'}</span>
            </button>
            {moveUnderSubmenuOpen && (
              <div className="move-project-dropdown" style={{ position: 'relative', marginTop: '2px', maxHeight: '200px', overflowY: 'auto' }}>
                <button
                  className={`move-project-item${!page.parent_id ? ' active' : ''}`}
                  onClick={() => {
                    onSetParentPage(page.id, null);
                    closeMenu();
                  }}
                >
                  <span>\u2B06</span> Move to top level
                </button>
                {moveUnderCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    className="move-project-item"
                    onClick={() => {
                      onSetParentPage(page.id, candidate.id);
                      closeMenu();
                    }}
                  >
                    <span>{candidate.icon || '\uD83D\uDCC4'}</span> {candidate.title || 'Untitled'}
                  </button>
                ))}
              </div>
            )}

            <div className="context-menu-separator" />
            <button
              className="context-menu-item danger"
              onClick={() => {
                onDeletePage(page.id);
                closeMenu();
              }}
            >
              <span>\uD83D\uDDD1\uFE0F</span> Delete
            </button>
          </div>
        </>
      )}

      {/* Children */}
      {expanded && hasChildren && canNest && (
        <PageTree
          pages={pages}
          parentId={page.id}
          level={level + 1}
          activePage={activePage}
          onSelectPage={onSelectPage}
          onDeletePage={onDeletePage}
          onToggleFavorite={onToggleFavorite}
          onMovePageToProject={onMovePageToProject}
          onSetParentPage={onSetParentPage}
          allProjects={allProjects}
        />
      )}
    </>
  );
}
