import { getPrivacyById, getFollowState } from '../repositories/user.repository.js';
import { hasBlocked } from '../repositories/block.repository.js';

// Política única de visibilidad de cuentas privadas: las ven su dueño, un admin o un seguidor aceptado.
export const canViewPrivateContent = ({ privado, isOwner, isAdmin, isAcceptedFollower }) =>
  !privado || isOwner || isAdmin || isAcceptedFollower;

export const canViewUserContent = async (targetUserId, viewerId = null, viewerRol = null) => {
  const privacy = await getPrivacyById(targetUserId);
  if (!privacy) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const isOwner = viewerId != null && Number(viewerId) === Number(targetUserId);
  const isAdmin = viewerRol === 'admin';

  // Bloqueo unidireccional: si el dueño bloqueó al viewer, este no ve su contenido.
  // Bloquear a alguien no restringe lo que uno ve de él.
  if (!isOwner && !isAdmin && viewerId != null) {
    if (await hasBlocked(targetUserId, viewerId)) return false;
  }

  // Solo se consulta el seguimiento si puede cambiar la decisión.
  let isAcceptedFollower = false;
  if (privacy.privado && !isOwner && !isAdmin && viewerId != null) {
    isAcceptedFollower = (await getFollowState(viewerId, targetUserId)) === 'aceptado';
  }

  return canViewPrivateContent({ privado: privacy.privado, isOwner, isAdmin, isAcceptedFollower });
};
