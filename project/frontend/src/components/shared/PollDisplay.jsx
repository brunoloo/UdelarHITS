import { useState, useEffect, useReducer } from 'react'
import { Check } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { tiempoRestante } from '../../utils/poll'
import './PollDisplay.css'

export function PollDisplay({ encuesta, readOnly = false, invalidateKey }) {
  const { showToast } = useToast()
  const requireAuth = useRequireAuth()
  const queryClient = useQueryClient()
  const [poll, setPoll] = useState(encuesta)
  const [, force] = useReducer(x => x + 1, 0)

  useEffect(() => { setPoll(encuesta) }, [encuesta])

  const cerrada = poll.cerrada || new Date(poll.fecha_cierre).getTime() <= Date.now()
  const revelado = poll.mi_voto != null || cerrada

  // Cuando vence el tiempo mientras se mira, revelar automáticamente.
  useEffect(() => {
    if (cerrada) return
    const ms = new Date(poll.fecha_cierre).getTime() - Date.now()
    if (ms <= 0) return
    const t = setTimeout(() => force(), Math.min(ms + 500, 2 ** 31 - 1))
    return () => clearTimeout(t)
  }, [poll.fecha_cierre, cerrada])

  const voteMutation = useMutation({
    mutationFn: (opcionId) => apiPost(`/polls/${poll.id}/vote`, { opcion_id: opcionId }),
    onSuccess: (res) => {
      setPoll(res.data)
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: invalidateKey })
      queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === 'replies' })
    },
    onError: (err) => showToast(err.message || 'No se pudo votar', 'error'),
  })

  const total = Number(poll.total_votos) || 0

  function handleVote(opcionId) {
    if (readOnly || revelado || voteMutation.isPending) return
    if (!requireAuth('Iniciá sesión para votar')) return
    voteMutation.mutate(opcionId)
  }

  return (
    <div className="poll-display" onClick={e => e.stopPropagation()}>
      {poll.opciones.map((op) => {
        const votos = Number(op.votos) || 0
        const pct = total > 0 ? Math.round((votos / total) * 100) : 0
        const elegida = poll.mi_voto === op.id

        if (!revelado) {
          return (
            <button
              key={op.id}
              type="button"
              className="poll-choice"
              disabled={readOnly || voteMutation.isPending}
              onClick={() => handleVote(op.id)}
            >
              {op.texto}
            </button>
          )
        }
        return (
          <div key={op.id} className={`poll-result${elegida ? ' poll-result--mine' : ''}`}>
            <div className="poll-result-bar" style={{ width: `${pct}%` }} />
            <div className="poll-result-content">
              <span className="poll-result-text">
                {op.texto}
                {elegida && <Check size={14} className="poll-result-check" />}
              </span>
              <span className="poll-result-pct">{pct}%</span>
            </div>
          </div>
        )
      })}

      <div className="poll-footer">
        <span>{total} {total === 1 ? 'voto' : 'votos'}</span>
        <span>·</span>
        <span>{cerrada ? 'Finalizada' : tiempoRestante(poll.fecha_cierre)}</span>
      </div>
    </div>
  )
}
