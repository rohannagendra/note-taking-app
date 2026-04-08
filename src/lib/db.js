const API_BASE = '/api';

export async function apiFetch(path, options = {}) {
  const { body, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Keep getDB as a no-op that resolves immediately for backwards compat
export async function getDB() {
  return true;
}
