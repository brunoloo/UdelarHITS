import { getPrivacyById, getFollowState } from '../repositories/user.repository.js';
import { hasBlocked } from '../repositories/block.repository.js';

// ── ÚNICA fuente de verdad de la política de visibilidad de cuentas privadas ──
// Predicado PURO (sin I/O): recibe los hechos ya recolectados y aplica la regla.
// Cualquiera que decida "¿este viewer puede ver el contenido/actividad de esta
// cuenta?" debe pasar por acá, para que la política viva en un solo lugar y no
// se pueda desincronizar entre endpoints (perfil vs topics/replies).
//   - cuenta pública -> todos
//   - cuenta privada -> solo el dueño, un admin (moderación) o un seguidor aceptado
export const canViewPrivateContent = ({ privado, isOwner, isAdmin, isAcceptedFollower }) =>
  !privado || isOwner || isAdmin || isAcceptedFollower;

// Versión con I/O: junta los hechos (privacidad + estado de seguimiento) y aplica
// el predicado de arriba. La usan los endpoints de topics/replies, que no tienen
// el usuario ya cargado. Depende solo de repositorios, así que puede importarse
// desde cualquier service sin crear ciclos de imports.
export const canViewUserContent = async (targetUserId, viewerId = null, viewerRol = null) => {
  const privacy = await getPrivacyById(targetUserId);
  if (!privacy) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const isOwner = viewerId != null && Number(viewerId) === Number(targetUserId);
  const isAdmin = viewerRol === 'admin';

  // Gate de bloqueo UNIDIRECCIONAL: si el DUEÑO del contenido bloqueó al viewer,
  // este no puede ver su contenido "por usuario" — incluso en cuenta pública.
  // La dirección inversa (el viewer bloqueó al dueño) NO se gatea: bloquear es una
  // decisión del que bloquea, no una restricción sobre el bloqueado, así que el
  // viewer sigue viendo el contenido del target normalmente. Los admins conservan
  // visibilidad para moderación.
  if (!isOwner && !isAdmin && viewerId != null) {
    if (await hasBlocked(targetUserId, viewerId)) return false;
  }

  // Solo consultamos el estado de seguimiento cuando puede cambiar la decisión
  // (cuenta privada y el viewer no es dueño ni admin).
  let isAcceptedFollower = false;
  if (privacy.privado && !isOwner && !isAdmin && viewerId != null) {
    isAcceptedFollower = (await getFollowState(viewerId, targetUserId)) === 'aceptado';
  }

  return canViewPrivateContent({ privado: privacy.privado, isOwner, isAdmin, isAcceptedFollower });
};
