import {
  crearApelacionService,
  listarApelacionesPendientesService,
  resolverApelacionService,
} from '../services/appeal.service.js';

import { getModeratedContentByUserId } from '../repositories/appeal.repository.js';

// =========================================================
// Appeal controller (Fase 4.B)
// =========================================================

// Usuario: crear apelación sobre su contenido inactivado por moderación
const crearApelacion = async (req, res) => {
  try {
    const apelacion = await crearApelacionService(req.user.id, req.body);
    return res.status(201).json({
      ok: true,
      message: 'Apelación enviada. Un administrador la revisará.',
      data: apelacion
    });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    if (error.code === 'CONFLICT') return res.status(409).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Admin: listar apelaciones pendientes por tipo (?tipo=tema | ?tipo=comentario)
const listarApelacionesPendientes = async (req, res) => {
  try {
    const apelaciones = await listarApelacionesPendientesService(req.query.tipo);
    return res.status(200).json({ ok: true, data: apelaciones });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Admin: resolver una apelación. body: { decision: 'aceptar' | 'rechazar' }
const resolverApelacion = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await resolverApelacionService(id, req.body.decision);

    const message = result.decision === 'aceptada'
      ? 'Apelación aceptada. El contenido fue restaurado.'
      : 'Apelación rechazada. El contenido fue eliminado definitivamente.';

    return res.status(200).json({ ok: true, message, data: result });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getMyModeratedContent = async (req, res) => {
  try {
    const content = await getModeratedContentByUserId(req.user.id);
    return res.status(200).json({ ok: true, data: content });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { crearApelacion, listarApelacionesPendientes, resolverApelacion, getMyModeratedContent };