import { UserAvatar } from '../../components/shared/UserAvatar'
import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPatch, apiDelete } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../context/AuthContext'
import './EditProfileModal.css'

export function EditProfileModal({ isOpen, onClose, profile, onSaved }) {
  const { showToast } = useToast()

  const [nombre, setNombre] = useState('')
  const [bio, setBio] = useState('')

  const [avatarPreview, setAvatarPreview] = useState('')
  const [pendingAvatar, setPendingAvatar] = useState(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const avatarRef = useRef(null)

  const [bannerPreview, setBannerPreview] = useState('')
  const [pendingBanner, setPendingBanner] = useState(null)
  const [removeBanner, setRemoveBanner] = useState(false)
  const bannerRef = useRef(null)

  useEffect(() => {
    if (isOpen && profile) {
      setNombre(profile.nombre || '')
      setBio(profile.biografia || '')
      setAvatarPreview(profile.url_imagen || '')
      setPendingAvatar(null)
      setRemoveAvatar(false)
      setBannerPreview(profile.url_banner || '')
      setPendingBanner(null)
      setRemoveBanner(false)
    }
  }, [isOpen, profile])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (pendingAvatar) {
        const fd = new FormData()
        fd.append('avatar', pendingAvatar)
        await apiPatch('/users/me/avatar', fd)
      } else if (removeAvatar) {
        await apiDelete('/users/me/avatar')
      }

      if (pendingBanner) {
        const fd = new FormData()
        fd.append('banner', pendingBanner)
        await apiPatch('/users/me/banner', fd)
      } else if (removeBanner) {
        await apiDelete('/users/me/banner')
      }

      const body = { biografia: bio.trim() }
      if (nombre.trim()) body.nombre = nombre.trim()
      return apiPatch('/users/me', body)
    },
    onSuccess: async () => {                    // ← async
      try {
        const res = await apiGet('/users/me')   // ← refetch fresh user
        setUser(res.data.user)                  // ← actualiza AuthContext → Header se re-renderiza
      } catch {}
      showToast('Perfil actualizado', 'success')
      onClose()
      if (onSaved) onSaved()
    },
    onError: (err) => showToast(err.message || 'Error al guardar', 'error'),
  })

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingAvatar(file)
    setRemoveAvatar(false)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function handleRemoveAvatar() {
    setPendingAvatar(null)
    setRemoveAvatar(true)
    setAvatarPreview('')
    if (avatarRef.current) avatarRef.current.value = ''
  }

  function handleBannerChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingBanner(file)
    setRemoveBanner(false)
    setBannerPreview(URL.createObjectURL(file))
  }

  function handleRemoveBanner() {
    setPendingBanner(null)
    setRemoveBanner(true)
    setBannerPreview('')
    if (bannerRef.current) bannerRef.current.value = ''
  }

  const bannerBg = bannerPreview
    ? `url(${bannerPreview}) center/cover`
    : 'linear-gradient(135deg, var(--accent) 0%, #4a5687 50%, #6b5d8e 100%)'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar perfil"
      className="edit-profile-modal"
      headerAction={
        <button
          className="save-btn"
          type="button"
          disabled={!nombre.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      }
    >
      {/* Banner */}
      <div className="edit-banner" style={{ background: bannerBg }}>
        <div className="edit-banner-overlay">
          <button
            className="icon-circle"
            type="button"
            onClick={() => bannerRef.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <button className="icon-circle" type="button" onClick={handleRemoveBanner}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <input
          ref={bannerRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleBannerChange}
        />
      </div>

      {/* Avatar */}
      <div className="edit-avatar-row">
        <div className="edit-avatar-wrap">
          {avatarPreview ? (
            <img
              className="edit-avatar-img"
              src={avatarPreview}
              alt="Avatar"
              onError={() => setAvatarPreview('')}
            />
          ) : (
            <UserAvatar
              nickname={profile?.nickname}
              className="edit-avatar-img"
            />
          )}
          <div className="edit-avatar-buttons">
            <button
              className="edit-avatar-overlay"
              type="button"
              onClick={() => avatarRef.current?.click()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <button className="edit-avatar-remove" type="button" onClick={handleRemoveAvatar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      {/* Fields */}
      <div className="edit-body">
        <div className="edit-field">
          <div className="edit-field-label">
            <span>Nombre</span>
            <span className="edit-field-counter">{nombre.length} / 50</span>
          </div>
          <input
            type="text"
            maxLength={50}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
          />
        </div>
        <div className="edit-field">
          <div className="edit-field-label">
            <span>Biografía</span>
            <span className="edit-field-counter">{bio.length} / 160</span>
          </div>
          <textarea
            maxLength={160}
            rows={3}
            value={bio}
            onChange={e => setBio(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
