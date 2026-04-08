import { apiFetch } from './db.js';

export async function getPages() {
  return apiFetch('/pages');
}

export async function getPageById(id) {
  return apiFetch(`/pages/${id}`);
}

export async function createPage({ title, icon, projectId } = {}) {
  return apiFetch('/pages', {
    method: 'POST',
    body: {
      title: title || 'Untitled',
      icon: icon || '📄',
      projectId: projectId || null,
    },
  });
}

export async function updatePage(id, updates) {
  return apiFetch(`/pages/${id}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deletePage(id) {
  return apiFetch(`/pages/${id}`, {
    method: 'DELETE',
  });
}

export async function toggleFavorite(id, isFavorite) {
  return apiFetch(`/pages/${id}`, { method: 'PATCH', body: { is_favorite: isFavorite } });
}

export async function searchPages(query) {
  return apiFetch(`/pages/search?q=${encodeURIComponent(query)}`);
}

export async function syncToMarkdown() {
  return apiFetch('/sync', { method: 'POST' });
}

export async function importMarkdown(markdown, title) {
  return apiFetch('/import', { method: 'POST', body: { markdown, title } });
}

export async function getBacklinks(pageId) {
  return apiFetch(`/pages/${pageId}/backlinks`);
}
