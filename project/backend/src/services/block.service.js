import { getUserByNickname } from '../repositories/user.repository.js';
import { blockUser, unblockUser, isBlocked, getBlockedUsers, removeFollowsBothDirections } from '../repositories/block.repository.js';
import { deleteNotificationsByActorAndType } from '../repositories/notification.repository.js';

const blockUserService = async (bloqueadorId, bloqueadoNickname) => {
  const bloqueado = await getUserByNickname(bloqueadoNickname);
  if (!bloqueado) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (bloqueadorId === bloqueado.id) {
    const err = new Error('No podés bloquearte a vos mismo');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  await blockUser(bloqueadorId, bloqueado.id);
  await removeFollowsBothDirections(bloqueadorId, bloqueado.id);
  await deleteNotificationsByActorAndType(bloqueadorId, bloqueado.id, 'solicitud_seguimiento');
  await deleteNotificationsByActorAndType(bloqueado.id, bloqueadorId, 'solicitud_seguimiento');
};

const unblockUserService = async (bloqueadorId, bloqueadoNickname) => {
  const bloqueado = await getUserByNickname(bloqueadoNickname);
  if (!bloqueado) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  await unblockUser(bloqueadorId, bloqueado.id);
};

const getBlockedUsersService = async (userId) => {
  return await getBlockedUsers(userId);
};

export { blockUserService, unblockUserService, getBlockedUsersService, isBlocked };
