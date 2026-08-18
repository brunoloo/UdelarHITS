// Resalta el término dentro de un fragmento de resultado de búsqueda. El backend
// devuelve el fragmento partido en TRES campos de texto plano (before/match/after)
// — nunca HTML — y acá lo componemos con un <mark> como nodo React. Sin
// dangerouslySetInnerHTML a propósito: un comentario con <img onerror=…> sería
// XSS almacenado servido por el buscador.
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
