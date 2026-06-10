import pool from '../config/db.js';
import {
  createAppeal, hasPendingAppeal, getAppealById,
  getPendingAppealsByType, deleteAppealById
} from '../repositories/appeal.repository.js';
import { getContenidoTipo } from '../repositories/report.repository.js';
import {
  aceptarApelacionTema, rechazarApelacionTema,
  aceptarApelacionComentario, rechazarApelacionComentario
} from './moderation.service.js';

// =========================================================
// Appeal service (Fase 4.B)
// =========================================================

// ---------------------------------------------------------
// Crear apelación. Reglas:
//   * el contenido existe y es tema o comentario
//   * el que apela es el AUTOR del contenido
//   * el contenido es APELABLE: inactivado por moderación directa
//     (motivo = 'moderacion_reporte' E inactivado_directo = TRUE).
//     Esto descarta: borrado por autor, y caída por arrastre.
//   * no hay ya una apelación pendiente sobre ese contenido
//   El título lo genera el sistema; el autor solo manda justificacion.
// ---------------------------------------------------------
const crearApelacionService = async (usuarioId, { contenido_id, justificacion }) => {
  const id = Number(contenido_id);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID de contenido inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!justificacion?.trim()) {
    const err = new Error('La justificación es obligatoria');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (justificacion.trim().length > 2000) {
    const err = new Error('La justificación superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const contenido = await getContenidoTipo(id);
  if (!contenido) {
    const err = new Error('Contenido no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Solo el autor puede apelar
  if (contenido.autor_id !== usuarioId) {
    const err = new Error('Solo el autor puede apelar este contenido');
    err.code = 'FORBIDDEN';
    throw err;
  }

  // ¿Es apelable? Necesitamos los flags de moderación del subtipo.
  // getContenidoTipo ya trae estado; pedimos motivo/inactivado_directo
  // a partir del tipo.
  const apelable = await esApelable(contenido);
  if (!apelable) {
    const err = new Error('Este contenido no puede ser apelado');
    err.code = 'FORBIDDEN';
    throw err;
  }

  // ¿Ya hay una pendiente?
  if (await hasPendingAppeal(id)) {
    const err = new Error('Ya existe una apelación pendiente para este contenido');
    err.code = 'CONFLICT';
    throw err;
  }

  const titulo = contenido.tipo === 'tema'
    ? `Apelación de tema #${id}`
    : `Apelación de comentario #${id}`;

  try {
    return await createAppeal({
      contenido_id: id,
      autor_id: usuarioId,
      titulo,
      justificacion: justificacion.trim()
    });
  } catch (e) {
    if (e.code === '23505') {
      const err = new Error('Ya existe una apelación pendiente para este contenido');
      err.code = 'CONFLICT';
      throw err;
    }
    throw e;
  }
};

// ---------------------------------------------------------
// Determina si un contenido es apelable consultando sus flags de
// moderación según el subtipo. Apelable solo si:
//   motivo_inactivacion = 'moderacion_reporte' AND inactivado_directo = TRUE
// ---------------------------------------------------------
const esApelable = async (contenido) => {
  const tabla = contenido.tipo === 'tema' ? 'tema' : 'comentario';
  const { rows } = await pool.query(
    `SELECT motivo_inactivacion, inactivado_directo
     FROM ${tabla} WHERE contenido_id = $1`,
    [contenido.contenido_id]
  );
  const r = rows[0];
  if (!r) return false;
  return r.motivo_inactivacion === 'moderacion_reporte' && r.inactivado_directo === true;
};

// ---------------------------------------------------------
// Listar apelaciones pendientes por tipo (panel admin).
// ---------------------------------------------------------
const listarApelacionesPendientesService = async (tipo) => {
  if (tipo !== 'tema' && tipo !== 'comentario') {
    const err = new Error('Tipo inválido (tema | comentario)');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  return await getPendingAppealsByType(tipo);
};

// ---------------------------------------------------------
// Resolver una apelación (admin). decision: 'aceptar' | 'rechazar'.
//   aceptar  → reactiva el contenido (+ árbol si tema) + borra reportes
//   rechazar → hard delete del árbol
// En ambos casos la apelación se elimina. El borrado de la apelación se
// hace ANTES del hard delete en el caso rechazar (si la borráramos después,
// el CASCADE ya la habría volado y deleteAppealById devolvería null — no
// rompe, pero es más claro borrarla primero y de forma explícita).
// ---------------------------------------------------------
const resolverApelacionService = async (apelacionId, decision) => {
  const id = Number(apelacionId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID de apelación inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (decision !== 'aceptar' && decision !== 'rechazar') {
    const err = new Error('Decisión inválida (aceptar | rechazar)');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const apelacion = await getAppealById(id);
  if (!apelacion) {
    const err = new Error('Apelación no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (apelacion.estado !== 'pendiente') {
    const err = new Error('La apelación ya fue resuelta');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const cid = apelacion.contenido_id;
  const tipo = apelacion.tipo;

  if (decision === 'aceptar') {
    // Reactivar primero, luego borrar la apelación.
    const result = tipo === 'tema'
      ? await aceptarApelacionTema(cid)
      : await aceptarApelacionComentario(cid);
    await deleteAppealById(id);
    return { decision: 'aceptada', ...result };
  }

  // rechazar: borrar la apelación explícitamente y luego hard delete del árbol.
  await deleteAppealById(id);
  const result = tipo === 'tema'
    ? await rechazarApelacionTema(cid)
    : await rechazarApelacionComentario(cid);
  return { decision: 'rechazada', ...result };
};

export { crearApelacionService, listarApelacionesPendientesService, resolverApelacionService };