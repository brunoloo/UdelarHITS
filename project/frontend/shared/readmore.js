function initReadMore(el, text, initialLines, expandLines) {
  initialLines = initialLines || 8;
  expandLines = expandLines || 12;
  const initialChars = 500;
  const expandChars = 750;
  const lines = text.split('\n');

  const needsTruncateLines = lines.length > initialLines;
  const needsTruncateChars = text.length > initialChars;

  if (!needsTruncateLines && !needsTruncateChars) {
    el.innerHTML = renderizarBioConLinks(text);
    return;
  }

  const mode = needsTruncateLines ? 'lines' : 'chars';
  let currentVisible = mode === 'lines' ? initialLines : initialChars;

  if (mode === 'lines') {
    el.innerHTML = renderizarBioConLinks(lines.slice(0, initialLines).join('\n') + '...');
  } else {
    el.innerHTML = renderizarBioConLinks(text.slice(0, initialChars) + '...');
  }

  const btn = document.createElement('button');
  btn.className = 'read-more-btn';
  btn.textContent = 'Leer más';
  el.after(btn);

  btn.addEventListener('click', () => {
    if (mode === 'lines') {
      if (currentVisible >= lines.length) {
        currentVisible = initialLines;
        el.innerHTML = renderizarBioConLinks(lines.slice(0, initialLines).join('\n') + '...');
        btn.textContent = 'Leer más';
        return;
      }

      currentVisible = Math.min(currentVisible + expandLines, lines.length);

      if (currentVisible >= lines.length) {
        el.innerHTML = renderizarBioConLinks(text);
        btn.textContent = 'Leer menos';
      } else {
        el.innerHTML = renderizarBioConLinks(lines.slice(0, currentVisible).join('\n') + '...');
      }

    } else {
      if (currentVisible >= text.length) {
        currentVisible = initialChars;
        el.innerHTML = renderizarBioConLinks(text.slice(0, initialChars) + '...');
        btn.textContent = 'Leer más';
        return;
      }

      currentVisible = Math.min(currentVisible + expandChars, text.length);

      if (currentVisible >= text.length) {
        el.innerHTML = renderizarBioConLinks(text);
        btn.textContent = 'Leer menos';
      } else {
        el.innerHTML = renderizarBioConLinks(text.slice(0, currentVisible) + '...');
      }
    }
  });
}

window.initReadMore = initReadMore;