/** Opens the manager chat with an editable draft; never sends automatically. */
export function selectionInquiry(bloggers) {
  const names = [...new Set(bloggers.map((blogger) => blogger.name).filter(Boolean))];
  const text = [
    'Здравствуйте! Хочу обсудить рекламу у этих блогеров:',
    ...names.map((name) => `— ${name}`),
    '',
    'Подскажите, пожалуйста, условия сотрудничества.',
  ].join('\n');
  return `https://t.me/nesssvt?text=${encodeURIComponent(text)}`;
}
