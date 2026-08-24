import { Modal } from '../ui/Modal'
import './PinHomeModal.css'

// Mini modal que pregunta por cuánto tiempo fijar un ítem (categoría o
// comentario) en el inicio. Al elegir una duración se dispara onConfirm(dias).
// Lo comparten CategoryPage (fijar categoría) y FeedPage (fijar comentario de
// Home), que sólo cambian el texto descriptivo.
const PIN_HOME_OPTIONS = [
  { dias: 3, label: '3 días' },
  { dias: 7, label: '1 semana' },
  { dias: 30, label: '1 mes' },
]

export function PinHomeModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  title = 'Fijar en el inicio',
  desc,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="pin-home-body">
        {desc && <p className="pin-home-desc">{desc}</p>}
        <div className="pin-home-options">
          {PIN_HOME_OPTIONS.map(opt => (
            <button
              key={opt.dias}
              className="pin-home-option"
              type="button"
              disabled={isPending}
              onClick={() => onConfirm(opt.dias)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
