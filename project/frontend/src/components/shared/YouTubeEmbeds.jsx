import { useEffect, useMemo, useRef, useState } from 'react'
import { extractYouTubeVideoIds } from '../../utils/renderBioWithLinks'
import './YouTubeEmbeds.css'

// Reproductores de YouTube para los links de video del cuerpo de un comentario.
// Los contenedores se reservan siempre (sin saltos de layout); el <iframe> recién
// se crea cuando el bloque entra al viewport, y ahí arranca en autoplay muteado.
export function YouTubeEmbeds({ text }) {
  const ids = useMemo(() => extractYouTubeVideoIds(text), [text])
  const hasIds = ids.length > 0
  const ref = useRef(null)
  // Sin IntersectionObserver (navegadores viejos) se muestran directo.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (!hasIds || visible) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.25 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasIds, visible])

  if (!hasIds) return null

  return (
    // stopPropagation: las cards contenedoras navegan al hacer click.
    <div className="yt-embeds" ref={ref} onClick={e => e.stopPropagation()}>
      {ids.map((id, i) => (
        <div className="yt-embed" key={`${id}-${i}`}>
          {visible && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=1`}
              title="Video de YouTube"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          )}
        </div>
      ))}
    </div>
  )
}
