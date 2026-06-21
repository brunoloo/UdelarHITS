import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '../../api/client'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-UY', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ReportsSection() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [fading, setFading] = useState(new Set())
  const [confirm, setConfirm] = useState(null)

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['user-reports', 'pending'],
    queryFn: () => apiGet('/user-reports/pending').then(r => r.data),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, decision }) => apiPatch(`/user-reports/${id}/resolve`, { decision }),
    onSuccess: (_, { decision }) => {
      showToast(
        decision === 'levantar' ? 'Reporte levantado' : 'Cuenta inactivada',
        'success'
      )
      queryClient.invalidateQueries({ queryKey: ['user-reports', 'pending'] })
    },
    onError: (err, { id }) => {
      setFading(prev => { const next = new Set(prev); next.delete(id); return next })
      showToast(err.message || 'Error al resolver reporte', 'error')
    },
  })

  function handleLevantar(report) {
    setFading(prev => new Set([...prev, report.id]))
    resolveMutation.mutate({ id: report.id, decision: 'levantar' })
  }

  function handleInactivar(report) {
    setConfirm(report)
  }

  function handleConfirmInactivar() {
    if (!confirm) return
    setFading(prev => new Set([...prev, confirm.id]))
    resolveMutation.mutate({ id: confirm.id, decision: 'inactivar' })
  }

  if (isLoading) {
    return (
      <div className="admin-section">
        <div className="admin-skeleton">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 88, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-section">
      {reports.length === 0 ? (
        <div className="admin-empty">No hay reportes de usuarios pendientes.</div>
      ) : (
        <div className="reports-list">
          {reports.map(r => (
            <div
              key={r.id}
              className={`report-card${fading.has(r.id) ? ' fading' : ''}`}
            >
              <div className="report-card-left">
                <UserAvatar
                  url_imagen={r.reportado_url_imagen}
                  nickname={r.reportado_nickname}
                  size={40}
                />
                <div className="report-card-info">
                  <span className="report-card-reported">@{r.reportado_nickname}</span>
                  {r.reportado_nombre && (
                    <span className="report-card-name">{r.reportado_nombre}</span>
                  )}
                </div>
              </div>

              <div className="report-card-center">
                <span className="report-card-motivo">{r.motivo}</span>
                <span className="report-card-reporter">
                  Reportado por @{r.reportador_nickname} · {formatDate(r.fecha_creacion)}
                </span>
              </div>

              <div className="report-card-actions">
                <button
                  className="admin-btn admin-btn--ghost"
                  onClick={() => handleLevantar(r)}
                >
                  Levantar reporte
                </button>
                <button
                  className="admin-btn admin-btn--danger"
                  onClick={() => handleInactivar(r)}
                >
                  Inactivar cuenta
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirmInactivar}
        title="¿Inactivar cuenta?"
        message={`¿Inactivar la cuenta de @${confirm?.reportado_nickname}? El usuario no podrá iniciar sesión.`}
        confirmText="Inactivar"
        danger
      />
    </div>
  )
}
