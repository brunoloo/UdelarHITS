import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPost, apiDelete } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import './FollowButton.css'

// Estado del seguimiento hacia el perfil:
//   'none'      → no lo sigo                  → botón "Seguir"
//   'pendiente' → solicitud enviada (privada) → botón "Solicitado" (hover: Cancelar)
//   'aceptado'  → lo sigo                      → botón "Siguiendo" (hover: Dejar de seguir)
export function FollowButton({ nickname, initialState = 'none', onToggle }) {
  const [estado, setEstado] = useState(initialState)
  const [hover, setHover] = useState(false)
  const { showToast } = useToast()

  const mutation = useMutation({
    mutationFn: () =>
      estado === 'none'
        ? apiPost(`/users/${encodeURIComponent(nickname)}/follow`, {})
        : apiDelete(`/users/${encodeURIComponent(nickname)}/follow`),
    onSuccess: (res) => {
      // Al seguir, el backend informa si quedó 'aceptado' (pública) o
      // 'pendiente' (privada). Al dejar de seguir / cancelar, volvemos a 'none'.
      const newEstado = estado === 'none' ? (res?.data?.estado || 'aceptado') : 'none'
      setEstado(newEstado)
      if (onToggle) onToggle(newEstado)
    },
    onError: (err) => showToast(err.message || 'Error', 'error'),
  })

  let label = 'Seguir'
  let className = 'btn-follow'

  if (estado === 'aceptado') {
    className = 'btn-follow btn-follow--siguiendo'
    label = hover ? 'Dejar de seguir' : 'Siguiendo'
    if (hover) className += ' btn-follow--unfollow'
  } else if (estado === 'pendiente') {
    className = 'btn-follow btn-follow--pendiente'
    label = hover ? 'Cancelar solicitud' : 'Solicitado'
    if (hover) className += ' btn-follow--unfollow'
  }

  return (
    <button
      className={className}
      type="button"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
    </button>
  )
}
