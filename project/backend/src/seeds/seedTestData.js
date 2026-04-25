import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const SALT_ROUNDS = 10;

const usuarios = [
  {
    nickname: 'brunoloo',
    nombre: '︻╦╤─ ҉ ----',
    email: 'bruno@gmail.com',
    password: '12345678',
    rol: 'admin',
    biografia: 'this is empty',
    url_imagen: 'https://imgs.search.brave.com/gKlg5BzWkqOP2j73PBYVXkRmVJ5h5BIIEbW5mZx-SiY/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vb3Jp/Z2luYWxzLzZlLzZh/L2Y1LzZlNmFmNWQy/ODhjZDgyNTk0YzE0/M2Y0YzgzOTFkNzJi/LmpwZw',
    fecha_creacion: '4713-01-01 00:00:00 BC',
  },
  {
    nickname: 'luffy',
    nombre: 'Monkey D. Luffy',
    email: 'luffy@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Monkey D. Luffy',
    url_imagen: 'https://static.wikitide.net/deathbattlewiki/2/28/Portrait.monkeydluffy.png',
    fecha_creacion: '1522-05-05 08:00:00',
  },
  {
    nickname: 'zoro',
    nombre: 'Roronoa Zoro',
    email: 'zoro@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Roronoa Zoro',
    url_imagen: 'https://static.wikia.nocookie.net/glad-you-came/images/a/a2/Zoro.png/revision/latest?cb=20230710081928',
    fecha_creacion: '1522-11-11 06:30:00',
  },
  {
    nickname: 'nami',
    nombre: 'Nami',
    email: 'nami@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Nami',
    url_imagen: 'https://static.wikia.nocookie.net/fairypirates/images/d/dd/Nami.png/revision/latest?cb=20161022095010',
    fecha_creacion: '1522-07-03 10:00:00',
  },
  {
    nickname: 'usopp',
    nombre: 'Usopp',
    email: 'usopp@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Usopp',
    url_imagen: 'https://i.blogs.es/b46e01/usopp/500_333.jpeg',
    fecha_creacion: '1522-04-01 09:00:00',
  },
  {
    nickname: 'sanji',
    nombre: 'Vinsmoke Sanji',
    email: 'sanji@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Vinsmoke Sanji',
    url_imagen: 'https://i.blogs.es/d69c38/sanji/840_560.jpeg',
    fecha_creacion: '1522-03-02 19:00:00',
  },
  {
    nickname: 'chopper',
    nombre: 'Tony Tony Chopper',
    email: 'chopper@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Tony Tony Chopper',
    url_imagen: 'https://static.wikia.nocookie.net/onepiece/images/5/58/Tony_Tony_Chopper_Anime_Dos_A%C3%B1os_Despu%C3%A9s_Infobox.png/revision/latest?cb=20130629130823&path-prefix=es',
    fecha_creacion: '1522-12-24 00:00:00',
  },
  {
    nickname: 'robin',
    nombre: 'Nico Robin',
    email: 'robin@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Nico Robin',
    url_imagen: 'https://sm.ign.com/ign_latam/screenshot/default/nicorobin_1bgf.jpg',
    fecha_creacion: '1522-02-06 14:00:00',
  },
  {
    nickname: 'franky',
    nombre: 'Franky',
    email: 'franky@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Franky',
    url_imagen: 'https://i.pinimg.com/736x/91/b5/5f/91b55f7d20f57ebadf75f3c9d7190053.jpg',
    fecha_creacion: '1523-03-09 11:00:00',
  },
  {
    nickname: 'brook',
    nombre: 'Brook',
    email: 'brook@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Brook',
    url_imagen: 'https://i.blogs.es/34d729/brook/840_560.jpeg',
    fecha_creacion: '1523-04-03 23:59:00',
  },
  {
    nickname: 'jinbe',
    nombre: 'Jinbe',
    email: 'jinbe@gmail.com',
    password: '12345678',
    rol: 'user',
    biografia: 'Soy Jinbe',
    url_imagen: 'https://seakoff.com/cdn/shop/articles/jinbe-from-one-piece-the-whale-sharks-journey-to-the-straw-hats-968530.webp?v=1718531265',
    fecha_creacion: '1524-01-01 00:00:00',
  },
];

