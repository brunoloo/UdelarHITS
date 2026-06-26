import { useState } from 'react'
import { AttachmentPicker } from './AttachmentPicker'
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
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = text.trim().length >= minLength

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(text.trim(), files)
      setText('')
      setFiles([])
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
      <AttachmentPicker files={files} onChange={setFiles} disabled={submitting} />
      <div className="inline-reply-actions">
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
