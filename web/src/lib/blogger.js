import { SITE } from './content.js';

/** Name shown on cards: the handle wins when the author publishes under one. */
export function displayName(blogger) {
  return blogger.nickname || blogger.name;
}

export function adLink(blogger, config) {
  const base = blogger.ad_contact || config?.telegram || 'https://t.me/nesssvt';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}text=${encodeURIComponent(SITE.adPrefill)}`;
}

/** '@handle' label for a t.me URL, matching how the site prints contacts. */
export function telegramHandle(value) {
  if (!value) return '';
  const cleaned = String(value)
    .replace(/^(?:https?:\/\/)?(?:www\.|telegram\.)?t\.me\//i, '')
    .replace(/^@/, '')
    .split('?')[0]
    .replace(/\/+$/, '');
  return `@${cleaned}`;
}

export function socialFor(blogger, platform) {  return (blogger.social_links || []).find((link) => link.platform === platform) || null;
}

/** The big link on the card: the platform the author is known for. */
export function primarySocial(blogger) {
  const links = blogger.social_links || [];
  const match = links.find((link) => link.platform === blogger.platform) || links[0];
  return (
    match || { platform: blogger.platform || 'TikTok', url: blogger.social_url || adLink(blogger, null) }
  );
}

export function tagsLine(blogger) {
  return (blogger.topics || []).join(' · ');
}

export function sortBloggers(list) {
  return [...list].sort(
    (a, b) => (b.featured_first ? 1 : 0) - (a.featured_first ? 1 : 0) || (a.sort_order || 0) - (b.sort_order || 0)
  );
}

export function topicOptions(list) {
  const set = new Set();
  for (const blogger of list) for (const topic of blogger.topics || []) set.add(topic);
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

export function platformOptions(list) {
  const set = new Set();
  for (const blogger of list) {
    if (blogger.platform) set.add(blogger.platform);
    for (const link of blogger.social_links || []) set.add(link.platform);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'en'));
}
