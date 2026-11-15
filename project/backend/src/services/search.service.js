import {
  searchCategorias,
  searchTemas,
  searchComentarios,
  searchUsuarios,
} from '../repositories/search.repository.js';

// El mínimo es el del buscador de usuarios; el máximo evita patrones enormes.
const MIN_TERM = 2;
const MAX_TERM = 100;

// '' = las cuatro secciones a la vez.
const TIPOS = ['categorias', 'temas', 'comentarios', 'usuarios'];

const clampLimit = (raw, fallback) => {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, 1), 50);
};

const clampOffset = (raw) => {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
};

// Pide limit + 1 al repositorio y decide hasMore por el sobrante.
const withHasMore = (rows, limit) => {
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
};

const parseParams = ({ q, etiqueta, tipo }) => {
  const term = (q ?? '').trim();
  if (term.length < MIN_TERM) {
    const err = new Error(`El término de búsqueda debe tener al menos ${MIN_TERM} caracteres`);
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (term.length > MAX_TERM) {
    const err = new Error('El término de búsqueda es demasiado largo');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const tipoNorm = (tipo ?? '').trim();
  if (tipoNorm !== '' && !TIPOS.includes(tipoNorm)) {
    const err = new Error('Tipo de búsqueda inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  // Siempre '' y nunca NULL, para que la comparación del SQL no anule la sección.
  const etiquetaNorm = (etiqueta ?? '').trim();
  return { term, etiqueta: etiquetaNorm, tipo: tipoNorm };
};

// Con etiqueta la sección de usuarios queda vacía: los usuarios no tienen etiqueta.
const searchAllSections = async ({ term, etiqueta, limit, viewerId }) => {
  const [cat, tem, com, usr] = await Promise.all([
    searchCategorias({ term, etiqueta, limit: limit + 1 }),
    searchTemas({ term, etiqueta, limit: limit + 1 }),
    searchComentarios({ term, etiqueta, limit: limit + 1, viewerId }),
    etiqueta === ''
      ? searchUsuarios({ term, viewerId, limit: limit + 1 })
      : Promise.resolve([]),
  ]);
  return {
    categorias: withHasMore(cat, limit),
    temas: withHasMore(tem, limit),
    comentarios: withHasMore(com, limit),
    usuarios: etiqueta === '' ? withHasMore(usr, limit) : { items: [], hasMore: false },
  };
};

const searchOneSection = async ({ tipo, term, etiqueta, limit, offset, viewerId }) => {
  const args = { term, etiqueta, limit: limit + 1, offset };
  let rows;
  switch (tipo) {
    case 'categorias': rows = await searchCategorias(args); break;
    case 'temas': rows = await searchTemas(args); break;
    case 'comentarios': rows = await searchComentarios({ ...args, viewerId }); break;
    case 'usuarios':
      rows = etiqueta === ''
        ? await searchUsuarios({ term, viewerId, limit: limit + 1, offset })
        : [];
      break;
    default: rows = [];
  }
  return withHasMore(rows, limit);
};

const searchSiteService = async (rawParams, viewerId = null) => {
  const { term, etiqueta, tipo } = parseParams(rawParams);

  if (tipo === '') {
    // Sin tipo: tanda inicial chica por sección.
    const limit = clampLimit(rawParams.limit, 5);
    return searchAllSections({ term, etiqueta, limit, viewerId });
  }

  const limit = clampLimit(rawParams.limit, 10);
  const offset = clampOffset(rawParams.offset);
  return searchOneSection({ tipo, term, etiqueta, limit, offset, viewerId });
};

export { searchSiteService };
