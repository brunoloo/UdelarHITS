import bcrypt  from 'bcrypt';
import {uploadToCloudinary, deleteFromCloudinary} from '../utils/uploadToCloudinary.js';
import {generateToken} from '../utils/generateToken.js'
import crypto from 'crypto';
import { sendEmail } from '../utils/sendEmail.js';
import { createResetToken, findValidToken, markTokenAsUsed } from '../repositories/token.repository.js';
import { createVerification, findValidVerification, incrementVerificationAttempts, markVerificationUsed } from '../repositories/verification.repository.js';
import { isAllowedEmailDomain } from '../config/emailDomains.js';
import { createRateLimiter } from '../utils/rateLimiter.js';

// Límite de envío de mails: como máximo 5 por dirección cada 15 minutos
// (cubre registro/verificación/reenvío y recuperación de contraseña).
const emailSendLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

// Defensa 5: máximo 1 recuperación de contraseña EXITOSA por cuenta cada 24hs.
// Es adicional al rate-limit por IP (authLimiter) y al de dirección de arriba:
// evita que una sola cuenta, reintentando fuera de la ventana de 15 min,
// agote por sí sola la cuota diaria de Resend (100 mails/día en el plan free).
// La ventana es configurable para poder testearla sin esperar 24hs.
const forgotAccountLimiter = createRateLimiter({
  windowMs: Number(process.env.FORGOT_PASSWORD_ACCOUNT_WINDOW_MS || 24 * 60 * 60 * 1000),
  max: 1,
});

// Solo para tests: el limiter vive en memoria y los ids de usuario se repiten
// entre tests (truncate con RESTART IDENTITY), así que necesitan limpiarlo.
export const _resetForgotAccountLimiter = () => forgotAccountLimiter.reset();
import {
  findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers, getUserIdByNickname, getUserByNickname,
  findByEmailForGoogleAuth, isNicknameTaken, createGoogleUser, confirmNickname,
  getCategoriesByUserId, getFollowersByUserId, getFollowingByUserId, updateUserById,
  getUserAvatarUrlById, updateUserEstado, deleteUserByNickname, followUser, unfollowUser,
  isFollowing, getFollowState, acceptFollowRequest, rejectFollowRequest, acceptAllPendingFollowRequests, updateAvatarById, searchUsers, updateBannerById,
  deleteBannerById, deleteAvatarById, getSuggestedUsers, getMostActiveUsers, getPasswordHashById,
  updatePasswordHashById, deactivateUser, clearFollows, getPrivacyById, updatePrivacy,
  getLikesPrivacyById, updateLikesPrivacy } from '../repositories/user.repository.js';
import { createNotification, notificationExists, deleteNotificationsByActorAndType, deleteNotificationsByType } from '../repositories/notification.repository.js';
import { isBlocked } from '../repositories/block.repository.js';
import pool from '../config/db.js';

// Valida unicidad de nickname/email y lanza el error correspondiente.
const assertNicknameEmailFree = async (normalizedNickname, normalizedEmail) => {
  const existing = await findByEmailOrNickname({
    nickname: normalizedNickname,
    email: normalizedEmail,
  });

  if (existing.nicknameTaken && existing.emailTaken) {
    const err = new Error('El nickname y el email ya están en uso');
    err.code = 'USER_EXISTS';
    throw err;
  }
  if (existing.nicknameTaken) {
    const err = new Error('El nickname ya está en uso');
    err.code = 'NICKNAME_EXISTS';
    throw err;
  }
  if (existing.emailTaken) {
    const err = new Error('El email ya está en uso');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }
};

