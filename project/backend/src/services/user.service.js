import bcrypt  from 'bcrypt';
import {uploadToCloudinary, deleteFromCloudinary, deleteAttachmentFromCloudinary} from '../utils/uploadToCloudinary.js';
import {generateToken} from '../utils/generateToken.js'
import crypto from 'crypto';
import { sendEmail } from '../utils/sendEmail.js';
import { createResetToken, findValidToken, markTokenAsUsed } from '../repositories/token.repository.js';
import { createVerification, findValidVerification, incrementVerificationAttempts, markVerificationUsed } from '../repositories/verification.repository.js';
import { isAllowedEmailDomain } from '../config/emailDomains.js';
import { createRateLimiter } from '../utils/rateLimiter.js';

// Máximo 5 correos por dirección cada 15 minutos.
const emailSendLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

// Una recuperación exitosa por cuenta cada 24 h, además de los límites por IP y por
// dirección: evita que una cuenta agote la cuota diaria de correo.
// La ventana es configurable para los tests.
const forgotAccountLimiter = createRateLimiter({
  windowMs: Number(process.env.FORGOT_PASSWORD_ACCOUNT_WINDOW_MS || 24 * 60 * 60 * 1000),
  max: 1,
});

// Solo para tests: el limiter vive en memoria y los ids se repiten entre tests.
export const _resetForgotAccountLimiter = () => forgotAccountLimiter.reset();
import {
  findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers, getUserIdByNickname, getUserByNickname, getUserById,
  findByEmailForGoogleAuth, isNicknameTaken, createGoogleUser, confirmNickname,
  getCategoriesByUserId, getFollowersByUserId, getFollowingByUserId, updateUserById, findFacultadByNombre,
  getUserAvatarUrlById, updateUserEstado, deleteUserByNickname, followUser, unfollowUser,
  isFollowing, getFollowState, acceptFollowRequest, rejectFollowRequest, acceptAllPendingFollowRequests, updateAvatarById, searchUsers, searchMentionCandidates, updateBannerById,
  deleteBannerById, deleteAvatarById, getSuggestedUsers, getMostActiveUsers, getRandomActiveUsers, getAccountAuthById, getPasswordHashById,
  updatePasswordHashById, deactivateUser, clearFollows, getPrivacyById, updatePrivacy,
  getLikesPrivacyById, updateLikesPrivacy } from '../repositories/user.repository.js';
import { createNotification, notificationExists, deleteNotificationsByActorAndType, deleteNotificationsByType } from '../repositories/notification.repository.js';
import { createPendingImagen, getPendingImagenesByUserTipo, deletePendingImagen } from '../repositories/pendingImage.repository.js';
import { notifyImagePending } from './pendingImage.service.js';
import { checkImageSafety, isVisionConfigured } from '../utils/checkImageSafety.js';
import { isBlocked, getBlockDirection } from '../repositories/block.repository.js';
import { canViewPrivateContent } from './access.service.js';
import pool from '../config/db.js';

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

// Opcional. Un valor debe existir en el catálogo de facultades; devuelve el nombre
// canónico, no lo que envió el cliente.
const normalizeFacultad = async (facultad) => {
  const raw = typeof facultad === 'string' ? facultad.trim() : facultad;
  if (raw === null || raw === '' || raw === undefined) return null;

  const found = typeof raw === 'string' ? await findFacultadByNombre(raw) : null;
  if (!found) {
    const err = new Error('Facultad no válida');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  return found.nombre;
};

const requestRegistrationService = async ({ nickname, nombre, email, password, facultad }) => {
  const normalizedNickname = nickname?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedNombre = nombre?.trim().toLowerCase();

  if (!normalizedNickname || !normalizedNombre || !normalizedEmail || !password) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    const err = new Error('Email inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!isAllowedEmailDomain(normalizedEmail)) {
    const err = new Error('Usá un email de un proveedor conocido (Gmail, Outlook, Proton, etc.). No se permiten correos temporales.');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Se valida antes de cualquier efecto: una facultad inválida no debe consumir el límite de envíos.
  const facultadNormalizada = await normalizeFacultad(facultad);

  await assertNicknameEmailFree(normalizedNickname, normalizedEmail);

  if (!emailSendLimiter.check(`reg:${normalizedEmail}`)) {
    const err = new Error('Enviamos demasiados códigos a este correo. Esperá unos minutos.');
    err.code = 'RATE_LIMITED';
    throw err;
  }

  // Se guarda el hash, no el texto plano.
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
    facultad: facultadNormalizada,
    expiraEn,
  });

  await sendVerificationCodeEmail(normalizedEmail, codigo);

  return { email: normalizedEmail };
};

