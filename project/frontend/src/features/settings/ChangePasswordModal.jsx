import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Modal } from '../../components/ui/Modal'
import { apiPut } from '../../api/client'
import { useToast } from '../../hooks/useToast'

const EYE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EYE_OFF_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete }) {
  return (
    <div className="edit-field">
      <div className="edit-field-label"><span>{label}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type={show ? 'text' : 'password'}
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '2px', display: 'flex',
            flexShrink: 0,
          }}
        >
          {show ? EYE_OFF_ICON : EYE_ICON}
        </button>
      </div>
    </div>
  )
}

export function ChangePasswordModal({ isOpen, onClose }) {
  const { showToast } = useToast()
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setCurrent(''); setNewPass(''); setConfirm('')
    setShowCurrent(false); setShowNew(false); setShowConfirm(false)
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  const mutation = useMutation({
    mutationFn: () => apiPut('/users/change-password', { currentPassword: current, newPassword: newPass }),
    onSuccess: () => {
      handleClose()
      showToast('Contraseña actualizada correctamente', 'success')
    },
    onError: (err) => {
      setError(err.message || 'Error al cambiar la contraseña.')
    },
  })

  function handleSubmit() {
    setError('')

    if (!current || !newPass || !confirm) {
      setError('Completá todos los campos.')
      return
    }
    if (newPass.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPass !== confirm) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    if (current === newPass) {
      setError('La nueva contraseña debe ser diferente a la actual.')
      return
    }

    mutation.mutate()
  }

  const saveBtn = (
    <button
      className="save-btn"
      type="button"
      onClick={handleSubmit}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Guardando...' : 'Guardar'}
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Cambiar contraseña" headerAction={saveBtn} className="modal--narrow">
      <div className="edit-body">
        <PasswordField
          id="cp-current"
          label="Contraseña actual"
          value={current}
          onChange={setCurrent}
          show={showCurrent}
          onToggle={() => setShowCurrent(v => !v)}
          autoComplete="current-password"
        />
        {/* TODO: link a La Central /central/cuenta/forgot-password.html — se conecta en Etapa 5 */}
        <a href="#" className="cp-forgot-link" onClick={e => e.preventDefault()}>
          ¿Olvidaste tu contraseña?
        </a>
        <PasswordField
          id="cp-new"
          label="Nueva contraseña"
          value={newPass}
          onChange={setNewPass}
          show={showNew}
          onToggle={() => setShowNew(v => !v)}
          autoComplete="new-password"
        />
        <PasswordField
          id="cp-confirm"
          label="Confirmar nueva contraseña"
          value={confirm}
          onChange={setConfirm}
          show={showConfirm}
          onToggle={() => setShowConfirm(v => !v)}
          autoComplete="new-password"
        />
        {error && <p className="cp-error">{error}</p>}
      </div>
    </Modal>
  )
}
