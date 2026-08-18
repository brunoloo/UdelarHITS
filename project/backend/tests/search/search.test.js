import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import {
  registerAndLogin,
  createCategory,
  createTopic,
  createReply,
  createHomeReply,
  getTagIds,
} from '../helpers.js';

// ─── GET /api/search — buscador unificado ─────────────────────────────────────
// Cuatro secciones independientes (categorías, temas, comentarios, usuarios).
// El beforeEach global (tests/setup.js) hace TRUNCATE, así que cada test parte de
// una BD limpia y puede usar términos fijos sin colisiones.

const search = (qs) => request(app).get(`/api/search${qs}`);

// Helpers locales de manipulación de estado (visibilidad) por SQL directo: es la
// forma determinística de "ocultar" contenido sin depender del pipeline de
// moderación/reportes.
const setUsuarioEstado = (id, estado) =>
  pool.query('UPDATE usuario SET estado = $1 WHERE id = $2', [estado, id]);
const setCategoriaEstado = (id, estado) =>
  pool.query('UPDATE categoria SET estado = $1 WHERE id = $2', [estado, id]);
const setTemaEstado = (id, estado) =>
  pool.query('UPDATE tema SET estado = $1 WHERE contenido_id = $2', [estado, id]);
const setComentarioEstado = (id, estado) =>
  pool.query('UPDATE comentario SET estado = $1 WHERE contenido_id = $2', [estado, id]);
const setComentarioMotivo = (id, motivo) =>
  pool.query('UPDATE comentario SET motivo_inactivacion = $1 WHERE contenido_id = $2', [motivo, id]);
// Inserta un "me gusta" directo (determinístico) de un usuario sobre un contenido.
const addLike = (usuarioId, contenidoId) =>
  pool.query(`INSERT INTO reaccion (usuario_id, contenido_id, tipo) VALUES ($1, $2, 'meGusta')`,
    [usuarioId, contenidoId]);

// Crea categoría con etiquetas por nombre.
async function createWithTags(cookie, titulo, tagNames, descripcion) {
  const etiquetas = await getTagIds(tagNames);
  return createCategory(cookie, { titulo, etiquetas, ...(descripcion ? { descripcion } : {}) });
}