// La cuenta se crea recién al confirmar el código.
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
    facultad: pending.facultad ?? null,
  });

  await markVerificationUsed(pending.id);

  const token = generateToken(user.id, pending.password_hash);
  return { user, token };
};

// Reusa los datos guardados para que el usuario no tenga que reingresarlos.
const resendRegistrationCodeService = async ({ email }) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return;

  const pending = await findValidVerification(normalizedEmail);
  if (!pending) return; // Sin registro pendiente no se hace nada, y no se revela.

  // Rate limit compartido con el registro (mismo destino).
  if (!emailSendLimiter.check(`reg:${normalizedEmail}`)) return;

  const codigo = crypto.randomInt(100000, 1000000).toString();
  const expiraEn = new Date(Date.now() + 15 * 60 * 1000);

  // El código nuevo invalida el anterior y reinicia los intentos.
  await createVerification({
    email: normalizedEmail,
    codigo,
    nickname: pending.nickname,
    nombre: pending.nombre,
    passwordHash: pending.password_hash,
    facultad: pending.facultad ?? null,
    expiraEn,
  });

  await sendVerificationCodeEmail(normalizedEmail, codigo);
};

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

    const token = generateToken(existingUser.id, existingUser.password_hash);

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

// Proyección pública: nunca incluye email, rol ni nickname_confirmado.
// La facultad se guarda abreviada; el nombre completo lo arma el backend.
const facultadNombreCompleto = (display) => (display ? `Facultad de ${display}` : null);

const toPublicUser = (user) => ({
  id: user.id,
  nickname: user.nickname,
  nombre: user.nombre,
  url_imagen: user.url_imagen,
  url_banner: user.url_banner,
  biografia: user.biografia,
  facultad: user.facultad ?? null,
  facultad_nombre: facultadNombreCompleto(user.facultad_display),
  fecha_creacion: user.fecha_creacion,
  estado: user.estado,
  privado: user.privado,
  me_gusta_privado: user.me_gusta_privado,
});

const getUserProfileService = async (nickname, viewerId = null, viewerRol = null) => {
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
  let yo_bloquee = false;
  if (viewerId && viewerId !== user.id) {
    const blocked = await isBlocked(viewerId, user.id);
    if (blocked) {
      te_bloqueo = true;
      const directions = await getBlockDirection(viewerId, user.id);
      yo_bloquee = directions ? directions.some(d => d.bloqueador_id === viewerId) : false;
      return {
        user: {
          id: user.id,
          nickname: user.nickname,
          nombre: user.nombre,
          url_imagen: null,
          url_banner: null,
          biografia: null,
          facultad: null,
          facultad_nombre: null,
          fecha_creacion: user.fecha_creacion,
          estado: user.estado,
          privado: false,
          me_gusta_privado: false,
        },
        categories: [],
        followers: [],
        following: [],
        ya_sigo: false,
        mi_estado_seguimiento: 'none',
        te_bloqueo,
        yo_bloquee,
        puede_ver: false,
      };
    }
  }

  let mi_estado_seguimiento = 'none';
  if (viewerId && viewerId !== user.id) {
    mi_estado_seguimiento = (await getFollowState(viewerId, user.id)) || 'none';
  }
  const ya_sigo = mi_estado_seguimiento === 'aceptado';

  // Mismo predicado que los endpoints de temas y comentarios (access.service).
  const isOwner = viewerId != null && Number(viewerId) === Number(user.id);
  const isAdmin = viewerRol === 'admin';
  const puede_ver = canViewPrivateContent({
    privado: user.privado,
    isOwner,
    isAdmin,
    isAcceptedFollower: ya_sigo,
  });

  const publicUser = toPublicUser(user);

  if (!puede_ver) {
    // Cuenta privada sin acceso: solo la card pública, sin categorías, seguidores ni actividad.
    return {
      user: publicUser,
      categories: [],
      followers: [],
      following: [],
      ya_sigo,
      mi_estado_seguimiento,
      te_bloqueo,
      yo_bloquee,
      puede_ver: false,
    };
  }

  const categories = await getCategoriesByUserId(user.id);
  const followers = await getFollowersByUserId(user.id);
  const following = await getFollowingByUserId(user.id);

  return {
    user: publicUser,
    categories,
    followers,
    following,
    ya_sigo,
    mi_estado_seguimiento,
    te_bloqueo,
    yo_bloquee,
    puede_ver: true,
  };
};

