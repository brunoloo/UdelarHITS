import pool from '../../src/config/db.js';
import { FACULTADES } from '../../../frontend/src/config/facultades.js';

// ─── Guardarraíl: config de facultades del front ↔ tabla `etiqueta` ───
// La card de facultades del sidebar usa una lista hardcodeada
// (frontend/src/config/facultades.js). Cada ficha navega a /?etiqueta=SIGLA, así
// que la sigla TIENE que existir como etiqueta.nombre con grupo 'Facultades'. Si
// alguien renombra una etiqueta en la base, la ficha quedaría filtrando vacío en
// silencio, sin error en ningún lado. Este test lo detecta al instante — es el
// único acoplamiento aceptable entre la lista hardcodeada y la base.

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
