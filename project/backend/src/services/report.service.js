import { createReporte, countReportesByContenido, getContenidoTipo, createReporteCategoria, countReportesByCategoria } from '../repositories/report.repository.js';
import { calcularUmbral } from '../config/reportConfig.js';
import { inactivarTemaPorModeracion, inactivarComentarioPorModeracion, inactivarCategoriaPorModeracion } from './moderation.service.js';

// =========================================================
// Reporte service (Fase 4.A)
// =========================================================

const MOTIVOS_VALIDOS = ['spam', 'incitacionOdio', 'acoso', 'contenidoInapropiado', 'informacionEnganosa', 'suplantacion']; // = enum motivo_reporte

// ---------------------------------------------------------
// Crea un reporte sobre un contenido (tema o comentario) y, si con este
// reporte se alcanza el umbral, dispara la inactivación por moderación.
//
// Validaciones:
//   * motivo dentro del enum
//   * el contenido existe y es tema o comentario
//   * no se reporta contenido propio
//   * no se reporta contenido ya inactivo/oculto
//   * un usuario no reporta dos veces (lo garantiza el UNIQUE; traducimos
//     el 23505 a un error de dominio)
// ---------------------------------------------------------
const crearReporteService = async (usuarioId, { contenido_id, categoria_id, motivo }) => {
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
 
  // Despachar según tipo
  if (tieneCategoria) {
    return await reportarCategoria(usuarioId, Number(categoria_id), motivo);
  }
  return await reportarContenido(usuarioId, Number(contenido_id), motivo);
};
 
// Reportar tema o comentario (lógica existente, extraída a función)
async function reportarContenido(usuarioId, contenidoId, motivo) {
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
  const umbral = calcularUmbral({ tipo: contenido.tipo, categoria_id: contenido.categoria_id });
 
  let moderacion = null;
  if (total >= umbral) {
    if (contenido.tipo === 'tema') {
      moderacion = await inactivarTemaPorModeracion(id);
    } else {
      moderacion = await inactivarComentarioPorModeracion(id);
    }
  }
 
  return {
    reporte,
    total_reportes: total,
    umbral,
    inactivado: moderacion !== null && moderacion.action !== 'noop',
    moderacion
  };
}
 
// Reportar categoría (lógica nueva)
async function reportarCategoria(usuarioId, categoriaId, motivo) {
  if (!Number.isInteger(categoriaId) || categoriaId < 1) {
    const err = new Error('ID de categoría inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
 
  // Importar getCategoryById inline para no crear dependencia circular
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
  const umbral = calcularUmbral({ tipo: 'categoria', categoria_id: categoriaId });
 
  let moderacion = null;
  if (total >= umbral) {
    moderacion = await inactivarCategoriaPorModeracion(categoriaId);
  }
 
  return {
    reporte,
    total_reportes: total,
    umbral,
    inactivado: moderacion !== null && moderacion.action !== 'noop',
    moderacion
  };
}

export { crearReporteService };