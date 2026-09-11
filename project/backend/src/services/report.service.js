import { createReporte, countReportesByContenido, getContenidoTipo, createReporteCategoria, countReportesByCategoria,
  getReportBreakdownByContenido, getReportBreakdownByCategoria } from '../repositories/report.repository.js';
import { debeInactivar, debeInactivarHome } from '../config/reportConfig.js';
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
//
// El rol del reportante (`rolUsuario`) viene resuelto por el middleware `protect`
// desde la BD. Si es admin, el reporte no espera al umbral comunitario: oculta el
// contenido en el acto (ver `esAdmin` más abajo).
// ---------------------------------------------------------
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
 
  // Comparación explícita contra el valor del enum: cualquier otro rol (o un rol
  // ausente) cae en el flujo normal por umbral.
  const esAdmin = rolUsuario === 'admin';

  // Despachar según tipo
  if (tieneCategoria) {
    return await reportarCategoria(usuarioId, Number(categoria_id), motivo, esAdmin);
  }
  return await reportarContenido(usuarioId, Number(contenido_id), motivo, esAdmin);
};
 
// Reportar tema o comentario (lógica existente, extraída a función)
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
  // Comentario de Home: no tiene categoría → la fórmula dual no aplica. Usa un
  // umbral plano y explícito (reportConfig.HOME) sobre los reportantes distintos.
  // El resto (tema / comentario de categoría) usa el umbral dinámico dual, que
  // pondera reportes de participantes vs visitantes de la categoría del
  // contenido. El desglose (n/p/v) NO se expone en la respuesta para no filtrar
  // tamaño de participación ni internals de moderación.
  // Excepción por rol: un reporte de admin oculta el contenido en el acto, el
  // umbral comunitario no aplica (no se consulta el desglose: es un bypass, no un
  // reporte con peso infinito). El contenido queda igual que siempre, con
  // motivo_inactivacion = 'moderacion_reporte' e inactivado_directo = TRUE, a
  // propósito: así la apelación del autor sigue funcionando sin cambios.
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
 
// Reportar categoría (lógica nueva)
async function reportarCategoria(usuarioId, categoriaId, motivo, esAdmin = false) {
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
  // Umbral dinámico dual sobre los participantes de la propia categoría, salvo
  // que reporte un admin: en ese caso se inactiva en el acto, sin consultar el
  // desglose (misma excepción por rol que en reportarContenido).
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