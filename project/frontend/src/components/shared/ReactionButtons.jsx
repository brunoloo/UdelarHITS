import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { useToast } from '../../hooks/useToast'
import { apiPost } from '../../api/client'
import { formatCount } from '../../utils/formatCount'
import { trackLike } from '../../utils/analytics'
import { LikeIcon } from './LikeIcon'
import './ReactionButtons.css'

// Actualización optimista: la UI cambia al instante y se reconcilia con la respuesta;
// si falla, se revierte.
export function ReactionButtons({ contenidoId, likes, mi_reaccion }) {
  const requireAuth = useRequireAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [state, setState] = useState({
    likes: Number(likes) || 0,
    mine: mi_reaccion === 'meGusta',
  })

  const mutation = useMutation({
    mutationFn: () => apiPost(`/reactions/${contenidoId}`, { tipo: 'meGusta' }),
    onSuccess: (res) => {
      const data = res?.data
      if (data) {
        setState({
          likes: Number(data.likes) || 0,
          mine: data.mi_reaccion === 'meGusta',
        })
      }
      // Invalida todas las vistas de comentarios en caché, para que el mismo comentario muestre
      // el conteo nuevo en todos lados, y el badge de notificaciones.
      queryClient.invalidateQueries({ queryKey: ['replies'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Sincroniza el estado local con los datos del servidor cuando cambian, salvo mientras hay
  // un toggle en curso.
  const [synced, setSynced] = useState({ likes, mi_reaccion })
  if (synced.likes !== likes || synced.mi_reaccion !== mi_reaccion) {
    setSynced({ likes, mi_reaccion })
    if (!mutation.isPending) {
      setState({
        likes: Number(likes) || 0,
        mine: mi_reaccion === 'meGusta',
      })
    }
  }

  function handleClick(e) {
    e.stopPropagation()
    if (!requireAuth('Debes iniciar sesión para reaccionar')) return
    // Se ignoran los clics mientras hay un toggle en curso: una sola request a la vez.
    if (mutation.isPending) return

    const prev = state
    // Solo se registra el dar like.
    const isLiking = !prev.mine

    setState({
      likes: prev.likes + (prev.mine ? -1 : 1),
      mine: !prev.mine,
    })

    mutation.mutate(undefined, {
      onSuccess: () => {
        if (isLiking) trackLike()
      },
      onError: (err) => {
        setState(prev) // Revertir
        showToast(err.message || 'No se pudo registrar la reacción', 'error')
      },
    })
  }

  return (
    <div className="reaction-buttons">
      <button
        type="button"
        className={`reaction-btn${state.mine ? ' reaction-btn--active' : ''}`}
        onClick={handleClick}
        aria-pressed={state.mine}
        aria-label="Me gusta"
      >
        <LikeIcon filled={state.mine} />
        <span title={`${state.likes} me gusta`}>{formatCount(state.likes)}</span>
      </button>
    </div>
  )
}