// ---------------------------------------------------------------------------
// CATEGORÍAS
// cada entrada: { autorEmail, titulo, descripcion, etiquetas: [] }
// ---------------------------------------------------------------------------
const categorias = [
  // --- brunoloo (1 categoría) ---
  {
    autorEmail: 'bruno@gmail.com',
    titulo: 'Hola mundo',
    descripcion: 'Este es mi primer foro web.',
    etiquetas: ['Programming'],
  },

  // --- Luffy (2 categorías) ---
  {
    autorEmail: 'luffy@gmail.com',
    titulo: 'Aventuras en el mar',
    descripcion: 'Comparte tus historias y travesías más épicas navegando por el mundo.',
    etiquetas: ['Travel', 'Stories'],
  },
  {
    autorEmail: 'luffy@gmail.com',
    titulo: 'La carne es lo mejor',
    descripcion: 'El mejor alimento del mundo es la carne. Discusión abierta.',
    etiquetas: ['Food & cooking', 'Daily life'],
  },

  // --- Zoro (3 categorías) ---
  {
    autorEmail: 'zoro@gmail.com',
    titulo: 'Artes marciales y entrenamiento',
    descripcion: 'Todo sobre técnicas de combate, disciplina y superación física.',
    etiquetas: ['Health & fitness', 'Sports'],
  },
  {
    autorEmail: 'zoro@gmail.com',
    titulo: 'El camino del espadachín',
    descripcion: 'Filosofía, historia y cultura detrás del uso de la espada.',
    etiquetas: ['Philosophy', 'History'],
  },
  {
    autorEmail: 'zoro@gmail.com',
    titulo: 'Cómo no perderse',
    descripcion: 'Consejos de orientación y navegación... o al menos intentarlo.',
    etiquetas: ['Travel', 'Tutorials'],
  },

  // --- Nami (1 categoría) ---
  {
    autorEmail: 'nami@gmail.com',
    titulo: 'Cartografía y geografía',
    descripcion: 'Mapas, rutas, territorios y el arte de conocer el mundo.',
    etiquetas: ['Travel', 'Science'],
  },

  // --- Usopp (1 categoría) ---
  {
    autorEmail: 'usopp@gmail.com',
    titulo: 'Historias increíbles',
    descripcion: 'Relatos épicos y hazañas que dejarán a todos con la boca abierta.',
    etiquetas: ['Stories', 'Memes'],
  },

  // --- Sanji (2 categorías) ---
  {
    autorEmail: 'sanji@gmail.com',
    titulo: 'Cocina de élite',
    descripcion: 'Mis mejores recetas y técnicas culinarias para los más exigentes.',
    etiquetas: ['Food & cooking'],
  },
  {
    autorEmail: 'sanji@gmail.com',
    titulo: 'Moda y estilo',
    descripcion: 'Porque un caballero siempre debe lucir impecable.',
    etiquetas: ['Fashion', 'Lifestyle'],
  },

  // --- Chopper (2 categorías) ---
  {
    autorEmail: 'chopper@gmail.com',
    titulo: 'Medicina y salud',
    descripcion: 'Conocimientos médicos, remedios y cómo cuidar tu cuerpo.',
    etiquetas: ['Health & fitness', 'Science'],
  },
  {
    autorEmail: 'chopper@gmail.com',
    titulo: 'Animales y naturaleza',
    descripcion: 'El fascinante mundo animal y los ecosistemas que los rodean.',
    etiquetas: ['Pets', 'Nature'],
  },

  // --- Robin (3 categorías) ---
  {
    autorEmail: 'robin@gmail.com',
    titulo: 'Arqueología e historia antigua',
    descripcion: 'Civilizaciones perdidas, artefactos y los misterios del pasado.',
    etiquetas: ['History', 'Science'],
  },
  {
    autorEmail: 'robin@gmail.com',
    titulo: 'Literatura y escritura',
    descripcion: 'Libros, autores, narrativa y el arte de contar historias.',
    etiquetas: ['Writing', 'Art'],
  },
  {
    autorEmail: 'robin@gmail.com',
    titulo: 'Idiomas y culturas del mundo',
    descripcion: 'La diversidad lingüística y cultural que enriquece a la humanidad.',
    etiquetas: ['Culture', 'Education'],
  },

  // --- Franky (2 categorías) ---
  {
    autorEmail: 'franky@gmail.com',
    titulo: 'Mecánica y construcción',
    descripcion: 'SUPER proyectos de ingeniería, maquinaria y construcción casera.',
    etiquetas: ['Engineering', 'Home & DIY'],
  },
  {
    autorEmail: 'franky@gmail.com',
    titulo: 'Tecnología y gadgets',
    descripcion: 'Los inventos más increíbles y la tecnología que cambia el mundo.',
    etiquetas: ['Tech', 'Gadgets'],
  },

  // --- Brook (1 categoría) ---
  {
    autorEmail: 'brook@gmail.com',
    titulo: 'Música para el alma',
    descripcion: 'Géneros, instrumentos, composición y todo lo que hace vibrar el corazón.',
    etiquetas: ['Music', 'Art'],
  },

  // --- Jinbe (3 categorías) ---
  {
    autorEmail: 'jinbe@gmail.com',
    titulo: 'Navegación y océanos',
    descripcion: 'Corrientes marinas, técnicas de navegación y vida en alta mar.',
    etiquetas: ['Travel', 'Nature'],
  },
  {
    autorEmail: 'jinbe@gmail.com',
    titulo: 'Artes marciales acuáticas',
    descripcion: 'Técnicas de combate en el agua y disciplinas físicas extremas.',
    etiquetas: ['Sports', 'Health & fitness'],
  },
  {
    autorEmail: 'jinbe@gmail.com',
    titulo: 'Política y diplomacia',
    descripcion: 'Alianzas, negociaciones y cómo construir puentes entre facciones.',
    etiquetas: ['Politics', 'Philosophy'],
  },
];

