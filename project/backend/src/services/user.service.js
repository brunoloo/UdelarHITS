import bcrypt  from 'bcrypt';
import { findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin } from '../repositories/user.repository.js';

const registerUserService = async ({ nickname, nombre, email, password }) => {
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

  // Crear usuario
  const user = await createUser({
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

    const user = {
    id: existingUser.id,
    nickname: existingUser.nickname,
    nombre: existingUser.nombre,
    email: existingUser.email,
    biografia: existingUser.biografia,
    url_imagen: existingUser.url_imagen
    };

    return { user };
}

export { registerUserService, loginUserService };


