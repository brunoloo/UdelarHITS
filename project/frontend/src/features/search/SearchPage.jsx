import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api/client'
import { CategoryCardMini } from '../../components/shared/CategoryCardMini'
import { TopicCardMini } from '../../components/shared/TopicCardMini'
import { CommentEntry } from '../../components/shared/CommentEntry'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { buildReplyFormData } from '../../utils/attachments'
import { trackCreateComment } from '../../utils/analytics'
import { facultadBySigla } from '../../config/facultades'
import { Link } from 'react-router-dom'
import './SearchPage.css'

const LIMIT = 10
const MIN_CHARS = 2

// Extrae { before, match, after } de una fila; null si no matcheó en el texto.
const snippetOf = (r) =>
  r.snippet_match ? { before: r.snippet_before, match: r.snippet_match, after: r.snippet_after } : null

function sectionUrl(tipo, q, etiqueta, offset) {
  const p = new URLSearchParams({ q, tipo, limit: String(LIMIT), offset: String(offset) })
  if (etiqueta) p.set('etiqueta', etiqueta)
  return `/search?${p.toString()}`
}

// Hook por sección: paginación incremental ("ver más") sobre GET /api/search con
// `tipo`. getNextPageParam avanza el offset mientras el backend diga hasMore.
function useSection(tipo, q, etiqueta, enabled) {
  const query = useInfiniteQuery({
    queryKey: ['search', tipo, q, etiqueta],
    queryFn: ({ pageParam }) => apiGet(sectionUrl(tipo, q, etiqueta, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.data.hasMore ? pages.length * LIMIT : undefined),
    enabled,
    staleTime: 60 * 1000,
  })
  const items = query.data?.pages.flatMap(p => p.data.items) ?? []
  return { ...query, items }
}

function Section({ title, section, children }) {
  const { items, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = section
  if (!isLoading && items.length === 0) return null
  return (
    <section className="search-section">
      <h2 className="search-section-title">{title}</h2>
      {isLoading ? (
        <div className="search-loading">Buscando…</div>
      ) : (
        <>
          <div className="search-list">{items.map(children)}</div>
          {hasNextPage && (
            <button
              type="button"
              className="search-more"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const q = (searchParams.get('q') ?? '').trim()
  const etiqueta = (searchParams.get('etiqueta') ?? '').trim()
  const canSearch = q.length >= MIN_CHARS
  // Con etiqueta activa los usuarios no aplican (no heredan etiqueta): el backend
  // ya devuelve vacío, así que ni montamos esa query.
  const usersEnabled = canSearch && etiqueta === ''

  const cats = useSection('categorias', q, etiqueta, canSearch)
  const temas = useSection('temas', q, etiqueta, canSearch)
  const coments = useSection('comentarios', q, etiqueta, canSearch)
  const users = useSection('usuarios', q, etiqueta, usersEnabled)

  // Responder desde un resultado de comentario: publica y refresca la sección.
  const COMMENTS_KEY = ['search', 'comentarios', q, etiqueta]
  async function handleReply(parentId, text, files, poll) {
    const res = await apiPost('/replies/create',
      buildReplyFormData({ cuerpo: text, comentario_padre_id: parentId }, files, poll))
    trackCreateComment('reply')
    queryClient.invalidateQueries({ queryKey: COMMENTS_KEY })
    return res
  }

  const etiquetaLabel = etiqueta
    ? (facultadBySigla(etiqueta) ? etiqueta.toUpperCase() : etiqueta)
    : null

  if (!canSearch) {
    return (
      <div className="search-page">
        <p className="search-hint">Escribí al menos {MIN_CHARS} caracteres para buscar.</p>
      </div>
    )
  }

  const loading = cats.isLoading || temas.isLoading || coments.isLoading || (usersEnabled && users.isLoading)
  const totalItems =
    cats.items.length + temas.items.length + coments.items.length + users.items.length
  const empty = !loading && totalItems === 0

  return (
    <div className="search-page">
      <header className="search-head">
        <h1 className="search-heading">
          Resultados para “{q}”
          {etiquetaLabel && <span className="search-scope"> en {etiquetaLabel}</span>}
        </h1>
      </header>

      {empty ? (
        <p className="search-empty">No se encontraron resultados para “{q}”.</p>
      ) : (
        <>
          <Section title="Categorías" section={cats}>
            {c => (
              <CategoryCardMini key={`cat-${c.id}`} category={c} snippet={snippetOf(c)} />
            )}
          </Section>

          <Section title="Temas" section={temas}>
            {t => (
              <div key={`tema-${t.id}`} className="search-topic">
                <div className="search-result-context">en {t.categoria_titulo}</div>
                <TopicCardMini topic={t} snippet={snippetOf(t)} />
              </div>
            )}
          </Section>

          <Section title="Comentarios" section={coments}>
            {c => (
              <CommentEntry
                key={`com-${c.id}`}
                comment={c}
                invalidateKey={COMMENTS_KEY}
                onReply={handleReply}
              />
            )}
          </Section>

          {usersEnabled && (
            <Section title="Usuarios" section={users}>
              {u => (
                <Link key={`user-${u.nickname}`} to={`/user/${u.nickname}`} className="search-user">
                  <UserAvatar
                    className="search-user-avatar"
                    url_imagen={u.url_imagen}
                    nickname={u.nickname}
                    size="md"
                  />
                  <div className="search-user-info">
                    <div className="search-user-nick">@{u.nickname}</div>
                    <div className="search-user-name">{u.nombre}</div>
                  </div>
                </Link>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  )
}
