import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { GoogleAuthButton } from './GoogleAuthButton'
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

export function LoginPage() {
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // If a session is already active, go straight to home — NOT to any prior
  // route — so we can't bounce back into a page that redirected us here.
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true })
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      const messages = {
        email_taken: 'Ya existe una cuenta con ese email. Iniciá sesión con tu contraseña.',
        google_error: 'Hubo un error al iniciar sesión con Google. Intentá de nuevo.',
      }
      if (messages[errorParam]) {
        showToast(messages[errorParam], 'error')
      }
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('error')
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParams, showToast])

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await login({ email: identifier, nickname: identifier, password })
      navigate('/')
    } catch (err) {
      showToast(err.message || 'Credenciales incorrectas.', 'error')
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
        <h1 className="auth-title">Bienvenido de vuelta</h1>
        <p className="auth-subtitle">Ingresá con tu email o nickname</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="identifier">Email o nickname</label>
            <input
              className="form-input"
              id="identifier"
              type="text"
              placeholder="Tu email o nickname"
              autoComplete="username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Contraseña</label>
            <div className="input-wrapper">
              <input
                className="form-input"
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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

          <p className="auth-forgot">
            <a
              href="/central/cuenta/forgot-password.html"
              target="_blank"
              rel="noreferrer"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </p>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Procesando...' : 'Iniciar sesión'}
          </button>
        </form>

        <GoogleAuthButton />

        <hr className="auth-divider" />
        <p className="auth-footer">
          ¿No tenés cuenta? <Link to="/register">Registrarse</Link>
        </p>
      </div>
    </div>
  )
}
