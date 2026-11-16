import { countPendingWork, listComments, countComments } from '../repositories/admin.repository.js';

const ESTADOS_COMENTARIO = new Set(['visible', 'oculto']);
const PAGE_DEFAULT = 30;
const PAGE_MAX = 100;

// El total alimenta el indicador del menú; el desglose, las pestañas del panel.
const getPendingCountService = async () => {
  const { apelaciones, reportes, imagenes } = await countPendingWork();
  return { apelaciones, reportes, imagenes, total: apelaciones + reportes + imagenes };
};

const listCommentsService = async ({ estado, q, limit, offset } = {}) => {
  let safeEstado = null;
  if (estado != null && estado !== '' && estado !== 'todos') {
    if (!ESTADOS_COMENTARIO.has(estado)) {
      const err = new Error('Estado inválido');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    safeEstado = estado;
  }

  const safeQ = typeof q === 'string' && q.trim() !== '' ? q.trim().slice(0, 100) : null;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || PAGE_DEFAULT, 1), PAGE_MAX);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const [items, total] = await Promise.all([
    listComments({ estado: safeEstado, q: safeQ, limit: safeLimit, offset: safeOffset }),
    countComments({ estado: safeEstado, q: safeQ }),
  ]);
  return { items, total, limit: safeLimit, offset: safeOffset };
};

export { getPendingCountService, listCommentsService };
