// Resolve from the installed module, not the page route or origin root. This
// works for root hosting, GitHub Pages /repository/, and module workers alike.
export function projectStorageUrl(path, moduleUrl = import.meta.url) {
  const root = new URL('../../', moduleUrl);
  const prefix = /^https?:$/.test(root.protocol) ? root.pathname : '/';
  const clean = String(path || '').replace(/^\/+/, '');
  return `${prefix}${clean}`;
}
