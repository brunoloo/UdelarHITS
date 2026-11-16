import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '../../api/client'
import { HOME_FEED_KEY } from '../../api/queryKeys'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { CategoryIcon } from '../../components/shared/CategoryIcon'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { FollowButton } from '../../components/shared/FollowButton'
import { categoryStats } from '../../utils/categoryStats'
import { categoryPath } from '../../utils/slug'
import { trackSubscribeCategory } from '../../utils/analytics'
import { sugerirCategorias } from './sugerirCategorias'
import '../../components/shared/FollowButton.css'
import './onboarding.css'

const MAX_USUARIOS = 6

// Paso opcional después del registro: seguir categorías y personas para que el inicio
// y las notificaciones tengan algo propio desde el primer día. Se puede saltear.
export function OnboardingPage() {
  useDocumentTitle()
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [seguidas, setSeguidas] = useState(() => new Set())

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categories', 'index'],
    queryFn: () => apiGet('/categories/index').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  // Misma key y mismo pedido que Explorar: FollowButton la invalida al seguir.
  const { data: usuarios = [] } = useQuery({
    queryKey: ['users', 'suggested'],
    queryFn: () => apiGet('/users/suggested?limit=12').then(r => r.data),
  })

  const sugeridas = useMemo(
    () => sugerirCategorias(categorias, user?.facultad),
    [categorias, user?.facultad],
  )

  const subscribeMutation = useMutation({
    mutationFn: ({ id, seguir }) => seguir
      ? apiPost(`/categories/${id}/subscribe`, {})
      : apiDelete(`/categories/${id}/subscribe`),
    onSuccess: (_res, { id, seguir }) => {
      if (seguir) trackSubscribeCategory()
      setSeguidas(prev => {
        const next = new Set(prev)
        if (seguir) next.add(id)
        else next.delete(id)
        return next
      })
      // La suscripción pesa en el orden del inicio y se muestra en la página de la categoría.
      queryClient.invalidateQueries({ queryKey: HOME_FEED_KEY })
      queryClient.invalidateQueries({ queryKey: ['category', String(id), 'subscription'] })
    },
    onError: (err) => showToast(err.message || 'No se pudo actualizar la suscripción', 'error'),
  })

  return (
    <div className="onboarding-page">
      <h1 className="onboarding-title">
        {user?.nickname ? `¡Bienvenido/a, ${user.nickname}!` : '¡Bienvenido/a!'}
      </h1>
      <p className="onboarding-subtitle">
        Seguí lo que te interese: vas a recibir un aviso cuando haya algo nuevo y tu inicio lo va a mostrar primero.
      </p>

      <section className="onboarding-section">
        <h2 className="onboarding-section-title">Categorías para seguir</h2>
        {isLoading ? (
          <p className="onboarding-hint">Cargando categorías...</p>
        ) : sugeridas.length === 0 ? (
          <p className="onboarding-hint">Todavía no hay categorías. Podés crear la primera desde el inicio.</p>
        ) : (
          <ul className="onboarding-list">
            {sugeridas.map(c => {
              const siguiendo = seguidas.has(c.id)
              const stats = categoryStats(c.contador_temas, c.contador_comentarios)
              const pendiente = subscribeMutation.isPending && subscribeMutation.variables?.id === c.id
              return (
                <li key={c.id} className="onboarding-item">
                  <div className="onboarding-item-icon">
                    <CategoryIcon name={c.icono} size={18} />
                  </div>
                  <div className="onboarding-item-body">
                    <Link className="onboarding-item-title" to={categoryPath(c.id, c.titulo)}>{c.titulo}</Link>
                    {c.descripcion && <div className="onboarding-item-desc">{c.descripcion}</div>}
                    {(c.deMiFacultad || stats) && (
                      <div className="onboarding-item-meta">
                        {[c.deMiFacultad ? 'De tu facultad' : null, stats].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`btn-follow${siguiendo ? ' btn-follow--siguiendo' : ''}`}
                    aria-pressed={siguiendo}
                    disabled={pendiente}
                    onClick={() => subscribeMutation.mutate({ id: c.id, seguir: !siguiendo })}
                  >
                    {siguiendo ? 'Siguiendo' : 'Seguir'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {usuarios.length > 0 && (
        <section className="onboarding-section">
          <h2 className="onboarding-section-title">Personas de la comunidad</h2>
          <ul className="onboarding-list">
            {usuarios.slice(0, MAX_USUARIOS).map(u => (
              <li key={u.nickname} className="onboarding-item">
                <UserAvatar url_imagen={u.url_imagen} nickname={u.nickname} size={36} />
                <div className="onboarding-item-body">
                  <Link className="onboarding-item-title" to={`/user/${encodeURIComponent(u.nickname)}`}>
                    @{u.nickname}
                  </Link>
                  {u.nombre && <div className="onboarding-item-desc">{u.nombre}</div>}
                </div>
                <FollowButton nickname={u.nickname} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="onboarding-actions">
        <Link className="onboarding-continue" to="/" replace>Ir al inicio</Link>
      </div>
    </div>
  )
}
