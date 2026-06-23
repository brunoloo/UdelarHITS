import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { apiPost, apiDelete } from '../../api/client'
import { Modal } from '../../components/ui/Modal'
import { UserAvatar } from '../../components/shared/UserAvatar'
import './FollowersModal.css'

export function FollowersModal({ isOpen, onClose, title, users, myFollowing = [], onFollowChange }) {
  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="followers-modal">
      <div className="follow-list">
        {(!users || users.length === 0) ? (
          <div className="follow-list-empty">
            {title === 'Seguidores' ? 'Todavía no tiene seguidores' : 'Todavía no sigue a nadie'}
          </div>
        ) : (
          users.map(u => (
            // Key includes follow-membership so the item remounts (and its
            // useState re-initializes) if `myFollowing` arrives or changes
            // after first render — otherwise a late ['me'] query would leave
            // already-followed users stuck showing "Seguir".
            <FollowItem
              key={`${u.nickname}:${myFollowing.some(f => f.nickname === u.nickname)}`}
              user={u}
              myFollowing={myFollowing}
              onClose={onClose}
              onFollowChange={onFollowChange}
            />
          ))
        )}
      </div>
    </Modal>
  )
}

function FollowItem({ user: u, myFollowing, onClose, onFollowChange }) {
  const { user: me } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const isMe = me && me.nickname === u.nickname
  // myFollowing solo lista seguimientos aceptados; desde el modal no se conoce
  // si hay una solicitud pendiente, así que el estado inicial es 'aceptado'/'none'.
  const initialEstado = myFollowing.some(f => f.nickname === u.nickname) ? 'aceptado' : 'none'
  const [estado, setEstado] = useState(initialEstado)
  const [hover, setHover] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      estado === 'none'
        ? apiPost(`/users/${encodeURIComponent(u.nickname)}/follow`, {})
        : apiDelete(`/users/${encodeURIComponent(u.nickname)}/follow`),
    onSuccess: (res) => {
      // Al seguir, el backend informa 'aceptado' (pública) o 'pendiente' (privada).
      const newEstado = estado === 'none' ? (res?.data?.estado || 'aceptado') : 'none'
      setEstado(newEstado)
      if (onFollowChange) onFollowChange(u.nickname, newEstado === 'aceptado')
      // Invalidate profile caches so follower/following counters refresh and
      // the follow state survives closing and reopening the modal. ['me'] is
      // the source of `myFollowing` when viewing another user's profile, and
      // ['user'] covers any open profile (partial-key match).
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
    onError: (err) => showToast(err.message || 'Error', 'error'),
  })

  let btnLabel = 'Seguir'
  let btnClass = 'btn-follow-sm'

  if (estado === 'aceptado') {
    btnClass = 'btn-follow-sm btn-follow-sm--following'
    btnLabel = hover ? 'Dejar de seguir' : 'Siguiendo'
  } else if (estado === 'pendiente') {
    btnClass = 'btn-follow-sm btn-follow-sm--following'
    btnLabel = hover ? 'Cancelar' : 'Solicitado'
  }

  return (
    <div className="follow-item">
      <UserAvatar url_imagen={u.url_imagen} nickname={u.nickname} size="md" />
      <div className="follow-item-info">
        <Link
          className="follow-item-nickname"
          to={`/user/${encodeURIComponent(u.nickname)}`}
          onClick={onClose}
        >
          @{u.nickname}
        </Link>
        {u.nombre && <div className="follow-item-name">{u.nombre}</div>}
      </div>
      {me && !isMe && (
        <button
          className={btnClass}
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {btnLabel}
        </button>
      )}
    </div>
  )
}
