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

export async function getComments(blockId) {
  return apiFetch(`/blocks/${blockId}/comments`);
}

export async function addComment(blockId, content) {
  return apiFetch(`/blocks/${blockId}/comments`, {
    method: 'POST',
    body: { content },
  });
}

export async function updateComment(id, content) {
  return apiFetch(`/comments/${id}`, {
    method: 'PATCH',
    body: { content },
  });
}

export async function deleteComment(id) {
  return apiFetch(`/comments/${id}`, {
    method: 'DELETE',
  });
}
