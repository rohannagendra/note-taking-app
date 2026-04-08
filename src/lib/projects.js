import { apiFetch } from './db.js';

export async function getProjects() {
  return apiFetch('/projects');
}

export async function createProject({ name, icon, color } = {}) {
  return apiFetch('/projects', {
    method: 'POST',
    body: {
      name: name || 'New Project',
      icon: icon || '📁',
      color: color || '#E8E5E0',
    },
  });
}

export async function updateProject(id, updates) {
  return apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteProject(id) {
  return apiFetch(`/projects/${id}`, {
    method: 'DELETE',
  });
}
