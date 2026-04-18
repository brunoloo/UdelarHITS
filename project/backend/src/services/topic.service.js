import { createTopic, findTopicByTituloAndCategoria } from '../repositories/topic.repository.js';
import { getCategoryById, assignParticipantRole } from '../repositories/category.repository.js';

const createTopicService = async (autorId, { categoria_id, titulo, cuerpo }) => {
  if (!categoria_id || !titulo?.trim() || !cuerpo?.trim()) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const category = await getCategoryById(categoria_id);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (category.estado === 'inactiva') {
    const err = new Error('No se pueden crear temas en una categoría inactiva');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const existing = await findTopicByTituloAndCategoria(titulo.trim(), categoria_id);
  if (existing) {
    const err = new Error('Ya existe un tema con ese título en esta categoría');
    err.code = 'TITULO_EXISTS';
    throw err;
  }

  const topic = await createTopic({
    autor_id: autorId,
    categoria_id,
    titulo: titulo.trim(),
    cuerpo: cuerpo.trim()
  });

  await assignParticipantRole(autorId, categoria_id);

  return topic;
};

export { createTopicService };