import bcrypt  from 'bcrypt';
import uploadToCloudinary from '../utils/uploadToCloudinary.js';
import {generateToken} from '../utils/generateToken.js'
import { 
  findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers, getUserIdByNickname, getUserByNickname,
  getCategoriesByUserId, getFollowersByUserId, getFollowingByUserId, updateUserById, 
  getUserAvatarUrlById, updateUserEstado, deleteUserByNickname, followUser, unfollowUser, 
  isFollowing, updateAvatarById, searchUsers, getUserBannerUrlById, updateBannerById, 
  deleteBannerById, deleteAvatarById } from '../repositories/user.repository.js';

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
        const err = new Error('Usuario baneado');
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
    fecha_creacion: user.fecha_creacion
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

const getUserAvatarService = async (userId) => {
  const url = await getUserAvatarUrlById(userId);
  if (url === undefined) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return url; // puede ser null
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
  return await deleteBannerById(userId);
};

const getUserBannerService = async (id) => {
  return await getUserBannerUrlById(id);
};

const deleteAvatarService = async (userId) => {
  return await deleteAvatarById(userId);
};

export { showMeService ,registerUserService, loginUserService, getUsersService, getUserProfileService, 
  updateMeService, getUserAvatarService, banUserService, activeUserService, 
  deleteUserService, followUserService, unfollowUserService, isFollowingService, 
  updateAvatarService, searchUsersService, updateBannerService, deleteBannerService, 
  getUserBannerService, deleteAvatarService };