// ── Contrato / validación ─────────────────────────────────────────────────────
describe('GET /search — contrato', () => {
  test('q con menos de 2 caracteres → 400', async () => {
    const res = await search('?q=a');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('sin q → 400', async () => {
    const res = await search('');
    expect(res.status).toBe(400);
  });

  test('tipo inválido → 400', async () => {
    const res = await search('?q=hola&tipo=inexistente');
    expect(res.status).toBe(400);
  });

  test('sin tipo devuelve las cuatro secciones con items[] y hasMore', async () => {
    const res = await search('?q=zznoexiste');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    for (const k of ['categorias', 'temas', 'comentarios', 'usuarios']) {
      expect(res.body.data[k]).toHaveProperty('items');
      expect(Array.isArray(res.body.data[k].items)).toBe(true);
      expect(res.body.data[k]).toHaveProperty('hasMore');
    }
  });
});

// ── Categorías ────────────────────────────────────────────────────────────────
describe('GET /search — categorías', () => {
  test('matchea por título y por descripción; el match en título ordena primero', async () => {
    const a = await registerAndLogin();
    // Match en descripción (no en título).
    const enDesc = await createWithTags(a.cookie, 'Categoria Alfa ' + Date.now(), ['FING'],
      'Acá hablamos de zebra y más');
    // Match en título.
    const enTitulo = await createWithTags(a.cookie, 'Todo sobre zebra ' + Date.now(), ['FING'],
      'Descripción cualquiera');

    const res = await search('?q=zebra');
    expect(res.status).toBe(200);
    const ids = res.body.data.categorias.items.map(c => c.id);
    expect(ids).toContain(enTitulo.id);
    expect(ids).toContain(enDesc.id);
    // El de título va antes que el de solo-descripción.
    expect(ids.indexOf(enTitulo.id)).toBeLessThan(ids.indexOf(enDesc.id));
  });

  test('categoría inactiva no aparece', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Zebra inactiva ' + Date.now(), ['FING']);
    await setCategoriaEstado(cat.id, 'inactiva');

    const res = await search('?q=zebra');
    expect(res.body.data.categorias.items.map(c => c.id)).not.toContain(cat.id);
  });

  test('categoría de autor inactivo no aparece', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Zebra autor ' + Date.now(), ['FING']);
    await setUsuarioEstado(a.user.id, 'inactivo');

    const res = await search('?q=zebra');
    expect(res.body.data.categorias.items.map(c => c.id)).not.toContain(cat.id);
  });

  test('etiquetas viene como array sin NULL (ARRAY_AGG FILTER)', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Zebra con tags ' + Date.now(), ['FING', 'Programación']);

    const res = await search('?q=zebra');
    const found = res.body.data.categorias.items.find(c => c.id === cat.id);
    expect(found).toBeTruthy();
    expect(Array.isArray(found.etiquetas)).toBe(true);
    expect(found.etiquetas).not.toContain(null);

    // Categoría SIN etiquetas (insertada directo): debe dar [] o null, nunca [null].
    const { rows } = await pool.query(
      `INSERT INTO categoria (titulo, descripcion, autor_id) VALUES ($1, $2, $3) RETURNING id`,
      ['Zebra sin tags ' + Date.now(), 'zebra desc', a.user.id]
    );
    // Reactivar autor para que la categoría sea visible.
    await setUsuarioEstado(a.user.id, 'activo');
    const res2 = await search('?q=zebra');
    const tagless = res2.body.data.categorias.items.find(c => String(c.id) === String(rows[0].id));
    expect(tagless).toBeTruthy();
    const noNull = tagless.etiquetas == null || !tagless.etiquetas.includes(null);
    expect(noNull).toBe(true);
  });
});

// ── Temas ─────────────────────────────────────────────────────────────────────
describe('GET /search — temas', () => {
  test('matchea por título y por cuerpo del tema', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat temas ' + Date.now(), ['FING']);
    const porTitulo = await createTopic(a.cookie, {
      categoria_id: cat.id, titulo: 'Zebra en el titulo', cuerpo: 'nada especial',
    });
    const porCuerpo = await createTopic(a.cookie, {
      categoria_id: cat.id, titulo: 'Titulo neutro ' + Date.now(), cuerpo: 'hablando de zebra en el cuerpo',
    });

    const res = await search('?q=zebra');
    const ids = res.body.data.temas.items.map(t => t.id);
    expect(ids).toContain(porTitulo.contenido_id);
    expect(ids).toContain(porCuerpo.contenido_id);
  });

  test('orden por comentarios visibles DESC; tema sin comentarios igual aparece', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat orden ' + Date.now(), ['FING']);
    const conComentarios = await createTopic(a.cookie, {
      categoria_id: cat.id, titulo: 'Zebra con comentarios', cuerpo: 'x',
    });
    const sinComentarios = await createTopic(a.cookie, {
      categoria_id: cat.id, titulo: 'Zebra sin comentarios', cuerpo: 'x',
    });
    // Dos comentarios visibles en el primero.
    await createReply(a.cookie, { tema_id: conComentarios.contenido_id, cuerpo: 'c1' });
    await createReply(a.cookie, { tema_id: conComentarios.contenido_id, cuerpo: 'c2' });

    const res = await search('?q=zebra');
    const items = res.body.data.temas.items;
    const ids = items.map(t => t.id);
    // Ambos aparecen (el LEFT JOIN / subquery escalar no descarta el de 0 comentarios).
    expect(ids).toContain(conComentarios.contenido_id);
    expect(ids).toContain(sinComentarios.contenido_id);
    // El de más comentarios va primero.
    expect(ids.indexOf(conComentarios.contenido_id)).toBeLessThan(ids.indexOf(sinComentarios.contenido_id));
    // COUNT llega como string: castear.
    const sin = items.find(t => t.id === sinComentarios.contenido_id);
    expect(Number(sin.contador_comentarios)).toBe(0);
    const con = items.find(t => t.id === conComentarios.contenido_id);
    expect(Number(con.contador_comentarios)).toBe(2);
  });

  test('comentario inactivado no infla el conteo que ordena temas', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat conteo ' + Date.now(), ['FING']);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id, titulo: 'Zebra conteo', cuerpo: 'x' });
    await createReply(a.cookie, { tema_id: tema.contenido_id, cuerpo: 'visible' });
    const oculto = await createReply(a.cookie, { tema_id: tema.contenido_id, cuerpo: 'a ocultar' });
    // Inactivar por moderación (motivo != NULL): no debe contar.
    await setComentarioMotivo(oculto.contenido_id, 'moderacion_admin');

    const res = await search('?q=zebra&tipo=temas');
    const t = res.body.data.items.find(x => x.id === tema.contenido_id);
    expect(Number(t.contador_comentarios)).toBe(1);
  });

  test('tema inactivo no aparece', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat tinact ' + Date.now(), ['FING']);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id, titulo: 'Zebra tema inact', cuerpo: 'x' });
    await setTemaEstado(tema.contenido_id, 'inactivo');

    const res = await search('?q=zebra');
    expect(res.body.data.temas.items.map(t => t.id)).not.toContain(tema.contenido_id);
  });

  test('tema cuya categoría está inactiva no aparece', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat catinact ' + Date.now(), ['FING']);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id, titulo: 'Zebra cat inact', cuerpo: 'x' });
    await setCategoriaEstado(cat.id, 'inactiva');

    const res = await search('?q=zebra');
    expect(res.body.data.temas.items.map(t => t.id)).not.toContain(tema.contenido_id);
  });

  test('tema de autor inactivo no aparece', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat tautor ' + Date.now(), ['FING']);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id, titulo: 'Zebra tema autor', cuerpo: 'x' });
    await setUsuarioEstado(a.user.id, 'inactivo');

    const res = await search('?q=zebra');
    expect(res.body.data.temas.items.map(t => t.id)).not.toContain(tema.contenido_id);
  });
});

