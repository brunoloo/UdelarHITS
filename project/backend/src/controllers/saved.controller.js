import {
  saveItemService, unsaveItemService, getSavedIdsService, getSavedListService,
} from '../services/saved.service.js';

const handleError = (res, error) => {
  if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
  return res.status(500).json({ ok: false, message: 'Internal server error' });
};

const saveItem = async (req, res) => {
  try {
    const { tipo, id } = req.body;
    await saveItemService(req.user.id, tipo, id);
    return res.status(201).json({ ok: true, message: 'Guardado' });
  } catch (error) {
    return handleError(res, error);
  }
};

const unsaveItem = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    await unsaveItemService(req.user.id, tipo, id);
    return res.status(200).json({ ok: true, message: 'Quitado de guardados' });
  } catch (error) {
    return handleError(res, error);
  }
};

const getSavedIds = async (req, res) => {
  try {
    const data = await getSavedIdsService(req.user.id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

const getSavedList = async (req, res) => {
  try {
    const data = await getSavedListService(req.user.id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

export { saveItem, unsaveItem, getSavedIds, getSavedList };
