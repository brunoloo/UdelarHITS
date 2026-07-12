import { getPrivacyById, getFollowState } from '../repositories/user.repository.js';

// Determina si `viewer` puede ver el contenido/actividad de `targetUserId`.
// Es la MISMA regla que canView() del frontend, pero enforced en el backend
// (el chequeo del front es solo cosmético y se puede saltear pegándole directo
// a la API):
//   - cuenta pública  -> todos
//   - cuenta privada  -> solo el dueño, un admin (moderación) o un seguidor aceptado
//
// Depende únicamente de repositorios, así que puede importarse desde cualquier
// service sin crear ciclos de imports.
export const canViewUserContent = async (targetUserId, viewerId = null, viewerRol = null) => {
  const privacy = await getPrivacyById(targetUserId);
  if (!privacy) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!privacy.privado) return true;
  if (viewerId != null && Number(viewerId) === Number(targetUserId)) return true;
  if (viewerRol === 'admin') return true;
  if (viewerId != null) {
    const estado = await getFollowState(viewerId, targetUserId);
    if (estado === 'aceptado') return true;
  }
  return false;
};
