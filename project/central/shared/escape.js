function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;