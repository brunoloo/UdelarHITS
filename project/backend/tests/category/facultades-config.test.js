import pool from '../../src/config/db.js';
import { FACULTADES } from '../../../frontend/src/config/facultades.js';

// La lista de facultades del frontend está fija en código: cada sigla tiene que existir
// como etiqueta del grupo 'Facultades'.

describe('config de facultades (front) contra la tabla etiqueta', () => {
  test('las 16 facultades esperadas están declaradas en el config', () => {
    expect(FACULTADES).toHaveLength(16);
  });

  test('cada sigla del config existe en `etiqueta` con grupo = \'Facultades\'', async () => {
    const { rows } = await pool.query(
      `SELECT nombre FROM etiqueta WHERE grupo = 'Facultades'`
    );
    const enBase = new Set(rows.map(r => r.nombre));

    const faltantes = FACULTADES
      .map(f => f.sigla)
      .filter(sigla => !enBase.has(sigla));

    expect(faltantes).toEqual([]);
  });
});