// ---------------------------------------------------------------------------
// INTERACCIONES — temas y comentarios
//
// Tipos:
//   { type: 'tema',             autorEmail, categoriaRef, titulo, cuerpo }
//   { type: 'comentario_cat',   autorEmail, categoriaRef, cuerpo }
//   { type: 'comentario_tema',  autorEmail, temaRef, cuerpo }
//
// categoriaRef  → titulo de la categoría (string, único en BD)
// temaRef       → titulo del tema (definido más arriba en este mismo array)
// Las interacciones se procesan en orden, por lo que un comentario_tema
// puede referenciar un tema creado anteriormente.
// ---------------------------------------------------------------------------
const interacciones = [
  // --- Luffy (5 interacciones) ---
  { type: 'comentario_cat',  autorEmail: 'luffy@gmail.com',   categoriaRef: 'Cocina de élite',                      cuerpo: '¡Esta categoría huele a carne! ¿Habrá recetas de carne asada?' },
  { type: 'comentario_cat',  autorEmail: 'luffy@gmail.com',   categoriaRef: 'Artes marciales y entrenamiento',      cuerpo: 'Yo no necesito técnicas, ¡tengo el Gear Fifth!' },
  { type: 'tema',            autorEmail: 'luffy@gmail.com',   categoriaRef: 'Historias increíbles',                 titulo: 'La vez que derroté a Doflamingo',                      cuerpo: 'Todo empezó en Dressrosa. Nadie creía que podía ganar, pero con el Gear Fourth todo cambió. ¡Fue épico!' },
  { type: 'comentario_cat',  autorEmail: 'luffy@gmail.com',   categoriaRef: 'Navegación y océanos',                 cuerpo: 'El mar es libre, ¡igual que yo! Ser rey de los piratas es mi destino.' },
  { type: 'comentario_tema', autorEmail: 'luffy@gmail.com',   temaRef: 'La vez que derroté a Doflamingo',           cuerpo: 'Y encima Zoro me cargó todo el camino. ¡Ese es mi nakama!' },

  // --- Zoro (4 interacciones) ---
  { type: 'tema',            autorEmail: 'zoro@gmail.com',    categoriaRef: 'Arqueología e historia antigua',       titulo: 'Las espadas legendarias de la historia',               cuerpo: 'Desde Enma hasta las 12 espadas supremas, la historia de las katanas legendarias es inseparable de la de los grandes espadachines.' },
  { type: 'comentario_cat',  autorEmail: 'zoro@gmail.com',    categoriaRef: 'Medicina y salud',                     cuerpo: 'Chopper, ¿cuánto tiempo tarda en sanar una herida de tres espadas en el pecho? Pregunto por un amigo.' },
  { type: 'comentario_tema', autorEmail: 'zoro@gmail.com',    temaRef: 'La vez que derroté a Doflamingo',           cuerpo: 'Eso no fue nada. Yo aguanté todos los daños de Luffy sin decir una palabra. Nada pasó.' },
  { type: 'comentario_cat',  autorEmail: 'zoro@gmail.com',    categoriaRef: 'Música para el alma',                  cuerpo: 'No entiendo de música, pero el sonido de una katana al desenfundar es suficiente para mí.' },

  // --- Nami (4 interacciones) ---
  { type: 'tema',            autorEmail: 'nami@gmail.com',    categoriaRef: 'Cartografía y geografía',              titulo: 'Cómo trazar una ruta segura en la Grand Line',         cuerpo: 'La Grand Line desafía toda brújula convencional. Los Log Pose son indispensables y aprender a leerlos puede ser la diferencia entre vivir o morir.' },
  { type: 'comentario_cat',  autorEmail: 'nami@gmail.com',    categoriaRef: 'Moda y estilo',                        cuerpo: 'Por fin una categoría con sentido. La moda es tan importante como un buen mapa.' },
  { type: 'comentario_tema', autorEmail: 'nami@gmail.com',    temaRef: 'Las espadas legendarias de la historia',    cuerpo: 'Zoro, ¿y cuánto cuestan? Pregunto por razones obvias.' },
  { type: 'comentario_cat',  autorEmail: 'nami@gmail.com',    categoriaRef: 'Tecnología y gadgets',                 cuerpo: 'El Clima-Tact es el mejor gadget que existe. Hecho a mano, por cierto.' },

  // --- Usopp (6 interacciones) ---
  { type: 'tema',            autorEmail: 'usopp@gmail.com',   categoriaRef: 'Historias increíbles',                 titulo: 'Cuando yo solo derroté a 50.000 soldados',             cuerpo: 'Fue en Enies Lobby. Yo, el gran Sogeking, con mi Kabuto en mano, enfrenté a un ejército entero. Ninguno pudo conmigo.' },
  { type: 'comentario_tema', autorEmail: 'usopp@gmail.com',   temaRef: 'La vez que derroté a Doflamingo',           cuerpo: '¡Increíble capitán! Aunque yo también estuve ahí. Disparé la bala de azúcar más difícil de la historia.' },
  { type: 'comentario_cat',  autorEmail: 'usopp@gmail.com',   categoriaRef: 'Mecánica y construcción',              cuerpo: 'Franky, el Kabuto lo diseñé yo. Si necesitás asesoría de ingeniería, acá estoy.' },
  { type: 'comentario_cat',  autorEmail: 'usopp@gmail.com',   categoriaRef: 'Aventuras en el mar',                  cuerpo: 'Una vez navegué solo durante tres días en una tormenta del tamaño de una isla. Sobreviví, claro.' },
  { type: 'tema',            autorEmail: 'usopp@gmail.com',   categoriaRef: 'Mecánica y construcción',              titulo: 'El arte de construir armas con materiales básicos',    cuerpo: 'Con madera, goma y un poco de ingenio podés construir armas capaces de cambiar el rumbo de una batalla. Yo lo hago constantemente.' },
  { type: 'comentario_tema', autorEmail: 'usopp@gmail.com',   temaRef: 'Cómo trazar una ruta segura en la Grand Line', cuerpo: 'Nami, yo una vez me orienté por las estrellas durante tres días. El Log Pose es para los débiles.' },

  // --- Sanji (5 interacciones) ---
  { type: 'tema',            autorEmail: 'sanji@gmail.com',   categoriaRef: 'Cocina de élite',                      titulo: 'La receta del Bento perfecto',                         cuerpo: 'Un Bento no es solo comida, es un mensaje. Cada ingrediente debe estar cocinado con amor y precisión. Hoy les enseño mi receta favorita para Nami-swan.' },
  { type: 'comentario_cat',  autorEmail: 'sanji@gmail.com',   categoriaRef: 'La carne es lo mejor',                 cuerpo: 'La carne es buena, sí, pero sin técnica culinaria adecuada es un desperdicio. Confíen en el chef.' },
  { type: 'tema',            autorEmail: 'sanji@gmail.com',   categoriaRef: 'Literatura y escritura',               titulo: 'Los libros de cocina que cambiaron mi vida',           cuerpo: 'Zeff me enseñó que cocinar es un arte. Pero fueron los libros de los grandes chefs los que refinaron mi técnica hasta llevarla al límite.' },
  { type: 'comentario_cat',  autorEmail: 'sanji@gmail.com',   categoriaRef: 'Cartografía y geografía',              cuerpo: 'Nami-swan, si necesitás que te acompañe en alguna expedición cartográfica, aquí estoy. Por ti iría al fin del mundo.' },
  { type: 'comentario_tema', autorEmail: 'sanji@gmail.com',   temaRef: 'Cuando yo solo derroté a 50.000 soldados',  cuerpo: 'Usopp, no exageres. Aunque admito que esa bala de azúcar fue brillante.' },

  // --- Chopper (4 interacciones) ---
  { type: 'tema',            autorEmail: 'chopper@gmail.com', categoriaRef: 'Medicina y salud',                     titulo: 'Primeros auxilios en alta mar',                        cuerpo: 'Cuando estás lejos de cualquier hospital, saber aplicar primeros auxilios puede salvar una vida. Compilo aquí lo más importante que aprendí con el Dr. Hiluluk y el Dr. Kureha.' },
  { type: 'comentario_tema', autorEmail: 'chopper@gmail.com', temaRef: 'La receta del Bento perfecto',              cuerpo: '¡Qué lindo Sanji! Aunque yo prefiero las hojas medicinales. ¿Les puedo agregar al Bento?' },
  { type: 'comentario_cat',  autorEmail: 'chopper@gmail.com', categoriaRef: 'Animales y naturaleza',                cuerpo: '¡Los renos son los animales más nobles e inteligentes del mundo! No estoy sesgado para nada.' },
  { type: 'comentario_tema', autorEmail: 'chopper@gmail.com', temaRef: 'Las espadas legendarias de la historia',    cuerpo: 'Zoro, ¿sabías que las heridas de katana son más fáciles de suturar que las de maza? Dato de doctor.' },

  // --- Robin (7 interacciones) ---
  { type: 'tema',            autorEmail: 'robin@gmail.com',   categoriaRef: 'Arqueología e historia antigua',       titulo: 'El Vacío del Siglo y sus implicancias',                cuerpo: 'Hay 100 años borrados de la historia del mundo. Los Poneglyphs son la única fuente que se resiste al olvido. Descifrarlos es mi vida entera.' },
  { type: 'tema',            autorEmail: 'robin@gmail.com',   categoriaRef: 'Literatura y escritura',               titulo: 'Escritura antigua: los alfabetos olvidados',           cuerpo: 'Antes del idioma común existieron docenas de sistemas de escritura. El alfabeto de Ohara era uno de los más ricos. Aquí un análisis comparativo.' },
  { type: 'comentario_tema', autorEmail: 'robin@gmail.com',   temaRef: 'Las espadas legendarias de la historia',    cuerpo: 'Las espadas también tienen historia escrita. El Shodai Kitetsu fue mencionado en un Poneglyph de Wano.' },
  { type: 'comentario_cat',  autorEmail: 'robin@gmail.com',   categoriaRef: 'Idiomas y culturas del mundo',         cuerpo: 'Los idiomas son la memoria de los pueblos. Cuando muere un idioma, muere una forma de ver el mundo.' },
  { type: 'tema',            autorEmail: 'robin@gmail.com',   categoriaRef: 'Aventuras en el mar',                  titulo: 'Islas perdidas que podrían existir',                   cuerpo: 'Según los registros de Ohara, hay al menos cuatro islas no cartografiadas en la Grand Line. Aquí la evidencia.' },
  { type: 'comentario_tema', autorEmail: 'robin@gmail.com',   temaRef: 'Cómo trazar una ruta segura en la Grand Line', cuerpo: 'Nami, los Poneglyphs también contienen coordenadas. Si alguna vez los necesitás, puedo ayudarte.' },
  { type: 'comentario_tema', autorEmail: 'robin@gmail.com',   temaRef: 'Primeros auxilios en alta mar',             cuerpo: 'Chopper, en Ohara también estudiaban medicina. Tengo algunos textos antiguos que podrían interesarte.' },

  // --- Franky (5 interacciones) ---
  { type: 'tema',            autorEmail: 'franky@gmail.com',  categoriaRef: 'Mecánica y construcción',              titulo: 'Cómo construí el Thousand Sunny',                      cuerpo: 'El Sunny está hecho de Adam Wood, el árbol más resistente del mundo. El diseño es completamente mío. Incluye Mini Merry II y el Gaon Cannon. ¡SUPER!' },
  { type: 'tema',            autorEmail: 'franky@gmail.com',  categoriaRef: 'Tecnología y gadgets',                 titulo: 'Modificaciones corporales: pros y contras',            cuerpo: 'Me convertí en un cyborg después de un accidente. Hoy mi cuerpo es mitad hombre, mitad máquina SUPER. Aquí explico qué modificaciones recomendaría y cuáles no.' },
  { type: 'comentario_tema', autorEmail: 'franky@gmail.com',  temaRef: 'El arte de construir armas con materiales básicos', cuerpo: 'Usopp, respeto tu trabajo, pero cuando quieras escalar al siguiente nivel, hablamos de acero de titanio.' },
  { type: 'comentario_cat',  autorEmail: 'franky@gmail.com',  categoriaRef: 'Aventuras en el mar',                  cuerpo: 'El Thousand Sunny puede con cualquier aventura. Lo digo yo, que lo construí con estas manos. ¡SUPER!' },
  { type: 'comentario_tema', autorEmail: 'franky@gmail.com',  temaRef: 'Cómo construí el Thousand Sunny',           cuerpo: '¿Alguien más lloró cuando vio el Sunny por primera vez? Porque yo no. Tengo los ojos en modo lluvia, nada más.' },

  // --- Brook (3 interacciones) ---
  { type: 'tema',            autorEmail: 'brook@gmail.com',   categoriaRef: 'Música para el alma',                  titulo: "Bink's Sake: la canción que atraviesa el tiempo",      cuerpo: "Bink's Sake es más que una canción pirata. Es una promesa, un recuerdo y una despedida. La toqué sola en el Thriller Bark durante 50 años. Cada nota tiene un peso enorme." },
  { type: 'comentario_tema', autorEmail: 'brook@gmail.com',   temaRef: 'Los libros de cocina que cambiaron mi vida', cuerpo: 'Sanji-san, ¿hay algún libro sobre recetas para personas sin estómago? Pregunto por motivos personales. Yohohoho.' },
  { type: 'comentario_cat',  autorEmail: 'brook@gmail.com',   categoriaRef: 'Historias increíbles',                 cuerpo: 'Una vez navegué solo 50 años en un barco fantasma. ¿Eso cuenta como historia increíble? Yohohoho.' },

  // --- Jinbe (4 interacciones) ---
  { type: 'tema',            autorEmail: 'jinbe@gmail.com',   categoriaRef: 'Navegación y océanos',                 titulo: 'Corrientes marinas que todo navegante debe conocer',   cuerpo: 'La Corriente del Circuito, los vórtices de Calm Belt y las mareas de la Grand Line tienen patrones estudiables. Aquí un resumen de lo más crítico para sobrevivir.' },
  { type: 'comentario_tema', autorEmail: 'jinbe@gmail.com',   temaRef: 'Cómo trazar una ruta segura en la Grand Line', cuerpo: 'Nami, complementando tu tema: las corrientes de tiburones ballena marcan rutas seguras que pocos conocen.' },
  { type: 'comentario_tema', autorEmail: 'jinbe@gmail.com',   temaRef: 'Islas perdidas que podrían existir',        cuerpo: 'Robin-san, desde el mar puedo confirmar al menos dos de esas islas. Las visité como capitán de los Piratas del Sol.' },
  { type: 'comentario_cat',  autorEmail: 'jinbe@gmail.com',   categoriaRef: 'Artes marciales y entrenamiento',      cuerpo: 'El Gyojin Karate se basa en controlar el agua dentro del cuerpo del oponente. No es solo fuerza, es precisión y calma.' },
];

