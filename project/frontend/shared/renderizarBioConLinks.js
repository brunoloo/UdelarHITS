function renderizarBioConLinks(texto) {
  if (!texto) return "";
  const textoEscapado = escapeHtml(texto);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const resultado = textoEscapado.replace(urlRegex, function(url) {
    const urlCodificada = encodeURIComponent(url);
    return `<a href="/src/redirect/redirect.html?to=${urlCodificada}" target="_blank" rel="noopener noreferrer" class="bio-link">${url}</a>`;
  });
  return resultado.replace(/\n/g, '<br>');
}