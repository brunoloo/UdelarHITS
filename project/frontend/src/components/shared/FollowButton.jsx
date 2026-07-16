import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiDelete } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { trackFollowUser } from '../../utils/analytics'
import './FollowButton.css'

export function FollowButton({ nickname, initialState = 'none', isPrivate = false, onToggle }) {
  const [estado, setEstado] = useState(initialState)

  useEffect(() => { setEstado(initialState) }, [initialState])
  const [hover, setHover] = useState(false)
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ prevEstado }) =>
      prevEstado === 'none'
        ? apiPost(`/users/${encodeURIComponent(nickname)}/follow`, {})
        : apiDelete(`/users/${encodeURIComponent(nickname)}/follow`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['user', nickname] })
      await queryClient.cancelQueries({ queryKey: ['me'] })
      await queryClient.cancelQueries({ queryKey: ['users', 'suggested'] })

      const prevProfile = queryClient.getQueryData(['user', nickname])
      const prevMe = queryClient.getQueryData(['me'])
      const prevSuggested = queryClient.getQueryData(['users', 'suggested'])
      const prevEstado = estado

      const optimisticEstado = prevEstado === 'none'
        ? (isPrivate ? 'pendiente' : 'aceptado')
        : 'none'

      setEstado(optimisticEstado)

      if (prevProfile) {
        queryClient.setQueryData(['user', nickname], old => {
          if (!old) return old
          const updated = { ...old, mi_estado_seguimiento: optimisticEstado }
          if (optimisticEstado === 'aceptado' && old.followers) {
            updated.followers = [...old.followers, { nickname: prevMe?.user?.nickname }]
          } else if (optimisticEstado === 'none' && old.followers) {
            updated.followers = old.followers.filter(f => f.nickname !== prevMe?.user?.nickname)
          }
          return updated
        })
      }

      return { prevProfile, prevMe, prevSuggested, prevEstado }
    },
    onError: (err, _vars, context) => {
      if (context?.prevEstado !== undefined) setEstado(context.prevEstado)
      if (context?.prevProfile) queryClient.setQueryData(['user', nickname], context.prevProfile)
      if (context?.prevMe) queryClient.setQueryData(['me'], context.prevMe)
      if (context?.prevSuggested) queryClient.setQueryData(['users', 'suggested'], context.prevSuggested)
      showToast(err.message || 'Error', 'error')
    },
    onSuccess: (res, { prevEstado }) => {
      if (prevEstado === 'none') {
        // Solo trackeamos el "seguir" (no el dejar de seguir). Incluye tanto el
        // follow directo como la solicitud a un perfil privado.
        trackFollowUser()
        const serverEstado = res?.data?.estado || 'aceptado'
        setEstado(serverEstado)
        if (onToggle) onToggle(serverEstado)
      } else {
        setEstado('none')
        if (onToggle) onToggle('none')
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user', nickname] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'suggested'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
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
      onClick={() => mutation.mutate({ prevEstado: estado })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
    </button>
  )
}