// ---------------------------------------------------------------------------
// helpers de inserción
// ---------------------------------------------------------------------------

const insertarContenido = async (client, autorId, cuerpo) => {
  const { rows } = await client.query(
    `INSERT INTO contenido (autor_id, cuerpo) VALUES ($1, $2) RETURNING id`,
    [autorId, cuerpo]
  );
  return rows[0].id;
};

const insertarTema = async (client, contenidoId, categoriaId, titulo) => {
  await client.query(
    `INSERT INTO tema (contenido_id, categoria_id, titulo) VALUES ($1, $2, $3)`,
    [contenidoId, categoriaId, titulo]
  );
  await client.query(
    `UPDATE categoria SET contador_temas = contador_temas + 1 WHERE id = $1`,
    [categoriaId]
  );
};

const insertarComentarioCat = async (client, contenidoId, categoriaId) => {
  await client.query(
    `INSERT INTO comentario (contenido_id, categoria_id) VALUES ($1, $2)`,
    [contenidoId, categoriaId]
  );
};

const insertarComentarioTema = async (client, contenidoId, temaId) => {
  await client.query(
    `INSERT INTO comentario (contenido_id, tema_id) VALUES ($1, $2)`,
    [contenidoId, temaId]
  );
};


const seedTestData = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Insertando usuarios de prueba...\n');

    for (const u of usuarios) {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const passwordHash = await bcrypt.hash(u.password, salt);

      const q = `
      INSERT INTO usuario (nickname, nombre, email, password_hash, rol, biografia, url_imagen, fecha_creacion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
      ON CONFLICT (email) DO NOTHING
      RETURNING id, nickname, email, rol
    `;

    const values = [
      u.nickname,
      u.nombre,
      u.email,
      passwordHash,
      u.rol,
      u.biografia ?? null,
      u.url_imagen ?? null,
      u.fecha_creacion ?? null,  // null → cae en el NOW() del COALESCE
    ];

      const { rows } = await client.query(q, values);

      if (rows.length > 0) {
        console.log(`✔ Creado: ${rows[0].nickname} (${rows[0].email}) — rol: ${rows[0].rol}`);
      } else {
        console.log(`⚠ Omitido (ya existe): ${u.email}`);
      }
    }

    // -----------------------------------------------------------------------
    // 2. Obtener mapa email → id de todos los usuarios recién insertados
    // -----------------------------------------------------------------------
    const { rows: usuariosDB } = await client.query(
      `SELECT id, email FROM usuario WHERE email = ANY($1)`,
      [usuarios.map((u) => u.email)]
    );
    const emailToId = Object.fromEntries(usuariosDB.map((u) => [u.email, u.id]));

    // -----------------------------------------------------------------------
    // 3. Insertar categorías + etiquetas
    // -----------------------------------------------------------------------
    console.log('\nInsertando categorías...\n');

    for (const cat of categorias) {
      const autorId = emailToId[cat.autorEmail];
      if (!autorId) {
        console.warn(`⚠ No se encontró el autor ${cat.autorEmail}, se omite la categoría "${cat.titulo}".`);
        continue;
      }

      const qCat = `
        INSERT INTO categoria (titulo, descripcion, autor_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (titulo) DO NOTHING
        RETURNING id, titulo
      `;
      const { rows: catRows } = await client.query(qCat, [cat.titulo, cat.descripcion, autorId]);

      if (catRows.length === 0) {
        console.log(`⚠ Omitida (ya existe): "${cat.titulo}"`);
        continue;
      }

      const categoriaId = catRows[0].id;
      console.log(`✔ Categoría creada: "${catRows[0].titulo}" (id: ${categoriaId})`);

      // insertar etiquetas en categoria_etiqueta
      for (const etiqueta of cat.etiquetas) {
        const qEtiq = `
          INSERT INTO categoria_etiqueta (categoria_id, etiqueta_valor)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `;
        await client.query(qEtiq, [categoriaId, etiqueta]);
      }
    }

    // -----------------------------------------------------------------------
    // 4. Procesar interacciones (temas y comentarios)
    // -----------------------------------------------------------------------
    console.log('\nInsertando temas y comentarios...\n');

    // mapa titulo → id de categoría (cargado de la BD para cubrir tanto las
    // categorías recién insertadas como las que ya existían por runs previos)
    const { rows: catsDB } = await client.query(`SELECT id, titulo FROM categoria`);
    const catTituloToId = Object.fromEntries(catsDB.map((c) => [c.titulo, c.id]));

    // mapa titulo → contenido_id de temas (se va llenando durante el loop)
    const temaTituloToId = {};

    for (const inter of interacciones) {
      const autorId = emailToId[inter.autorEmail];
      if (!autorId) {
        console.warn(`⚠ Autor no encontrado: ${inter.autorEmail}`);
        continue;
      }

      if (inter.type === 'tema') {
        const categoriaId = catTituloToId[inter.categoriaRef];
        if (!categoriaId) {
          console.warn(`⚠ Categoría no encontrada: "${inter.categoriaRef}"`);
          continue;
        }
        const contenidoId = await insertarContenido(client, autorId, inter.cuerpo);
        await insertarTema(client, contenidoId, categoriaId, inter.titulo);
        temaTituloToId[inter.titulo] = contenidoId;
        console.log(`✔ Tema: "${inter.titulo}" en "${inter.categoriaRef}"`);

      } else if (inter.type === 'comentario_cat') {
        const categoriaId = catTituloToId[inter.categoriaRef];
        if (!categoriaId) {
          console.warn(`⚠ Categoría no encontrada: "${inter.categoriaRef}"`);
          continue;
        }
        const contenidoId = await insertarContenido(client, autorId, inter.cuerpo);
        await insertarComentarioCat(client, contenidoId, categoriaId);
        console.log(`✔ Comentario en categoría "${inter.categoriaRef}" por ${inter.autorEmail}`);

      } else if (inter.type === 'comentario_tema') {
        const temaId = temaTituloToId[inter.temaRef];
        if (!temaId) {
          console.warn(`⚠ Tema no encontrado: "${inter.temaRef}" — definilo antes en el array.`);
          continue;
        }
        const contenidoId = await insertarContenido(client, autorId, inter.cuerpo);
        await insertarComentarioTema(client, contenidoId, temaId);
        console.log(`✔ Comentario en tema "${inter.temaRef}" por ${inter.autorEmail}`);
      }
    }

    // -----------------------------------------------------------------------
    // 5. brunoloo sigue a toda la tripulación
    // -----------------------------------------------------------------------
    console.log('\nInsertando seguidores...\n');

    const brunooId = emailToId['bruno@gmail.com'];
    const tripulacion = [
      'luffy@gmail.com', 'zoro@gmail.com', 'nami@gmail.com', 'usopp@gmail.com',
      'sanji@gmail.com', 'chopper@gmail.com', 'robin@gmail.com',
      'franky@gmail.com', 'brook@gmail.com', 'jinbe@gmail.com',
    ];

    for (const email of tripulacion) {
      const seguidoId = emailToId[email];
      await client.query(
        `INSERT INTO usuario_seguidor (seguidor_id, seguido_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING`,
        [brunooId, seguidoId]
      );
      console.log(`✔ brunoloo sigue a ${email.split('@')[0]}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed completo: usuarios, categorías, temas y comentarios.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error en el seed, se hizo rollback:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};



seedTestData();