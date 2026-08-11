import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { apiPost } from '../../api/client'
import { UserAvatar } from './UserAvatar'
import { AttachmentButton, AttachmentPreviews } from './AttachmentPicker'
import { PollButton, PollEditor } from './PollEditor'
import { buildReplyFormData } from '../../utils/attachments'
import { nuevaEncuesta, pollValido } from '../../utils/poll'
import { trackCreateComment } from '../../utils/analytics'

// Compositor de comentario compartido (textarea + adjuntos + encuesta). Mismo
// componente que usa CategoryPage para "Publicar comentario"; se reutiliza en el
// Home pasando otro ámbito. `scopeFields` son los campos de ámbito que van al
// FormData (p. ej. { categoria_id } o { es_home: true }); `invalidateKey` es la
// query que se refresca al publicar; `source` alimenta el analytics.
export function CreateCommentPanel({
  scopeFields,
  invalidateKey,
  source = 'direct',
  placeholder = 'Publicar comentario',
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [cuerpo, setCuerpo] = useState('')
  const [files, setFiles] = useState([])
  const [poll, setPoll] = useState(null)
  const { showToast } = useToast()
  const requireAuth = useRequireAuth()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => apiPost('/replies/create', buildReplyFormData(
      { cuerpo: cuerpo.trim(), ...scopeFields },
      files,
      poll,
    )),
    onSuccess: (res) => {
      trackCreateComment(source)
      if (res?.data?.advertencia) showToast(res.data.advertencia, 'error')
      else showToast('Comentario publicado', 'success')
      setOpen(false)
      setCuerpo('')
      setFiles([])
      setPoll(null)
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: invalidateKey })
    },
    onError: (err) => {
      showToast(err.message || 'Error al publicar', 'error')
    },
  })

  function closePanel() {
    setOpen(false)
    setCuerpo('')
    setFiles([])
    setPoll(null)
    mutation.reset()
  }

  const canSubmit = cuerpo.trim().length >= 1 || files.length > 0 || pollValido(poll)

  function handleSubmit() {
    if (!requireAuth('Debes iniciar sesión para comentar')) return
    if (!canSubmit || mutation.isPending) return
    mutation.mutate()
  }

  const avatarContent = (
    <UserAvatar url_imagen={user?.url_imagen} nickname={user?.nickname} size={36} />
  )

  if (!open) {
    return (
      <section className="create-topic">
        <button className="create-topic-trigger" type="button" onClick={() => setOpen(true)}>
          <span className="ct-avatar ct-avatar-comment" aria-hidden="true">{avatarContent}</span>
          <span className="ct-placeholder">{placeholder}</span>
          <span className="ct-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Comentar
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className="create-topic">
      <div className="create-cat-panel open">
        <div className="create-cat-panel-body">
          <span className="ct-avatar ct-avatar-comment" aria-hidden="true">{avatarContent}</span>
          <div className="cc-form">
            <div className="edit-field">
              <div className="edit-field-label">
                <span>Comentario (*)</span>
                <span className="edit-field-counter">{cuerpo.length} / 5000</span>
              </div>
              <textarea
                maxLength={5000}
                rows={4}
                placeholder="Escribí tu comentario"
                value={cuerpo}
                onChange={e => setCuerpo(e.target.value)}
                autoFocus
              />
            </div>
            <AttachmentPreviews files={files} onChange={setFiles} />
            <PollEditor poll={poll} onChange={setPoll} onRemove={() => setPoll(null)} />
          </div>
        </div>
        <div className="create-cat-panel-footer">
          <AttachmentButton files={files} onChange={setFiles} disabled={mutation.isPending} className="attach-btn--indent" />
          <PollButton active={!!poll} onActivate={() => setPoll(nuevaEncuesta())} disabled={mutation.isPending} />
          <button className="cc-cancel" type="button" onClick={closePanel}>Cancelar</button>
          <button
            className="save-btn"
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={handleSubmit}
          >
            {mutation.isPending ? 'Publicando...' : 'Comentar'}
          </button>
        </div>
      </div>
    </section>
  )
}
