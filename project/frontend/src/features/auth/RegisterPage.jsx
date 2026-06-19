import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import './auth.css'

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [form, setForm] = useState({
    nombre: '',
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (form.password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres.', 'error')
      return
    }
    if (form.password !== form.confirmPassword) {
      showToast('Las contraseñas no coinciden.', 'error')
      return
    }
    if (!acceptTerms) {
      showToast('Debés aceptar los términos de uso y la política de privacidad.', 'error')
      return
    }

    setLoading(true)
    try {
      await register({
        nombre: form.nombre,
        nickname: form.nickname,
        email: form.email,
        password: form.password,
      })
      navigate('/')
    } catch (err) {
      showToast(err.message || 'Error al registrarse.', 'error')
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
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-subtitle">Únete a la comunidad de Udelar</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="nombre">Nombre completo</label>
            <input
              className="form-input"
              id="nombre"
              name="nombre"
              type="text"
              placeholder="Tu nombre completo"
              autoComplete="name"
              value={form.nombre}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="nickname">Nickname</label>
            <input
              className="form-input"
              id="nickname"
              name="nickname"
              type="text"
              placeholder="Tu nickname"
              autoComplete="username"
              value={form.nickname}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              className="form-input"
              id="email"
              name="email"
              type="email"
              placeholder="Tu email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Contraseña</label>
            <div className="input-wrapper">
              <input
                className="form-input"
                id="reg-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="input-toggle"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirmar contraseña</label>
            <div className="input-wrapper">
              <input
                className="form-input"
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repetí tu contraseña"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="input-toggle"
                aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowConfirm(v => !v)}
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="auth-legal">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                required
              />
              <span>
                Acepto los{' '}
                <a href="/central/legal/terminos.html" target="_blank" rel="noreferrer">
                  términos de uso
                </a>
                {' '}y la{' '}
                <a href="/central/legal/privacidad.html" target="_blank" rel="noreferrer">
                  política de privacidad
                </a>
              </span>
            </label>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Procesando...' : 'Crear cuenta'}
          </button>
        </form>

        <hr className="auth-divider" />
        <p className="auth-footer">
          ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
