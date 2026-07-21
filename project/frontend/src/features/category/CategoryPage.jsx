import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api/client'
import { TopicCard } from '../../components/shared/TopicCard'
import { CommentThread } from '../../components/shared/CommentThread'
import { CategoryIcon } from '../../components/shared/CategoryIcon'
import { IconPickerModal } from './IconPickerModal'
import { Modal } from '../../components/ui/Modal'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { Tag } from '../../components/ui/Tag'
import { TagSelector } from '../../components/ui/TagSelector'
import { CategoryDescriptionField } from './CategoryDescriptionField'
import { AccordionField } from '../../components/shared/AccordionField'
import { PreviewHint } from '../../components/shared/PreviewHint'
import { descriptionSummary, tagsSummary } from './categoryFieldSummary'
import { useSaved } from '../../hooks/useSaved'
import { BookmarkIcon } from '../../components/shared/BookmarkIcon'
import { BellIcon } from '../../components/shared/BellIcon'
import { PinIcon } from '../../components/shared/PinIcon'
import { ReadMore } from '../../components/ui/ReadMore'
import { timeAgo } from '../../utils/timeAgo'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { useToast } from '../../hooks/useToast'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { CreateTopicPanel } from '../topic/CreateTopicPanel'
import { ReportModal } from '../../components/shared/ReportModal'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { AttachmentButton, AttachmentPreviews } from '../../components/shared/AttachmentPicker'
import { PollButton, PollEditor } from '../../components/shared/PollEditor'
import { buildReplyFormData } from '../../utils/attachments'
import { nuevaEncuesta, pollValido } from '../../utils/poll'
import { trackCreateComment, trackSubscribeCategory } from '../../utils/analytics'
import './category.css'

// ── SKELETONS ──────────────────────────────────────────────────────────────────
function TopicSkeleton() {
  return (
    <>
      <div className="skeleton-card">
        <div className="skeleton" style={{ height: 11, width: '28%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 17, width: '65%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 12, width: '55%' }} />
      </div>
      <div className="skeleton-card">
        <div className="skeleton" style={{ height: 11, width: '22%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 17, width: '50%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 12, width: '45%' }} />
      </div>
    </>
  )
}