// ── Comentarios ───────────────────────────────────────────────────────────────
describe('GET /search — comentarios', () => {
  test('matchea nivel 1 en los tres ámbitos; excluye respuestas anidadas', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat coment ' + Date.now(), ['FING']);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id, titulo: 'Tema neutro ' + Date.now(), cuerpo: 'x' });

    const enHome = await createHomeReply(a.cookie, { cuerpo: 'zebra en home' });
    const enTema = await createReply(a.cookie, { tema_id: tema.contenido_id, cuerpo: 'zebra en tema' });
    const enCat = await createReply(a.cookie, { categoria_id: cat.id, cuerpo: 'zebra en categoria' });
    // Respuesta anidada (nivel 2) con el término: NO debe aparecer.
    const anidada = await createReply(a.cookie, {
      tema_id: tema.contenido_id, comentario_padre_id: enTema.contenido_id, cuerpo: 'zebra anidada',
    });

    const res = await search('?q=zebra');
    const ids = res.body.data.comentarios.items.map(c => c.id);
    expect(ids).toContain(enHome.contenido_id);
    expect(ids).toContain(enTema.contenido_id);
    expect(ids).toContain(enCat.contenido_id);
    expect(ids).not.toContain(anidada.contenido_id);

    // El ámbito viene en el payload para armar el permalink en el front.
    const home = res.body.data.comentarios.items.find(c => c.id === enHome.contenido_id);
    expect(home.tipo).toBe('home');
    const tem = res.body.data.comentarios.items.find(c => c.id === enTema.contenido_id);
    expect(tem.tipo).toBe('tema');
    expect(Number(tem.destino_id)).toBe(Number(tema.contenido_id));
  });

  test('orden por likes DESC, fecha DESC, id DESC', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat likes ' + Date.now(), ['FING']);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id, titulo: 'Tema likes ' + Date.now(), cuerpo: 'x' });
    const c1 = await createReply(a.cookie, { tema_id: tema.contenido_id, cuerpo: 'zebra uno' });
    const c2 = await createReply(a.cookie, { tema_id: tema.contenido_id, cuerpo: 'zebra dos' });
    // Dos likes a c2, cero a c1 → c2 primero. Likes de otros usuarios (UNIQUE por usuario).
    const l1 = await registerAndLogin();
    const l2 = await registerAndLogin();
    await addLike(l1.user.id, c2.contenido_id);
    await addLike(l2.user.id, c2.contenido_id);

    const res = await search('?q=zebra');
    const ids = res.body.data.comentarios.items.map(c => c.id);
    expect(ids.indexOf(c2.contenido_id)).toBeLessThan(ids.indexOf(c1.contenido_id));
    const item2 = res.body.data.comentarios.items.find(c => c.id === c2.contenido_id);
    expect(Number(item2.likes)).toBe(2);
  });

  test('comentario oculto no aparece', async () => {
    const a = await registerAndLogin();
    const c = await createHomeReply(a.cookie, { cuerpo: 'zebra oculto' });
    await setComentarioEstado(c.contenido_id, 'oculto');
    const res = await search('?q=zebra');
    expect(res.body.data.comentarios.items.map(x => x.id)).not.toContain(c.contenido_id);
  });

  test('comentario con motivo_inactivacion no aparece', async () => {
    const a = await registerAndLogin();
    const c = await createHomeReply(a.cookie, { cuerpo: 'zebra motivo' });
    await setComentarioMotivo(c.contenido_id, 'moderacion_reporte');
    const res = await search('?q=zebra');
    expect(res.body.data.comentarios.items.map(x => x.id)).not.toContain(c.contenido_id);
  });

  test('comentario de autor inactivo no aparece', async () => {
    const a = await registerAndLogin();
    const c = await createHomeReply(a.cookie, { cuerpo: 'zebra autor coment' });
    await setUsuarioEstado(a.user.id, 'inactivo');
    const res = await search('?q=zebra');
    expect(res.body.data.comentarios.items.map(x => x.id)).not.toContain(c.contenido_id);
  });

  test('comentario en tema cuya categoría está inactiva no aparece', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat coment inact ' + Date.now(), ['FING']);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id, titulo: 'Tema ci ' + Date.now(), cuerpo: 'x' });
    const c = await createReply(a.cookie, { tema_id: tema.contenido_id, cuerpo: 'zebra contenedor' });
    await setCategoriaEstado(cat.id, 'inactiva');
    const res = await search('?q=zebra');
    expect(res.body.data.comentarios.items.map(x => x.id)).not.toContain(c.contenido_id);
  });
});

