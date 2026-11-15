import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { CategoryIcon } from '../../components/shared/CategoryIcon'
import { CATEGORY_ICONS } from '../../utils/categoryIcons.js'
import './IconPickerModal.css'

export function IconPickerModal({ isOpen, onClose, current, onConfirm, isPending }) {
  const [selected, setSelected] = useState(current || 'grid')

  const seed = isOpen ? (current || 'grid') : null
  const [prevSeed, setPrevSeed] = useState(seed)
  if (prevSeed !== seed) {
    setPrevSeed(seed)
    if (seed) setSelected(seed)
  }

  const confirmBtn = (
    <button
      className="save-btn"
      type="button"
      disabled={isPending}
      onClick={() => onConfirm(selected)}
    >
      {isPending ? 'Guardando...' : 'Aceptar'}
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Elegir ícono" headerAction={confirmBtn}>
      <div className="icon-picker-grid">
        {CATEGORY_ICONS.map(name => (
          <button
            key={name}
            type="button"
            className={`icon-picker-item${selected === name ? ' selected' : ''}`}
            onClick={() => setSelected(name)}
            title={name}
            aria-pressed={selected === name}
          >
            <CategoryIcon name={name} size={22} />
          </button>
        ))}
      </div>
    </Modal>
  )
}
