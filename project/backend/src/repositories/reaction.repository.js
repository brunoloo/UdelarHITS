import pool from '../config/db.js';

/**
 * Toggle a reaction on a piece of content.
 * - No existing reaction → insert
 * - Same type exists    → delete (toggle off)
 * - Different type      → update
 *
 * Returns { action, likes, mi_reaccion }
 */
const toggleReaction = async (userId, contenidoId, tipo) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Serializar toggles concurrentes del mismo usuario sobre el mismo
    // contenido (p. ej. doble-click). Sin esto, dos requests podrían leer
    // "sin reacción" a la vez y ambos intentar INSERT, violando el UNIQUE
    // (usuario_id, contenido_id). El lock se libera al COMMIT/ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `reaccion:${userId}:${contenidoId}`,
    ]);

    const { rows: existing } = await client.query(
      'SELECT id, tipo FROM reaccion WHERE usuario_id = $1 AND contenido_id = $2',
      [userId, contenidoId]
    );

    let action;
    let mi_reaccion = null;

    if (existing.length === 0) {
      await client.query(
        'INSERT INTO reaccion (usuario_id, contenido_id, tipo) VALUES ($1, $2, $3)',
        [userId, contenidoId, tipo]
      );
      action = 'created';
      mi_reaccion = tipo;
    } else if (existing[0].tipo === tipo) {
      await client.query('DELETE FROM reaccion WHERE id = $1', [existing[0].id]);
      action = 'removed';
      mi_reaccion = null;
    } else {
      await client.query('UPDATE reaccion SET tipo = $1 WHERE id = $2', [tipo, existing[0].id]);
      action = 'changed';
      mi_reaccion = tipo;
    }

    const { rows: counts } = await client.query(`
      SELECT COUNT(*) FILTER (WHERE tipo = 'meGusta') AS likes
      FROM reaccion
      WHERE contenido_id = $1
    `, [contenidoId]);

    await client.query('COMMIT');

    return {
      action,
      mi_reaccion,
      likes: parseInt(counts[0].likes),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get reaction counts + user's own reaction for a single content.
 */
const getReactionsByContentId = async (contenidoId, userId = null) => {
  const q = `
    SELECT COUNT(*) FILTER (WHERE tipo = 'meGusta') AS likes
    FROM reaccion
    WHERE contenido_id = $1
  `;
  const { rows: counts } = await pool.query(q, [contenidoId]);

  let mi_reaccion = null;
  if (userId) {
    const { rows } = await pool.query(
      'SELECT tipo FROM reaccion WHERE contenido_id = $1 AND usuario_id = $2 LIMIT 1',
      [contenidoId, userId]
    );
    mi_reaccion = rows[0]?.tipo || null;
  }

  return {
    likes: parseInt(counts[0].likes),
    mi_reaccion,
  };
};

export { toggleReaction, getReactionsByContentId };