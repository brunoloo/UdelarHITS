import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiDelete } from '../../api/client'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-UY', { year: 'numeric', month: 'short', day: 'numeric' })
}

function TableSkeleton({ cols = 5 }) {
  return (
    <div className="admin-skeleton">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="admin-skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton" style={{ height: 14, flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function CategoriesTab() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [confirm, setConfirm] = useState(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => apiGet('/categories/').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => apiDelete(`/categories/${id}/delete`),
    onSuccess: () => {
      showToast('Categoría eliminada', 'success')
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: err => showToast(err.message || 'Error al eliminar categoría', 'error'),
  })

  const filtered = categories.filter(c =>
    estadoFilter === 'todos' || c.estado === estadoFilter
  )

  return (
    <div>
      <div className="admin-filters">
        <select
          className="admin-select"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activas</option>
          <option value="inactivo">Inactivas</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No se encontraron categorías.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Autor</th>
                <th>Estado</th>
                <th>Creada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>{c.titulo}</td>
                  <td className="admin-nick">@{c.autor_nickname}</td>
                  <td>
                    <span className={`admin-status admin-status--${c.estado}`}>{c.estado}</span>
                  </td>
                  <td>{formatDate(c.fecha_creacion)}</td>
                  <td>
                    <div className="admin-actions-cell">
                      <Link
                        to={`/category/${c.id}`}
                        className="admin-btn admin-btn--ghost"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver
                      </Link>
                      <button
                        className="admin-btn admin-btn--danger"
                        onClick={() => setConfirm(c)}
                      >
                        Eliminar
                      </button>
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
        onConfirm={() => deleteMutation.mutate(confirm.id)}
        title="¿Eliminar categoría?"
        message={`¿Eliminar "${confirm?.titulo}"? Esta acción es irreversible.`}
        confirmText="Eliminar"
        danger
      />
    </div>
  )
}

function TopicsTab() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [confirm, setConfirm] = useState(null)

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['admin', 'topics'],
    queryFn: () => apiGet('/topics/').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => apiDelete(`/topics/${id}/delete`),
    onSuccess: () => {
      showToast('Tema eliminado', 'success')
      queryClient.invalidateQueries({ queryKey: ['admin', 'topics'] })
    },
    onError: err => showToast(err.message || 'Error al eliminar tema', 'error'),
  })

  const filtered = topics.filter(t =>
    estadoFilter === 'todos' || t.estado === estadoFilter
  )

  return (
    <div>
      <div className="admin-filters">
        <select
          className="admin-select"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No se encontraron temas.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Autor</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>{t.titulo}</td>
                  <td className="admin-nick">@{t.autor_nickname}</td>
                  <td>
                    <span className={`admin-status admin-status--${t.estado}`}>{t.estado}</span>
                  </td>
                  <td>{formatDate(t.fecha_creacion)}</td>
                  <td>
                    <div className="admin-actions-cell">
                      <Link
                        to={`/topic/${t.id}`}
                        className="admin-btn admin-btn--ghost"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver
                      </Link>
                      <button
                        className="admin-btn admin-btn--danger"
                        onClick={() => setConfirm(t)}
                      >
                        Eliminar
                      </button>
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
        onConfirm={() => deleteMutation.mutate(confirm.id)}
        title="¿Eliminar tema?"
        message={`¿Eliminar "${confirm?.titulo}"? Esta acción es irreversible.`}
        confirmText="Eliminar"
        danger
      />
    </div>
  )
}

export function ContentSection() {
  const [subTab, setSubTab] = useState('categorias')

  return (
    <div className="admin-section">
      <div className="admin-subtabs">
        <button
          className={`admin-subtab${subTab === 'categorias' ? ' active' : ''}`}
          onClick={() => setSubTab('categorias')}
        >
          Categorías
        </button>
        <button
          className={`admin-subtab${subTab === 'temas' ? ' active' : ''}`}
          onClick={() => setSubTab('temas')}
        >
          Temas
        </button>
      </div>

      {subTab === 'categorias' ? <CategoriesTab /> : <TopicsTab />}
    </div>
  )
}
