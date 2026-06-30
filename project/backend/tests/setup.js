import pool from '../src/config/db.js';

const TABLES = [
  'mensaje', 'conversacion',
  'bloqueo',
  'apelacion', 'reporte', 'reaccion',
  'historial_edicion_comentario', 'historial_edicion_categoria',
  'comentario', 'tema', 'contenido',
  'participacion_categoria', 'categoria_etiqueta', 'categoria',
  'usuario_seguidor', 'usuario', 'notificacion', 'historial_edicion_tema',
  'token_reset_password', 'reporte_usuario',
];

beforeEach(async () => {
  if (!process.env.DB_NAME?.includes('test')) {
    throw new Error(`ABORTADO: DB_NAME="${process.env.DB_NAME}" no es una BD de test. Truncate cancelado.`);
  }
  await pool.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await pool.end();
});