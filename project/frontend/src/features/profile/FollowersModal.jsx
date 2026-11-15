import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiPost, apiDelete } from '../../api/client'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { UserAvatar } from '../../components/shared/UserAvatar'
import './FollowersModal.css'

export function FollowersModal({ isOpen, onClose, title, users, myFollowing = [], onFollowChange, canRemoveFollowers = false }) {
  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="followers-modal" closeOnBackdrop>
      <div className="follow-list">
        {(!users || users.length === 0) ? (
          <div className="follow-list-empty">
            {title === 'Seguidores' ? 'Todavía no tiene seguidores' : 'Todavía no sigue a nadie'}
          </div>
        ) : (
          users.map(u => (
            // La key incluye si lo sigo, para que el ítem se remonte si `myFollowing` llega después del primer render.
            <FollowItem
              key={`${u.nickname}:${myFollowing.some(f => f.nickname === u.nickname)}`}
              user={u}
              myFollowing={myFollowing}
              onClose={onClose}
              onFollowChange={onFollowChange}
              canRemove={canRemoveFollowers}
            />
          ))
        )}
      </div>
    </Modal>
  )
}

function FollowItem({ user: u, myFollowing, onClose, onFollowChange, canRemove }) {
  const { user: me } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const isMe = me && me.nickname === u.nickname
  // myFollowing solo lista seguimientos aceptados: una solicitud pendiente no se conoce desde el modal.
  const initialEstado = myFollowing.some(f => f.nickname === u.nickname) ? 'aceptado' : 'none'
  const [estado, setEstado] = useState(initialEstado)
  const [hover, setHover] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

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
      // Refresca contadores y estado de seguimiento: ['me'] es la fuente de `myFollowing` y
      // ['user'] cubre cualquier perfil abierto.
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
    onError: (err) => showToast(err.message || 'Error', 'error'),
  })

  // Quita a este seguidor de la lista propia; no afecta a quién sigue el usuario.
  const removeMutation = useMutation({
    mutationFn: () => apiDelete(`/users/${encodeURIComponent(u.nickname)}/follower`),
    onSuccess: () => {
      showToast(`Removiste a @${u.nickname} de tus seguidores`, 'success')
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
        <div className="follow-item-actions">
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
          {canRemove && (
            <button
              className="follow-item-remove"
              type="button"
              aria-label={`Remover a @${u.nickname} de tus seguidores`}
              title="Remover seguidor"
              disabled={removeMutation.isPending}
              onClick={() => setConfirmRemove(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {canRemove && (
        <ConfirmDialog
          isOpen={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          onConfirm={() => removeMutation.mutate()}
          title="Remover seguidor"
          message={`¿Seguro que querés remover a @${u.nickname} de tus seguidores?`}
          confirmText="Remover"
          danger
          elevated
        />
      )}
    </div>
  )
}
