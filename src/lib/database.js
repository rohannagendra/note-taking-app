import { apiFetch } from './db.js';

export async function createDatabase(pageId, name, schema) {
  return apiFetch('/databases', {
    method: 'POST',
    body: { page_id: pageId, name, properties_schema: schema },
  });
}

export async function getDatabase(id) {
  return apiFetch(`/databases/${id}`);
}

export async function updateDatabase(id, updates) {
  return apiFetch(`/databases/${id}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteDatabase(id) {
  return apiFetch(`/databases/${id}`, { method: 'DELETE' });
}

export async function getDatabaseRows(dbId) {
  return apiFetch(`/databases/${dbId}/rows`);
}

export async function addDatabaseRow(dbId, properties) {
  return apiFetch(`/databases/${dbId}/rows`, {
    method: 'POST',
    body: { properties },
  });
}

export async function updateDatabaseRow(rowId, properties) {
  return apiFetch(`/database-rows/${rowId}`, {
    method: 'PATCH',
    body: { properties },
  });
}

export async function deleteDatabaseRow(rowId) {
  return apiFetch(`/database-rows/${rowId}`, { method: 'DELETE' });
}

export async function getPageDatabase(pageId) {
  return apiFetch(`/pages/${pageId}/database`);
}
