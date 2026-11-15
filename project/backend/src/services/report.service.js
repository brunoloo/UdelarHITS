import { createReporte, countReportesByContenido, getContenidoTipo, createReporteCategoria, countReportesByCategoria,
  getReportBreakdownByContenido, getReportBreakdownByCategoria } from '../repositories/report.repository.js';
import { debeInactivar, debeInactivarHome } from '../config/reportConfig.js';
import { inactivarTemaPorModeracion, inactivarComentarioPorModeracion, inactivarCategoriaPorModeracion } from './moderation.service.js';

const MOTIVOS_VALIDOS = ['spam', 'incitacionOdio', 'acoso', 'contenidoInapropiado', 'informacionEnganosa', 'suplantacion']; // = enum motivo_reporte

// Si reporta un admin, el contenido se oculta en el acto, sin esperar el umbral.
const crearReporteService = async (usuarioId, { contenido_id, categoria_id, motivo }, rolUsuario) => {
  // Validar que venga exactamente uno de los dos
  const tieneContenido = contenido_id != null;
  const tieneCategoria = categoria_id != null;
  if (tieneContenido === tieneCategoria) {
    const err = new Error('Debe especificar contenido_id o categoria_id (no ambos)');
    err.code = 'BAD_REQUEST';
    throw err;
  }
 
  if (!motivo || !MOTIVOS_VALIDOS.includes(motivo)) {
    const err = new Error('Motivo de reporte inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
 
  const esAdmin = rolUsuario === 'admin';

  if (tieneCategoria) {
    return await reportarCategoria(usuarioId, Number(categoria_id), motivo, esAdmin);
  }
  return await reportarContenido(usuarioId, Number(contenido_id), motivo, esAdmin);
};
 
async function reportarContenido(usuarioId, contenidoId, motivo, esAdmin = false) {
  const id = contenidoId;
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID de contenido inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
 
  const contenido = await getContenidoTipo(id);
  if (!contenido) {
    const err = new Error('Contenido no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
 
  if (contenido.autor_id === usuarioId) {
    const err = new Error('No podés reportar tu propio contenido');
    err.code = 'FORBIDDEN';
    throw err;
  }
 
  const yaInactivo =
    (contenido.tipo === 'tema' && contenido.estado === 'inactivo') ||
    (contenido.tipo === 'comentario' && contenido.estado === 'oculto');
  if (yaInactivo) {
    const err = new Error('Este contenido ya no está disponible');
    err.code = 'BAD_REQUEST';
    throw err;
  }
 
  let reporte;
  try {
    reporte = await createReporte({ usuario_id: usuarioId, contenido_id: id, motivo });
  } catch (e) {
    if (e.code === '23505') {
      const err = new Error('Ya reportaste este contenido');
      err.code = 'CONFLICT';
      throw err;
    }
    throw e;
  }
 
  const total = await countReportesByContenido(id);
  // Los comentarios de Home usan un umbral plano; el resto, el umbral dual de su categoría.
  // El desglose no se expone en la respuesta. Un reporte de admin inactiva en el acto, con el
  // mismo motivo, para que la apelación del autor siga funcionando.
  let inactivar;
  if (esAdmin) {
    inactivar = true;
  } else if (contenido.tipo === 'comentario' && contenido.es_home) {
    inactivar = debeInactivarHome(total);
  } else {
    const { n, p, v } = await getReportBreakdownByContenido(id);
    inactivar = debeInactivar({ n, p, v });
  }

  let moderacion = null;
  if (inactivar) {
    if (contenido.tipo === 'tema') {
      moderacion = await inactivarTemaPorModeracion(id);
    } else {
      moderacion = await inactivarComentarioPorModeracion(id);
    }
  }

  return {
    reporte,
    total_reportes: total,
    inactivado: moderacion !== null && moderacion.action !== 'noop',
    moderacion
  };
}
 
async function reportarCategoria(usuarioId, categoriaId, motivo, esAdmin = false) {
  if (!Number.isInteger(categoriaId) || categoriaId < 1) {
    const err = new Error('ID de categoría inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
 
  // Import dinámico para evitar una dependencia circular.
  const pool = (await import('../config/db.js')).default;
  const { rows } = await pool.query(
    'SELECT id, autor_id, estado FROM categoria WHERE id = $1', [categoriaId]
  );
  const categoria = rows[0];
 
  if (!categoria) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }
 
  if (categoria.autor_id === usuarioId) {
    const err = new Error('No podés reportar tu propia categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }
 
  if (categoria.estado === 'inactiva') {
    const err = new Error('Esta categoría ya no está disponible');
    err.code = 'BAD_REQUEST';
    throw err;
  }
 
  let reporte;
  try {
    reporte = await createReporteCategoria({ usuario_id: usuarioId, categoria_id: categoriaId, motivo });
  } catch (e) {
    if (e.code === '23505') {
      const err = new Error('Ya reportaste esta categoría');
      err.code = 'CONFLICT';
      throw err;
    }
    throw e;
  }
 
  const total = await countReportesByCategoria(categoriaId);
  // Misma excepción por rol que en reportarContenido.
  let inactivar;
  if (esAdmin) {
    inactivar = true;
  } else {
    const { n, p, v } = await getReportBreakdownByCategoria(categoriaId);
    inactivar = debeInactivar({ n, p, v });
  }

  let moderacion = null;
  if (inactivar) {
    moderacion = await inactivarCategoriaPorModeracion(categoriaId);
  }

  return {
    reporte,
    total_reportes: total,
    inactivado: moderacion !== null && moderacion.action !== 'noop',
    moderacion
  };
}

export { crearReporteService };