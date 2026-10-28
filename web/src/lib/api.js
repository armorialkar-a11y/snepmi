import { initDataRaw } from './telegram.js';

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload || {};
  }

  /** Per-field validation messages from the server (zod), keyed by field name. */
  get fieldErrors() {
    return this.payload.errors || null;
  }
}

async function request(path, { method = 'GET', body, form, signal } = {}) {
  const headers = {};
  const token = initDataRaw();
  if (token) headers.Authorization = `tma ${token}`;

  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, { method, headers, body: payload, signal });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text.slice(0, 200) };
  }

  if (!response.ok) {
    throw new ApiError(data?.error || `Ошибка ${response.status}`, response.status, data);
  }
  return data;
}

/**
 * The server answers 422 with `{ errors: { field: message } }`, and nested keys
 * arrive dotted (`adminUserIds.0`). A form can only render the fields it owns,
 * so anything else is folded into one message the form can show verbatim.
 */
export function partitionFieldErrors(errors, rendered) {
  const mapped = {};
  const hidden = [];
  for (const [key, message] of Object.entries(errors || {})) {
    const base = key.split('.')[0];
    if (rendered.has(base)) {
      if (mapped[base] === undefined) mapped[base] = message;
    } else if (message) {
      hidden.push(message);
    }
  }
  return { mapped, hiddenMessage: hidden.join(' ') };
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, form, options) => request(path, { ...options, method: 'POST', form }),
};
