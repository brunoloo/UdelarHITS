import { fileTypeFromBuffer } from 'file-type';

import { requestRegistrationService, verifyRegistrationService, loginUserService, getUsersService, createUserByAdminService,
    getUserProfileService, showMeService, updateMeService, 
    banUserService, activeUserService, deleteUserService,
  followUserService, unfollowUserService, isFollowingService,
  acceptFollowRequestService, rejectFollowRequestService, updateAvatarService,
  searchUsersService, updateBannerService,
  deleteBannerService, deleteAvatarService, getSuggestedUsersService, getMostActiveUsersService, 
  changePasswordService, forgotPasswordService, verifyResetTokenService, 
  resetPasswordService, deactivateAccountService, togglePrivacyService, toggleLikesPrivacyService } from '../services/user.service.js';

const showMe = async (req, res) => {
  try {
    const result = await showMeService(req.user.nickname);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, message: error.message });
    }
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

// Paso 1: valida los datos y envía el código de verificación al email.
// No crea la cuenta todavía.
const registerUser = async (req, res) => {
  try {
    const result = await requestRegistrationService(req.body);
    return res.status(200).json({
      ok: true,
      message: 'Te enviamos un código de verificación a tu correo.',
      requiresVerification: true,
      data: { email: result.email }
    })
  } catch (error) {
    if (error.code === 'USER_EXISTS') {
      return res.status(409).json({ ok: false, message: error.message });
    }
    if (error.code === 'NICKNAME_EXISTS') {
      return res.status(409).json({ ok: false, message: error.message });
    }
    if (error.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ ok: false, message: error.message });
    }
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Paso 2: confirma el código y crea la cuenta.
const verifyEmail = async (req, res) => {
  try {
    const result = await verifyRegistrationService(req.body);
    return res.status(201).json({
      ok: true,
      message: 'Cuenta creada correctamente',
      data: {
        id: result.id,
        nickname: result.nickname,
        nombre: result.nombre,
        email: result.email,
        rol: result.rol
      }
    })
  } catch (error) {
    if (error.code === 'USER_EXISTS' || error.code === 'NICKNAME_EXISTS' || error.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ ok: false, message: error.message });
    }
    if (error.code === 'INVALID_CODE') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Crear usuario admin
