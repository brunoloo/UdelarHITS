import {
  listPendingImagesService,
  approvePendingImageService,
  rejectPendingImageService,
} from '../services/pendingImage.service.js';

const VALID_ORIGENES = new Set(['adjunto', 'avatar', 'banner']);

// GET /api/admin/pending-images — cola unificada de imágenes en revisión.
const getPendingImages = async (_req, res) => {
  try {
    const data = await listPendingImagesService();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// PATCH /api/admin/pending-images/:id/approve  body: { origen }
const approvePendingImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { origen } = req.body;
    if (!VALID_ORIGENES.has(origen)) {
      return res.status(400).json({ ok: false, message: 'origen inválido (adjunto | avatar | banner)' });
    }
    const result = await approvePendingImageService(Number(id), origen);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// PATCH /api/admin/pending-images/:id/reject  body: { origen }
const rejectPendingImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { origen } = req.body;
    if (!VALID_ORIGENES.has(origen)) {
      return res.status(400).json({ ok: false, message: 'origen inválido (adjunto | avatar | banner)' });
    }
    const result = await rejectPendingImageService(Number(id), origen);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { getPendingImages, approvePendingImage, rejectPendingImage };