// ── CREATE COMMENT PANEL ───────────────────────────────────────────────────────
function CreateCommentPanel({ categoryId, user }) {
  const [open, setOpen] = useState(false)
  const [cuerpo, setCuerpo] = useState('')
  const [files, setFiles] = useState([])
  const [poll, setPoll] = useState(null)
  const { showToast } = useToast()
  const requireAuth = useRequireAuth()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => apiPost('/replies/create', buildReplyFormData(
      { cuerpo: cuerpo.trim(), categoria_id: categoryId },
      files,
      poll,
    )),
    onSuccess: (res) => {
      trackCreateComment('direct')
      if (res?.data?.advertencia) showToast(res.data.advertencia, 'error')
      else showToast('Comentario publicado', 'success')
      setOpen(false)
      setCuerpo('')
      setFiles([])
      setPoll(null)
      queryClient.invalidateQueries({ queryKey: ['replies', 'category', categoryId] })
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
          <span className="ct-placeholder">Publicar comentario</span>
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

// ── HISTORY MODAL BODY ─────────────────────────────────────────────────────────
function HistoryModalBody({ catId }) {
  const [idx, setIdx] = useState(0)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['category', catId, 'history'],
    queryFn: () => apiGet(`/categories/${catId}/history`).then(r => r.data),
  })

  if (isLoading) return <div className="history-empty">Cargando...</div>
  if (entries.length === 0) return <div className="history-empty">Esta categoría no tiene ediciones anteriores.</div>

  const entry = entries[idx]
  const total = entries.length

  return (
    <div className="history-carousel">
      <div className="history-header">
        <span>{idx + 1} de {total}</span>
        <span>{timeAgo(entry.fecha_edicion)}</span>
      </div>
      <div>
        <p className="history-label">Descripción anterior</p>
        <div className="history-text">{entry.descripcion_anterior}</div>
      </div>
      <div className="history-nav">
        <button
          className="history-arrow"
          disabled={idx >= total - 1}
          onClick={() => setIdx(i => i + 1)}
          aria-label="Anterior"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button
          className="history-arrow"
          disabled={idx <= 0}
          onClick={() => setIdx(i => i - 1)}
          aria-label="Siguiente"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── EDIT CATEGORY MODAL ────────────────────────────────────────────────────────
function EditCategoryModal({ cat, isOpen, onClose, onSaved }) {
  const [desc, setDesc] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  // Acordeón: 'desc' | 'tags' | null. Solo uno abierto a la vez. Arranca cerrado
  // (los paneles muestran el contenido precargado en su resumen).
  const [openField, setOpenField] = useState(null)
  const togglePanel = p => setOpenField(cur => (cur === p ? null : p))
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const { data: availableTags = {} } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const nameToId = useMemo(() => {
    const map = {}
    for (const tags of Object.values(availableTags)) {
      for (const t of tags) map[t.nombre] = t.id
    }
    return map
  }, [availableTags])

  useEffect(() => {
    if (isOpen && cat) {
      setDesc(cat.descripcion || '')
      setOpenField(null) // ambos acordeones arrancan cerrados
      const names = parseEtiquetas(cat.etiquetas)
      setSelectedTags(names.map(n => nameToId[n]).filter(Boolean))
    }
  }, [isOpen, nameToId]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: () => apiPatch(`/categories/${cat.id}`, {
      descripcion: desc.trim(),
      etiquetas: selectedTags,
    }),
    onSuccess: () => {
      showToast('Categoría actualizada', 'success')
      onClose()
      onSaved()
      queryClient.invalidateQueries({ queryKey: ['category', String(cat.id)] })
    },
    onError: (err) => {
      showToast(err.message || 'Error al guardar', 'error')
    },
  })

  const canSave = desc.trim().length >= 1 && selectedTags.length >= 1

  const saveBtn = (
    <button
      className="save-btn"
      type="button"
      disabled={!canSave || mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? 'Guardando...' : 'Guardar'}
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar categoría" headerAction={saveBtn} className="modal--wide">
      <div className="edit-body">
        <AccordionField
          open={openField === 'desc'}
          onToggle={() => togglePanel('desc')}
          title="Descripción"
          summary={descriptionSummary(desc)}
          hasContent={!!desc.trim()}
        >
          <CategoryDescriptionField
            key={isOpen ? 'open' : 'closed'}
            value={desc}
            onChange={setDesc}
            maxLength={750}
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
    </Modal>
  )
}

// ── CONFIRM DELETE MODAL ───────────────────────────────────────────────────────
function ConfirmDeleteModal({ isOpen, onClose, onConfirm, isPending }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="¿Eliminar categoría?">
      <div className="confirm-delete-body">
        <p>
          Esta acción es <strong>irreversible</strong>. Todo el contenido asociado
          dejará de ser accesible desde el feed y las búsquedas.
        </p>
        <div className="confirm-delete-actions">
          <button
            className="btn-danger"
            type="button"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Eliminando...' : 'Eliminar categoría'}
          </button>
          <button className="btn-ghost" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── PIN HOME MODAL (solo admin) ────────────────────────────────────────────────
// Mini modal que pregunta por cuánto tiempo fijar la categoría en el inicio.
const PIN_HOME_OPTIONS = [
  { dias: 3, label: '3 días' },
  { dias: 7, label: '1 semana' },
  { dias: 30, label: '1 mes' },
]

function PinHomeModal({ isOpen, onClose, onConfirm, isPending }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fijar en el inicio">
      <div className="pin-home-body">
        <p className="pin-home-desc">
          La categoría aparecerá primera en el inicio para todos los usuarios
          durante el tiempo elegido. Al vencer, se desancla automáticamente.
        </p>
        <div className="pin-home-options">
          {PIN_HOME_OPTIONS.map(opt => (
            <button
              key={opt.dias}
              className="pin-home-option"
              type="button"
              disabled={isPending}
              onClick={() => onConfirm(opt.dias)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export function CategoryPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isSaved, toggleSaved } = useSaved()

  const tabParam = searchParams.get('tab')
  const commentIdParam = searchParams.get('commentId')
  // Comentarios es el tab por defecto. Un deep-link explícito (?tab=temas o
  // ?tab=comentarios) igual respeta lo que pida la URL.
  const [activeTab, setActiveTab] = useState(tabParam === 'temas' ? 'temas' : 'comentarios')

  // Si llega ?tab=comentarios o ?tab=temas (p.ej. al clickear una notificación
  // estando ya en esta página), cambiamos de tab. El inicializador de useState
  // solo corre al montar, así que reaccionamos a cambios posteriores del param.
  useEffect(() => {
    if (tabParam === 'comentarios') setActiveTab('comentarios')
    else if (tabParam === 'temas') setActiveTab('temas')
  }, [tabParam])
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [pinHomeOpen, setPinHomeOpen] = useState(false)

  const { data: cat, isLoading: catLoading, isError } = useQuery({
    queryKey: ['category', id],
    queryFn: () => apiGet(`/categories/${id}`).then(r => r.data),
  })

  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ['replies', 'category', id],
    queryFn: () => apiGet(`/replies/category/${id}`).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/categories/${id}/delete`),
    onSuccess: (data) => {
      showToast(data?.message || 'Categoría eliminada', 'success')
      navigate('/')
    },
    onError: (err) => {
      showToast(err.message || 'Error al eliminar', 'error')
    },
  })

  const iconMutation = useMutation({
    mutationFn: (icono) => apiPatch(`/categories/${id}`, { icono }),
    onSuccess: () => {
      showToast('Ícono actualizado', 'success')
      setIconPickerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['category', id] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'index'] })
    },
    onError: (err) => showToast(err.message || 'Error al actualizar el ícono', 'error'),
  })

  // Fijar/desanclar (moderador): comentario directo y tema de la categoría.
  const pinCommentMutation = useMutation({
    mutationFn: (comment) => comment.fijado
      ? apiDelete(`/categories/${id}/pin/comentario`)
      : apiPost(`/categories/${id}/pin`, { tipo: 'comentario', item_id: comment.id }),
    onSuccess: (_data, comment) => {
      showToast(comment.fijado ? 'Comentario desanclado' : 'Comentario fijado', 'success')
      queryClient.invalidateQueries({ queryKey: ['replies', 'category', id] })
    },
    onError: (err) => showToast(err.message || 'No se pudo fijar', 'error'),
  })

  const pinTopicMutation = useMutation({
    mutationFn: (topic) => topic.fijado
      ? apiDelete(`/categories/${id}/pin/tema`)
      : apiPost(`/categories/${id}/pin`, { tipo: 'tema', item_id: topic.contenido_id }),
    onSuccess: (_data, topic) => {
      showToast(topic.fijado ? 'Tema desanclado' : 'Tema fijado', 'success')
      queryClient.invalidateQueries({ queryKey: ['category', id] })
    },
    onError: (err) => showToast(err.message || 'No se pudo fijar', 'error'),
  })

  // Suscripción (campanita): notificarse de temas y comentarios directos nuevos.
  const { data: subData } = useQuery({
    queryKey: ['category', id, 'subscription'],
    queryFn: () => apiGet(`/categories/${id}/subscription`).then(r => r.data),
    enabled: !!user,
  })
  const suscrito = !!subData?.suscrito

  const subscribeMutation = useMutation({
    mutationFn: () => suscrito
      ? apiDelete(`/categories/${id}/subscribe`)
      : apiPost(`/categories/${id}/subscribe`, {}),
    onSuccess: (res) => {
      // Solo la suscripción (activar la campanita) es el evento; cancelarla no.
      if (res.suscrito) trackSubscribeCategory()
      queryClient.setQueryData(['category', id, 'subscription'], { suscrito: !!res.suscrito })
      showToast(res.suscrito ? 'Te suscribiste a la categoría' : 'Cancelaste la suscripción', 'success')
    },
    onError: (err) => showToast(err.message || 'No se pudo actualizar la suscripción', 'error'),
  })

  // Fijar/desanclar la categoría en el Home (solo admin). Al cambiar el estado
  // refrescamos tanto el detalle como el feed del Home (prefijo 'categories').
  const pinHomeMutation = useMutation({
    mutationFn: (dias) => apiPost(`/categories/${id}/pin-home`, { dias }),
    onSuccess: () => {
      showToast('Categoría fijada en el inicio', 'success')
      setPinHomeOpen(false)
      queryClient.invalidateQueries({ queryKey: ['category', id] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (err) => showToast(err.message || 'No se pudo fijar la categoría', 'error'),
  })

  const unpinHomeMutation = useMutation({
    mutationFn: () => apiDelete(`/categories/${id}/pin-home`),
    onSuccess: () => {
      showToast('Categoría desanclada del inicio', 'success')
      queryClient.invalidateQueries({ queryKey: ['category', id] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (err) => showToast(err.message || 'No se pudo desanclar la categoría', 'error'),
  })

  if (catLoading) {
    return (
      <div>
        <div className="skeleton-card" style={{ marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 22, width: '40%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '50%' }} />
        </div>
        <TopicSkeleton />
      </div>
    )
  }

  if (isError || !cat) {
    return <div className="feed-empty">Categoría no encontrada.</div>
  }

  const isActive = cat.estado !== 'inactiva'
  const isOwner = !!(user && (user.id === cat.autor_id || user.rol === 'admin'))
  const isAdmin = user?.rol === 'admin'
  const etiquetas = parseEtiquetas(cat.etiquetas)
  const topicCount = cat.topics?.length ?? Number(cat.contador_temas) ?? 0
  const commentCount = replies.length

  const catGuardada = isSaved('categoria', cat.id)
  const dropdownItems = []

  dropdownItems.push(
    {
      label: catGuardada ? 'Quitar de guardados' : 'Guardar',
      icon: <BookmarkIcon filled={catGuardada} size={14} />,
      onClick: () => toggleSaved('categoria', cat.id),
    },
    {
      label: 'Reportar',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
      ),
      onClick: () => {
        if (user?.id == cat.autor_id) { showToast('No podés reportar tu propio contenido', 'error'); return }
        setReportOpen(true)
      },
    },
    {
      label: 'Historial de ediciones',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      onClick: () => setHistoryOpen(true),
    },
  )

  // Fijar en el inicio: opción exclusiva de administradores. Fija la categoría
  // primera en el Home por un tiempo (o la desancla si ya está fijada).
  if (isAdmin && isActive) {
    dropdownItems.push({
      label: cat.fijada ? 'Desanclar del inicio' : 'Fijar en el inicio',
      icon: <PinIcon filled={!!cat.fijada} size={14} />,
      onClick: () => {
        if (cat.fijada) unpinHomeMutation.mutate()
        else setPinHomeOpen(true)
      },
    })
  }

  // Eliminar: acción destructiva, directa desde el menú de tres puntos (antes
  // vivía dentro del modal de "Editar categoría"). Pasa por el ConfirmDeleteModal.
  if (isOwner && isActive) {
    dropdownItems.push({
      label: 'Eliminar categoría',
      danger: true,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      ),
      onClick: () => setDeleteOpen(true),
    })
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Navegación">
        <Link to="/">Inicio</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span>{isActive ? cat.titulo : 'Categoría inactiva'}</span>
      </nav>

      {/* Category header */}
      <div className="cat-header">
        {!isActive ? (
          <div className="cat-inactive-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="cat-inactive-text">
              <span className="cat-inactive-title">Esta categoría ya no está disponible</span>
              <span className="cat-inactive-desc">
                El contenido publicado se preserva por la{' '}
                <Link to="/about/policies" target="_blank" rel="noopener noreferrer">
                  política de preservación de contenido
                </Link>.
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="cat-header-top">
              {isOwner ? (
                <button
                  type="button"
                  className="cat-icon-wrap cat-icon-editable"
                  onClick={() => setIconPickerOpen(true)}
                  title="Cambiar ícono"
                  aria-label="Cambiar ícono de la categoría"
                >
                  <CategoryIcon name={cat.icono} size={28} />
                  <span className="cat-icon-edit-badge">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/>
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                    </svg>
                  </span>
                </button>
              ) : (
                <div className="cat-icon-wrap">
                  <CategoryIcon name={cat.icono} size={28} />
                </div>
              )}
              <div className="cat-header-info">
                <h1 className="cat-title">{cat.titulo}</h1>
                <p className="cat-desc"><ReadMore text={cat.descripcion} maxLength={500} /></p>
              </div>
              <DropdownMenu items={dropdownItems} />
            </div>

            {etiquetas.length > 0 && (
              <div className="cat-tags">
                {etiquetas.map(e => <Tag key={e} label={e} />)}
              </div>
            )}

            <div className="cat-meta">
              <span className="cat-meta-item">
                <strong>{topicCount}</strong> {topicCount === 1 ? 'tema' : 'temas'}
              </span>
              <span className="cat-meta-item">
                creada <strong>{timeAgo(cat.fecha_creacion)}</strong>
              </span>
              {user && user.id !== cat.autor_id && (
                <button
                  className={`cat-bell${suscrito ? ' active' : ''}`}
                  type="button"
                  title={suscrito ? 'Dejar de seguir esta categoría' : 'Seguir esta categoría'}
                  disabled={subscribeMutation.isPending}
                  onClick={() => subscribeMutation.mutate()}
                >
                  <BellIcon filled={suscrito} size={16} />
                </button>
              )}
              {isOwner && (
                <button className="btn-ghost" type="button" onClick={() => setEditOpen(true)}>
                  Editar categoría
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <nav className="section-tabs" role="tablist">
        <button
          className={`tab${activeTab === 'comentarios' ? ' active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'comentarios'}
          onClick={() => setActiveTab('comentarios')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Comentarios <span className="count">{commentCount}</span>
        </button>
        <button
          className={`tab${activeTab === 'temas' ? ' active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'temas'}
          onClick={() => setActiveTab('temas')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h10"/>
          </svg>
          Temas <span className="count">{topicCount}</span>
        </button>
      </nav>

      {/* Topics panel */}
      {activeTab === 'temas' && (
        <div className="section-panel">
          {isActive && <CreateTopicPanel categoryId={id} user={user} />}
          {catLoading ? (
            <TopicSkeleton />
          ) : !cat.topics || cat.topics.length === 0 ? (
            <div className="feed-empty">
              Todavía no hay temas en esta categoría. ¡Sé el primero en crear uno!
            </div>
          ) : (
            cat.topics.map(t => (
              <TopicCard
                key={t.contenido_id}
                topic={t}
                canPin={isOwner}
                onTogglePin={() => pinTopicMutation.mutate(t)}
              />
            ))
          )}
        </div>
      )}

      {/* Comments panel */}
      {activeTab === 'comentarios' && (
        <div className="section-panel">
          {isActive && <CreateCommentPanel categoryId={id} user={user} />}
          {repliesLoading ? (
            <div className="feed-empty">Cargando comentarios...</div>
          ) : (
            <CommentThread
              comments={replies}
              invalidateKey={['replies', 'category', id]}
              initialCommentId={commentIdParam}
              canPin={isOwner}
              onTogglePin={(c) => pinCommentMutation.mutate(c)}
              onInitialDrillDone={() => {
                searchParams.delete('commentId')
                searchParams.delete('tab')
                setSearchParams(searchParams, { replace: true })
              }}
            />
          )}
        </div>
      )}

      {/* Edit modal */}
      {isOwner && isActive && (
        <EditCategoryModal
          cat={cat}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['category', id] })}
        />
      )}

      {/* Confirm delete modal */}
      {isOwner && (
        <ConfirmDeleteModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate()}
          isPending={deleteMutation.isPending}
        />
      )}

      {/* Pin-home modal (solo admin) */}
      {isAdmin && (
        <PinHomeModal
          isOpen={pinHomeOpen}
          onClose={() => setPinHomeOpen(false)}
          onConfirm={(dias) => pinHomeMutation.mutate(dias)}
          isPending={pinHomeMutation.isPending}
        />
      )}

      {/* Report modal */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentId={id}
        contentType="category"
      />

      {/* History modal */}
      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Historial de ediciones"
      >
        {historyOpen && <HistoryModalBody catId={id} />}
      </Modal>

      {/* Icon picker modal (solo autor) */}
      {isOwner && (
        <IconPickerModal
          isOpen={iconPickerOpen}
          onClose={() => setIconPickerOpen(false)}
          current={cat.icono}
          onConfirm={(icono) => iconMutation.mutate(icono)}
          isPending={iconMutation.isPending}
        />
      )}
    </>
  )
}
