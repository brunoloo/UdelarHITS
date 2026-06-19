import bcrypt  from 'bcrypt';
import {uploadToCloudinary, deleteFromCloudinary} from '../utils/uploadToCloudinary.js';
import {generateToken} from '../utils/generateToken.js'
import crypto from 'crypto';
import { sendEmail } from '../utils/sendEmail.js';
import { createResetToken, findValidToken, markTokenAsUsed } from '../repositories/token.repository.js';
import { 
  findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers, getUserIdByNickname, getUserByNickname,
  getCategoriesByUserId, getFollowersByUserId, getFollowingByUserId, updateUserById, 
  getUserAvatarUrlById, updateUserEstado, deleteUserByNickname, followUser, unfollowUser, 
  isFollowing, updateAvatarById, searchUsers, updateBannerById, 
  deleteBannerById, deleteAvatarById, getSuggestedUsers, getMostActiveUsers, getPasswordHashById, 
  updatePasswordHashById, deactivateUser, clearFollows, getPrivacyById, updatePrivacy } from '../repositories/user.repository.js';

const registerUserService = async ({ nickname, nombre, email, password}) => {

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
  if(password.length < 8){
    const err = new Error('La contraseña debe tener al menos 8 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Chequeo de formato para correo electrónico (usamos una expresión regular: guiño a TeoLen)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    const err = new Error('Email inválido');
    err.code = "BAD_REQUEST";
    throw err;
  }

  // Chequeo de existencia
  const existing = await findByEmailOrNickname({ 
    nickname: normalizedNickname, 
    email: normalizedEmail 
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

  // Hash de password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const rol = 'user';

  // Crear usuario
  const user = await createUser({
    rol,
    nickname: normalizedNickname,
    nombre: normalizedNombre,
    email: normalizedEmail,
    passwordHash,
  });

  return user;
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

    const isPasswordValid = await bcrypt.compare(password, existingUser.password_hash);

    if (!isPasswordValid) {
        const err = new Error('El nombre o la contraseña no son correctas');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
    }

    if(existingUser.estado !== 'activo'){
        const err = new Error('Tu cuenta no está activa');
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
    url_imagen: existingUser.url_imagen
    };

    return {user, token};
}

const getUsersService = async () => {
  return await getUsers();
};

const getUserProfileService = async (nickname) => {
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
  const categories = await getCategoriesByUserId(user.id);
  const followers = await getFollowersByUserId(user.id);
  const following = await getFollowingByUserId(user.id);

  return { user , categories, followers, following };
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
    privado: user.privado 
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
  await followUser(seguidorId, seguido.id);
  const followers = await getFollowersByUserId(seguido.id);
  return { seguidores: followers.length };
};

const unfollowUserService = async (seguidorId, seguidoNickname) => {
  const seguido = await getUserByNickname(seguidoNickname);
  if (!seguido) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  await unfollowUser(seguidorId, seguido.id);
  const followers = await getFollowersByUserId(seguido.id);
  return { seguidores: followers.length };
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
  const url = await uploadToCloudinary(fileBuffer, 'avatars', `avatar_${userId}`);
  const updated = await updateAvatarById(userId, url);
  return updated;
};

const searchUsersService = async (query) => {
  if (!query || query.trim().length < 2) {
    return [];
  }
  return await searchUsers(query.trim());
};

const updateBannerService = async (userId, fileBuffer, mimetype) => {
  if (!fileBuffer) {
    const err = new Error('No se proporcionó ninguna imagen');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const url = await uploadToCloudinary(fileBuffer, 'banners', `banner_${userId}`);
  const updated = await updateBannerById(userId, url);
  return updated;
};

const deleteBannerService = async (userId) => {
  // Intentar borrar en Cloudinary, pero no romper si falla
  await deleteFromCloudinary('banners', `banner_${userId}`);
  return await deleteBannerById(userId);
};

const deleteAvatarService = async (userId) => {
  await deleteFromCloudinary('avatars', `avatar_${userId}`);
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
  await deleteFromCloudinary('avatars', `avatar_${userId}`);
  await deleteFromCloudinary('banners', `banner_${userId}`);

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
  return updated;
};

export { showMeService ,registerUserService, loginUserService, getUsersService, getUserProfileService, 
  updateMeService, banUserService, activeUserService, 
  deleteUserService, followUserService, unfollowUserService, isFollowingService, 
  updateAvatarService, searchUsersService, updateBannerService, 
  deleteAvatarService, deleteBannerService, getSuggestedUsersService, getMostActiveUsersService, 
  changePasswordService, forgotPasswordService, verifyResetTokenService, resetPasswordService, 
  deactivateAccountService, togglePrivacyService };