// ── Etiqueta + texto ──────────────────────────────────────────────────────────
describe('GET /search — etiqueta + texto', () => {
  test('restringe categorías/temas a la etiqueta y excluye comentarios de home', async () => {
    const a = await registerAndLogin();
    const catFing = await createWithTags(a.cookie, 'Zebra FING ' + Date.now(), ['FING']);
    const catProg = await createWithTags(a.cookie, 'Zebra Prog ' + Date.now(), ['Programación']);
    const temaFing = await createTopic(a.cookie, { categoria_id: catFing.id, titulo: 'Zebra tema fing', cuerpo: 'x' });
    const comFing = await createReply(a.cookie, { categoria_id: catFing.id, cuerpo: 'zebra en cat fing' });
    const comHome = await createHomeReply(a.cookie, { cuerpo: 'zebra en home' });

    const res = await search('?q=zebra&etiqueta=FING');
    expect(res.status).toBe(200);
    // Categorías: solo la de FING.
    const catIds = res.body.data.categorias.items.map(c => c.id);
    expect(catIds).toContain(catFing.id);
    expect(catIds).not.toContain(catProg.id);
    // Temas: solo los de categoría FING.
    expect(res.body.data.temas.items.map(t => t.id)).toContain(temaFing.contenido_id);
    // Comentarios: el de categoría FING sí, el de home NO.
    const comIds = res.body.data.comentarios.items.map(c => c.id);
    expect(comIds).toContain(comFing.contenido_id);
    expect(comIds).not.toContain(comHome.contenido_id);
  });

  test('con etiqueta, la sección usuarios viene vacía', async () => {
    const a = await registerAndLogin({ nickname: 'zebrauser_' + Math.random().toString(36).slice(2, 7) });
    await createWithTags(a.cookie, 'Zebra cat ' + Date.now(), ['FING']);
    const res = await search('?q=zebra&etiqueta=FING');
    expect(res.body.data.usuarios.items).toEqual([]);
    expect(res.body.data.usuarios.hasMore).toBe(false);
  });
});

