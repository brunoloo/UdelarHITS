import {
  saveItem, unsaveItem, getSavedIds,
  getSavedCategorias, getSavedTemas, getSavedComentarios,
} from '../repositories/saved.repository.js';

const TIPOS = ['categoria', 'tema', 'comentario'];

const assertTipoId = (tipo, id) => {
  if (!TIPOS.includes(tipo)) {
    const err = new Error('Tipo inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (!/^\d+$/.test(String(id))) {
    const err = new Error('Id inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
};

const saveItemService = async (usuarioId, tipo, id) => {
  assertTipoId(tipo, id);
  await saveItem(usuarioId, tipo, id);
};

const unsaveItemService = async (usuarioId, tipo, id) => {
  assertTipoId(tipo, id);
  await unsaveItem(usuarioId, tipo, id);
};

const getSavedIdsService = async (usuarioId) => {
  const rows = await getSavedIds(usuarioId);
  const result = { categorias: [], temas: [], comentarios: [] };
  for (const r of rows) {
    if (r.tipo === 'categoria') result.categorias.push(Number(r.categoria_id));
    else if (r.tipo === 'tema') result.temas.push(Number(r.contenido_id));
    else if (r.tipo === 'comentario') result.comentarios.push(Number(r.contenido_id));
  }
  return result;
};

// Lista única ordenada por fecha de guardado (más reciente primero). Cada item
// lleva `kind` ('categoria'|'tema'|'comentario') para que el panel elija la card.
const getSavedListService = async (usuarioId) => {
  const [categorias, temas, comentarios] = await Promise.all([
    getSavedCategorias(usuarioId),
    getSavedTemas(usuarioId),
    getSavedComentarios(usuarioId),
  ]);

  const items = [
    ...categorias.map(c => ({ kind: 'categoria', ...c })),
    ...temas.map(t => ({ kind: 'tema', ...t })),
    ...comentarios.map(c => ({ kind: 'comentario', ...c })),
  ];

  items.sort((a, b) => new Date(b.fecha_guardado) - new Date(a.fecha_guardado));
  return items;
};

export { saveItemService, unsaveItemService, getSavedIdsService, getSavedListService };
