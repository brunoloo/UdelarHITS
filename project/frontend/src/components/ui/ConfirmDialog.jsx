import { Modal } from './Modal'
import './ConfirmDialog.css'

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Estás seguro?',
  message,
  confirmText = 'Confirmar',
  danger = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="confirm-body">
        {message && <p className="confirm-message">{message}</p>}
        <div className="confirm-actions">
          <button type="button" className="confirm-btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={`confirm-btn-ok${danger ? ' confirm-btn-ok--danger' : ''}`}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
