import { getPollById, getOption, castVote, getPollByContenidoId } from '../repositories/encuesta.repository.js';

const bad = (msg) => { const e = new Error(msg); e.code = 'BAD_REQUEST'; throw e; };

// Registra el voto de un usuario en una encuesta y devuelve los resultados
// actualizados (con su voto, lo que revela los %).
const votePollService = async (userId, encuestaId, opcionId) => {
  const eId = Number(encuestaId);
  const oId = Number(opcionId);
  if (!Number.isInteger(eId) || eId < 1) bad('Encuesta inválida');
  if (!Number.isInteger(oId) || oId < 1) bad('Opción inválida');

  const poll = await getPollById(eId);
  if (!poll) { const e = new Error('Encuesta no encontrada'); e.code = 'NOT_FOUND'; throw e; }
  if (poll.cerrada) bad('La encuesta ya finalizó');

  const option = await getOption(oId);
  if (!option || Number(option.encuesta_id) !== eId) bad('La opción no pertenece a esta encuesta');

  const inserted = await castVote(eId, oId, userId);
  if (!inserted) bad('Ya votaste en esta encuesta');

  return await getPollByContenidoId(poll.contenido_id, userId);
};

export { votePollService };