// Paso 1 del registro: valida los datos, verifica el dominio del email, y envía
// un código de 6 dígitos al correo. NO crea la cuenta todavía: guarda los datos
// como una verificación pendiente hasta que se confirme el código.
// Envía el email con el código de verificación de 6 dígitos.
const sendVerificationCodeEmail = async (to, codigo) => {
  await sendEmail({
    to,
    subject: 'Tu código de verificación — UdelarHITS',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <h2 style="font-size: 20px; margin-bottom: 16px;">Confirmá tu correo</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
          Usá este código para terminar de crear tu cuenta en UdelarHITS.
          Si no fuiste vos, podés ignorar este mensaje.
        </p>
        <div style="font-size: 34px; font-weight: 700; letter-spacing: 8px; text-align: center;
                    background: #f3f4f6; border-radius: 10px; padding: 18px 0; color: #111;">
          ${codigo}
        </div>
        <p style="font-size: 13px; color: #999; margin-top: 24px; line-height: 1.5;">
          Este código expira en 15 minutos.
        </p>
      </div>
    `,
  });
};

const requestRegistrationService = async ({ nickname, nombre, email, password }) => {
  const normalizedNickname = nickname?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedNombre = nombre?.trim().toLowerCase();

  // Validaciones mínimas
  if (!normalizedNickname || !normalizedNombre || !normalizedEmail || !password) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Validación de nickname
  if (normalizedNickname.length < 3 || normalizedNickname.length > 30) {
    const err = new Error('El nickname debe tener entre 3 y 30 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (!/^[a-zA-ZÀ-ÿ0-9_-]+$/.test(normalizedNickname)) {
    const err = new Error('El nickname solo puede contener letras, números, guiones y guiones bajos');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Chequeo de password > 8 caracteres
  if (password.length < 8) {
    const err = new Error('La contraseña debe tener al menos 8 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (password.length > 128) {
    const err = new Error('La contraseña no puede superar los 128 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Chequeo de formato para correo electrónico (usamos una expresión regular: guiño a TeoLen)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    const err = new Error('Email inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Solo dominios de correo conocidos (bloquea correos temporales/desechables)
  if (!isAllowedEmailDomain(normalizedEmail)) {
    const err = new Error('Usá un email de un proveedor conocido (Gmail, Outlook, Proton, etc.). No se permiten correos temporales.');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Chequeo de existencia
  await assertNicknameEmailFree(normalizedNickname, normalizedEmail);

  // Rate limit de envío de mails a esta dirección
  if (!emailSendLimiter.check(`reg:${normalizedEmail}`)) {
    const err = new Error('Enviamos demasiados códigos a este correo. Esperá unos minutos.');
    err.code = 'RATE_LIMITED';
    throw err;
  }

  // Hash de password (se guarda en la verificación pendiente, no en texto plano)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Código de 6 dígitos, válido por 15 minutos
  const codigo = crypto.randomInt(100000, 1000000).toString();
  const expiraEn = new Date(Date.now() + 15 * 60 * 1000);

  await createVerification({
    email: normalizedEmail,
    codigo,
    nickname: normalizedNickname,
    nombre: normalizedNombre,
    passwordHash,
    expiraEn,
  });

  await sendVerificationCodeEmail(normalizedEmail, codigo);

  return { email: normalizedEmail };
};

// Paso 2 del registro: confirma el código y recién ahí crea la cuenta con los
// datos guardados en la verificación pendiente.
const verifyRegistrationService = async ({ email, codigo }) => {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedCodigo = String(codigo ?? '').trim();

  if (!normalizedEmail || !normalizedCodigo) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const pending = await findValidVerification(normalizedEmail);
  if (!pending) {
    const err = new Error('El código expiró o no es válido. Solicitá uno nuevo.');
    err.code = 'INVALID_CODE';
    throw err;
  }

  if (pending.codigo !== normalizedCodigo) {
    const intentos = await incrementVerificationAttempts(pending.id);
    if (intentos >= 5) {
      await markVerificationUsed(pending.id);
      const err = new Error('Demasiados intentos. Solicitá un código nuevo.');
      err.code = 'INVALID_CODE';
      throw err;
    }
    const err = new Error('Código incorrecto');
    err.code = 'INVALID_CODE';
    throw err;
  }

  // Reconfirmar unicidad por si alguien tomó el nickname/email entre medio.
  await assertNicknameEmailFree(pending.nickname, normalizedEmail);

  const user = await createUser({
    rol: 'user',
    nickname: pending.nickname,
    nombre: pending.nombre,
    email: normalizedEmail,
    passwordHash: pending.password_hash,
  });

  await markVerificationUsed(pending.id);

  // Token para iniciar sesión automáticamente al verificar.
  const token = generateToken(user.id);
  return { user, token };
};

// Reenvía el código a un registro pendiente, reusando los datos ya guardados
// (incluido el password_hash; nunca el texto plano). Pensado para que el usuario
// pueda retomar la verificación sin re-tipear sus datos. Responde de forma
// genérica desde el controller: nunca revela si existe un registro pendiente.
const resendRegistrationCodeService = async ({ email }) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return;

  const pending = await findValidVerification(normalizedEmail);
  if (!pending) return; // No hay nada pendiente: silencioso (sin fuga de info).

  // Rate limit compartido con el registro (mismo destino).
  if (!emailSendLimiter.check(`reg:${normalizedEmail}`)) return;

  const codigo = crypto.randomInt(100000, 1000000).toString();
  const expiraEn = new Date(Date.now() + 15 * 60 * 1000);

  // createVerification invalida la fila anterior e inserta una nueva con código
  // fresco (y contador de intentos en cero, como cualquier OTP nuevo).
  await createVerification({
    email: normalizedEmail,
    codigo,
    nickname: pending.nickname,
    nombre: pending.nombre,
    passwordHash: pending.password_hash,
    expiraEn,
  });

  await sendVerificationCodeEmail(normalizedEmail, codigo);
};

// Crear usuario admin
export const createUserByAdminService = async ({ nickname, nombre, email, password, rol }) => {
  const normalizedNickname = nickname?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedNombre = nombre?.trim().toLowerCase();

  if (!normalizedNickname || !normalizedNombre || !normalizedEmail || !password) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const existing = await findByEmailOrNickname({ 
    nickname: normalizedNickname, 
    email: normalizedEmail 
  });

  if (existing.nicknameTaken || existing.emailTaken) {
    const err = new Error('Ya existe un administrador con ese nickname o email');
    err.code = 'ADMIN_EXISTS';
    throw err;
  }

  const safeRole = rol === 'admin' ? 'admin' : 'user';

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await createUser({
    rol: safeRole,
    nickname: normalizedNickname,
    nombre: normalizedNombre,
    email: normalizedEmail,
    passwordHash,
  });

  return user;
};

const loginUserService =  async ({nickname ,email, password}) => {
    const normalizedNickname = nickname ? nickname.trim().toLowerCase() : null;
    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    if ((!normalizedNickname && !normalizedEmail) || !password) {
      const err = new Error('Faltan campos obligatorios');
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const existingUser = await findByEmailOrNicknameForLogin({ 
      nickname: normalizedNickname, 
      email: normalizedEmail 
    });
    
    // Chequeo de existencia
    if (!existingUser) {
        const err = new Error('El nombre o la contraseña no son correctas');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
    }

    if (!existingUser.password_hash) {
        const err = new Error('Esta cuenta usa Google para iniciar sesión. Usá el botón "Continuar con Google".');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
    }

    const isPasswordValid = await bcrypt.compare(password, existingUser.password_hash);

    if (!isPasswordValid) {
        const err = new Error('El nombre o la contraseña no son correctas');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
    }

    if(existingUser.estado !== 'activo'){
        const err = new Error('Esta cuenta no está activa');
        err.code = 'FORBIDDEN';
        throw err;
    }

    // Generar JWT token
    const token = generateToken(existingUser.id);

    const user = {
    id: existingUser.id,
    rol: existingUser.rol,
    nickname: existingUser.nickname,
    nombre: existingUser.nombre,
    email: existingUser.email,
    biografia: existingUser.biografia,
    url_imagen: existingUser.url_imagen,
    privado: existingUser.privado,
    me_gusta_privado: existingUser.me_gusta_privado,
    nickname_confirmado: existingUser.nickname_confirmado
    };

    return {user, token};
}

const getUsersService = async () => {
  return await getUsers();
};

const getUserProfileService = async (nickname, viewerId = null) => {
  const normalizedNickname = nickname?.trim().toLowerCase();

  if (!normalizedNickname) {
    const err = new Error('Falta nickname');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const user = await getUserByNickname(normalizedNickname);
  if (!user) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  let te_bloqueo = false;
  if (viewerId && viewerId !== user.id) {
    const blocked = await isBlocked(viewerId, user.id);
    if (blocked) {
      te_bloqueo = true;
      return {
        user: {
          id: user.id,
          nickname: user.nickname,
          nombre: user.nombre,
          url_imagen: null,
          url_banner: null,
          biografia: null,
          fecha_creacion: user.fecha_creacion,
          estado: user.estado,
          privado: false,
        },
        categories: [],
        followers: [],
        following: [],
        ya_sigo: false,
        mi_estado_seguimiento: 'none',
        te_bloqueo,
      };
    }
  }

  const categories = await getCategoriesByUserId(user.id);
  const followers = await getFollowersByUserId(user.id);
  const following = await getFollowingByUserId(user.id);

  let mi_estado_seguimiento = 'none';
  if (viewerId && viewerId !== user.id) {
    mi_estado_seguimiento = (await getFollowState(viewerId, user.id)) || 'none';
  }
  const ya_sigo = mi_estado_seguimiento === 'aceptado';

  return { user, categories, followers, following, ya_sigo, mi_estado_seguimiento, te_bloqueo };
};

const showMeService = async (nickname) => {
  const { user, categories, followers, following } = await getUserProfileService(nickname);

  const safeUser = {
    id: user.id,
    rol: user.rol,
    nickname: user.nickname,
    nombre: user.nombre,
    email: user.email,
    biografia: user.biografia,
    url_imagen: user.url_imagen,
    url_banner: user.url_banner,
    fecha_creacion: user.fecha_creacion,
    privado: user.privado,
    me_gusta_privado: user.me_gusta_privado,
    nickname_confirmado: user.nickname_confirmado
  };

  return { user: safeUser, categories, followers, following };
};

const updateMeService = async (userId, { nombre, biografia }) => {
  if (nombre === undefined && biografia === undefined) {
    const err = new Error('No hay campos para actualizar');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (typeof nombre === 'string' && nombre.length > 120) {
    const err = new Error('El nombre superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (biografia?.length > 160) {
    const err = new Error('La biografía superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const updated = await updateUserById(userId, {
    nombre,
    biografia
  });

  if (!updated) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return {
    user: {
      nickname: updated.nickname,
      nombre: updated.nombre,
      email: updated.email,
      biografia: updated.biografia,
      url_imagen: updated.url_imagen
    }
  };
};

const banUserService = async (nickname) => {
  const updated = await updateUserEstado(nickname, 'ban');
  if (!updated) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return updated;
};

const activeUserService = async (nickname) => {
  const updated = await updateUserEstado(nickname, 'activo');
  if (!updated) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return updated;
};

const deleteUserService = async (nickname) => {
  const user = await getUserByNickname(nickname);

  if (!user) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const categorias = await getCategoriesByUserId(user.id);

  if (categorias.length > 0) {
    const err = new Error('No se puede eliminar el usuario porque tiene categorías creadas');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const deleted = await deleteUserByNickname(nickname);
  return deleted;
};

const followUserService = async (seguidorId, seguidoNickname) => {
  const seguido = await getUserByNickname(seguidoNickname);
  if (!seguido) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (seguidorId === seguido.id) {
    const err = new Error('No podés seguirte a vos mismo');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const blocked = await isBlocked(seguidorId, seguido.id);
  if (blocked) {
    const err = new Error('No se puede realizar esta acción');
    err.code = 'FORBIDDEN';
    throw err;
  }

  // Cuenta privada → la solicitud queda pendiente hasta que el receptor la
  // acepte/rechace. Cuenta pública → seguimiento inmediato.
  const esPrivada = !!seguido.privado;
  const estado = esPrivada ? 'pendiente' : 'aceptado';
  const inserted = await followUser(seguidorId, seguido.id, estado);

  // Notificar al seguido (solo si fue un alta nueva, no re-follow idempotente).
  // Nunca a uno mismo (ya validado arriba). Dedup para que unfollow/re-follow
  // no duplique la notificación: la notificación persiste hasta que el receptor
  // la consume (en privadas, al aceptar/rechazar).
  if (inserted) {
    const tipo = esPrivada ? 'solicitud_seguimiento' : 'nuevo_seguidor';
    const dup = await notificationExists({
      tipo, actor_id: seguidorId, usuario_id: seguido.id,
    });
    if (!dup) {
      const { rows } = await pool.query('SELECT nickname FROM usuario WHERE id = $1', [seguidorId]);
      const nick = rows[0]?.nickname;
      await createNotification({
        usuario_id: seguido.id,
        tipo,
        mensaje: esPrivada
          ? `${nick} te envió una solicitud de seguimiento`
          : `${nick} te empezó a seguir`,
        contenido_id: null,
        actor_id: seguidorId,
        url: `/user/${nick}`,
      });
    }
  }

  const followers = await getFollowersByUserId(seguido.id);
  return { estado, seguidores: followers.length };
};

const unfollowUserService = async (seguidorId, seguidoNickname) => {
  const seguido = await getUserByNickname(seguidoNickname);
  if (!seguido) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  await unfollowUser(seguidorId, seguido.id);
  await deleteNotificationsByActorAndType(seguido.id, seguidorId, 'solicitud_seguimiento');
  const followers = await getFollowersByUserId(seguido.id);
  return { seguidores: followers.length };
};

// El receptor (receptorId) acepta la solicitud de solicitanteNickname.
const acceptFollowRequestService = async (receptorId, solicitanteNickname) => {
  const solicitante = await getUserByNickname(solicitanteNickname);
  if (!solicitante) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const accepted = await acceptFollowRequest(solicitante.id, receptorId);

  // Consumir la notificación de solicitud (desaparece del panel y reinicia el
  // dedup para futuras solicitudes).
  await deleteNotificationsByActorAndType(receptorId, solicitante.id, 'solicitud_seguimiento');

  // Avisar al solicitante que fue aceptado (solo si realmente había una
  // solicitud pendiente; si la canceló antes, no se notifica nada).
  if (accepted) {
    const { rows } = await pool.query('SELECT nickname FROM usuario WHERE id = $1', [receptorId]);
    const nick = rows[0]?.nickname;
    await createNotification({
      usuario_id: solicitante.id,
      tipo: 'solicitud_aceptada',
      mensaje: `${nick} aceptó tu solicitud de seguimiento`,
      contenido_id: null,
      actor_id: receptorId,
      url: `/user/${nick}`,
    });
  }

  const followers = await getFollowersByUserId(receptorId);
  return { aceptada: !!accepted, seguidores: followers.length };
};

// El receptor (receptorId) rechaza la solicitud de solicitanteNickname.
const rejectFollowRequestService = async (receptorId, solicitanteNickname) => {
  const solicitante = await getUserByNickname(solicitanteNickname);
  if (!solicitante) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  // Elimina la solicitud pendiente (el solicitante verá el botón volver a
  // "Seguir" al recargar y podrá volver a solicitar). No se notifica el rechazo.
  const rejected = await rejectFollowRequest(solicitante.id, receptorId);

  // Consumir la notificación de solicitud (desaparece del panel y reinicia el
  // dedup: un nuevo follow posterior sí generará una notificación nueva).
  await deleteNotificationsByActorAndType(receptorId, solicitante.id, 'solicitud_seguimiento');

  if (rejected) {
    const { getIO } = await import('../socket.js');
    const io = getIO();
    if (io) {
      io.to(`user:${solicitante.id}`).emit('seguimiento:actualizado');
    }
  }

  return { rechazada: !!rejected };
};

const isFollowingService = async (seguidorId, seguidoNickname) => {
  const seguido = await getUserByNickname(seguidoNickname);
  if (!seguido) return false;
  return await isFollowing(seguidorId, seguido.id);
};

const updateAvatarService = async (userId, fileBuffer, mimetype) => {
  if (!fileBuffer) {
    const err = new Error('No se proporcionó ninguna imagen');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const url = await uploadToCloudinary(fileBuffer, 'udelarhits/avatars', `avatar_${userId}`);
  const updated = await updateAvatarById(userId, url);
  return updated;
};

const searchUsersService = async (query, viewerId = null) => {
  if (!query || query.trim().length < 2) {
    return [];
  }
  return await searchUsers(query.trim(), viewerId);
};

const updateBannerService = async (userId, fileBuffer, mimetype) => {
  if (!fileBuffer) {
    const err = new Error('No se proporcionó ninguna imagen');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const url = await uploadToCloudinary(fileBuffer, 'udelarhits/banners', `banner_${userId}`);
  const updated = await updateBannerById(userId, url);
  return updated;
};

const deleteBannerService = async (userId) => {
  // Intentar borrar en Cloudinary, pero no romper si falla
  await deleteFromCloudinary('udelarhits/banners', `banner_${userId}`);
  return await deleteBannerById(userId);
};

const deleteAvatarService = async (userId) => {
  await deleteFromCloudinary('udelarhits/avatars', `avatar_${userId}`);
  return await deleteAvatarById(userId);
};

const getSuggestedUsersService = async (userId, limit) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 20);
  return await getSuggestedUsers(userId, safeLimit);
};

const getMostActiveUsersService = async (limit) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 5, 1), 10);
  return await getMostActiveUsers(safeLimit);
};

const changePasswordService = async (userId, { currentPassword, newPassword }) => {
  if (!currentPassword || !newPassword) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (newPassword.length < 8) {
    const err = new Error('La nueva contraseña debe tener al menos 8 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (newPassword.length > 128) {
    const err = new Error('La nueva contraseña no puede superar los 128 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const hash = await getPasswordHashById(userId);
  if (!hash) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const isValid = await bcrypt.compare(currentPassword, hash);
  if (!isValid) {
    const err = new Error('La contraseña actual no es correcta.');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);

  await updatePasswordHashById(userId, newHash);
};

const forgotPasswordService = async (email) => {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    const err = new Error('Falta el correo electrónico');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Buscar usuario por email (reutilizamos lo que ya existe)
  const user = await findByEmailOrNicknameForLogin({ nickname: null, email: normalizedEmail });

  // Si no existe, no hacemos nada pero tampoco revelamos que no existe
  if (!user) return;

  // Si está baneado o inactivo, tampoco enviamos
  if (user.estado !== 'activo') return;

  // Defensa 5: 1 recuperación exitosa por cuenta cada 24hs. peek() no consume:
  // el intento se registra recién DESPUÉS de que el mail salió bien, así un
  // fallo de envío no deja a la cuenta bloqueada un día sin haber recibido nada.
  if (!forgotAccountLimiter.peek(`acct:${user.id}`)) {
    const err = new Error('Ya se envió un enlace de recuperación para esta cuenta en las últimas 24 horas. Revisá tu correo (incluida la carpeta de spam) o probá de nuevo más tarde.');
    err.code = 'RATE_LIMITED';
    throw err;
  }

  // Rate limit de envío de mails a esta dirección (silencioso, sin fuga)
  if (!emailSendLimiter.check(`forgot:${normalizedEmail}`)) return;

  // Generar token seguro
  const token = crypto.randomBytes(32).toString('hex');
  const expiraEn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  await createResetToken(user.id, token, expiraEn);

  // Enviar email
  const resetUrl = `${process.env.APP_URL}/central/cuenta/reset-password.html?token=${token}`;

  await sendEmail({
    to: normalizedEmail,
    subject: 'Recuperar tu contraseña — UdelarHITS',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <h2 style="font-size: 20px; margin-bottom: 16px;">Recuperar tu contraseña</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en UdelarHITS. 
          Si no fuiste vos, podés ignorar este mensaje.
        </p>
        <a href="${resetUrl}" 
           style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #fff; 
                  text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Restablecer contraseña
        </a>
        <p style="font-size: 13px; color: #999; margin-top: 24px; line-height: 1.5;">
          Este enlace expira en 10 minutos. Si no solicitaste este cambio, no es necesario que hagas nada.
        </p>
      </div>
    `,
  });

  // El mail salió bien: recién ahora se consume el cupo de 24hs de la cuenta.
  forgotAccountLimiter.check(`acct:${user.id}`);
};

