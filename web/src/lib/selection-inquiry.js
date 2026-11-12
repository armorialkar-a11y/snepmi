/** Opens the manager chat with an editable draft; never sends automatically. */
export function selectionInquiry(bloggers, contact) {
  const names = [...new Set(bloggers.map((blogger) => blogger.name).filter(Boolean))];
  const text = [
    'Здравствуйте! Хочу обсудить рекламу у этих блогеров:',
    ...names.map((name) => `— ${name}`),
    '',
    'Подскажите, пожалуйста, условия сотрудничества.',
  ].join('\n');
  let url;
  try {
    url = new URL(contact || 'https://t.me/advmiu');
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('invalid contact');
  } catch {
    url = new URL('https://t.me/advmiu');
  }
  url.searchParams.set('text', text);
  return url.toString();
}
