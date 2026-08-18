import { useSearchParams, Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { SearchSnippet } from '../../components/shared/SearchSnippet'
import { commentPermalink } from '../../utils/commentPermalink'
import { facultadBySigla } from '../../config/facultades'
import './SearchPage.css'

const LIMIT = 10
const MIN_CHARS = 2

// Arma el querystring para una sección concreta del buscador unificado.
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
    <section className="sp-section">
      <h2 className="sp-section-title">{title}</h2>
      {isLoading ? (
        <div className="sp-loading">Buscando…</div>
      ) : (
        <>
          <ul className="sp-list">{items.map(children)}</ul>
          {hasNextPage && (
            <button
              type="button"
              className="sp-more"
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

  const etiquetaLabel = etiqueta
    ? (facultadBySigla(etiqueta) ? etiqueta.toUpperCase() : etiqueta)
    : null

  if (!canSearch) {
    return (
      <div className="sp-page">
        <p className="sp-hint">Escribí al menos {MIN_CHARS} caracteres para buscar.</p>
      </div>
    )
  }

  const loading = cats.isLoading || temas.isLoading || coments.isLoading || (usersEnabled && users.isLoading)
  const totalItems =
    cats.items.length + temas.items.length + coments.items.length + users.items.length
  const empty = !loading && totalItems === 0

  return (
    <div className="sp-page">
      <header className="sp-head">
        <h1 className="sp-heading">
          Resultados para “{q}”
          {etiquetaLabel && <span className="sp-scope"> en {etiquetaLabel}</span>}
        </h1>
      </header>

      {empty ? (
        <p className="sp-empty">No se encontraron resultados para “{q}”.</p>
      ) : (
        <>
          <Section title="Categorías" section={cats}>
            {c => (
              <li key={`cat-${c.id}`} className="sp-item">
                <Link to={`/category/${c.id}`} className="sp-item-link">
                  <div className="sp-item-title">{c.titulo}</div>
                  <div className="sp-item-sub">
                    {c.snippet_match
                      ? <SearchSnippet before={c.snippet_before} match={c.snippet_match} after={c.snippet_after} />
                      : `${Number(c.contador_temas) || 0} temas`}
                  </div>
                </Link>
              </li>
            )}
          </Section>

          <Section title="Temas" section={temas}>
            {t => (
              <li key={`tema-${t.id}`} className="sp-item">
                <Link to={`/topic/${t.id}`} className="sp-item-link">
                  <div className="sp-item-title">{t.titulo}</div>
                  <div className="sp-item-sub">
                    {t.snippet_match
                      ? <SearchSnippet before={t.snippet_before} match={t.snippet_match} after={t.snippet_after} />
                      : <span className="sp-muted">en {t.categoria_titulo}</span>}
                  </div>
                  <div className="sp-item-meta">
                    {Number(t.contador_comentarios) || 0} comentarios · en {t.categoria_titulo}
                  </div>
                </Link>
              </li>
            )}
          </Section>

          <Section title="Comentarios" section={coments}>
            {c => (
              <li key={`com-${c.id}`} className="sp-item">
                <Link
                  to={commentPermalink({ tipo: c.tipo, id: c.id, destino_id: c.destino_id })}
                  className="sp-item-link sp-item-link--comment"
                >
                  <UserAvatar
                    className="sp-item-avatar"
                    url_imagen={c.autor_url_imagen && /^https?:\/\//i.test(c.autor_url_imagen) ? c.autor_url_imagen : null}
                    nickname={c.autor_nickname}
                    size={32}
                  />
                  <div className="sp-item-body">
                    <div className="sp-item-title">@{c.autor_nickname}</div>
                    <div className="sp-item-sub">
                      <SearchSnippet before={c.snippet_before} match={c.snippet_match} after={c.snippet_after} />
                    </div>
                    <div className="sp-item-meta">
                      {c.tipo === 'home' ? 'en Home' : `en ${c.destino_titulo}`} · {Number(c.likes) || 0} me gusta
                    </div>
                  </div>
                </Link>
              </li>
            )}
          </Section>

          {usersEnabled && (
            <Section title="Usuarios" section={users}>
              {u => (
                <li key={`user-${u.nickname}`} className="sp-item">
                  <Link to={`/user/${u.nickname}`} className="sp-item-link sp-item-link--comment">
                    <UserAvatar
                      className="sp-item-avatar"
                      url_imagen={u.url_imagen && /^https?:\/\//i.test(u.url_imagen) ? u.url_imagen : null}
                      nickname={u.nickname}
                      size={32}
                    />
                    <div className="sp-item-body">
                      <div className="sp-item-title">@{u.nickname}</div>
                      <div className="sp-item-sub">{u.nombre}</div>
                    </div>
                  </Link>
                </li>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  )
}
