import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPost, apiDelete } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import './FollowButton.css'

export function FollowButton({ nickname, initialFollowing, onToggle }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [hover, setHover] = useState(false)
  const { showToast } = useToast()

  const mutation = useMutation({
    mutationFn: () =>
      following
        ? apiDelete(`/users/${encodeURIComponent(nickname)}/follow`)
        : apiPost(`/users/${encodeURIComponent(nickname)}/follow`, {}),
    onSuccess: () => {
      const newVal = !following
      setFollowing(newVal)
      if (onToggle) onToggle(newVal)
    },
    onError: (err) => showToast(err.message || 'Error', 'error'),
  })

  let label = 'Seguir'
  let className = 'btn-follow'

  if (following) {
    className = 'btn-follow btn-follow--siguiendo'
    label = hover ? 'Dejar de seguir' : 'Siguiendo'
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
