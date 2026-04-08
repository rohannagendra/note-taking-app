import { apiFetch } from './db.js';

export async function getTags() {
  return apiFetch('/tags');
}

export async function createTag({ name, color } = {}) {
  return apiFetch('/tags', {
    method: 'POST',
    body: { name, color },
  });
}

export async function deleteTag(id) {
  return apiFetch(`/tags/${id}`, {
    method: 'DELETE',
  });
}

export async function addTagToPage(pageId, tagId) {
  return apiFetch(`/pages/${pageId}/tags`, {
    method: 'POST',
    body: { tagId },
  });
}

export async function removeTagFromPage(pageId, tagId) {
  return apiFetch(`/pages/${pageId}/tags/${tagId}`, {
    method: 'DELETE',
  });
}

export async function getPageTags(pageId) {
  return apiFetch(`/pages/${pageId}/tags`);
}

export async function getTagsByPageId(pageId) {
  return getPageTags(pageId);
}

export async function getPagesByTagId(tagId) {
  return apiFetch(`/tags/${tagId}/pages`);
}
