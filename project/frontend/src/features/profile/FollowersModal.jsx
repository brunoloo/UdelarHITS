import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
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
            <FollowItem
              key={u.nickname}
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
  const isMe = me && me.nickname === u.nickname
  const initialFollowing = myFollowing.some(f => f.nickname === u.nickname)
  const [following, setFollowing] = useState(initialFollowing)
  const [hover, setHover] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      following
        ? apiDelete(`/users/${encodeURIComponent(u.nickname)}/follow`)
        : apiPost(`/users/${encodeURIComponent(u.nickname)}/follow`, {}),
    onSuccess: () => {
      const newVal = !following
      setFollowing(newVal)
      if (onFollowChange) onFollowChange(u.nickname, newVal)
    },
    onError: (err) => showToast(err.message || 'Error', 'error'),
  })

  let btnLabel = 'Seguir'
  let btnClass = 'btn-follow-sm'

  if (following) {
    btnClass = 'btn-follow-sm btn-follow-sm--following'
    btnLabel = hover ? 'Dejar de seguir' : 'Siguiendo'
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
