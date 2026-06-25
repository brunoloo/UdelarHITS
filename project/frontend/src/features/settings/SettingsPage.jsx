import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { apiPatch } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { ChangePasswordModal } from './ChangePasswordModal'
import './settings.css'

const TABS = [
  {
    id: 'apariencia',
    label: 'Apariencia',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>
        <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
        <path d="M2 12h2"/><path d="M20 12h2"/>
        <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
      </svg>
    ),
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    id: 'privacidad',
    label: 'Privacidad',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'notificaciones',
    label: 'Notificaciones',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/>
        <path d="M10 21a2 2 0 0 0 4 0"/>
      </svg>
    ),
  },
  {
    id: 'acerca',
    label: 'Acerca de',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
  },
]

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('apariencia')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { user, setUser } = useAuth()
  const { showToast } = useToast()

  const privacyMutation = useMutation({
    mutationFn: () => apiPatch('/users/me/privacy', {}),
    onSuccess: (res) => {
      const isPrivate = res.data.privado
      setUser(prev => ({ ...prev, privado: isPrivate }))
      showToast(isPrivate ? 'Tu cuenta ahora es privada' : 'Tu cuenta ahora es pública', 'success')
    },
    onError: () => {
      showToast('Error al cambiar la privacidad', 'error')
    },
  })

  const likesPrivacyMutation = useMutation({
    mutationFn: () => apiPatch('/users/me/likes-privacy', {}),
    onSuccess: (res) => {
      const isPrivate = res.data.me_gusta_privado
      setUser(prev => ({ ...prev, me_gusta_privado: isPrivate }))
      showToast(isPrivate ? 'Tus me gusta ahora son privados' : 'Tus me gusta ahora son públicos', 'success')
    },
    onError: () => {
      showToast('Error al cambiar la privacidad', 'error')
    },
  })

  return (
    <>
      <div className="page--column">
        <div className="settings-header">
          <h1>Configuración</h1>
          <p>Personalizá tu experiencia.</p>
        </div>

        <div className="settings-layout">
          <aside className="settings-sidebar" aria-label="Secciones de configuración">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </aside>

          <section className="settings-content">
            {activeTab === 'apariencia' && (
              <article className="settings-section">
                <h2>Apariencia</h2>
                <p className="settings-section-desc">Cómo se ve UdelarHITS en tu dispositivo.</p>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <h3>Tema</h3>
                    <p>Elegí entre claro, oscuro o seguir la preferencia de tu sistema.</p>
                  </div>
                  <div className="settings-row-control">
                    <div className="radio-group" role="radiogroup" aria-label="Selección de tema">
                      {THEME_OPTIONS.map(opt => (
                        <label
                          key={opt.value}
                          className={`radio-option${theme === opt.value ? ' selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="theme"
                            value={opt.value}
                            checked={theme === opt.value}
                            onChange={() => setTheme(opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            )}

            {activeTab === 'cuenta' && (
              <article className="settings-section">
                <h2>Cuenta</h2>
                <p className="settings-section-desc">Gestioná los datos de tu cuenta.</p>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <h3>Contraseña</h3>
                    <p>Cambiá tu contraseña actual por una nueva.</p>
                  </div>
                  <div className="settings-row-control">
                    <button
                      type="button"
                      className="settings-btn-secondary"
                      onClick={() => setChangePasswordOpen(true)}
                    >
                      Cambiar contraseña
                    </button>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <h3>Eliminar cuenta</h3>
                    <p>Desactivá tu perfil. Tu contenido publicado se mantiene visible.</p>
                  </div>
                  <div className="settings-row-control">
                    <a href="/central/cuenta/delete-account.html" target="_blank" rel="noreferrer" className="settings-btn-danger">
                      Eliminar cuenta
                    </a>
                  </div>
                </div>
              </article>
            )}

            {activeTab === 'privacidad' && (
              <article className="settings-section">
                <h2>Privacidad</h2>
                <p className="settings-section-desc">Controlá qué información tuya es visible para otros usuarios.</p>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <h3>Cuenta privada</h3>
                    <p>Solo tus seguidores podrán ver tus categorías, temas y comentarios desde tu perfil. Tu información pública sigue visible para todos.</p>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={!!user?.privado}
                        disabled={privacyMutation.isPending}
                        onChange={() => privacyMutation.mutate()}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <h3>Mis me gusta</h3>
                    <p>Oculta el contenido al que le das like.</p>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={!!user?.me_gusta_privado}
                        disabled={likesPrivacyMutation.isPending}
                        onChange={() => likesPrivacyMutation.mutate()}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              </article>
            )}

            {activeTab === 'notificaciones' && (
              <article className="settings-section">
                <h2>Notificaciones</h2>
                <p className="settings-section-desc">Elegí sobre qué cosas querés ser notificado.</p>
                <div className="settings-placeholder">
                  <p>El sistema de notificaciones está en desarrollo.</p>
                </div>
              </article>
            )}

            {activeTab === 'acerca' && (
              <article className="settings-section">
                <h2>Acerca de UdelarHITS</h2>
                <p className="settings-section-desc">Información sobre la plataforma.</p>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <h3>Versión</h3>
                    <p>Beta</p>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <h3>Sobre el proyecto</h3>
                    <p>UdelarHITS es un foro institucional hecho por estudiantes para la comunidad de la Universidad de la República.</p>
                  </div>
                  <div className="settings-row-control">
                    <Link to="/about" className="settings-btn-secondary">Conocer más</Link>
                  </div>
                </div>
              </article>
            )}
          </section>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  )
}
