import pool from '../config/db.js';
import { moderateDeactivateTopicTx, moderateHideTopicRepliesTx, reactivateTopicTx, 
  restoreDraggedRepliesTx, hardDeleteTopicTreeTx, deleteReportsByContenidoTx } from '../repositories/topic.repository.js';
import { moderateHideReply, reactivateReplyTx, hardDeleteReplySubtreeTx } from '../repositories/reply.repository.js';
import { createNotification } from '../repositories/notification.repository.js';

// Inactivación por moderación: siempre soft, para que el contenido pueda apelarse.
// No valida permisos (lo hace report.service) e importa solo repositorios, para evitar ciclos.

// En una transacción: marca el tema inactivo y descuenta el contador de la categoría. Idempotente.
const inactivarTemaPorModeracion = async (temaId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tema = await moderateDeactivateTopicTx(temaId, client);

    // Sin fila, otra request ya lo había inactivado.
    if (!tema) {
      await client.query('ROLLBACK');
      return { action: 'noop', reason: 'tema no activo' };
    }

    await client.query(`
      UPDATE categoria SET contador_temas = contador_temas - 1
      WHERE id = $1 AND contador_temas > 0
    `, [tema.categoria_id]);

     const { rows: [{ autor_id }] } = await client.query(
       'SELECT autor_id FROM contenido WHERE id = $1', [temaId]
     );
     await createNotification({
       usuario_id: autor_id,
       tipo: 'moderacion_contenido',
       mensaje: 'Tu tema fue ocultado por reportes de la comunidad.',
       contenido_id: temaId
     }, client);

    await client.query('COMMIT');
    return { action: 'topic_deactivated' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Solo oculta el nodo; las respuestas quedan navegables. Idempotente.
   const inactivarComentarioPorModeracion = async (comentarioId) => {
     const client = await pool.connect();
     try {
       await client.query('BEGIN');

       const oculto = await moderateHideReply(comentarioId, client);
       if (!oculto) {
         await client.query('ROLLBACK');
         return { action: 'noop', reason: 'comentario no visible' };
       }

       const { rows: [{ autor_id }] } = await client.query(
         'SELECT autor_id FROM contenido WHERE id = $1', [comentarioId]
       );
       await createNotification({
         usuario_id: autor_id,
         tipo: 'moderacion_contenido',
         mensaje: 'Tu comentario fue ocultado por reportes de la comunidad.',
         contenido_id: comentarioId
       }, client);

       await client.query('COMMIT');
       return { action: 'comment_hidden' };
     } catch (err) {
       await client.query('ROLLBACK');
       throw err;
     } finally {
       client.release();
     }
   };

// Reactiva el tema, restaura los comentarios arrastrados, ajusta el contador y borra los reportes.
const aceptarApelacionTema = async (temaId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    const tema = await reactivateTopicTx(temaId, client);
    if (!tema) {
      await client.query('ROLLBACK');
      return { action: 'noop', reason: 'tema no estaba inactivo' };
    }
 
    await client.query(`
      UPDATE categoria SET contador_temas = contador_temas + 1 WHERE id = $1
    `, [tema.categoria_id]);
 
    await deleteReportsByContenidoTx(temaId, client);
 
    await client.query('COMMIT');
    return { action: 'topic_reactivated' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
 
// Hard delete del árbol completo.
const rechazarApelacionTema = async (temaId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await hardDeleteTopicTreeTx(temaId, client);
    await client.query('COMMIT');
    return { action: 'topic_hard_deleted' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
 
const aceptarApelacionComentario = async (comentarioId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    const com = await reactivateReplyTx(comentarioId, client);
    if (!com) {
      await client.query('ROLLBACK');
      return { action: 'noop', reason: 'comentario no estaba oculto' };
    }
 
    await deleteReportsByContenidoTx(comentarioId, client);
 
    await client.query('COMMIT');
    return { action: 'comment_reactivated' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
 
const rechazarApelacionComentario = async (comentarioId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await hardDeleteReplySubtreeTx(comentarioId, client);
    await client.query('COMMIT');
    return { action: 'comment_hard_deleted' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const inactivarCategoriaPorModeracion = async (categoriaId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    const { rows } = await client.query(`
      UPDATE categoria
      SET estado = 'inactiva',
          motivo_inactivacion = 'moderacion_reporte',
          fecha_inactivacion = NOW()
      WHERE id = $1 AND estado = 'activa'
      RETURNING id, autor_id
    `, [categoriaId]);
 
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return { action: 'noop', reason: 'categoria no activa' };
    }
 
    const categoria = rows[0];
 
    await createNotification({
      usuario_id: categoria.autor_id,
      tipo: 'moderacion_contenido',
      mensaje: 'Tu categoría fue ocultada por reportes de la comunidad.',
      contenido_id: null
    }, client);
 
    await client.query('COMMIT');
    return { action: 'category_deactivated' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
 
const aceptarApelacionCategoria = async (categoriaId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    const { rows } = await client.query(`
      UPDATE categoria
      SET estado = 'activa',
          motivo_inactivacion = NULL,
          fecha_inactivacion = NULL
      WHERE id = $1 AND estado = 'inactiva'
      RETURNING id
    `, [categoriaId]);
 
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return { action: 'noop', reason: 'categoria no estaba inactiva' };
    }
 
    // Borrar reportes para evitar re-inactivación
    await client.query('DELETE FROM reporte WHERE categoria_id = $1', [categoriaId]);
 
    await client.query('COMMIT');
    return { action: 'category_reactivated' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
 
const rechazarApelacionCategoria = async (categoriaId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // El borrado cascadea a todo su contenido.
    await client.query('DELETE FROM categoria WHERE id = $1', [categoriaId]);
    await client.query('COMMIT');
    return { action: 'category_hard_deleted' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export { inactivarTemaPorModeracion, inactivarComentarioPorModeracion, aceptarApelacionComentario, aceptarApelacionTema, rechazarApelacionComentario, 
  rechazarApelacionTema, inactivarCategoriaPorModeracion, aceptarApelacionCategoria, rechazarApelacionCategoria };