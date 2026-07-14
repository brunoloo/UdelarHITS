import { fileTypeFromBuffer } from 'file-type';

import { generateToken } from '../utils/generateToken.js';
import { requestRegistrationService, verifyRegistrationService, resendRegistrationCodeService, loginUserService, getUsersService, createUserByAdminService,
    getUserProfileService, showMeService, updateMeService,
    banUserService, activeUserService, deleteUserService,
  followUserService, unfollowUserService, removeFollowerService, isFollowingService,
  acceptFollowRequestService, rejectFollowRequestService, updateAvatarService,
  searchUsersService, updateBannerService,
  deleteBannerService, deleteAvatarService, getSuggestedUsersService, getMostActiveUsersService,
  changePasswordService, forgotPasswordService, verifyResetTokenService,
  resetPasswordService, deactivateAccountService, togglePrivacyService, toggleLikesPrivacyService,
  confirmNicknameService } from '../services/user.service.js';

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
    if (error.code === 'RATE_LIMITED') {
      return res.status(429).json({ ok: false, message: error.message });
    }
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    // El envío del código falló (p. ej. cuota de Resend superada): avisar de
    // forma honesta — nunca decir "revisá tu correo" si no salió nada.
    if (error.code === 'EMAIL_QUOTA' || error.code === 'EMAIL_SEND_FAILED') {
      return res.status(503).json({
        ok: false,
        message: 'No pudimos enviar el correo de verificación por un problema temporal del servicio de email. Tu registro no se completó — probá de nuevo más tarde.',
      });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Reenvía el código a un registro pendiente. Respuesta genérica siempre: no
// revela si el email tiene (o no) un registro en curso.
const resendCode = async (req, res) => {
  try {
    await resendRegistrationCodeService(req.body);
  } catch (error) {
    // Si el envío falló de verdad (cuota de Resend u otro error del servicio),
    // avisar honestamente: la respuesta genérica de éxito dejaría al usuario
    // esperando un mail que nunca va a llegar.
    if (error.code === 'EMAIL_QUOTA' || error.code === 'EMAIL_SEND_FAILED') {
      return res.status(503).json({
        ok: false,
        message: 'No pudimos enviar el correo por un problema temporal del servicio de email. Probá de nuevo más tarde.',
      });
    }
    // Cualquier otro error sigue siendo silencioso: no exponemos detalles.
  }
  return res.status(200).json({
    ok: true,
    message: 'Si hay un registro pendiente para ese correo, te reenviamos un código.'
  });
};

// Paso 2: confirma el código, crea la cuenta e inicia sesión (setea la cookie).
const verifyEmail = async (req, res) => {
  try {
    const { user, token } = await verifyRegistrationService(req.body);
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: (1000 * 60 * 60 * 24) * 7 // 7 días
    });
    return res.status(201).json({
      ok: true,
      message: 'Cuenta creada correctamente',
      data: {
        id: user.id,
        nickname: user.nickname,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        biografia: user.biografia ?? null,
        url_imagen: user.url_imagen ?? null
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
    const data = await getUserProfileService(nickname, req.user?.id, req.user?.rol);
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
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
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

// El usuario autenticado remueve a :nickname de su lista de seguidores.
const removeFollower = async (req, res) => {
  try {
    const { nickname } = req.params;
    const result = await removeFollowerService(req.user.id, nickname);
    return res.status(200).json({ ok: true, data: result });
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
    if (error.code === 'CLOUDINARY_QUOTA') {
      return res.status(503).json({
        ok: false,
        message: 'No se pudo subir la imagen por un problema temporal de almacenamiento del sitio — no es un error tuyo ni de tu archivo. El resto del foro sigue funcionando con normalidad, probá de nuevo más tarde.',
      });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const users = await searchUsersService(q, req.user?.id);
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
    if (error.code === 'CLOUDINARY_QUOTA') {
      return res.status(503).json({
        ok: false,
        message: 'No se pudo subir la imagen por un problema temporal de almacenamiento del sitio — no es un error tuyo ni de tu archivo. El resto del foro sigue funcionando con normalidad, probá de nuevo más tarde.',
      });
    }
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
    // Límite de 1 recuperación por cuenta cada 24hs: mensaje claro (pedido
    // explícito del flujo) aunque implique confirmar que la cuenta existe.
    if (error.code === 'RATE_LIMITED') return res.status(429).json({ ok: false, message: error.message });
    // El mail no salió (cuota de Resend u otro fallo de envío): nunca
    // responder el 200 genérico como si se hubiera enviado.
    if (error.code === 'EMAIL_QUOTA' || error.code === 'EMAIL_SEND_FAILED') {
      return res.status(503).json({
        ok: false,
        message: 'No pudimos enviar el correo de recuperación por un problema temporal del servicio de email. Probá de nuevo más tarde.',
      });
    }
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
    await deactivateAccountService(req.user.id, { password: req.body.password, nickname: req.body.nickname });

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

const googleAuthCallback = async (req, res) => {
  const token = generateToken(req.user.id);
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: (1000 * 60 * 60 * 24) * 7
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const dest = req.user.nickname_confirmado === false ? '/setup-profile' : '/';
  return res.redirect(`${frontendUrl}${dest}`);
};

const setupNickname = async (req, res) => {
  try {
    const { nickname } = req.body;
    const updated = await confirmNicknameService(req.user.id, nickname);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NICKNAME_TAKEN') return res.status(409).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

export { showMe, registerUser, verifyEmail, resendCode, loginUser, logoutUser, googleAuthCallback, setupNickname, getUsers,
  getUserProfile, updateMe, banUser,
  activeUser, deleteUser, followUser, unfollowUser, removeFollower, acceptFollowRequest, rejectFollowRequest, checkFollowing, updateAvatar,
  searchUsers, updateBanner, deleteBanner, deleteAvatar, getSuggestedUsersList, getMostActiveUsersList,
  changeUserPassword, forgotPassword, verifyResetToken, resetPassword, deactivateAccount, togglePrivacy, toggleLikesPrivacy }