import { searchSiteService } from '../services/search.service.js';

// GET /api/search?q=&etiqueta=&tipo=&limit=&offset=
// Sin `tipo`: devuelve las cuatro secciones con su primera tanda + hasMore.
// Con `tipo`: pagina esa sección sola ({ items, hasMore }) — lo usa "ver más".
// optionalAuth: el viewer (si está logueado) se usa para excluir bloqueados de la
// sección de usuarios.
const searchSite = async (req, res) => {
  try {
    const data = await searchSiteService(
      {
        q: req.query.q,
        etiqueta: req.query.etiqueta,
        tipo: req.query.tipo,
        limit: req.query.limit,
        offset: req.query.offset,
      },
      req.user?.id
    );
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { searchSite };
