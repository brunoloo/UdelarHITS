import { useState, useEffect } from 'react'
import { Modal } from '../../components/ui/Modal'
import { CategoryIcon } from '../../components/shared/CategoryIcon'
import { CATEGORY_ICONS } from '../../../../shared/categoryIcons.js'
import './IconPickerModal.css'

// Grilla de íconos disponibles para la categoría. El autor elige uno y confirma
// con "Aceptar"; el padre persiste el cambio (PATCH /categories/:id { icono }).
export function IconPickerModal({ isOpen, onClose, current, onConfirm, isPending }) {
  const [selected, setSelected] = useState(current || 'grid')

  useEffect(() => {
    if (isOpen) setSelected(current || 'grid')
  }, [isOpen, current])

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
