import type { Document, InteractionLog, LexemeIndex, Project } from '../types';

const API_BASE = '/api/library';

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string;
};

const requestJson = async (path: string, options: ApiOptions = {}) => {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  return fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
};

export type StoredProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  lexeme_index?: LexemeIndex | null;
  interaction_log?: InteractionLog | null;
  active_document_id?: string | null;
};

export const uploadEpubToSupabase = async (
  file: File,
  bookId: string,
  authToken: string
): Promise<string> => {
  if (!authToken) {
    console.warn('Missing auth token for upload.');
    return '';
  }

  const form = new FormData();
  form.append('type', 'epub');
  form.append('bookId', bookId);
  form.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`
    },
    body: form
  });

  if (!res.ok) {
    console.error('Upload failed', await res.text());
    return '';
  }

  const data = (await res.json()) as { path?: string };
  return data.path || '';
};

export const uploadAvatarToSupabase = async (
  file: File,
  authToken: string
): Promise<{ path: string; publicUrl: string }> => {
  if (!authToken) {
    console.warn('Missing auth token for upload.');
    return { path: '', publicUrl: '' };
  }

  const form = new FormData();
  form.append('type', 'avatar');
  form.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`
    },
    body: form
  });

  if (!res.ok) {
    console.error('Avatar upload failed', await res.text());
    return { path: '', publicUrl: '' };
  }

  const data = (await res.json()) as { path?: string; publicUrl?: string };
  return { path: data.path || '', publicUrl: data.publicUrl || '' };
};

export const upsertProjectSnapshot = async (
  project: Project,
  authToken: string,
  activeDocumentId?: string
): Promise<boolean> => {
  if (!authToken) {
    console.warn('Missing auth token for project upsert.');
    return false;
  }

  const res = await requestJson(`${API_BASE}/project`, {
    method: 'POST',
    token: authToken,
    body: { project, activeDocumentId }
  });

  if (!res.ok) {
    console.error('Project upsert failed', await res.text());
    return false;
  }

  return true;
};

export const upsertDocumentSnapshot = async (
  document: Document,
  projectId: string,
  authToken: string
): Promise<boolean> => {
  if (!authToken) {
    console.warn('Missing auth token for document upsert.');
    return false;
  }

  const res = await requestJson(`${API_BASE}/document`, {
    method: 'POST',
    token: authToken,
    body: { document, projectId }
  });

  if (!res.ok) {
    console.error('Document upsert failed', await res.text());
    return false;
  }

  return true;
};

export const fetchProjectSnapshot = async (
  authToken: string
): Promise<{ project: StoredProjectRow; documents: Document[] } | null> => {
  if (!authToken) {
    console.warn('Missing auth token for fetch.');
    return null;
  }

  const res = await requestJson(`${API_BASE}/snapshot`, {
    token: authToken
  });

  if (!res.ok) {
    console.error('Fetch snapshot failed', await res.text());
    return null;
  }

  const data = (await res.json()) as { project?: StoredProjectRow | null; documents?: Document[] };
  if (!data.project) return null;

  return { project: data.project, documents: data.documents || [] };
};
