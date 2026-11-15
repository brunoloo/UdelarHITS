import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { HOME_FEED_KEY, COMMUNITY_STATS_KEY } from '../../api/queryKeys'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { CreateCommentPanel } from '../../components/shared/CreateCommentPanel'
import { CreateCategoryPanel } from '../category/CreateCategoryPanel'
import '../../components/shared/CreatePanel.css'
import './HomeComposer.css'

// Una sola caja para publicar un comentario o crear una categoría. Los dos paneles quedan
// montados mientras está abierta, para no perder lo escrito al cambiar de pestaña;
// `session` es su key y cerrarla los remonta vacíos.

const TABS = [
  { id: 'comentario', label: 'Comentario' },
  { id: 'categoria', label: 'Categoría' },
]

function CommentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function CategoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

const ICONS = { comentario: CommentIcon, categoria: CategoryIcon }

export function HomeComposer() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('comentario')
  const [session, setSession] = useState(0)

  function openOn(t) {
    setTab(t)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setSession(s => s + 1)
  }

  // El estado vacío del feed abre la caja directo en Categoría, sin borrar lo escrito.
  useEffect(() => {
    function onOpen() { openOn('categoria') }
    window.addEventListener('open-create-category', onOpen)
    return () => window.removeEventListener('open-create-category', onOpen)
  }, [])

  // Llena su contenedor: con un tamaño fijo, en mobile quedaba descentrado.
  const avatar = (
    <UserAvatar url_imagen={user?.url_imagen} nickname={user?.nickname} size={36} style={{ width: '100%', height: '100%' }} />
  )

  if (!open) {
    return (
      <section className="create-topic home-composer" aria-label="Publicar en el inicio">
        <button className="create-topic-trigger" type="button" onClick={() => openOn('comentario')}>
          <span className="ct-avatar" aria-hidden="true">{avatar}</span>
          <span className="ct-placeholder">¿En qué estás pensando?</span>
          <span className="ct-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Publicar
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className="create-topic home-composer" aria-label="Publicar en el inicio">
      <div className="create-cat-panel open">
        <div className="hc-head">
          <span className="ct-avatar hc-avatar" aria-hidden="true">{avatar}</span>
          <div className="hc-head-main">
            <div className="hc-switch" role="tablist" aria-label="Tipo de publicación">
              {TABS.map(t => {
                const Icon = ICONS[t.id]
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`hc-tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls={`hc-panel-${t.id}`}
                    className="hc-switch-opt"
                    onClick={() => setTab(t.id)}
                  >
                    <Icon />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div
          role="tabpanel"
          id="hc-panel-comentario"
          aria-labelledby="hc-tab-comentario"
          hidden={tab !== 'comentario'}
        >
          <CreateCommentPanel
            key={session}
            embedded
            active={tab === 'comentario'}
            onClose={close}
            scopeFields={{ es_home: true }}
            invalidateKey={HOME_FEED_KEY}
            invalidateKeys={[COMMUNITY_STATS_KEY]}
          />
        </div>
        <div
          role="tabpanel"
          id="hc-panel-categoria"
          aria-labelledby="hc-tab-categoria"
          hidden={tab !== 'categoria'}
        >
          <CreateCategoryPanel
            key={session}
            embedded
            active={tab === 'categoria'}
            onClose={close}
          />
        </div>
      </div>
    </section>
  )
}
