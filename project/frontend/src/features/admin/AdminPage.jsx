import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet } from '../../api/client'
import { UsersSection } from './UsersSection'
import { ContentSection } from './ContentSection'
import { AppealsSection } from './AppealsSection'
import { ReportsSection } from './ReportsSection'
import './admin.css'

const TABS = [
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'contenido', label: 'Contenido' },
  { key: 'apelaciones', label: 'Apelaciones' },
  { key: 'reportes', label: 'Reportes' },
]

export function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('usuarios')

  const { data: temaAppeals = [] } = useQuery({
    queryKey: ['appeals', 'pending', 'tema'],
    queryFn: () => apiGet('/appeals/pending?tipo=tema').then(r => r.data),
  })
  const { data: comentarioAppeals = [] } = useQuery({
    queryKey: ['appeals', 'pending', 'comentario'],
    queryFn: () => apiGet('/appeals/pending?tipo=comentario').then(r => r.data),
  })
  const { data: categoriaAppeals = [] } = useQuery({
    queryKey: ['appeals', 'pending', 'categoria'],
    queryFn: () => apiGet('/appeals/pending?tipo=categoria').then(r => r.data),
  })
  const { data: pendingReports = [] } = useQuery({
    queryKey: ['user-reports', 'pending'],
    queryFn: () => apiGet('/user-reports/pending').then(r => r.data),
  })

  const badgeCounts = {
    apelaciones: temaAppeals.length + comentarioAppeals.length + categoriaAppeals.length,
    reportes: pendingReports.length,
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Panel de Administración</h1>
        <span className="admin-subtitle">@{user?.nickname}</span>
      </div>

      <div className="admin-tabs">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`admin-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
            {badgeCounts[key] > 0 && (
              <span className="admin-badge">{badgeCounts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'usuarios' && <UsersSection />}
      {tab === 'contenido' && <ContentSection />}
      {tab === 'apelaciones' && <AppealsSection />}
      {tab === 'reportes' && <ReportsSection />}
    </div>
  )
}
