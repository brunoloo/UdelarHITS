import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const seedAdmin = async () => {
  try {
    const password = 'Admin123!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const q = `
      INSERT INTO usuario (nickname, nombre, email, password_hash, rol)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nickname, email, rol
    `;

    const values = ['admin', 'Administrador', 'admin@gmail.com', passwordHash, 'admin'];
    const { rows } = await pool.query(q, values);

    console.log('Admin creado:', rows[0]);
  } catch (err) {
    console.error('Error al crear admin:', err.message);
  } finally {
    await pool.end();
  }
};

seedAdmin();