import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '../../api/client'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-UY', { year: 'numeric', month: 'short', day: 'numeric' })
}

function AppealCard({ appeal, onAccept, onReject, isFading }) {
  return (
    <div className={`appeal-card${isFading ? ' fading' : ''}`}>
      <div className="appeal-card-header">
        <div className="appeal-card-meta">
          <span className="appeal-card-title">{appeal.titulo}</span>
          {appeal.categoria_titulo && (
            <span className="appeal-card-cat">en {appeal.categoria_titulo}</span>
          )}
          {appeal.tema_titulo && (
            <span className="appeal-card-cat">en "{appeal.tema_titulo}"</span>
          )}
        </div>
        <div className="appeal-card-info">
          <span>@{appeal.autor_nickname}</span>
          <span>{formatDate(appeal.fecha_solicitud)}</span>
        </div>
      </div>

      {appeal.contenido_cuerpo && (
        <div className="appeal-content-body">{appeal.contenido_cuerpo}</div>
      )}

      <div className="appeal-justification">
        <span className="appeal-justification-label">Justificación: </span>
        {appeal.justificacion}
      </div>

      <div className="appeal-card-actions">
        <button className="admin-btn admin-btn--success" onClick={() => onAccept(appeal)}>
          Aceptar — restaurar contenido
        </button>
        <button className="admin-btn admin-btn--danger" onClick={() => onReject(appeal)}>
          Rechazar — eliminar definitivamente
        </button>
      </div>
    </div>
  )
}

function AppealsList({ tipo }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [fading, setFading] = useState(new Set())
  const [confirm, setConfirm] = useState(null)

  const { data: appeals = [], isLoading } = useQuery({
    queryKey: ['appeals', 'pending', tipo],
    queryFn: () => apiGet(`/appeals/pending?tipo=${tipo}`).then(r => r.data),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, decision }) => apiPatch(`/appeals/${id}/resolve`, { decision }),
    onSuccess: (_, { decision }) => {
      showToast(
        decision === 'aceptar' ? 'Contenido restaurado' : 'Contenido eliminado permanentemente',
        'success'
      )
      queryClient.invalidateQueries({ queryKey: ['appeals', 'pending', tipo] })
    },
    onError: (err, { id }) => {
      setFading(prev => { const next = new Set(prev); next.delete(id); return next })
      showToast(err.message || 'Error al resolver apelación', 'error')
    },
  })

  function handleAccept(appeal) {
    setFading(prev => new Set([...prev, appeal.id]))
    resolveMutation.mutate({ id: appeal.id, decision: 'aceptar' })
  }

  function handleReject(appeal) {
    setConfirm(appeal)
  }

  function handleConfirmReject() {
    if (!confirm) return
    setFading(prev => new Set([...prev, confirm.id]))
    resolveMutation.mutate({ id: confirm.id, decision: 'rechazar' })
  }

  if (isLoading) {
    return (
      <div className="admin-skeleton">
        {[1, 2].map(i => (
          <div key={i} className="skeleton" style={{ height: 150, borderRadius: 8 }} />
        ))}
      </div>
    )
  }

  if (appeals.length === 0) {
    return <div className="admin-empty">No hay apelaciones pendientes.</div>
  }

  return (
    <div className="appeals-list">
      {appeals.map(a => (
        <AppealCard
          key={a.id}
          appeal={a}
          onAccept={handleAccept}
          onReject={handleReject}
          isFading={fading.has(a.id)}
        />
      ))}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirmReject}
        title="¿Rechazar apelación?"
        message={`¿Eliminar permanentemente "${confirm?.titulo}"? Esta acción no se puede deshacer.`}
        confirmText="Rechazar y eliminar"
        danger
      />
    </div>
  )
}

export function AppealsSection() {
  const [subTab, setSubTab] = useState('tema')

  const { data: temaAppeals = [] } = useQuery({
    queryKey: ['appeals', 'pending', 'tema'],
    queryFn: () => apiGet('/appeals/pending?tipo=tema').then(r => r.data),
  })
  const { data: comentarioAppeals = [] } = useQuery({
    queryKey: ['appeals', 'pending', 'comentario'],
    queryFn: () => apiGet('/appeals/pending?tipo=comentario').then(r => r.data),
  })
  const { data: categoriaAppeals = [] } = useQuery({
    queryKey: ['appeals', 'pending', 'categoria'],
    queryFn: () => apiGet('/appeals/pending?tipo=categoria').then(r => r.data),
  })

  const counts = {
    tema: temaAppeals.length,
    comentario: comentarioAppeals.length,
    categoria: categoriaAppeals.length,
  }

  return (
    <div className="admin-section">
      <div className="admin-subtabs">
        {[
          { key: 'tema', label: 'Temas' },
          { key: 'comentario', label: 'Comentarios' },
          { key: 'categoria', label: 'Categorías' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`admin-subtab${subTab === key ? ' active' : ''}`}
            onClick={() => setSubTab(key)}
          >
            {label}
            {counts[key] > 0 && (
              <span className="admin-badge admin-badge--sm">{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      <AppealsList key={subTab} tipo={subTab} />
    </div>
  )
}
