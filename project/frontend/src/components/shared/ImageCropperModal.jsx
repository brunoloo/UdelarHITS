import { useState, useRef, useCallback } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Modal } from '../ui/Modal'
import './ImageCropperModal.css'

function getCenteredCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  )
}

function cropImageToBlob(image, crop, outputWidth, outputHeight) {
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  const { width: displayW, height: displayH } = image.getBoundingClientRect()
  const scaleX = image.naturalWidth / displayW
  const scaleY = image.naturalHeight / displayH

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputWidth,
    outputHeight
  )

  return new Promise(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  })
}

export function ImageCropperModal({ isOpen, onClose, imageSrc, aspect = 1, circularCrop = false, onConfirm }) {
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)
  const imgRef = useRef(null)

  const outputWidth = aspect > 1 ? Math.round(400 * aspect) : 400
  const outputHeight = 400

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget
    imgRef.current = e.currentTarget
    const centered = getCenteredCrop(width, height, aspect)
    setCrop(centered)
    setCompletedCrop(convertToPixelCrop(centered, width, height))
  }, [aspect])

  async function handleConfirm() {
    if (!completedCrop || !imgRef.current) return
    const blob = await cropImageToBlob(imgRef.current, completedCrop, outputWidth, outputHeight)
    onConfirm(blob)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recortar imagen" className="image-cropper-modal" closeOnBackdrop={false}>
      <div className="cropper-area">
        {imageSrc && (
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            onComplete={c => setCompletedCrop(c)}
            aspect={aspect}
            circularCrop={circularCrop}
            keepSelection
          >
            <img
              src={imageSrc}
              alt="Recortar"
              onLoad={onImageLoad}
              className="cropper-image"
            />
          </ReactCrop>
        )}
      </div>
      <div className="cropper-actions">
        <button className="cropper-btn cropper-btn--cancel" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="cropper-btn cropper-btn--confirm" type="button" onClick={handleConfirm} disabled={!completedCrop}>
          Aceptar
        </button>
      </div>
    </Modal>
  )
}
