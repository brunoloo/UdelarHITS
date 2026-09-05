import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useFacultades } from '../../hooks/useFacultades'
import { FacultySelect } from '../../components/shared/FacultySelect'
import { apiPost } from '../../api/client'
import { trackSignUp } from '../../utils/analytics'
import './auth.css'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export function SetupProfilePage() {
  useDocumentTitle()
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [nickname, setNickname] = useState(user?.nickname || '')
  // Abreviatura de la facultad ('' = sin especificar). Opcional, igual que en el
  // registro por email: este es el único formulario de alta que ve el usuario
  // que entra con Google.
  const [facultad, setFacultad] = useState('')
  const [loading, setLoading] = useState(false)

  const facultades = useFacultades()

  async function handleSubmit(e) {
    e.preventDefault()

    const trimmed = nickname.trim()
    if (!trimmed) {
      showToast('El nickname es obligatorio.', 'error')
      return
    }
    if (trimmed.length > 30) {
      showToast('El nickname no puede superar los 30 caracteres.', 'error')
      return
    }
    if (!/^[a-zA-ZÀ-ÿ0-9_-]+$/.test(trimmed)) {
      showToast('El nickname solo puede contener letras, números, guiones y guiones bajos.', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await apiPost('/auth/setup-nickname', { nickname: trimmed, facultad: facultad || null })
      // Confirmar el nickname es el último paso del alta con Google: recién acá
      // se completa el registro del usuario nuevo.
      trackSignUp('google')
      setUser(prev => ({ ...prev, nickname: res.data.nickname, nickname_confirmado: true }))
      showToast('¡Nickname configurado! Bienvenido/a a UdelarHITS', 'success')
      navigate('/', { replace: true })
    } catch (err) {
      showToast(err.message || 'No se pudo guardar el nickname.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-brand">
          Udelar<span>HITS</span>
        </Link>
        <h1 className="auth-title">Elegí tu nickname</h1>
        <p className="auth-subtitle">
          Es tu nombre de usuario en el foro. Tu nickname es único y no lo podrás volver a cambiar.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="setup-nickname">Nickname</label>
            <input
              className="form-input"
              id="setup-nickname"
              type="text"
              placeholder="Tu nickname"
              autoComplete="username"
              maxLength={30}
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="setup-facultad">
              Facultad <span className="form-label-optional">(opcional)</span>
            </label>
            <FacultySelect
              id="setup-facultad"
              value={facultad}
              onChange={setFacultad}
              facultades={facultades}
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Guardando...' : 'Confirmar nickname'}
          </button>
        </form>
      </div>
    </div>
  )
}
