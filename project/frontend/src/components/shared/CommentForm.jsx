import { useState } from 'react'
import { AttachmentButton, AttachmentPreviews } from './AttachmentPicker'
import { PollButton, PollEditor } from './PollEditor'
import { nuevaEncuesta, pollValido } from '../../utils/poll'
import './CommentForm.css'

export function CommentForm({
  onSubmit,
  placeholder = 'Escribí tu respuesta',
  submitLabel = 'Responder',
  maxLength = 5000,
  minLength = 1,
  rows = 3,
  autoFocus = false,
  onCancel,
}) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [poll, setPoll] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Se puede enviar con texto, con adjuntos o con una encuesta válida.
  const canSubmit =
    text.trim().length >= minLength || files.length > 0 || pollValido(poll)

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(text.trim(), files, poll)
      setText('')
      setFiles([])
      setPoll(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="inline-reply-panel" onClick={e => e.stopPropagation()}>
      <div className="edit-field">
        <div className="edit-field-label">
          <span>{placeholder}</span>
          <span className="edit-field-counter">{text.length} / {maxLength}</span>
        </div>
        <textarea
          className="inline-reply-input"
          maxLength={maxLength}
          rows={rows}
          placeholder={placeholder}
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus={autoFocus}
        />
      </div>
      <AttachmentPreviews files={files} onChange={setFiles} />
      <PollEditor poll={poll} onChange={setPoll} onRemove={() => setPoll(null)} />
      <div className="inline-reply-actions">
        <AttachmentButton files={files} onChange={setFiles} disabled={submitting} />
        <PollButton active={!!poll} onActivate={() => setPoll(nuevaEncuesta())} disabled={submitting} />
        {onCancel && (
          <button className="cc-cancel" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          className="save-btn"
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Publicando...' : submitLabel}
        </button>
      </div>
    </div>
  )
}
