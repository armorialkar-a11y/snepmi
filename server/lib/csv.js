/** Protect spreadsheet users from formulas in untrusted CSV fields. */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = Array.isArray(value) ? value.join('; ') : String(value);
  // Also guard leading whitespace and control characters accepted by spreadsheets.
  if (/^\s*[\t\r\n]/u.test(text) || /^\s*[=+\-@＝＋－＠]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
