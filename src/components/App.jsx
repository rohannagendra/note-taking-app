import React, { useState, useEffect, useCallback } from 'react';
import { getDB } from '../lib/db.js';
import { getPages, createPage, updatePage, deletePage, syncToMarkdown, importMarkdown } from '../lib/pages.js';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../lib/projects.js';
import { getTags, getPagesByTagId } from '../lib/tags.js';
import Sidebar from './Sidebar.jsx';
import PageEditor from './PageEditor.jsx';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [pages, setPages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [activeTagId, setActiveTagId] = useState(null);
  const [filteredPageIds, setFilteredPageIds] = useState(null);
  const [activePage, setActivePage] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize DB and load pages + projects + tags
  useEffect(() => {
    async function init() {
      await getDB();
      setDbReady(true);
      const [loadedPages, loadedProjects, loadedTags] = await Promise.all([
        getPages(),
        getProjects(),
        getTags(),
      ]);
      setPages(loadedPages);
      setProjects(loadedProjects);
      setAllTags(loadedTags);
      if (loadedPages.length > 0) {
        setActivePage(loadedPages[0].id);
      }
    }
    init();
  }, []);

  // Filter pages by active tag
  useEffect(() => {
    if (!activeTagId) {
      setFilteredPageIds(null);
      return;
    }
    async function filterByTag() {
      const tagPages = await getPagesByTagId(activeTagId);
      setFilteredPageIds(new Set(tagPages.map((p) => p.id)));
    }
    filterByTag();
  }, [activeTagId]);

  const refreshTags = useCallback(async () => {
    const loadedTags = await getTags();
    setAllTags(loadedTags);
  }, []);

  // --- Page handlers ---

  const handleCreatePage = useCallback(async () => {
    const newPage = await createPage();
    setPages((prev) => [...prev, newPage]);
    setActivePage(newPage.id);
  }, []);

  const handleCreatePageInProject = useCallback(async (projectId) => {
    const newPage = await createPage({ projectId });
    setPages((prev) => [...prev, newPage]);
    setActivePage(newPage.id);
  }, []);

  const handleDeletePage = useCallback(
    async (pageId) => {
      await deletePage(pageId);
      setPages((prev) => {
        const remaining = prev.filter((p) => p.id !== pageId);
        if (activePage === pageId) {
          setActivePage(remaining.length > 0 ? remaining[0].id : null);
        }
        return remaining;
      });
    },
    [activePage]
  );

  const handleSelectPage = useCallback((pageId) => {
    setActivePage(pageId);
  }, []);

  const handleUpdatePage = useCallback(async (pageId, updates) => {
    await updatePage(pageId, updates);
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, ...updates } : p))
    );
  }, []);

  const handleMovePageToProject = useCallback(async (pageId, projectId) => {
    await updatePage(pageId, { project_id: projectId });
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId ? { ...p, project_id: projectId } : p
      )
    );
  }, []);

  // --- Project handlers ---

  const handleCreateProject = useCallback(async () => {
    const newProject = await createProject();
    setProjects((prev) => [...prev, newProject]);
  }, []);

  const handleUpdateProject = useCallback(async (projectId, updates) => {
    await updateProject(projectId, updates);
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
    );
  }, []);

  const handleDeleteProject = useCallback(async (projectId) => {
    await deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    // Pages with this project_id get set to null (ON DELETE SET NULL in DB)
    setPages((prev) =>
      prev.map((p) =>
        p.project_id === projectId ? { ...p, project_id: null } : p
      )
    );
  }, []);

  // --- Sync handler ---

  const handleSync = useCallback(async () => {
    const result = await syncToMarkdown();
    return result;
  }, []);


  // --- Import handler ---

  const handleImport = useCallback(async (markdownText) => {
    const newPage = await importMarkdown(markdownText);
    setPages((prev) => [...prev, newPage]);
    setActivePage(newPage.id);
  }, []);

  // --- Sidebar toggle ---

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((v) => !v);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ctrl/Cmd+N → new page
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleCreatePage();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleCreatePage]);

  if (!dbReady) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">Initializing database...</div>
      </div>
    );
  }

  const displayedPages = filteredPageIds
    ? pages.filter((p) => filteredPageIds.has(p.id))
    : pages;

  const activePageObj = pages.find((p) => p.id === activePage) || null;

  return (
    <div className="app-container">
      <Sidebar
        pages={displayedPages}
        activePage={activePage}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        onDeletePage={handleDeletePage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        projects={projects}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onUpdateProject={handleUpdateProject}
        onMovePageToProject={handleMovePageToProject}
        onCreatePageInProject={handleCreatePageInProject}
        allTags={allTags}
        activeTagId={activeTagId}
        onSelectTag={setActiveTagId}
        onSync={handleSync}
        onImport={handleImport}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {activePageObj ? (
        <PageEditor
          key={activePageObj.id}
          page={activePageObj}
          onUpdatePage={handleUpdatePage}
          allTags={allTags}
          onRefreshTags={refreshTags}
          onNavigate={handleSelectPage}
        />
      ) : (
        <div className="page-editor-empty">
          <div className="empty-icon">📝</div>
          <div>Select or create a page</div>
        </div>
      )}
    </div>
  );
}
