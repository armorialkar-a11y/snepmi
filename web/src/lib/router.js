import { useSyncExternalStore } from 'react';

const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', emit);
  window.addEventListener('hashchange', emit);
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Routes live in the hash (`#/bloggers`), which keeps the SPA usable from any
 * static host and inside Telegram. `/bloggers` path deep links still resolve
 * because the server rewrites them to the app. Anchors (`#contacts`) are not
 * routes and are ignored here.
 */
export function currentPath() {
  if (typeof window === 'undefined') return '/';
  const { hash, pathname } = window.location;
  if (hash.startsWith('#/')) return hash.slice(1) || '/';
  if (hash) return '/';
  return pathname === '/' ? '/' : pathname.replace(/\/+$/, '') || '/';
}

export function toHref(to) {
  if (/^(https?:|mailto:|tel:)/i.test(to)) return to;
  if (to.startsWith('#')) return to;
  return `#${to === '/' ? '/' : to}`;
}

export function navigate(to, { replace = false, scroll = true } = {}) {
  if (/^(https?:|mailto:|tel:)/i.test(to)) return false;
  const path = to.startsWith('#/') ? to.slice(1) : to.startsWith('#') ? currentPath() : to;
  if (path === currentPath()) return false;
  const href = path === '/' ? '#/' : `#${path}`;
  window.history[replace ? 'replaceState' : 'pushState']({ snepmi: path }, '', href);
  emit();
  if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
  return true;
}

export function useRoute() {
  return useSyncExternalStore(subscribe, currentPath, () => '/');
}
