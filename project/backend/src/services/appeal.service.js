import pool from '../config/db.js';
import {
  createAppeal, hasPendingAppeal, getAppealById,
  getPendingAppealsByType, deleteAppealById
} from '../repositories/appeal.repository.js';
import { getContenidoTipo } from '../repositories/report.repository.js';
import {
  aceptarApelacionTema, rechazarApelacionTema,
  aceptarApelacionComentario, rechazarApelacionComentario, aceptarApelacionCategoria, rechazarApelacionCategoria
} from './moderation.service.js';

// Apelable solo si fue inactivado directamente por moderación (no borrado por su autor
// ni arrastrado por un tema). El título lo genera el sistema.
const crearApelacionService = async (usuarioId, { contenido_id, categoria_id, justificacion }) => {
  const tieneContenido = contenido_id != null;
  const tieneCategoria = categoria_id != null;
 
  if (tieneContenido === tieneCategoria) {
    const err = new Error('Debe especificar contenido_id o categoria_id');
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
 
  if (tieneCategoria) {
    return await crearApelacionCategoria(usuarioId, Number(categoria_id), justificacion.trim());
  }
  return await crearApelacionContenido(usuarioId, Number(contenido_id), justificacion.trim());
};
 
async function crearApelacionContenido(usuarioId, contenidoId, justificacion) {
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
 
  if (contenido.autor_id !== usuarioId) {
    const err = new Error('Solo el autor puede apelar este contenido');
    err.code = 'FORBIDDEN';
    throw err;
  }
 
  const apelable = await esApelable(contenido);
  if (!apelable) {
    const err = new Error('Este contenido no puede ser apelado');
    err.code = 'FORBIDDEN';
    throw err;
  }
 
  if (await hasPendingAppeal(id, null)) {
    const err = new Error('Ya existe una apelación pendiente para este contenido');
    err.code = 'CONFLICT';
    throw err;
  }
 
  const titulo = contenido.tipo === 'tema'
    ? `Apelación de tema #${id}`
    : `Apelación de comentario #${id}`;
 
  try {
    return await createAppeal({ contenido_id: id, autor_id: usuarioId, titulo, justificacion });
  } catch (e) {
    if (e.code === '23505') {
      const err = new Error('Ya existe una apelación pendiente para este contenido');
      err.code = 'CONFLICT';
      throw err;
    }
    throw e;
  }
}
 
async function crearApelacionCategoria(usuarioId, categoriaId, justificacion) {
  if (!Number.isInteger(categoriaId) || categoriaId < 1) {
    const err = new Error('ID de categoría inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
 
  const { rows } = await pool.query(
    'SELECT id, autor_id, estado, motivo_inactivacion FROM categoria WHERE id = $1',
    [categoriaId]
  );
  const cat = rows[0];
 
  if (!cat) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }
 
  if (cat.autor_id !== usuarioId) {
    const err = new Error('Solo el autor puede apelar esta categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }
 
  if (cat.estado !== 'inactiva' || cat.motivo_inactivacion !== 'moderacion_reporte') {
    const err = new Error('Esta categoría no puede ser apelada');
    err.code = 'FORBIDDEN';
    throw err;
  }
 
  if (await hasPendingAppeal(null, categoriaId)) {
    const err = new Error('Ya existe una apelación pendiente para esta categoría');
    err.code = 'CONFLICT';
    throw err;
  }
 
  const titulo = `Apelación de categoría #${categoriaId}`;
 
  try {
    return await createAppeal({ categoria_id: categoriaId, autor_id: usuarioId, titulo, justificacion });
  } catch (e) {
    if (e.code === '23505') {
      const err = new Error('Ya existe una apelación pendiente para esta categoría');
      err.code = 'CONFLICT';
      throw err;
    }
    throw e;
  }
}

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

const listarApelacionesPendientesService = async (tipo) => {
  if (tipo !== 'tema' && tipo !== 'comentario' && tipo !== 'categoria') {
    const err = new Error('Tipo inválido (tema | comentario)');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  return await getPendingAppealsByType(tipo);
};

// Aceptar reactiva el contenido y borra sus reportes; rechazar lo elimina con todo su árbol.
// La apelación se borra antes del hard delete, que la arrastraría por cascade.
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
 
  const tipo = apelacion.tipo;
  const targetId = apelacion.contenido_id || apelacion.categoria_id;
 
  if (decision === 'aceptar') {
    let result;
    if (tipo === 'tema') result = await aceptarApelacionTema(targetId);
    else if (tipo === 'comentario') result = await aceptarApelacionComentario(targetId);
    else if (tipo === 'categoria') result = await aceptarApelacionCategoria(targetId);
    await deleteAppealById(id);
    return { decision: 'aceptada', ...result };
  }
 
  await deleteAppealById(id);
  let result;
  if (tipo === 'tema') result = await rechazarApelacionTema(targetId);
  else if (tipo === 'comentario') result = await rechazarApelacionComentario(targetId);
  else if (tipo === 'categoria') result = await rechazarApelacionCategoria(targetId);
  return { decision: 'rechazada', ...result };
};

export { crearApelacionService, listarApelacionesPendientesService, resolverApelacionService };