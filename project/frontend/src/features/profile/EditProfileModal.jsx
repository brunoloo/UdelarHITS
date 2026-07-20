import { UserAvatar } from '../../components/shared/UserAvatar'
import { ImageCropperModal } from '../../components/shared/ImageCropperModal'
import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPatch, apiDelete, apiGet } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../../components/ui/Modal'
import { PreviewTextField } from '../../components/shared/PreviewTextField'
import { BioText } from '../../utils/renderBioWithLinks'
import { useAuth } from '../../context/AuthContext'
import './EditProfileModal.css'

export function EditProfileModal({ isOpen, onClose, profile, onSaved }) {
  const { showToast } = useToast()
  const { setUser } = useAuth()

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

  const [cropperSrc, setCropperSrc] = useState('')
  const [cropperType, setCropperType] = useState(null)

  // Mobile (táctil): como no hay hover, los controles de cámara/eliminar se
  // revelan al TOCAR el avatar o el banner. 'avatar' | 'banner' | null. En
  // desktop no se usa (el reveal es por hover vía CSS).
  const [revealed, setRevealed] = useState(null)
  const isTouch = () => window.matchMedia('(max-width: 768px)').matches

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
      setRevealed(null)
    }
  }, [isOpen, profile])

  // Mobile: al revelar los controles de un elemento, tocar fuera de él los
  // vuelve a ocultar (mismo criterio que un menú). En desktop no aplica.
  useEffect(() => {
    if (!revealed) return
    function onDocClick(e) {
      if (e.target.closest?.('.edit-banner, .edit-avatar-wrap')) return
      setRevealed(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [revealed])

  // Primer tap sobre el avatar/banner: revela sus controles (solo mobile). Si ya
  // están revelados, no interceptamos: el tap sigue hasta el botón real.
  function handleReveal(which, e) {
    if (!isTouch()) return
    if (revealed !== which) {
      e.stopPropagation()
      setRevealed(which)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Moderación de imágenes: el backend puede retener el avatar/banner en
      // revisión ({ pending: true }). En ese caso NO se actualiza la foto y hay
      // que avisar al usuario que sigue viendo la anterior.
      const enRevision = []

      if (pendingAvatar) {
        const fd = new FormData()
        fd.append('avatar', pendingAvatar, 'avatar.jpg')
        const r = await apiPatch('/users/me/avatar', fd)
        if (r?.pending) enRevision.push('foto de perfil')
      } else if (removeAvatar) {
        await apiDelete('/users/me/avatar')
      }

      if (pendingBanner) {
        const fd = new FormData()
        fd.append('banner', pendingBanner, 'banner.jpg')
        const r = await apiPatch('/users/me/banner', fd)
        if (r?.pending) enRevision.push('portada')
      } else if (removeBanner) {
        await apiDelete('/users/me/banner')
      }

      const body = { biografia: bio.trim() }
      if (nombre.trim()) body.nombre = nombre.trim()
      await apiPatch('/users/me', body)
      return { enRevision }
    },
    onSuccess: async ({ enRevision }) => {      // ← async
      try {
        const res = await apiGet('/users/me')   // ← refetch fresh user
        setUser(res.data.user)                  // ← actualiza AuthContext → Header se re-renderiza
      } catch {}
      if (enRevision.length > 0) {
        showToast(
          `Tu ${enRevision.join(' y ')} quedó en revisión por moderación. Seguís viendo la anterior hasta que se apruebe.`,
          'info'
        )
      } else {
        showToast('Perfil actualizado', 'success')
      }
      onClose()
      if (onSaved) onSaved()
    },
    onError: (err) => showToast(err.message || 'Error al guardar', 'error'),
  })

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropperSrc(URL.createObjectURL(file))
    setCropperType('avatar')
    if (avatarRef.current) avatarRef.current.value = ''
  }

  function handleAvatarCropped(blob) {
    setPendingAvatar(blob)
    setRemoveAvatar(false)
    setAvatarPreview(URL.createObjectURL(blob))
    setCropperType(null)
    setCropperSrc('')
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
    setCropperSrc(URL.createObjectURL(file))
    setCropperType('banner')
    if (bannerRef.current) bannerRef.current.value = ''
  }

  function handleBannerCropped(blob) {
    setPendingBanner(blob)
    setRemoveBanner(false)
    setBannerPreview(URL.createObjectURL(blob))
    setCropperType(null)
    setCropperSrc('')
  }

  function handleRemoveBanner() {
    setPendingBanner(null)
    setRemoveBanner(true)
    setBannerPreview('')
    if (bannerRef.current) bannerRef.current.value = ''
  }

  function handleCropperClose() {
    setCropperType(null)
    setCropperSrc('')
  }

  const bannerBg = bannerPreview
    ? `url(${bannerPreview}) center/cover`
    : 'linear-gradient(135deg, var(--accent) 0%, #4a5687 50%, #6b5d8e 100%)'

  const cropperOpen = cropperType !== null

  return (
    <>
      <Modal
        isOpen={isOpen && !cropperOpen}
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
        <div
          className={`edit-banner${revealed === 'banner' ? ' revealed' : ''}`}
          style={{ background: bannerBg }}
          onClick={(e) => handleReveal('banner', e)}
        >
          <div className="edit-banner-overlay">
            <button
              className="icon-circle"
              type="button"
              onClick={() => { setRevealed(null); bannerRef.current?.click() }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <button className="icon-circle" type="button" onClick={() => { setRevealed(null); handleRemoveBanner() }}>
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
          <div
            className={`edit-avatar-wrap${revealed === 'avatar' ? ' revealed' : ''}`}
            onClick={(e) => handleReveal('avatar', e)}
          >
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
                onClick={() => { setRevealed(null); avatarRef.current?.click() }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
              <button className="edit-avatar-remove" type="button" onClick={() => { setRevealed(null); handleRemoveAvatar() }}>
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
          <PreviewTextField
            key={isOpen ? 'open' : 'closed'}
            value={bio}
            onChange={setBio}
            label="Biografía"
            maxLength={160}
            placeholder="Contá algo sobre vos"
            emptyText="Sin biografía"
            renderPreview={v => <p className="profile-bio"><BioText text={v} /></p>}
          />
        </div>
      </Modal>

      <ImageCropperModal
        isOpen={cropperType === 'avatar'}
        onClose={handleCropperClose}
        imageSrc={cropperSrc}
        aspect={1}
        circularCrop
        onConfirm={handleAvatarCropped}
      />

      <ImageCropperModal
        isOpen={cropperType === 'banner'}
        onClose={handleCropperClose}
        imageSrc={cropperSrc}
        aspect={4}
        circularCrop={false}
        onConfirm={handleBannerCropped}
      />
    </>
  )
}
