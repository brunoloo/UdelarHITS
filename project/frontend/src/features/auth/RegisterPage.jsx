import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { GoogleAuthButton } from './GoogleAuthButton'
import './auth.css'

// Clave en localStorage para retomar el paso de verificación si el usuario sale
// de la pantalla del código. Guardamos SOLO el email (no la contraseña ni el
// código), válido durante la misma ventana de 15 min del backend.
const PENDING_KEY = 'udelarhits:pendingVerification'
const PENDING_TTL_MS = 15 * 60 * 1000

function savePending(email) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email, expiresAt: Date.now() + PENDING_TTL_MS }))
  } catch { /* localStorage no disponible */ }
}
function readPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.email || !parsed?.expiresAt || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(PENDING_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}
function clearPending() {
  try { localStorage.removeItem(PENDING_KEY) } catch { /* noop */ }
}

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
  const { register, verifyEmail, resendCode } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

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

  // Registro en dos pasos: 'form' (datos) → 'verify' (código enviado al email).
  const [step, setStep] = useState('form')
  const [code, setCode] = useState('')

  // Si quedó una verificación pendiente (el usuario salió de la pantalla del
  // código y volvió dentro de los 15 min), retomamos directamente ese paso.
  useEffect(() => {
    const pending = readPending()
    if (pending) {
      setForm(prev => ({ ...prev, email: pending.email }))
      setStep('verify')
    }
  }, [])

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      const messages = {
        email_taken: 'Ya existe una cuenta con ese email. Iniciá sesión con tu contraseña.',
        google_error: 'Hubo un error al registrarse con Google. Intentá de nuevo.',
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

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // Paso 1: valida y pide el código de verificación al email.
  async function handleSubmit(e) {
    e.preventDefault()

    if (form.nickname.length > 30) {
      showToast('El nickname no puede superar los 30 caracteres.', 'error')
      return
    }
    if (!/^[a-zA-ZÀ-ÿ0-9_-]+$/.test(form.nickname)) {
      showToast('El nickname solo puede contener letras, números, guiones y guiones bajos. No se permiten espacios ni caracteres especiales como @, #, $, etc.', 'error')
      return
    }
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
      savePending(form.email)
      setStep('verify')
      showToast('Te enviamos un código de verificación a tu correo.', 'success')
    } catch (err) {
      showToast(err.message || 'Error al registrarse.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Paso 2: confirma el código y crea la cuenta.
  async function handleVerify(e) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code.trim())) {
      showToast('Ingresá el código de 6 dígitos que te enviamos.', 'error')
      return
    }
    setLoading(true)
    try {
      await verifyEmail({ email: form.email, codigo: code.trim() })
      clearPending()
      showToast('¡Cuenta creada exitosamente! Bienvenido/a a UdelarHITS', 'success')
      navigate('/')
    } catch (err) {
      showToast(err.message || 'No pudimos verificar el código.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Reenvía un código nuevo al mismo email (solo necesita el email: sirve aunque
  // el usuario haya salido y vuelto, sin la contraseña en memoria).
  async function handleResend() {
    setLoading(true)
    try {
      await resendCode(form.email)
      savePending(form.email) // renueva la ventana local
      showToast('Si hay un registro pendiente, te reenviamos un código.', 'success')
    } catch (err) {
      showToast(err.message || 'No pudimos reenviar el código.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Vuelve al formulario para cambiar los datos (descarta la verificación local).
  function handleChangeData() {
    clearPending()
    setCode('')
    setStep('form')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-brand">
          Udelar<span>HITS</span>
        </Link>
        <h1 className="auth-title">{step === 'form' ? 'Crear cuenta' : 'Verificá tu correo'}</h1>
        <p className="auth-subtitle">
          {step === 'form'
            ? 'Únete a la comunidad de Udelar'
            : <>Ingresá el código que enviamos a <strong>{form.email}</strong></>}
        </p>

        {step === 'form' && (
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
        )}

        {step === 'form' && <GoogleAuthButton />}

        {step === 'verify' && (
        <form className="auth-form" onSubmit={handleVerify} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="codigo">Código de verificación</label>
            <input
              className="form-input"
              id="codigo"
              name="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Verificando...' : 'Verificar y crear cuenta'}
          </button>

          <p className="auth-footer" style={{ marginTop: 16 }}>
            ¿No te llegó?{' '}
            <button type="button" className="auth-link-btn" onClick={handleResend} disabled={loading}>
              Reenviar código
            </button>
            {' · '}
            <button type="button" className="auth-link-btn" onClick={handleChangeData} disabled={loading}>
              Cambiar datos
            </button>
          </p>
        </form>
        )}

        <hr className="auth-divider" />
        <p className="auth-footer">
          ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
