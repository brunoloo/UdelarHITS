import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPost } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../../components/ui/Modal'

export function ReportUserModal({ isOpen, onClose, nickname }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const { showToast } = useToast()

  const mutation = useMutation({
    mutationFn: () =>
      apiPost(`/user-reports/${encodeURIComponent(nickname)}/report`, {
        motivo: motivo.trim(),
      }),
    onSuccess: () => {
      showToast('Reporte enviado correctamente', 'success')
      handleClose()
    },
    onError: (err) => {
      setError(err.message || 'Error al enviar el reporte')
    },
  })

  function handleClose() {
    setMotivo('')
    setError('')
    mutation.reset()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Reportar usuario" className="report-modal">
      <div className="edit-body">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
          ¿Por qué querés reportar este usuario? Describí el motivo con el mayor detalle posible.
        </p>
        <div className="edit-field">
          <div className="edit-field-label">
            <span>Motivo del reporte</span>
            <span className="edit-field-counter">{motivo.length} / 1000</span>
          </div>
          <textarea
            maxLength={1000}
            rows={5}
            placeholder="Mínimo 10 caracteres"
            value={motivo}
            onChange={e => { setMotivo(e.target.value); setError('') }}
          />
        </div>
        {error && <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="cc-cancel" type="button" onClick={handleClose}>Cancelar</button>
          <button
            className="save-btn"
            type="button"
            disabled={motivo.trim().length < 10 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Enviando...' : 'Enviar reporte'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
