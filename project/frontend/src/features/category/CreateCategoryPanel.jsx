import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { apiGet, apiPost } from '../../api/client'

export function CreateCategoryPanel() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [panelOpen, setPanelOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [selectedTags, setSelectedTags] = useState([])

  const { data: availableTags = [] } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: data => apiPost('/categories/create', data),
    onSuccess: () => {
      showToast('Categoría creada correctamente', 'success')
      setPanelOpen(false)
      setTitulo('')
      setDescripcion('')
      setSelectedTags([])
      queryClient.invalidateQueries({ queryKey: ['categories', 'active'] })
    },
    onError: err => {
      showToast(err.message || 'Error al crear la categoría', 'error')
    },
  })

  const isFormValid =
    titulo.trim().length >= 3 && descripcion.trim().length >= 1 && selectedTags.length >= 1

  function openPanel() {
    setTitulo('')
    setDescripcion('')
    setSelectedTags([])
    mutation.reset()
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    mutation.reset()
  }

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length < 10 ? [...prev, tag] : prev
    )
  }

  function handleSubmit() {
    if (!isFormValid || mutation.isPending) return
    mutation.mutate({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      etiquetas: selectedTags,
    })
  }

  return (
    <section className="create-cat" aria-label="Crear nueva categoría">
      {!panelOpen ? (
        <button className="create-cat-trigger" type="button" onClick={openPanel}>
          <span className="cc-avatar" aria-hidden="true">
            <img
              src={user.url_imagen || '/assets/default-user.jpg'}
              alt={user.nickname}
              onError={e => { e.currentTarget.src = '/assets/default-user.jpg' }}
            />
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
              <img
                src={user.url_imagen || '/assets/default-user.jpg'}
                alt={user.nickname}
                onError={e => { e.currentTarget.src = '/assets/default-user.jpg' }}
              />
            </span>
            <div className="cc-form">
              <div className="edit-field">
                <div className="edit-field-label">
                  <span>Título (mínimo 3 caracteres*)</span>
                  <span className={`edit-field-counter${titulo.length >= 95 ? ' limit' : ''}`}>
                    {titulo.length} / 100
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="Ej: Tips para aprobar cálculo"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="edit-field">
                <div className="edit-field-label">
                  <span>Descripción (*)</span>
                  <span className={`edit-field-counter${descripcion.length >= 480 ? ' limit' : ''}`}>
                    {descripcion.length} / 500
                  </span>
                </div>
                <textarea
                  maxLength={500}
                  rows={3}
                  placeholder="¿De qué va esta categoría?"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                />
              </div>
              <div className="edit-field">
                <div className="edit-field-label">
                  <span>Etiquetas (*)</span>
                  <span className="edit-field-counter">{selectedTags.length} / 10</span>
                </div>
                <div className="tags-selector">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag-option${selectedTags.includes(tag) ? ' selected' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
              disabled={!isFormValid || mutation.isPending}
              onClick={handleSubmit}
            >
              {mutation.isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
