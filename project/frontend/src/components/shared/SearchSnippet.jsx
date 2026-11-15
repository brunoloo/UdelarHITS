// El backend devuelve el fragmento en tres campos de texto plano y acá se arma con un <mark>.
// Sin dangerouslySetInnerHTML: un comentario con HTML sería XSS almacenado.
export function SearchSnippet({ before, match, after }) {
  if (!match) return null
  return (
    <span className="search-snippet">
      {before}
      <mark className="search-snippet-mark">{match}</mark>
      {after}
    </span>
  )
}