const verifyResetTokenService = async (token) => {
  if (!token) {
    const err = new Error('Token faltante');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const valid = await findValidToken(token);
  if (!valid) {
    const err = new Error('Token inválido o expirado');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  return true;
};

const resetPasswordService = async (token, newPassword) => {
  if (!token || !newPassword) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (newPassword.length < 8) {
    const err = new Error('La contraseña debe tener al menos 8 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (newPassword.length > 128) {
    const err = new Error('La contraseña no puede superar los 128 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const validToken = await findValidToken(token);
  if (!validToken) {
    const err = new Error('Token inválido o expirado');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);

  await updatePasswordHashById(validToken.usuario_id, newHash);
  await markTokenAsUsed(validToken.id);
};

const deactivateAccountService = async (userId, password) => {
  if (!password) {
    const err = new Error('Falta la contraseña');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const hash = await getPasswordHashById(userId);
  if (!hash) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const isValid = await bcrypt.compare(password, hash);
  if (!isValid) {
    const err = new Error('La contraseña no es correcta');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Borrar avatar y banner de Cloudinary
  await deleteFromCloudinary('udelarhits/avatars', `avatar_${userId}`);
  await deleteFromCloudinary('udelarhits/banners', `banner_${userId}`);

  // Limpiar seguidores en ambas direcciones
  await clearFollows(userId);

  // Desactivar cuenta (estado, avatar, banner, bio → NULL)
  await deactivateUser(userId);
};

const togglePrivacyService = async (userId) => {
  const current = await getPrivacyById(userId);
  if (!current) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const newValue = !current.privado;
  const updated = await updatePrivacy(userId, newValue);

  // Al pasar de privada a pública, las solicitudes pendientes se vuelven
  // seguimientos efectivos automáticamente, y sus notificaciones (que ya no se
  // pueden aceptar/rechazar) se limpian del panel.
  if (newValue === false) {
    await acceptAllPendingFollowRequests(userId);
    await deleteNotificationsByType(userId, 'solicitud_seguimiento');
  }

  return updated;
};

const toggleLikesPrivacyService = async (userId) => {
  const current = await getLikesPrivacyById(userId);
  if (!current) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const newValue = !current.me_gusta_privado;
  return await updateLikesPrivacy(userId, newValue);
};

const sanitizeNicknameBase = (nombre) => {
  const firstName = (nombre || 'usuario').split(/\s+/)[0];
  const base = firstName
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
  return base || 'usuario';
};

const generateNicknameFromGoogleProfile = async (nombre) => {
  const base = sanitizeNicknameBase(nombre);
  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}${suffix}`;
    if (!(await isNicknameTaken(candidate))) return candidate;
  }
  return `${base}${Date.now() % 100000}`;
};

const handleGoogleAuthService = async (profile) => {
  const email = profile?.emails?.[0]?.value?.trim().toLowerCase();
  const nombre = profile?.displayName?.trim() || 'Usuario de Google';

  if (!email) {
    const err = new Error('No se pudo obtener el email de la cuenta de Google');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const existingUser = await findByEmailForGoogleAuth(email);

  if (existingUser) {
    if (existingUser.auth_provider === 'google' || existingUser.auth_provider === 'both') {
      if (existingUser.estado !== 'activo') {
        const err = new Error('Esta cuenta no está activa');
        err.code = 'FORBIDDEN';
        throw err;
      }
      return existingUser;
    }

    const err = new Error('Ya existe una cuenta con ese email, iniciá sesión con tu contraseña');
    err.code = 'EMAIL_TAKEN_LOCAL';
    throw err;
  }

  const nickname = await generateNicknameFromGoogleProfile(nombre);

  return await createGoogleUser({ nickname, nombre, email });
};

const confirmNicknameService = async (userId, newNickname) => {
  const normalized = newNickname?.trim().toLowerCase();

  if (!normalized) {
    const err = new Error('El nickname es obligatorio');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (normalized.length > 30) {
    const err = new Error('El nickname no puede superar los 30 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (!/^[a-zA-ZÀ-ÿ0-9_-]+$/.test(newNickname.trim())) {
    const err = new Error('El nickname solo puede contener letras, números, guiones y guiones bajos');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const ownerCheck = await pool.query(
    'SELECT id FROM usuario WHERE LOWER(nickname) = LOWER($1) LIMIT 1', [normalized]
  );
  if (ownerCheck.rows.length > 0 && String(ownerCheck.rows[0].id) !== String(userId)) {
    const err = new Error('Ese nickname ya está en uso');
    err.code = 'NICKNAME_TAKEN';
    throw err;
  }

  return await confirmNickname(userId, newNickname.trim());
};

export { showMeService , requestRegistrationService, verifyRegistrationService, resendRegistrationCodeService, loginUserService, handleGoogleAuthService, confirmNicknameService, getUsersService, getUserProfileService,
  updateMeService, banUserService, activeUserService,
  deleteUserService, followUserService, unfollowUserService, isFollowingService,
  acceptFollowRequestService, rejectFollowRequestService,
  updateAvatarService, searchUsersService, updateBannerService,
  deleteAvatarService, deleteBannerService, getSuggestedUsersService, getMostActiveUsersService,
  changePasswordService, forgotPasswordService, verifyResetTokenService, resetPasswordService,
  deactivateAccountService, togglePrivacyService, toggleLikesPrivacyService };


