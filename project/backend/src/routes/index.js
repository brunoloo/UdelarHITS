import { Router } from 'express';
import pool from '../config/db.js';



const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'API OK' });
});

router.get('/health/db', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, dbTime: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;