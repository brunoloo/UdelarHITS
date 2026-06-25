import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '../../api/client'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-UY', { year: 'numeric', month: 'short', day: 'numeric' })
}

function UsersSkeleton() {
  return (
    <div className="admin-skeleton">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="admin-skeleton-row">
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
          <div className="skeleton" style={{ width: '12%', height: 13 }} />
          <div className="skeleton" style={{ width: '16%', height: 13 }} />
          <div className="skeleton" style={{ width: '22%', height: 13 }} />
          <div className="skeleton" style={{ width: 40, height: 20, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 50, height: 20, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: '12%', height: 13 }} />
          <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 6, marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  )
}

export function UsersSection() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [confirm, setConfirm] = useState(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiGet('/users/').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ nickname, action }) => apiPatch(`/users/${nickname}/${action}`),
    onSuccess: (_, { action }) => {
      showToast(action === 'ban' ? 'Usuario suspendido' : 'Usuario activado', 'success')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: err => showToast(err.message || 'Error al actualizar usuario', 'error'),
  })

  const filtered = users.filter(u => {
    if (estadoFilter !== 'todos' && u.estado !== estadoFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return u.nickname?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="admin-section">
      <div className="admin-filters">
        <input
          className="admin-search"
          type="text"
          autoComplete="off"
          placeholder="Buscar por nickname o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="admin-select"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="ban">Suspendidos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {isLoading ? (
        <UsersSkeleton />
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No se encontraron usuarios.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Nickname</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <UserAvatar url_imagen={u.url_imagen} nickname={u.nickname} size={32} />
                  </td>
                  <td className="admin-nick">
                    <Link
                      to={`/user/${encodeURIComponent(u.nickname)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-nick-link"
                    >
                      @{u.nickname}
                    </Link>
                  </td>
                  <td>{u.nombre || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`admin-status admin-status--${u.rol}`}>{u.rol}</span>
                  </td>
                  <td>
                    <span className={`admin-status admin-status--${u.estado}`}>{u.estado}</span>
                  </td>
                  <td>{formatDate(u.fecha_creacion)}</td>
                  <td>
                    <div className="admin-actions-cell">
                      {u.estado === 'activo' && (
                        <button
                          className="admin-btn admin-btn--danger"
                          onClick={() => setConfirm({ user: u, action: 'ban' })}
                        >
                          Suspender
                        </button>
                      )}
                      {u.estado === 'ban' && (
                        <button
                          className="admin-btn admin-btn--success"
                          onClick={() => setConfirm({ user: u, action: 'active' })}
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => mutation.mutate({ nickname: confirm.user.nickname, action: confirm.action })}
        title={confirm?.action === 'ban' ? '¿Suspender usuario?' : '¿Activar usuario?'}
        message={
          confirm?.action === 'ban'
            ? `¿Estás seguro de que querés suspender a @${confirm?.user?.nickname}?`
            : `¿Estás seguro de que querés activar a @${confirm?.user?.nickname}?`
        }
        confirmText={confirm?.action === 'ban' ? 'Suspender' : 'Activar'}
        danger={confirm?.action === 'ban'}
      />
    </div>
  )
}
