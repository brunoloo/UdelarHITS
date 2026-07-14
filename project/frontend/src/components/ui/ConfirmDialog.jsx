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
  // Cuando el confirm se abre desde otro modal (p. ej. la lista de seguidores),
  // eleva su backdrop para que quede por encima y no debajo de ese modal.
  elevated = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      backdropClassName={elevated ? 'modal-backdrop--elevated' : ''}
    >
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
