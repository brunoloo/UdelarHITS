import {
  subscribePushService, unsubscribePushService,
  setPushEnabledService, getVapidPublicKeyService,
} from '../services/push.service.js';

const handleError = (res, error) => {
  if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
  return res.status(500).json({ ok: false, message: 'Internal server error' });
};

const getVapidKey = async (req, res) => {
  try {
    const publicKey = getVapidPublicKeyService();
    return res.status(200).json({ ok: true, data: { publicKey } });
  } catch (error) {
    return handleError(res, error);
  }
};

const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    await subscribePushService(req.user.id, { endpoint, keys }, req.get('user-agent'));
    return res.status(201).json({ ok: true, message: 'Suscripción registrada' });
  } catch (error) {
    return handleError(res, error);
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    const eliminadas = await unsubscribePushService(req.user.id, endpoint);
    return res.status(200).json({ ok: true, data: { eliminadas } });
  } catch (error) {
    return handleError(res, error);
  }
};

const setEnabled = async (req, res) => {
  try {
    const { activado } = req.body || {};
    const row = await setPushEnabledService(req.user.id, activado);
    return res.status(200).json({ ok: true, data: { push_activado: row?.push_activado } });
  } catch (error) {
    return handleError(res, error);
  }
};

export { getVapidKey, subscribe, unsubscribe, setEnabled };
