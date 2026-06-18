import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { UserAvatar } from '../../components/shared/UserAvatar'

export function CreateTopicPanel({ categoryId, user }) {
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const { showToast } = useToast()
  const requireAuth = useRequireAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => apiPost('/topics/create', {
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      categoria_id: categoryId,
    }),
    onSuccess: (data) => {
      showToast('Tema creado correctamente', 'success')
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] })
      const topicId = data?.data?.contenido_id || data?.data?.id
      if (topicId) {
        navigate(`/topic/${encodeURIComponent(topicId)}`)
      } else {
        setOpen(false)
        setTitulo('')
        setCuerpo('')
      }
    },
    onError: (err) => {
      showToast(err.message || 'Error al crear el tema', 'error')
    },
  })

  function closePanel() {
    setOpen(false)
    setTitulo('')
    setCuerpo('')
    mutation.reset()
  }

  const canSubmit = titulo.trim().length >= 3 && cuerpo.trim().length >= 1

  function handleSubmit() {
    if (!requireAuth('Iniciá sesión para crear un tema')) return
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
          <span className="ct-avatar" aria-hidden="true">{avatarContent}</span>
          <span className="ct-placeholder">Crear un nuevo tema</span>
          <span className="ct-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nuevo tema
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className="create-topic">
      <div className="create-cat-panel open">
        <div className="create-cat-panel-body">
          <span className="ct-avatar" aria-hidden="true">{avatarContent}</span>
          <div className="cc-form">
            <div className="edit-field">
              <div className="edit-field-label">
                <span>Título (mínimo 3 caracteres*)</span>
                <span className="edit-field-counter">{titulo.length} / 100</span>
              </div>
              <input
                type="text"
                maxLength={100}
                placeholder="¿De qué querés hablar?"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                autoFocus
              />
            </div>
            <div className="edit-field">
              <div className="edit-field-label">
                <span>Contenido (*)</span>
                <span className="edit-field-counter">{cuerpo.length} / 750</span>
              </div>
              <textarea
                maxLength={750}
                rows={4}
                placeholder="Desarrollá tu idea"
                value={cuerpo}
                onChange={e => setCuerpo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="create-cat-panel-footer">
          <button className="cc-cancel" type="button" onClick={closePanel}>Cancelar</button>
          <button
            className="save-btn"
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={handleSubmit}
          >
            {mutation.isPending ? 'Creando...' : 'Crear tema'}
          </button>
        </div>
      </div>
    </section>
  )
}
