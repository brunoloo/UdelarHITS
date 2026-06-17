import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPost } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../ui/Modal'
import './ReportModal.css'

const MOTIVOS = [
  { value: 'spam',                label: 'Spam',                  desc: 'Contenido comercial, repetitivo o irrelevante' },
  { value: 'incitacionOdio',      label: 'Incitación al odio',    desc: 'Discurso que ataca a un grupo por identidad' },
  { value: 'acoso',               label: 'Acoso',                 desc: 'Hostigamiento dirigido a una persona' },
  { value: 'contenidoInapropiado',label: 'Contenido inapropiado', desc: 'Sexual, violento o fuera de contexto' },
  { value: 'informacionEnganosa', label: 'Información engañosa',  desc: 'Datos falsos presentados como verdaderos' },
  { value: 'suplantacion',        label: 'Suplantación',          desc: 'Hacerse pasar por otra persona o entidad' },
]

export function ReportModal({ isOpen, onClose, contentId, contentType }) {
  const [selected, setSelected] = useState('')
  const { showToast } = useToast()

  const mutation = useMutation({
    mutationFn: () => {
      const body = { motivo: selected }
      if (contentType === 'category') {
        body.categoria_id = contentId
      } else {
        body.contenido_id = contentId
      }
      return apiPost('/reports/create', body)
    },
    onSuccess: (data) => {
      showToast(data?.message || 'Reporte registrado', 'success')
      handleClose()
    },
    onError: (err) => {
      showToast(err.message || 'Error al reportar', 'error')
    },
  })

  function handleClose() {
    setSelected('')
    mutation.reset()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="¿Qué estás reportando?"
      className="report-modal"
    >
      <div className="edit-body report-body">
        <p className="report-subtitle">Elegí la categoría que mejor describe el problema.</p>
        <div className="report-options">
          {MOTIVOS.map(m => (
            <label key={m.value} className="report-option">
              <div className="report-option-text">
                <span className="report-option-label">{m.label}</span>
                <span className="report-option-desc">{m.desc}</span>
              </div>
              <input
                type="radio"
                name="reportMotivo"
                value={m.value}
                checked={selected === m.value}
                onChange={() => setSelected(m.value)}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="report-footer">
        <button
          className="save-btn report-submit-btn"
          type="button"
          disabled={!selected || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Enviando...' : 'Enviar reporte'}
        </button>
      </div>
    </Modal>
  )
}
