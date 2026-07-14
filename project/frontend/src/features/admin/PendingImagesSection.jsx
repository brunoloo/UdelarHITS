import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '../../api/client'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'

const ORIGEN_LABEL = { adjunto: 'Adjunto', avatar: 'Avatar', banner: 'Banner' }

// Tiempo relativo simple (hace X min/h/días).
function timeAgo(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'hace instantes'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24)
  return `hace ${days} día${days === 1 ? '' : 's'}`
}

function PendingImageCard({ item, onApprove, onReject, isFading }) {
  return (
    <div className={`pending-image-card${isFading ? ' fading' : ''}`}>
      <div className="pending-image-thumb">
        <img src={item.url} alt={item.contexto} loading="lazy" />
      </div>

      <div className="pending-image-body">
        <div className="pending-image-head">
          <span className={`admin-status admin-status--${item.origen === 'adjunto' ? 'user' : 'admin'}`}>
            {ORIGEN_LABEL[item.origen] || item.origen}
          </span>
          <span className="pending-image-time">{timeAgo(item.fecha_creacion)}</span>
        </div>

        <div className="pending-image-context">
          {item.link ? (
            <Link to={item.link} target="_blank" rel="noopener noreferrer" className="admin-nick-link">
              {item.contexto}
            </Link>
          ) : (
            <span>{item.contexto}</span>
          )}
        </div>

        <div className="pending-image-uploader">
          Subida por{' '}
          <Link to={`/user/${encodeURIComponent(item.autor_nickname)}`} target="_blank" rel="noopener noreferrer" className="admin-nick-link">
            @{item.autor_nickname}
          </Link>
        </div>

        <div className="pending-image-scores">
          <span className="pending-image-score">adult: <strong>{item.score_adult || '—'}</strong></span>
          <span className="pending-image-score">racy: <strong>{item.score_racy || '—'}</strong></span>
        </div>

        <div className="pending-image-actions">
          <button className="admin-btn admin-btn--success" onClick={() => onApprove(item)}>
            Aprobar
          </button>
          <button className="admin-btn admin-btn--danger" onClick={() => onReject(item)}>
            Rechazar
          </button>
        </div>
      </div>
    </div>
  )
}

export function PendingImagesSection() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [fading, setFading] = useState(new Set())
  const [confirm, setConfirm] = useState(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin', 'pending-images'],
    queryFn: () => apiGet('/admin/pending-images').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, origen, action }) =>
      apiPatch(`/admin/pending-images/${id}/${action}`, { origen }),
    onSuccess: (_, { action }) => {
      showToast(action === 'approve' ? 'Imagen aprobada y publicada' : 'Imagen rechazada', 'success')
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-images'] })
    },
    onError: (err, { id, origen }) => {
      setFading(prev => { const next = new Set(prev); next.delete(`${origen}:${id}`); return next })
      showToast(err.message || 'Error al resolver la imagen', 'error')
    },
  })

  function handleApprove(item) {
    setFading(prev => new Set([...prev, `${item.origen}:${item.id}`]))
    mutation.mutate({ id: item.id, origen: item.origen, action: 'approve' })
  }

  function handleReject(item) {
    setConfirm(item)
  }

  function handleConfirmReject() {
    if (!confirm) return
    setFading(prev => new Set([...prev, `${confirm.origen}:${confirm.id}`]))
    mutation.mutate({ id: confirm.id, origen: confirm.origen, action: 'reject' })
  }

  if (isLoading) {
    return (
      <div className="admin-skeleton">
        {[1, 2].map(i => (
          <div key={i} className="skeleton" style={{ height: 160, borderRadius: 8 }} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <div className="admin-empty">No hay imágenes pendientes de revisión.</div>
  }

  return (
    <div className="admin-section">
      <div className="pending-images-grid">
        {items.map(item => (
          <PendingImageCard
            key={`${item.origen}:${item.id}`}
            item={item}
            onApprove={handleApprove}
            onReject={handleReject}
            isFading={fading.has(`${item.origen}:${item.id}`)}
          />
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirmReject}
        title="¿Rechazar imagen?"
        message="La imagen se eliminará de forma permanente y se notificará al usuario. Esta acción no se puede deshacer."
        confirmText="Rechazar y eliminar"
        danger
      />
    </div>
  )
}
