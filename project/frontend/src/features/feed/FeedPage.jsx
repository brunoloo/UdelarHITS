import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { apiGet, apiPost } from '../../api/client'
import { CategoryCard } from '../../components/shared/CategoryCard'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import './feed.css'

function CategorySkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ height: 11, width: '28%', marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 17, width: '65%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 4 }} />
      <div className="skeleton" style={{ height: 12, width: '55%' }} />
    </div>
  )
}

export function FeedPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q')

  const [panelOpen, setPanelOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
  })

  const { data: availableTags = [] } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
    enabled: !!user,
  })

  // Client-side filter when ?q= is present (tag or title match)
  const displayCategories = qParam
    ? categories.filter(c =>
        parseEtiquetas(c.etiquetas).some(e => e.toLowerCase() === qParam.toLowerCase()) ||
        c.titulo.toLowerCase().split(/\s+/).some(w => w.startsWith(qParam.toLowerCase()))
      )
    : categories

  const isFormValid =
    titulo.trim().length >= 3 && descripcion.trim().length >= 1 && selectedTags.length >= 1

  function openPanel() {
    setTitulo('')
    setDescripcion('')
    setSelectedTags([])
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
  }

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length < 10 ? [...prev, tag] : prev
    )
  }

  async function handleSubmit() {
    if (!isFormValid || submitting) return
    setSubmitting(true)
    try {
      await apiPost('/categories/create', {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        etiquetas: selectedTags,
      })
      showToast('Categoría creada correctamente', 'success')
      closePanel()
      queryClient.invalidateQueries({ queryKey: ['categories', 'active'] })
    } catch (err) {
      showToast(err.message || 'Error al crear la categoría', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="feed-page">
      {user && (
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
                <button className="cc-cancel" type="button" onClick={closePanel}>
                  Cancelar
                </button>
                <button
                  className="save-btn"
                  type="button"
                  disabled={!isFormValid || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="categories-feed">
        {isLoading ? (
          <>
            <CategorySkeleton />
            <CategorySkeleton />
            <CategorySkeleton />
          </>
        ) : displayCategories.length === 0 ? (
          <div className="feed-empty">
            {qParam
              ? `No se encontraron categorías para "${qParam}".`
              : 'No se encontraron categorías.'}
          </div>
        ) : (
          displayCategories.map(c => <CategoryCard key={c.id} category={c} />)
        )}
      </div>
    </div>
  )
}
