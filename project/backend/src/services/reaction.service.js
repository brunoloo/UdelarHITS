import { toggleReaction, getReactionsByContentId } from '../repositories/reaction.repository.js';
import { isBlocked } from '../repositories/block.repository.js';
import pool from '../config/db.js';

const TIPOS_VALIDOS = ['meGusta'];

const toggleReactionService = async (userId, contenidoId, tipo) => {
  const id = Number(contenidoId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID de contenido inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!TIPOS_VALIDOS.includes(tipo)) {
    const err = new Error(`Tipo de reacción inválido. Valores permitidos: ${TIPOS_VALIDOS.join(', ')}`);
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Verificar que el contenido existe
  const { rows } = await pool.query('SELECT id FROM contenido WHERE id = $1', [id]);
  if (rows.length === 0) {
    const err = new Error('Contenido no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Verificar que el comentario no esté oculto
  const { rows: comRows } = await pool.query(
    `SELECT estado FROM comentario WHERE contenido_id = $1`,
    [id]
  );
  if (comRows.length > 0 && comRows[0].estado === 'oculto') {
    const err = new Error('No se puede reaccionar a un comentario oculto');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const { rows: authorRows } = await pool.query(
    'SELECT autor_id FROM contenido WHERE id = $1', [id]
  );
  const autorId = authorRows[0]?.autor_id;
  if (autorId && autorId !== userId && await isBlocked(userId, autorId)) {
    const err = new Error('No se puede realizar esta acción');
    err.code = 'FORBIDDEN';
    throw err;
  }

  return await toggleReaction(userId, id, tipo);
};

const getReactionsService = async (contenidoId, userId = null) => {
  const id = Number(contenidoId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID de contenido inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  return await getReactionsByContentId(id, userId);
};

export { toggleReactionService, getReactionsService };