// ── Usuarios ──────────────────────────────────────────────────────────────────
describe('GET /search — usuarios', () => {
  test('matchea por nickname y excluye inactivos', async () => {
    const a = await registerAndLogin({ nickname: 'zebrator', nombre: 'Persona Uno' });
    const b = await registerAndLogin({ nickname: 'zebrando', nombre: 'Persona Dos' });
    await setUsuarioEstado(b.user.id, 'inactivo');

    const res = await search('?q=zebra&tipo=usuarios');
    const nicks = res.body.data.items.map(u => u.nickname);
    expect(nicks).toContain('zebrator');
    expect(nicks).not.toContain('zebrando');
  });

  test('exclusión bidireccional de bloqueados', async () => {
    // A bloquea B: B no aparece cuando A busca; y A no aparece cuando B busca.
    const a = await registerAndLogin({ nickname: 'zebrablocka', nombre: 'A' });
    const b = await registerAndLogin({ nickname: 'zebrablockb', nombre: 'B' });
    await request(app).post(`/api/users/${b.user.nickname}/block`).set('Cookie', a.cookie);

    const asA = await request(app).get('/api/search?q=zebra&tipo=usuarios').set('Cookie', a.cookie);
    expect(asA.body.data.items.map(u => u.nickname)).not.toContain('zebrablockb');

    const asB = await request(app).get('/api/search?q=zebra&tipo=usuarios').set('Cookie', b.cookie);
    expect(asB.body.data.items.map(u => u.nickname)).not.toContain('zebrablocka');

    // Sin viewer (anónimo) ambos aparecen.
    const anon = await search('?q=zebra&tipo=usuarios');
    const anonNicks = anon.body.data.items.map(u => u.nickname);
    expect(anonNicks).toContain('zebrablocka');
    expect(anonNicks).toContain('zebrablockb');
  });
});

// ── Escaping de LIKE / seguridad de regex ─────────────────────────────────────
describe('GET /search — escaping y seguridad', () => {
  test('buscar "100%" no devuelve todo (comodín literal, no wildcard)', async () => {
    const a = await registerAndLogin();
    const match = await createWithTags(a.cookie, 'Descuento 100% asegurado ' + Date.now(), ['FING']);
    const otra = await createWithTags(a.cookie, 'Cosa sin relacion ' + Date.now(), ['FING']);

    const res = await search(`?q=${encodeURIComponent('100%')}`);
    const ids = res.body.data.categorias.items.map(c => c.id);
    expect(ids).toContain(match.id);
    expect(ids).not.toContain(otra.id);
  });

  test('buscar "c++" no tira 500 (sin regex sobre input)', async () => {
    const res = await search(`?q=${encodeURIComponent('c++')}`);
    expect(res.status).toBe(200);
  });

  test('buscar "((" (paréntesis) no tira 500', async () => {
    const res = await search(`?q=${encodeURIComponent('((')}`);
    expect(res.status).toBe(200);
  });

  test('sección usuarios: "_" es literal, no wildcard (nuevo call site escapado)', async () => {
    const a = await registerAndLogin({ nickname: 'zebra_x', nombre: 'Zebra Test' });
    // "z_bra" como wildcard matchearía "zebra"; escapado, no.
    const res = await search('?q=z_bra&tipo=usuarios');
    expect(res.status).toBe(200);
    expect(res.body.data.items.map(u => u.nickname)).not.toContain('zebra_x');
  });
});

