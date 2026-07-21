import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { trackCreateTopic } from '../../utils/analytics'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { TopicContentField } from './TopicContentField'
import { PreviewHint } from '../../components/shared/PreviewHint'
import { AccordionField } from '../../components/shared/AccordionField'
import { descriptionSummary } from '../category/categoryFieldSummary'

export function CreateTopicPanel({ categoryId, user }) {
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  // Acordeón de la descripción (mismo patrón que crear categoría). 'desc' | null.
  const [openField, setOpenField] = useState(null)
  const togglePanel = p => setOpenField(cur => (cur === p ? null : p))
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
      trackCreateTopic()
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
    setOpenField(null)
    mutation.reset()
  }

  function handleSubmit() {
    if (!requireAuth('Debes iniciar sesión para crear un tema')) return
    if (mutation.isPending) return
    // El botón nunca está deshabilitado: validamos acá y avisamos con un toast rojo
    // del PRIMER requisito que falle (mismo criterio que crear categoría).
    if (titulo.trim().length < 3) {
      showToast('El título debe contener al menos 3 caracteres', 'error')
      return
    }
    if (cuerpo.trim().length < 1) {
      showToast('La descripción debe contener al menos un carácter', 'error')
      return
    }
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
                <span>Título</span>
                <span className={`edit-field-counter${titulo.length >= 95 ? ' limit' : ''}`}>
                  {titulo.length} / 100
                </span>
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
            <AccordionField
              open={openField === 'desc'}
              onToggle={() => togglePanel('desc')}
              title="Descripción"
              summary={descriptionSummary(cuerpo)}
              hasContent={!!cuerpo.trim()}
            >
              <TopicContentField
                value={cuerpo}
                onChange={setCuerpo}
                maxLength={1000}
                placeholder="Desarrollá tu idea"
              />
            </AccordionField>
            {/* Nota fuera del perímetro del panel de descripción. */}
            {openField === 'desc' && <PreviewHint />}
          </div>
        </div>
        <div className="create-cat-panel-footer">
          <button className="cc-cancel" type="button" onClick={closePanel} disabled={mutation.isPending}>Cancelar</button>
          <button
            className="save-btn"
            type="button"
            onClick={handleSubmit}
          >
            {mutation.isPending ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>
    </section>
  )
}
