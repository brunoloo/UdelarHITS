import { UserAvatar } from './UserAvatar'
import { ReactionButtons } from './ReactionButtons'
import { resolveAutor } from '../../utils/resolveAutor'
import './ReplyPreview.css'

// El backend recorta el texto a esta longitud; si llega al tope, sigue en el hilo.
const MAX_CARACTERES = 300

// Los adjuntos no se muestran en la vista previa: solo se avisa que están.
function marcadores(r) {
  const out = []
  if (r.tiene_imagen) out.push('[foto]')
  if (r.tiene_adjunto) out.push('[adjunto]')
  if (r.tiene_encuesta) out.push('[encuesta]')
  return out.join(' ')
}

// Una sola línea de lectura: los saltos de línea se colapsan y el CSS corta en dos líneas.
function textoPlano(texto) {
  const limpio = (texto || '').replace(/\s+/g, ' ').trim()
  return (texto || '').length >= MAX_CARACTERES ? `${limpio}…` : limpio
}

// Hasta dos respuestas directas debajo de un comentario, para leerlas sin entrar al hilo.
// El clic en una fila burbujea a la tarjeta, que abre el hilo; el me gusta no.
export function ReplyPreview({ replies, total, onOpen }) {
  if (!replies || replies.length === 0) return null
  const restantes = Number(total) || 0

  return (
    <div className="reply-preview">
      {replies.map(r => {
        const autor = resolveAutor(r)
        const texto = textoPlano(r.texto)
        const extra = marcadores(r)
        return (
          <div key={r.id} className="reply-preview-row">
            <UserAvatar url_imagen={autor.url_imagen} nickname={autor.nickname} size={20} inactive={autor.isInactive} lazy />
            <p className="reply-preview-text">
              <span className={`reply-preview-author${autor.isInactive ? ' inactive-author' : ''}`}>{autor.nickname}</span>
              {texto && <> {texto}</>}
              {extra && <span className="reply-preview-marker"> {extra}</span>}
            </p>
            <ReactionButtons contenidoId={r.id} likes={r.likes} mi_reaccion={r.mi_reaccion} />
          </div>
        )
      })}
      {restantes > replies.length && (
        <button
          type="button"
          className="reply-preview-more"
          onClick={e => { e.stopPropagation(); onOpen?.() }}
        >
          Ver las {restantes} respuestas
        </button>
      )}
    </div>
  )
}