// ── Snippet partido en tres ───────────────────────────────────────────────────
describe('GET /search — snippet', () => {
  test('devuelve before/match/after correctos con tildes y emoji antes del match', async () => {
    const a = await registerAndLogin();
    // Emoji + tilde ANTES del match: si hubiera aritmética de índices SQL↔JS, el
    // match saldría corrido. Partido en tres, snippet_match es exacto.
    const c = await createHomeReply(a.cookie, { cuerpo: 'Introducción ☕ RESUMEN final del curso' });

    const res = await search('?q=resumen');
    const item = res.body.data.comentarios.items.find(x => x.id === c.contenido_id);
    expect(item).toBeTruthy();
    // El match conserva el casing original y no arrastra caracteres vecinos.
    expect(item.snippet_match).toBe('RESUMEN');
    // El "antes" conserva la tilde y el emoji intactos.
    expect(item.snippet_before).toContain('Introducción');
    expect(item.snippet_before).toContain('☕');
    // El "después" arranca justo tras el match.
    expect(item.snippet_after.startsWith(' final')).toBe(true);
  });

  test('match solo por título → snippet null', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Zebra en titulo ' + Date.now(), ['FING'],
      'descripcion sin la palabra buscada');
    const res = await search('?q=zebra');
    const found = res.body.data.categorias.items.find(c => c.id === cat.id);
    expect(found).toBeTruthy();
    expect(found.snippet_match).toBeNull();
    expect(found.snippet_before).toBeNull();
    expect(found.snippet_after).toBeNull();
  });
});

// ── Paginación (ver más) ──────────────────────────────────────────────────────
describe('GET /search — paginación', () => {
  test('hasMore por limit+1 y offset no repite ni saltea', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat pag ' + Date.now(), ['FING']);
    // Cuatro comentarios de home que matchean.
    const ids = [];
    for (let i = 0; i < 4; i++) {
      const c = await createHomeReply(a.cookie, { cuerpo: `zebra pag ${i}` });
      ids.push(c.contenido_id);
    }

    const page1 = await search('?q=zebra&tipo=comentarios&limit=2&offset=0');
    expect(page1.body.data.items.length).toBe(2);
    expect(page1.body.data.hasMore).toBe(true);

    const page2 = await search('?q=zebra&tipo=comentarios&limit=2&offset=2');
    expect(page2.body.data.items.length).toBe(2);
    expect(page2.body.data.hasMore).toBe(false);

    // Sin solapamiento entre páginas (orden total estable por id DESC).
    const p1 = page1.body.data.items.map(x => x.id);
    const p2 = page2.body.data.items.map(x => x.id);
    expect(p1.filter(id => p2.includes(id))).toEqual([]);
    // Cobertura completa de los 4.
    expect([...p1, ...p2].sort()).toEqual([...ids].sort());
  });
});

// ── Call sites existentes con escaping ────────────────────────────────────────
describe('escaping en endpoints existentes', () => {
  test('/api/users/search: "_" es literal (call site user.repository)', async () => {
    const a = await registerAndLogin({ nickname: 'zebra_y', nombre: 'Zebra Y' });
    const res = await request(app).get('/api/users/search?q=z_bra');
    expect(res.status).toBe(200);
    expect(res.body.data.map(u => u.nickname)).not.toContain('zebra_y');
  });

  test('/api/categories/etiquetas/search: "%" y "_" son literales (call site category.repository)', async () => {
    // "%" como prefijo literal no matchea ninguna etiqueta (ninguna empieza con %).
    const pct = await request(app).get(`/api/categories/etiquetas/search?q=${encodeURIComponent('%')}`);
    expect(pct.status).toBe(200);
    expect(pct.body.data).toEqual([]);
    // "F_NG" como wildcard matchearía "FING"; escapado, no.
    const und = await request(app).get('/api/categories/etiquetas/search?q=F_NG');
    expect(und.status).toBe(200);
    expect(und.body.data.map(e => e.nombre)).not.toContain('FING');
  });
});
