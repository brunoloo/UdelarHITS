import './UserAvatar.css'

export function UserAvatar({ url_imagen, nickname, size = 'md', inactive = false }) {
  return (
    <img
      className={`user-avatar-img user-avatar-${size}${inactive ? ' user-avatar-inactive' : ''}`}
      src={url_imagen || '/assets/default-user.jpg'}
      alt={nickname}
      onError={e => { e.currentTarget.src = '/assets/default-user.jpg' }}
    />
  )
}