export const createUserByAdmin = async (req, res) => {
  try {
    const result = await createUserByAdminService(req.body);
    return res.status(201).json({
      ok: true,
      data: {
        id: result.id,
        rol: result.rol,
        nickname: result.nickname,
        nombre: result.nombre,
        email: result.email
      }
    });
  } catch (error) {
    if (error.code === 'ADMIN_EXISTS') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const loginUser = async (req, res) => {
    try {
    const result = await loginUserService(req.body);
    res.cookie("jwt", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: (1000*60*60*24)*7 // 7 días
    })
    return res.status(200).json({ 
      ok: true,
      message: 'Login exitoso', 
      data: {
        user: result.user
      } 
    });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'INVALID_CREDENTIALS') return res.status(401).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
}

const logoutUser = async (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  return res.status(200).json({
    ok: true,
    message: 'Logout exitoso'
  });
};

const getUsers = async (req, res) => {
  try {
    const users = await getUsersService();
    return res.status(200).json({ ok: true, data: users });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { nickname } = req.params;
    const data = await getUserProfileService(nickname, req.user?.id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const updateMe = async (req, res) => {
  try {
    const updated = await updateMeService(req.user.id, req.body);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const banUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    const updated = await banUserService(nickname);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const activeUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    const updated = await activeUserService(nickname);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    const deleted = await deleteUserService(nickname);
    return res.status(200).json({ 
      ok: true, 
      message: 'Usuario eliminado correctamente',
      data: deleted });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'BAD_REQUEST') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const followUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    const result = await followUserService(req.user.id, nickname);
    // result.estado: 'aceptado' (cuenta pública) | 'pendiente' (cuenta privada).
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const unfollowUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    await unfollowUserService(req.user.id, nickname);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// El usuario autenticado acepta la solicitud de seguimiento de :nickname.
const acceptFollowRequest = async (req, res) => {
  try {
    const { nickname } = req.params;
    const result = await acceptFollowRequestService(req.user.id, nickname);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// El usuario autenticado rechaza la solicitud de seguimiento de :nickname.
const rejectFollowRequest = async (req, res) => {
  try {
    const { nickname } = req.params;
    const result = await rejectFollowRequestService(req.user.id, nickname);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const checkFollowing = async (req, res) => {
  try {
    const { nickname } = req.params;
    const following = await isFollowingService(req.user.id, nickname);
    return res.status(200).json({ ok: true, data: { following } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No se proporcionó ninguna imagen' });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const type = await fileTypeFromBuffer(req.file.buffer);

    if (!type || !allowed.includes(type.mime)) {
      return res.status(400).json({ ok: false, message: 'Tipo de archivo no permitido' });
    }

    const updated = await updateAvatarService(req.user.id, req.file.buffer, req.file.mimetype);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const users = await searchUsersService(q);
    return res.status(200).json({ ok: true, data: users });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const updateBanner = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No se proporcionó ninguna imagen' });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const type = await fileTypeFromBuffer(req.file.buffer);

    if (!type || !allowed.includes(type.mime)) {
      return res.status(400).json({ ok: false, message: 'Tipo de archivo no permitido' });
    }

    const updated = await updateBannerService(req.user.id, req.file.buffer, req.file.mimetype);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteBanner = async (req, res) => {
  try {
    await deleteBannerService(req.user.id);
    return res.status(200).json({ ok: true, message: 'Banner eliminado' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteAvatar = async (req, res) => {
  try {
    await deleteAvatarService(req.user.id);
    return res.status(200).json({ ok: true, message: 'Avatar eliminado' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getSuggestedUsersList = async (req, res, next) => {
  try {
    const users = await getSuggestedUsersService(req.user.id, req.query.limit);
    return res.status(200).json({ ok: true, data: users });
  } catch (error) {
    next(error);
  }
};

const getMostActiveUsersList = async (req, res, next) => {
  try {
    const users = await getMostActiveUsersService(req.query.limit);
    return res.status(200).json({ ok: true, data: users });
  } catch (error) {
    next(error);
  }
};

const changeUserPassword = async (req, res) => {
  try {
    await changePasswordService(req.user.id, req.body);
    return res.status(200).json({ ok: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'INVALID_CREDENTIALS') return res.status(401).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    await forgotPasswordService(req.body.email);
    // Siempre responder 200 para no revelar si el email existe
    return res.status(200).json({ ok: true, message: 'Si el email existe, se envió el enlace de recuperación' });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const verifyResetToken = async (req, res) => {
  try {
    await verifyResetTokenService(req.body.token);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'INVALID_TOKEN') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const resetPassword = async (req, res) => {
  try {
    await resetPasswordService(req.body.token, req.body.newPassword);
    return res.status(200).json({ ok: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'INVALID_TOKEN') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const deactivateAccount = async (req, res) => {
  try {
    await deactivateAccountService(req.user.id, req.body.password);

    // Limpiar cookie JWT
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    return res.status(200).json({ ok: true, message: 'Cuenta desactivada correctamente' });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'INVALID_CREDENTIALS') return res.status(401).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const togglePrivacy = async (req, res) => {
  try {
    const updated = await togglePrivacyService(req.user.id);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const toggleLikesPrivacy = async (req, res) => {
  try {
    const updated = await toggleLikesPrivacyService(req.user.id);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

export { showMe, registerUser, verifyEmail, loginUser, logoutUser, getUsers,
  getUserProfile, updateMe, banUser,
  activeUser, deleteUser, followUser, unfollowUser, acceptFollowRequest, rejectFollowRequest, checkFollowing, updateAvatar,
  searchUsers, updateBanner, deleteBanner, deleteAvatar, getSuggestedUsersList, getMostActiveUsersList,
  changeUserPassword, forgotPassword, verifyResetToken, resetPassword, deactivateAccount, togglePrivacy, toggleLikesPrivacy }