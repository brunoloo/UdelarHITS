import { BarChart2, X, Plus } from 'lucide-react'
import {
  POLL_MIN_OPC,
  POLL_MAX_OPC,
  POLL_MAX_TEXTO,
  nuevaEncuesta,
} from '../../utils/poll'
import './PollEditor.css'

// Botón de encuesta (va a la derecha del clip). Activa/crea la encuesta.
export function PollButton({ active, onActivate, disabled = false }) {
  return (
    <button
      type="button"
      className={`poll-btn${active ? ' active' : ''}`}
      title="Crear encuesta"
      aria-label="Crear encuesta"
      disabled={disabled || active}
      onClick={onActivate}
    >
      <BarChart2 size={18} />
    </button>
  )
}

const rango = (n) => Array.from({ length: n }, (_, i) => i)

// Editor de encuesta: opciones (2..5) + duración (días/horas/minutos).
export function PollEditor({ poll, onChange, onRemove }) {
  if (!poll) return null

  const setOpcion = (i, val) => {
    const opciones = poll.opciones.slice()
    opciones[i] = val
    onChange({ ...poll, opciones })
  }
  const addOpcion = () => {
    if (poll.opciones.length >= POLL_MAX_OPC) return
    onChange({ ...poll, opciones: [...poll.opciones, ''] })
  }
  const removeOpcion = (i) => {
    if (poll.opciones.length <= POLL_MIN_OPC) return
    onChange({ ...poll, opciones: poll.opciones.filter((_, idx) => idx !== i) })
  }
  const setDur = (campo, val) => onChange({ ...poll, [campo]: Number(val) })

  return (
    <div className="poll-editor" onClick={e => e.stopPropagation()}>
      <div className="poll-editor-options">
        {poll.opciones.map((op, i) => (
          <div className="poll-option-row" key={i}>
            <input
              className="poll-option-input"
              type="text"
              maxLength={POLL_MAX_TEXTO}
              placeholder={`Opción ${i + 1}${i < POLL_MIN_OPC ? '' : ' (opcional)'}`}
              value={op}
              onChange={e => setOpcion(i, e.target.value)}
            />
            {poll.opciones.length > POLL_MIN_OPC && (
              <button
                type="button"
                className="poll-option-remove"
                title="Quitar opción"
                onClick={() => removeOpcion(i)}
              >
                <X size={15} />
              </button>
            )}
            {i === poll.opciones.length - 1 && poll.opciones.length < POLL_MAX_OPC && (
              <button
                type="button"
                className="poll-option-add"
                title="Agregar opción"
                onClick={addOpcion}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="poll-duration">
        <span className="poll-duration-label">Duración</span>
        <div className="poll-duration-selects">
          <label>
            <span>Días</span>
            <select value={poll.dias} onChange={e => setDur('dias', e.target.value)}>
              {rango(8).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>
            <span>Horas</span>
            <select value={poll.horas} onChange={e => setDur('horas', e.target.value)}>
              {rango(24).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>
            <span>Minutos</span>
            <select value={poll.minutos} onChange={e => setDur('minutos', e.target.value)}>
              {rango(60).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      <button type="button" className="poll-remove" onClick={onRemove}>
        Quitar encuesta
      </button>
    </div>
  )
}

export { nuevaEncuesta }
