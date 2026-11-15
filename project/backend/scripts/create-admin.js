// Crea una cuenta de administrador a partir de variables de entorno:
//   ADMIN_NICKNAME, ADMIN_EMAIL y ADMIN_PASSWORD (12 caracteres como mínimo).
import '../src/config/env.js';
import pool from '../src/config/db.js';
import { createUserByAdminService } from '../src/services/user.service.js';

const MIN_PASSWORD_LENGTH = 12;

const { ADMIN_NICKNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

async function main() {
  if (!ADMIN_NICKNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Faltan ADMIN_NICKNAME, ADMIN_EMAIL o ADMIN_PASSWORD.');
  }
  if (ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  const user = await createUserByAdminService({
    nickname: ADMIN_NICKNAME,
    nombre: ADMIN_NICKNAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    rol: 'admin',
  });
  console.log(`Administrador creado: ${user.nickname} (id ${user.id})`);
}

main()
  .catch((error) => {
    console.error(`No se pudo crear el administrador: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
