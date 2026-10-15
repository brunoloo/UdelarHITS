import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { apiGet, apiPost } from '../../api/client'
import { trackCreateCategory } from '../../utils/analytics'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { TagSelector } from '../../components/ui/TagSelector'
import { CategoryDescriptionField } from './CategoryDescriptionField'
import { AccordionField } from '../../components/shared/AccordionField'
import { PreviewHint } from '../../components/shared/PreviewHint'
import { descriptionSummary, tagsSummary } from './categoryFieldSummary'

// Modo `embedded` (compositor unificado del Home, HomeComposer): sin trigger ni
// <section>/borde/avatar propios — siempre abierto; el contenedor pone el marco y
// escucha él mismo 'open-create-category'. No se resetea al montar (el contenedor
// lo remonta con otra key para descartar lo escrito). `active` = pestaña visible
// (foco al título); `onClose` avisa al cancelar o crear.
export function CreateCategoryPanel({ embedded = false, active = true, onClose } = {}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const requireAuth = useRequireAuth()
  const queryClient = useQueryClient()

  const navigate = useNavigate()

  const [panelOpen, setPanelOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  // Acordeón: 'desc' | 'tags' | null. Solo uno abierto a la vez.
  const [openField, setOpenField] = useState(null)
  const togglePanel = p => setOpenField(cur => (cur === p ? null : p))
  const tituloRef = useRef(null)

  useEffect(() => {
    if (embedded && active) tituloRef.current?.focus()
  }, [embedded, active])

  const { data: availableTags = {} } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: data => apiPost('/categories/create', data),
    onSuccess: (res) => {
      trackCreateCategory()
      showToast('Categoría creada correctamente', 'success')
      // Cerramos el panel y limpiamos el formulario para que no quede abierto
      // de fondo al navegar.
      setPanelOpen(false)
      setTitulo('')
      setDescripcion('')
      setSelectedTags([])
      // Prefijo 'categories': refresca tanto el feed del Home como 'active'
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      // Mismo comportamiento que "crear tema": navegar directo a la categoría
      // recién creada (id que devuelve el backend).
      const newId = res?.data?.id
      onClose?.()
      if (newId) navigate(`/category/${encodeURIComponent(newId)}`)
    },
    onError: err => {
      showToast(err.message || 'Error al crear la categoría', 'error')
    },
  })

  function openPanel() {
    setTitulo('')
    setDescripcion('')
    setSelectedTags([])
    setOpenField(null) // ambos acordeones arrancan cerrados
    mutation.reset()
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    mutation.reset()
    onClose?.()
  }

  // El empty state del feed filtrado ("Crear la primera") abre este panel a
  // través de un evento, ya que vive en la misma página pero en otro componente.
  // Embebido: el listener lo maneja HomeComposer.
  useEffect(() => {
    if (embedded) return
    function onOpen() { openPanel() }
    window.addEventListener('open-create-category', onOpen)
    return () => window.removeEventListener('open-create-category', onOpen)
  }, [embedded])

  function handleSubmit() {
    if (!requireAuth('Debes iniciar sesión para crear una categoría')) return
    if (mutation.isPending) return
    // El botón nunca está deshabilitado: validamos acá y avisamos con un toast
    // rojo del PRIMER requisito que falle (en orden de aparición en el formulario).
    if (titulo.trim().length < 3) {
      showToast('El título debe contener al menos 3 caracteres', 'error')
      return
    }
    if (descripcion.trim().length < 1) {
      showToast('La descripción debe contener al menos un carácter', 'error')
      return
    }
    if (selectedTags.length < 1) {
      showToast('Debes seleccionar al menos una etiqueta', 'error')
      return
    }
    mutation.mutate({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      etiquetas: selectedTags,
    })
  }

  const formContent = (
    <div className="cc-form">
      <div className="edit-field">
        <div className="edit-field-label">
          <span>Título</span>
          <span className={`edit-field-counter${titulo.length >= 100 ? ' limit' : titulo.length >= 95 ? ' warn' : ''}`}>
            {titulo.length} / 100
          </span>
        </div>
        <input
          type="text"
          maxLength={100}
          placeholder="Ej: Tips para aprobar cálculo"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          ref={tituloRef}
          autoFocus={!embedded}
        />
      </div>
      <AccordionField
        open={openField === 'desc'}
        onToggle={() => togglePanel('desc')}
        title="Descripción"
        summary={descriptionSummary(descripcion)}
        hasContent={!!descripcion.trim()}
      >
        <CategoryDescriptionField
          value={descripcion}
          onChange={setDescripcion}
          maxLength={1000}
          placeholder="¿De qué va esta categoría?"
        />
      </AccordionField>
      {/* Nota fuera del perímetro del panel de descripción. */}
      {openField === 'desc' && <PreviewHint />}
      <AccordionField
        open={openField === 'tags'}
        onToggle={() => togglePanel('tags')}
        title="Etiquetas"
        summary={tagsSummary(selectedTags)}
        hasContent={selectedTags.length > 0}
      >
        <div className="edit-field">
          <div className="edit-field-label">
            <span />
            <span className="edit-field-counter">{selectedTags.length} / 10</span>
          </div>
          <TagSelector
            grouped={availableTags}
            selected={selectedTags}
            onChange={setSelectedTags}
          />
        </div>
      </AccordionField>
    </div>
  )

  const footer = (
    <div className="create-cat-panel-footer">
      <button
        className="cc-cancel"
        type="button"
        onClick={closePanel}
        disabled={mutation.isPending}
      >
        Cancelar
      </button>
      <button
        className="save-btn"
        type="button"
        onClick={handleSubmit}
      >
        {mutation.isPending ? 'Creando...' : 'Crear'}
      </button>
    </div>
  )

  if (embedded) {
    return (
      <div className="hc-pane">
        <div className="create-cat-panel-body">{formContent}</div>
        {footer}
      </div>
    )
  }

  return (
    <section className="create-cat" aria-label="Crear nueva categoría">
      {!panelOpen ? (
        <button className="create-cat-trigger" type="button" onClick={openPanel}>
          <span className="cc-avatar" aria-hidden="true">
            <UserAvatar url_imagen={user?.url_imagen} nickname={user?.nickname} size={36} />
          </span>
          <span className="cc-placeholder">Crear una nueva categoría</span>
          <span className="cc-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nueva
          </span>
        </button>
      ) : (
        <div className="create-cat-panel open">
          <div className="create-cat-panel-body">
            <span className="cc-avatar" aria-hidden="true">
              <UserAvatar url_imagen={user?.url_imagen} nickname={user?.nickname} size={36} />
            </span>
            {formContent}
          </div>
          {footer}
        </div>
      )}
    </section>
  )
}
