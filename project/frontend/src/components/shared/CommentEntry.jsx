import { Link, useNavigate } from 'react-router-dom'
import { CommentCard } from './CommentCard'
import { commentPermalink } from '../../utils/commentPermalink'
import './CommentEntry.css'

// Header contextual ("en tema/categoría [x]" o "en respuesta al comentario de
// [nick]") + CommentCard completa. Reutilizado en el perfil (tabs comentarios y
// me gusta) y en el panel de guardados, para que todos rendericen igual.
// onNavigate: callback opcional al navegar (p. ej. cerrar el panel de guardados).
export function CommentEntry({ comment: r, invalidateKey, onReply, onNavigate }) {
  const navigate = useNavigate()

  // Comentario de Home: no tiene contenedor del que derivar la URL — su permalink
  // ES la página del comentario (/comment/:id), independiente del ámbito.
  const isHome = r.tipo === 'home'
  // Permalink por ámbito (fuente única, compartida con la búsqueda). Para tema y
  // categoría, `base` es también el link del título contextual del header.
  const commentHref = commentPermalink({ tipo: r.tipo, id: r.id, destino_id: r.destino_id })
  const base = r.tipo === 'tema'
    ? `/topic/${encodeURIComponent(r.destino_id)}`
    : `/category/${encodeURIComponent(r.destino_id)}?tab=comentarios`

  const isReply = !!r.comentario_padre_id
  let prefix, titleText, titleHref
  if (isReply) {
    prefix = 'en respuesta al comentario de'
    // Cuenta inactiva → se anonimiza (sin link). 'ban' queda público.
    const padreInactivo = r.padre_autor_estado === 'inactivo'
    titleText = padreInactivo ? 'Usuario inactivo' : (r.padre_autor_nickname || 'usuario')
    titleHref = (!padreInactivo && r.padre_autor_nickname)
      ? `/user/${encodeURIComponent(r.padre_autor_nickname)}`
      : null
  } else if (isHome) {
    prefix = 'en'
    titleText = 'Home'
    titleHref = '/'
  } else if (r.tipo === 'tema') {
    prefix = 'en tema'
    if (r.tema_estado === 'inactivo') { titleText = 'inactivo'; titleHref = null }
    else { titleText = r.destino_titulo; titleHref = base }
  } else {
    prefix = 'en categoría'
    if (r.categoria_estado === 'inactiva') { titleText = 'inactiva'; titleHref = null }
    else { titleText = r.destino_titulo; titleHref = base }
  }

  return (
    <div className="comment-entry">
      <div className="comment-entry-head">
        <span>{prefix}</span>
        {titleHref
          ? <Link to={titleHref} onClick={onNavigate}>{titleText}</Link>
          : <span className="comment-entry-inactive">{titleText}</span>}
      </div>
      <CommentCard
        comment={r}
        role="reply"
        onCardClick={() => { onNavigate?.(); navigate(commentHref) }}
        onReply={onReply}
        invalidateKey={invalidateKey}
      />
    </div>
  )
}
