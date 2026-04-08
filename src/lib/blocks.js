import { apiFetch } from './db.js';

export async function getBlocks(pageId) {
  return apiFetch(`/pages/${pageId}/blocks`);
}

export async function addBlock(pageId, { type, content, position, checked, props } = {}) {
  return apiFetch(`/pages/${pageId}/blocks`, {
    method: 'POST',
    body: {
      type: type || 'text',
      content: content || '',
      position: position !== undefined && position !== null ? position : undefined,
      checked: checked || false,
      props: props || {},
    },
  });
}

export async function updateBlock(id, updates) {
  return apiFetch(`/blocks/${id}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteBlock(id) {
  return apiFetch(`/blocks/${id}`, {
    method: 'DELETE',
  });
}

export async function reorderBlocks(pageId, blockIds) {
  return apiFetch(`/pages/${pageId}/blocks/reorder`, {
    method: 'PUT',
    body: { blockIds },
  });
}
