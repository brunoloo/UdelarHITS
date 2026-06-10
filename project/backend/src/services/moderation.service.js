import pool from '../config/db.js';
import { moderateDeactivateTopicTx, moderateHideTopicRepliesTx, reactivateTopicTx, 
  restoreDraggedRepliesTx, hardDeleteTopicTreeTx, deleteReportsByContenidoTx } from '../repositories/topic.repository.js';
import { moderateHideReply, reactivateReplyTx, hardDeleteReplySubtreeTx } from '../repositories/reply.repository.js';

// Hogar de la inactivación POR MODERACIÓN. Distinta de la eliminación por
// autor de Fase 2:
//   * No valida permisos: actúa el sistema (la valida el reporte.service
//     al recibir el reporte, no acá).
//   * Siempre soft (nunca hard delete): el contenido tiene que sobrevivir
//     para poder apelarse en Fase 4.B.
//   * TEMA reportado    → oculta el árbol completo (tema inactivo + todos
//                         sus comentarios ocultos por arrastre).
//   * COMENTARIO reportado → solo oculta el nodo (placeholder), el subárbol
//                         de respuestas queda visible.
//
// Importa de los REPOSITORIES, nunca de otros services → sin ciclos.

// ---------------------------------------------------------
// Inactiva un TEMA por moderación, en una sola transacción atómica:
//   1. marca el tema inactivo (libera título con sufijo _deleted_)
//   2. decrementa el contador de temas de la categoría (si pasó de activo)
//   3. oculta todos los comentarios visibles del tema (arrastre)
// Si cualquier paso falla, ROLLBACK total: no queda estado a medias.
// Idempotente: si el tema ya no estaba activo, no hace nada.
// ---------------------------------------------------------
const inactivarTemaPorModeracion = async (temaId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tema = await moderateDeactivateTopicTx(temaId, client);

    // Si no devolvió fila, el tema ya no estaba 'activo' (otra request lo
    // inactivó primero). Cortamos sin tocar contador ni comentarios.
    if (!tema) {
      await client.query('ROLLBACK');
      return { action: 'noop', reason: 'tema no activo' };
    }

    // Decrementar contador (mismo efecto que Fase 2 al inactivar un tema).
    await client.query(`
      UPDATE categoria SET contador_temas = contador_temas - 1
      WHERE id = $1 AND contador_temas > 0
    `, [tema.categoria_id]);

    const ocultados = await moderateHideTopicRepliesTx(temaId, client);

    await client.query('COMMIT');
    return { action: 'topic_deactivated', comentarios_ocultados: ocultados };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------
// Inactiva un COMENTARIO por moderación: solo oculta el nodo (placeholder).
// El subárbol de respuestas queda intacto y navegable. No necesita
// transacción multi-tabla (es un solo UPDATE), pero usamos la variante de
// repo que marca motivo + inactivado_directo = TRUE.
// Idempotente: si ya estaba oculto, moderateHideReply devuelve null.
// ---------------------------------------------------------
const inactivarComentarioPorModeracion = async (comentarioId) => {
  const oculto = await moderateHideReply(comentarioId);
  if (!oculto) {
    return { action: 'noop', reason: 'comentario no visible' };
  }
  return { action: 'comment_hidden' };
};

// ---------------------------------------------------------
// ACEPTAR apelación de TEMA: reactiva el tema (revierte sufijo de título),
// restaura los comentarios arrastrados, re-incrementa el contador de la
// categoría, y borra los reportes acumulados. Todo en una transacción.
// ---------------------------------------------------------
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
 
    const restaurados = await restoreDraggedRepliesTx(temaId, client);
    await deleteReportsByContenidoTx(temaId, client);
 
    await client.query('COMMIT');
    return { action: 'topic_reactivated', comentarios_restaurados: restaurados };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
 
// ---------------------------------------------------------
// RECHAZAR apelación de TEMA: hard delete del árbol completo.
// El ON DELETE CASCADE borra la apelación junto con el contenido, pero
// igual borramos la apelación explícitamente en el service antes, por
// claridad (ver appeal.service). Acá solo destruimos el contenido.
// ---------------------------------------------------------
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
 
// ---------------------------------------------------------
// ACEPTAR apelación de COMENTARIO: vuelve a visible + borra sus reportes.
// ---------------------------------------------------------
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
 
// ---------------------------------------------------------
// RECHAZAR apelación de COMENTARIO: hard delete del subárbol completo
// (el comentario y todas sus respuestas).
// ---------------------------------------------------------
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

export { inactivarTemaPorModeracion, inactivarComentarioPorModeracion, aceptarApelacionComentario, aceptarApelacionTema, rechazarApelacionComentario, 
  rechazarApelacionTema };