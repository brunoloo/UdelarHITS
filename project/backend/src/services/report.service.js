import { createReporte, countReportesByContenido, getContenidoTipo } from '../repositories/report.repository.js';
import { calcularUmbral } from '../config/reportConfig.js';
import { inactivarTemaPorModeracion, inactivarComentarioPorModeracion } from './moderation.service.js';

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
const crearReporteService = async (usuarioId, { contenido_id, motivo }) => {
  const id = Number(contenido_id);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID de contenido inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!motivo || !MOTIVOS_VALIDOS.includes(motivo)) {
    const err = new Error('Motivo de reporte inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const contenido = await getContenidoTipo(id);
  if (!contenido) {
    const err = new Error('Contenido no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // No reportar lo propio
  if (contenido.autor_id === usuarioId) {
    const err = new Error('No podés reportar tu propio contenido');
    err.code = 'FORBIDDEN';
    throw err;
  }

  // No reportar contenido ya inactivo/oculto (no tiene sentido y evita
  // re-disparar inactivación sobre algo ya caído)
  const yaInactivo =
    (contenido.tipo === 'tema' && contenido.estado === 'inactivo') ||
    (contenido.tipo === 'comentario' && contenido.estado === 'oculto');
  if (yaInactivo) {
    const err = new Error('Este contenido ya no está disponible');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Insertar el reporte (UNIQUE atrapa el doble reporte)
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

  // ¿Cruzó el umbral?
  const total = await countReportesByContenido(id);
  const umbral = calcularUmbral({
    tipo: contenido.tipo,
    categoria_id: contenido.categoria_id,
    tema_id: contenido.tema_id
  });

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
};

export { crearReporteService };