// Único endpoint que expone email y rol, siempre del propio usuario. Una sola query.
const showMeService = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const safeUser = {
    id: user.id,
    rol: user.rol,
    nickname: user.nickname,
    nombre: user.nombre,
    email: user.email,
    biografia: user.biografia,
    facultad: user.facultad ?? null,
    facultad_nombre: facultadNombreCompleto(user.facultad_display),
    url_imagen: user.url_imagen,
    url_banner: user.url_banner,
    fecha_creacion: user.fecha_creacion,
    privado: user.privado,
    me_gusta_privado: user.me_gusta_privado,
    push_activado: user.push_activado,
    nickname_confirmado: user.nickname_confirmado,
    auth_provider: user.auth_provider,
    // Sin contraseña, la baja de la cuenta se confirma con el nickname.
    tiene_password: user.tiene_password
  };

  return { user: safeUser };
};

const showMeFullService = async (userId) => {
  const { user } = await showMeService(userId);
  const [categories, followers, following] = await Promise.all([
    getCategoriesByUserId(user.id),
    getFollowersByUserId(user.id),
    getFollowingByUserId(user.id),
  ]);
  return { user, categories, followers, following };
};

const updateMeService = async (userId, { nombre, biografia, facultad }) => {
  if (nombre === undefined && biografia === undefined && facultad === undefined) {
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

  // `undefined` significa no modificar la facultad.
  let facultadNormalizada;
  if (facultad !== undefined) {
    facultadNormalizada = await normalizeFacultad(facultad);
  }

  const updated = await updateUserById(userId, {
    nombre,
    biografia,
    facultad: facultadNormalizada
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
      facultad: updated.facultad ?? null,
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

  // En cuentas privadas la solicitud queda pendiente; en públicas el seguimiento es inmediato.
  const esPrivada = !!seguido.privado;
  const estado = esPrivada ? 'pendiente' : 'aceptado';
  const inserted = await followUser(seguidorId, seguido.id, estado);

  // Solo si es un seguimiento nuevo; el dedup evita repetir el aviso ante unfollow y re-follow.
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

// Mismo borrado que un unfollow, iniciado por el seguido. No afecta a quién sigue el usuario.
const removeFollowerService = async (userId, seguidorNickname) => {
  const seguidor = await getUserByNickname(seguidorNickname);
  if (!seguidor) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  await unfollowUser(seguidor.id, userId);
  // Limpiar una eventual solicitud pendiente de ese seguidor hacia mí.
  await deleteNotificationsByActorAndType(userId, seguidor.id, 'solicitud_seguimiento');
  const followers = await getFollowersByUserId(userId);
  return { seguidores: followers.length };
};

const acceptFollowRequestService = async (receptorId, solicitanteNickname) => {
  const solicitante = await getUserByNickname(solicitanteNickname);
  if (!solicitante) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const accepted = await acceptFollowRequest(solicitante.id, receptorId);

  // La notificación de la solicitud se borra al resolverla.
  await deleteNotificationsByActorAndType(receptorId, solicitante.id, 'solicitud_seguimiento');

  // Solo si había una solicitud pendiente.
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

const rejectFollowRequestService = async (receptorId, solicitanteNickname) => {
  const solicitante = await getUserByNickname(solicitanteNickname);
  if (!solicitante) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  // El rechazo no se notifica.
  const rejected = await rejectFollowRequest(solicitante.id, receptorId);

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

// Vale la última imagen subida: se descarta la que hubiera quedado en revisión del mismo tipo.
const supersedePreviousPending = async (userId, tipo) => {
  const previas = await getPendingImagenesByUserTipo(userId, tipo);
  for (const p of previas) {
    await deleteAttachmentFromCloudinary(p.public_id, 'imagen');
    await deletePendingImagen(p.id);
  }
};

// Con moderación activa la imagen se sube a un id temporal que no pisa la visible;
// si es segura se promueve, y si no queda retenida y el perfil no cambia.
// Sin moderación configurada se sube directo.
const moderateProfileImage = async ({ userId, fileBuffer, tipo, folder, canonicalId, updateColumn }) => {
  if (!isVisionConfigured()) {
    const url = await uploadToCloudinary(fileBuffer, folder, canonicalId);
    return await updateColumn(userId, url);
  }

  // Antes de procesar la nueva: evita además violar el índice único si vuelve a quedar pendiente.
  await supersedePreviousPending(userId, tipo);

  const pendingFolder = 'udelarhits/pending';
  const pendingId = `${tipo}_pending_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const pendingUrl = await uploadToCloudinary(fileBuffer, pendingFolder, pendingId);

  // Si el análisis falla, se publica normalmente.
  let result;
  try {
    result = await checkImageSafety(pendingUrl);
  } catch (err) {
    console.error(`[vision] fallback publicando ${tipo} de usuario ${userId}: ${err.message}`);
    result = { safe: true };
  }

  if (result.safe) {
    const url = await uploadToCloudinary(fileBuffer, folder, canonicalId);
    await deleteFromCloudinary(pendingFolder, pendingId);
    return await updateColumn(userId, url);
  }

  await createPendingImagen({
    usuarioId: userId,
    url: pendingUrl,
    publicId: `${pendingFolder}/${pendingId}`,
    tipo,
    scoreAdult: result.scores?.adult ?? null,
    scoreRacy: result.scores?.racy ?? null,
  });
  await notifyImagePending(userId, null);
  return { pendiente: true };
};

const updateAvatarService = async (userId, fileBuffer, mimetype) => {
  if (!fileBuffer) {
    const err = new Error('No se proporcionó ninguna imagen');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  return await moderateProfileImage({
    userId, fileBuffer, tipo: 'avatar',
    folder: 'udelarhits/avatars', canonicalId: `avatar_${userId}`,
    updateColumn: updateAvatarById,
  });
};

const searchUsersService = async (query, viewerId = null) => {
  if (!query || query.trim().length < 2) {
    return [];
  }
  return await searchUsers(query.trim(), viewerId);
};

// Una entrada inválida devuelve [] sin error, para que el desplegable se vacíe.
const searchMentionCandidatesService = async (q, viewerId = null) => {
  const prefix = (q ?? '').toString().trim();
  if (prefix.length > 30 || !/^[\w.-]*$/.test(prefix)) return [];
  return await searchMentionCandidates(prefix, viewerId);
};

const updateBannerService = async (userId, fileBuffer, mimetype) => {
  if (!fileBuffer) {
    const err = new Error('No se proporcionó ninguna imagen');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  return await moderateProfileImage({
    userId, fileBuffer, tipo: 'banner',
    folder: 'udelarhits/banners', canonicalId: `banner_${userId}`,
    updateColumn: updateBannerById,
  });
};

const deleteBannerService = async (userId) => {
  await deleteFromCloudinary('udelarhits/banners', `banner_${userId}`);
  return await deleteBannerById(userId);
};

const deleteAvatarService = async (userId) => {
  await deleteFromCloudinary('udelarhits/avatars', `avatar_${userId}`);
  return await deleteAvatarById(userId);
};

const getSuggestedUsersService = async (userId, limit) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 20);
  // Sin sesión no hay afinidad que medir: usuarios activos al azar.
  if (!userId) return await getRandomActiveUsers(safeLimit);
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

  const account = await getAccountAuthById(userId);
  if (!account) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  // Sin contraseña (cuenta creada con Google), la contraseña actual no puede ser correcta.
  if (!account.password_hash) {
    const err = new Error('La contraseña actual no es correcta.');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const isValid = await bcrypt.compare(currentPassword, account.password_hash);
  if (!isValid) {
    const err = new Error('La contraseña actual no es correcta.');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);

  await updatePasswordHashById(userId, newHash);
  // El cambio invalida las sesiones abiertas; la actual sigue con un token nuevo.
  return { token: generateToken(userId, newHash) };
};

const createSessionTokenService = async (userId) =>
  generateToken(userId, await getPasswordHashById(userId));

const forgotPasswordService = async (email) => {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    const err = new Error('Falta el correo electrónico');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const user = await findByEmailOrNicknameForLogin({ nickname: null, email: normalizedEmail });

  // No se revela si el email existe.
  if (!user) return;

  // Si está baneado o inactivo, tampoco enviamos
  if (user.estado !== 'activo') return;

  // peek() no consume: el intento se registra recién cuando el correo salió.
  if (!forgotAccountLimiter.peek(`acct:${user.id}`)) {
    const err = new Error('Ya se envió un enlace de recuperación para esta cuenta en las últimas 24 horas. Revisá tu correo (incluida la carpeta de spam) o probá de nuevo más tarde.');
    err.code = 'RATE_LIMITED';
    throw err;
  }

  // Límite por dirección, sin revelarlo.
  if (!emailSendLimiter.check(`forgot:${normalizedEmail}`)) return;

  const token = crypto.randomBytes(32).toString('hex');
  const expiraEn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  await createResetToken(user.id, token, expiraEn);

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

  // Si la cuenta no tenía contraseña (creada con Google), este reset le agrega un
  // segundo método de acceso.
  const account = await getAccountAuthById(validToken.usuario_id);
  const esPrimeraPassword = !!account && !account.password_hash;

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);

  await updatePasswordHashById(validToken.usuario_id, newHash);
  await markTokenAsUsed(validToken.id);

  // Aviso de seguridad solo la primera vez que la cuenta obtiene contraseña;
  // si el envío falla, no bloquea.
  if (esPrimeraPassword && account.email) {
    try {
      await sendEmail({
        to: account.email,
        subject: 'Se agregó una contraseña a tu cuenta — UdelarHITS',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
            <h2 style="font-size: 20px; margin-bottom: 16px;">Se agregó una contraseña a tu cuenta</h2>
            <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 16px;">
              Tu cuenta de UdelarHITS ingresaba con Google y ahora también tiene una
              contraseña propia, configurada mediante el flujo de recuperación.
              A partir de ahora podés iniciar sesión con tu email y contraseña,
              además de Google.
            </p>
            <p style="font-size: 15px; color: #b91c1c; line-height: 1.6; margin-bottom: 8px; font-weight: 600;">
              Si no fuiste vos, contactanos de inmediato.
            </p>
            <p style="font-size: 13px; color: #999; margin-top: 16px; line-height: 1.5;">
              Podés escribirnos respondiendo a este correo.
            </p>
          </div>
        `,
      });
    } catch (e) {
      console.error('[reset-password] No se pudo enviar el aviso de contraseña agregada:', e.code || e.message);
    }
  }
};

const deactivateAccountService = async (userId, { password, nickname } = {}) => {
  const account = await getAccountAuthById(userId);
  if (!account) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (account.password_hash) {
    if (!password) {
      const err = new Error('Falta la contraseña');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const isValid = await bcrypt.compare(password, account.password_hash);
    if (!isValid) {
      const err = new Error('La contraseña no es correcta');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
  } else {
    // Sin contraseña, la confirmación es reingresar el nickname.
    if (!nickname || !nickname.trim()) {
      const err = new Error('Falta el nickname de confirmación');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    if (nickname.trim().toLowerCase() !== account.nickname.toLowerCase()) {
      const err = new Error('El nickname no coincide');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
  }

  await deleteFromCloudinary('udelarhits/avatars', `avatar_${userId}`);
  await deleteFromCloudinary('udelarhits/banners', `banner_${userId}`);

  await clearFollows(userId);

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

  // Al pasar a pública, las solicitudes pendientes se aceptan y sus notificaciones se borran.
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

// Último paso del alta con Google; la facultad es opcional, igual que en el registro por email.
const confirmNicknameService = async (userId, newNickname, facultad) => {
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

  // Se valida antes de confirmar el nickname: si es inválida, el alta falla entera.
  const facultadNormalizada = facultad !== undefined ? await normalizeFacultad(facultad) : undefined;

  const confirmed = await confirmNickname(userId, newNickname.trim());

  if (facultadNormalizada !== undefined) {
    await updateUserById(userId, { facultad: facultadNormalizada });
  }

  return confirmed;
};

export { showMeService, showMeFullService, requestRegistrationService, verifyRegistrationService, resendRegistrationCodeService, loginUserService, handleGoogleAuthService, confirmNicknameService, getUsersService, getUserProfileService,
  updateMeService, banUserService, activeUserService,
  deleteUserService, followUserService, unfollowUserService, removeFollowerService, isFollowingService,
  acceptFollowRequestService, rejectFollowRequestService,
  updateAvatarService, searchUsersService, searchMentionCandidatesService, updateBannerService,
  deleteAvatarService, deleteBannerService, getSuggestedUsersService, getMostActiveUsersService,
  changePasswordService, forgotPasswordService, verifyResetTokenService, resetPasswordService,
  deactivateAccountService, togglePrivacyService, toggleLikesPrivacyService, createSessionTokenService };


