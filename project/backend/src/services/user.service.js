import bcrypt  from 'bcrypt';
import { 
  findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers, getUserByNickname,
  getCategoriesByUserId, getFollowersByUserId, getFollowingByUserId } from '../repositories/user.repository.js';
import {generateToken} from '../utils/generateToken.js'

const registerUserService = async ({ nickname, nombre, email, password}) => {
  // Validaciones mínimas
  if (!nickname || !nombre || !email || !password) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Chequeo de existencia
  const existingUser = await findByEmailOrNickname({ nickname, email });
  if (existingUser) {
    const err = new Error('Ya existe un usuario con ese nickname o email');
    err.code = 'USER_EXISTS';
    throw err;
  }

  // Hash de password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const rol = 'user';

  // Crear usuario
  const user = await createUser({
    rol,
    nickname,
    nombre,
    email,
    passwordHash,
  });

  return user;
};

// Crear usuario admin
export const createUserByAdminService = async ({ nickname, nombre, email, password, rol }) => {
  if (!nickname || !nombre || !email || !password) {
    const err = new Error('Faltan campos obligatorios');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const existingUser = await findByEmailOrNickname({ nickname, email });
  if (existingUser) {
    const err = new Error('Ya existe un administrador con ese nickname o email');
    err.code = 'ADMIN_EXISTS';
    throw err;
  }

  // default seguro
  const safeRole = rol === 'admin' ? 'admin' : 'user';

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Crear administrador
  const user = await createUser({
    rol: safeRole,
    nickname,
    nombre,
    email,
    passwordHash,
  });

  return user;
};

const loginUserService =  async ({nickname ,email, password}) => {
    if ( (!nickname && !email) || !password){
        const err = new Error('Faltan campos obligatorios');
        err.code = 'BAD_REQUEST';
        throw err;
    }

    // Chequeo de existencia
    const existingUser = await findByEmailOrNicknameForLogin({ nickname, email });
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
  if (!nickname) {
    const err = new Error('Falta nickname');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const user = await getUserByNickname(nickname);
  if (!user) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const categories = await getCategoriesByUserId(user.id);
  const followers = await getFollowersByUserId(user.id);
  const following = await getFollowingByUserId(user.id);

  return { user, categories, followers, following };
};

export { registerUserService, loginUserService, getUsersService, getUserProfileService };


