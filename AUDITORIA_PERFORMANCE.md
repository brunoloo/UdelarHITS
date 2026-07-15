# Auditoría de Performance — UdelarHITS

Fecha: 2026-07-15 · Basada en lectura completa del código en `main` (commit `8f68e0b`).
Bundle medido con build real: `vite build` → **JS 653.72 kB (178.81 kB gzip), CSS 121.57 kB (19.06 kB gzip), 1 solo chunk**.

Convención de impacto: **Alto** = lo percibe cualquier usuario en cada visita · **Medio** = lo percibe en vistas específicas o al crecer los datos · **Bajo** = higiene/escala futura.

---

## 0. Los tres síntomas, explicados con el código

**a) Flash del avatar default al entrar a un chat.** `ChatPage` arranca con `otherUser = null`; `UserAvatar` renderiza el fallback (inicial + color) siempre que `url_imagen` es falsy (`UserAvatar.jsx:43`). Recién cuando responde `GET /chat/conversations/:nickname` se setea `otherUser` y se monta el `<img>`, que además tiene que descargar un JPEG 400×400 sin transformación de Cloudinary. Son **dos** flashes encadenados: dato tardío + imagen tardía. (Detalle en §4.)

**b) La conversación tarda en cargar.** Waterfall doble: en el frontend, 2 requests HTTP secuenciales (resolver conversación → pedir mensajes, `ChatPage.jsx:54-102`); en el backend, cada request de mensajes hace 4 queries SQL **secuenciales** (auth middleware → `userBelongsToConversation` → `getVisibleSince` → `getMessages`, `chat.controller.js:66-84`). Total: ~6 round-trips en serie antes del primer mensaje pintado. (Detalle en §1.5 y §2.)

**c) Micro-demoras al navegar.** El `QueryClient` no tiene defaults (`App.jsx:10`): `staleTime: 0` y `refetchOnWindowFocus: true` en TODO. Cada navegación re-fetchea todo lo montado, incluyendo `/categories/active`, que ejecuta la query más pesada del sistema (CATEGORY_CARD_QUERY) para **todas** las categorías, y está montada permanentemente vía el buscador del Header. Además el bundle JS se sirve **sin gzip** porque `compression()` está montado después de `express.static` (`app.js:62-65`). (Detalle en §3, §5 y §7.)

---

## 1. Auditoría de queries SQL (`backend/src/repositories/`)

Lo bueno primero: **no hay `SELECT *` en ningún repository** (verificado con grep), no hay N+1 clásico en los listados de lectura (los autores/adjuntos/encuestas vienen embebidos en la misma query), y las escrituras usan transacciones correctamente. Los problemas son otros: subqueries correladas caras multiplicadas por falta de paginación, queries secuenciales que podrían fusionarse, y N+1 en algunos write-paths.

### 1.1 `CATEGORY_CARD_QUERY` — la query más cara del sistema, usada donde no hace falta

**Archivo:** `project/backend/src/repositories/category.repository.js:241-297` (consumida por `getActiveCategories:299`, `getChronoFeed:309`, `getPersonalizedFeed:325`, `getPinnedHomeCategory:654`).

**Qué pasa:** por cada categoría ejecuta: (1) `COUNT(*)` sobre `comentario WHERE categoria_id = c.id` — columna **sin índice**, ver §6; (2) subquery `ultimo_tema` con doble JOIN + ORDER BY fecha; (3) subquery `ultimo_comentario` que a su vez anida **cuatro** subqueries más (likes, contador_respuestas, `json_agg` de adjuntos, y el objeto encuesta completo con conteo de votos por opción); (4) `ARRAY_AGG` de etiquetas con GROUP BY.

`GET /categories/active` corre esto para **todas** las categorías activas, sin paginación (`ORDER BY c.titulo DESC`, sin LIMIT). Y ese endpoint lo consumen: el buscador del Header (`useSiteSearch.js:19-22`, montado en **todas** las páginas), la Sidebar (`Sidebar.jsx:316-319`), `RecentPage.jsx:75-78`, `ExplorePage.jsx:299-302` y `FeedPage.jsx:47-51`. Con `staleTime: 0`, cada navegación la re-ejecuta.

**Impacto: Alto.** Es la fuente principal de las micro-demoras de navegación (síntoma c) y crece cuadrático-ish con el contenido (categorías × comentarios).

**Solución (dos partes):**

1. *Backend:* endpoint liviano para búsqueda/sidebar, que es lo único que necesitan (título, etiquetas, contadores básicos). El feed paginado del Home sí necesita la card completa — ahí la query está bien porque va con `LIMIT 20`.

```js
// category.repository.js — listado liviano para buscador/sidebar/recientes
const getActiveCategoriesLight = async () => {
  const q = `
    SELECT c.id, c.titulo, c.icono, c.contador_temas, c.fecha_creacion,
      ARRAY_AGG(e.nombre) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE c.estado = 'activa'
    GROUP BY c.id
    ORDER BY c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q);
  return rows;
};
```

```js
// category.routes.js
router.get('/index', getActiveCategoriesIndex); // nuevo, liviano
```

y en el frontend cambiar `useSiteSearch`, `Sidebar` (NewCatsCard) y `RecentPage` a `/categories/index` con su propia queryKey (`['categories','index']`). `FeedPage` con `?q=` puede seguir usando `/active` (es un caso puntual) o migrar también.

2. *Índice* `comentario(categoria_id)` — ver §6.1. Sin ese índice, el `contador_comentarios` de cada card es un seq scan de `comentario` por categoría.

**Prioridad: 1 (junto con §3.1).**

### 1.2 Feed personalizado — scoring completo en cada request

**Archivo:** `category.repository.js:325-391` (`getPersonalizedFeed`).

**Qué pasa:** para **cada** categoría activa calcula: 2 `EXISTS` (participación, suscripción), un `SUM` sobre la CTE `afinidad` (que a su vez escanea todas las reacciones del usuario con triple LEFT JOIN), y 2 `COUNT` con ventana temporal sobre temas y comentarios. El count de comentarios usa `COALESCE(com2.categoria_id, t3.categoria_id) = c2.id` (línea 369), que no puede usar índice sobre la columna (el predicado se evalúa después del join). Esto corre en cada página del infinite scroll y en cada refetch del Home.

**Impacto: Medio hoy, Alto al crecer.** Con pocas categorías anda; con cientos de categorías y miles de comentarios el Home se degrada linealmente con contenido × actividad.

**Solución incremental:** (1) los índices de §6 (`contenido.fecha_creacion`, `comentario.categoria_id`, `categoria_etiqueta.etiqueta_id`) convierten los counts de ventana en index scans; (2) cache en memoria con TTL corto para la parte `scored` (el proyecto es single-instance, es seguro):

```js
// utils/ttlCache.js — helper genérico, sin dependencias
const cache = new Map();
export const withTTL = async (key, ttlMs, fn) => {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, exp: Date.now() + ttlMs });
  return value;
};
```

```js
// category.service.js — el modo del feed cambia poco: cachear la señal 60s
const personalized = user
  ? await withTTL(`feed-signals:${user.id}`, 60_000, () => hasFeedSignals(user.id))
  : false;
```

(El feed completo por usuario también se puede cachear 30-60s por `userId+cursor`, pero medí primero: con los índices puestos quizá no haga falta.)

**Prioridad: 3** (los índices), cache cuando se note.

### 1.3 Listados de comentarios — 5 subqueries correladas por fila y sin paginación

**Archivo:** `project/backend/src/repositories/reply.repository.js` — `getRepliesByCategoryId:33-52`, `getRepliesByTopicId:54-73`, `getRepliesByUserId:131-178`, `getLikedCommentsByUserId:180-228`, `getRepliesByCommentId:230-247`, `getReplyContext:372-402`.

**Qué pasa:** cada comentario devuelto ejecuta: `contador_respuestas` (COUNT), `likes` (COUNT), `mi_reaccion` (lookup), `json_agg` de adjuntos, y `encuestaSubquery` (que anida `total_votos` + `mi_voto` + COUNT de votos **por opción**). Las subqueries en sí están bien indexadas (`idx_comentario_padre_id`, `idx_reaccion_contenido`, `idx_adjunto_contenido`, `idx_encuesta_contenido`) — el problema real es que **ninguno de estos listados tiene LIMIT**. Un tema con 400 comentarios ejecuta ~2000 subqueries y serializa un JSON gigante en un solo response. `getRepliesByUserId` y `getLikedCommentsByUserId` agregan 2 subqueries más (autor del padre) y también van sin límite.

**Impacto: Medio hoy (foro chico), Alto en cuanto un tema se vuelva popular.** También es la causa de que el perfil cargue lento (dispara 3 de estos listados a la vez, ver §3.4).

**Solución: paginación keyset**, misma técnica que ya usás en el feed del Home (cursor compuesto). Ejemplo para `getRepliesByTopicId`:

```js
const getRepliesByTopicId = async (topicId, userId = null, { limit = 30, cursorFecha = null, cursorId = null } = {}) => {
  const q = `
    SELECT ... (igual que hoy) ...
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    JOIN tema t ON t.contenido_id = com.tema_id
    WHERE com.tema_id = $1 AND com.comentario_padre_id IS NULL
      AND ($3::timestamptz IS NULL OR (con.fecha_creacion, com.contenido_id) < ($3::timestamptz, $4::bigint))
    ORDER BY (com.contenido_id = t.comentario_fijado_id) DESC, con.fecha_creacion DESC, com.contenido_id DESC
    LIMIT $5
  `;
  const { rows } = await pool.query(q, [topicId, userId, cursorFecha, cursorId, limit + 1]);
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
};
```

y en el frontend pasar `TopicPage`/`CategoryPage` a `useInfiniteQuery` (ya lo hacés en `FeedPage`, es copiar el patrón). Nota: el comentario fijado complica el cursor — servilo siempre en la página 1 fuera del cursor, igual que hacés con la categoría fijada del Home (`category.service.js:305-315`).

**Prioridad: 4.**

### 1.4 Chat — lista de conversaciones con 2 subqueries por fila

**Archivo:** `project/backend/src/repositories/chat.repository.js:37-68`.

**Qué pasa:** por conversación: subquery del último mensaje (usa `idx_mensaje_conversacion`, OK) y `COUNT` de no-leídos filtrando `autor_id <> $1 AND leido = FALSE` — para lo cual el índice `(conversacion_id, fecha_creacion)` tiene que escanear todos los mensajes de la conversación. Es aceptable para pocas conversaciones, pero este endpoint además se llama **al montar la app entera** solo para calcular el badge (ver §2.3).

**Solución:** índice parcial de no-leídos (§6.5) + endpoint `unread-count` dedicado (§2.3).

### 1.5 Chat — 3 queries secuenciales para leer mensajes (y 3 para mandar uno)

**Archivo:** `project/backend/src/controllers/chat.controller.js:66-84` (`getConversationMessages`) y `86-126` (`sendMessage`); repos en `chat.repository.js:135-141` (`userBelongsToConversation`), `152-161` (`getVisibleSince`), `143-150` (`getOtherUserId`).

**Qué pasa:** `userBelongsToConversation` y `getVisibleSince` leen **la misma fila** de `conversacion` en dos round-trips separados; `sendMessage` hace lo mismo con `userBelongsToConversation` + `getOtherUserId`. Sumado a la query del middleware `protect`, cada GET de mensajes son 4 RTT a la DB en serie. En Railway (DB en red) cada RTT son ~1-5 ms mínimo; en serie, con conexión fría, se nota.

**Impacto: Alto para el síntoma (b)** — es latencia pura en el camino crítico del chat.

**Solución:** una sola query que valida pertenencia y devuelve lo que se necesita:

```js
// chat.repository.js — reemplaza belongs + visibleSince (y belongs + otherUserId)
export const getConversationForUser = async (convId, userId) => {
  const { rows } = await pool.query(
    `SELECT id,
       CASE WHEN usuario1_id = $2 THEN usuario2_id ELSE usuario1_id END AS otro_id,
       CASE WHEN usuario1_id = $2 THEN borrado_por_usuario1_at ELSE borrado_por_usuario2_at END AS visible_since
     FROM conversacion
     WHERE id = $1 AND (usuario1_id = $2 OR usuario2_id = $2)`,
    [convId, userId]
  );
  return rows[0] || null; // null => no pertenece (403)
};
```

```js
// chat.controller.js — getConversationMessages queda en 2 RTT (era 4 con protect)
const conv = await getConversationForUser(convId, req.user.id);
if (!conv) return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
const messages = await getMessages(convId, { before, limit, visibleSince: conv.visible_since });
```

**Prioridad: 2 (paquete chat).**

### 1.6 `/users/me` — 5 queries secuenciales, una de ellas redundante y sin índice usable

**Archivos:** `project/backend/src/services/user.service.js:488-522` (`showMeService`), `user.repository.js:96-106` (`getUserByNickname`), `middlewares/auth.middleware.js:13-16`.

**Qué pasa:** el flujo de `GET /users/me` es: (1) `protect` busca el usuario **por id**; (2) `showMeService` lo vuelve a buscar **por nickname** — mismo usuario, segunda query — y además con `LOWER(nickname) = LOWER($1)`, que **no puede usar** el índice UNIQUE de `nickname` (es sobre la columna cruda) → seq scan de `usuario`; (3)(4)(5) categorías (con COUNT de temas por categoría), seguidores y seguidos, en tres `await` secuenciales.

**Impacto: Alto** — es la primera request de la app (AuthContext) y bloquea el primer render con sesión.

**Solución:**

```js
// user.repository.js
const getUserById = async (id) => {
  const q = `
    SELECT id, rol, nickname, nombre, email, biografia, url_imagen, url_banner,
           fecha_creacion, estado, privado, me_gusta_privado, nickname_confirmado,
           auth_provider, (password_hash IS NOT NULL) AS tiene_password
    FROM usuario WHERE id = $1 LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};
```

```js
// user.service.js — showMeService por id + listas en paralelo
const showMeService = async (userId) => {
  const user = await getUserById(userId);
  if (!user) { const err = new Error('Usuario no encontrado'); err.code = 'NOT_FOUND'; throw err; }
  const [categories, followers, following] = await Promise.all([
    getCategoriesByUserId(user.id),
    getFollowersByUserId(user.id),
    getFollowingByUserId(user.id),
  ]);
  // ... armar safeUser igual que hoy
};
// controller: showMeService(req.user.id) en vez de req.user.nickname
```

Más el índice funcional `LOWER(nickname)` (§6.3), que acelera *todos* los lookups por nickname (login, perfiles, follow, chat por nickname…). Lo mismo aplica a `getUserProfileService` (`user.service.js:468-470`): tres `await` secuenciales → `Promise.all`.

**Prioridad: 2.**

### 1.7 N+1 reales en write-paths

**Impacto: Bajo-Medio** (solo escrituras), pero son fixes de 5 minutos:

- `createCategory` (`category.repository.js:21-26`) y `updateCategoryById` (`:187-192`): un INSERT por etiqueta → `INSERT ... SELECT unnest($2::bigint[])`:

```js
await client.query(
  `INSERT INTO categoria_etiqueta (categoria_id, etiqueta_id)
   SELECT $1, unnest($2::bigint[])`,
  [category.id, etiquetas]
);
```

- `createPoll` (`encuesta.repository.js:32-37`): un INSERT por opción → mismo patrón con `unnest` + `generate_subscripts` para el orden.
- **Notificaciones a suscriptores** (`reply.service.js:198-209`): loop de `createNotification`, y cada una vuelve a consultar el nickname/avatar del actor para el socket (`notification.repository.js:30-38`). Con N suscriptores son ~2N queries en serie **dentro del request de publicar comentario**. Fix: resolver el actor una vez, insertar en batch (`INSERT ... SELECT unnest(...)`) y emitir después; o al menos `Promise.all`.
- **Menciones** (`reply.service.js:239-252`): `isBlocked` por usuario mencionado en loop → una sola query con `= ANY($2)` sobre `bloqueo`.

**Prioridad: 5.**

### 1.8 Agregados públicos recalculados en cada request

**Archivos:** `category.repository.js:465-513` (`getPopularCategories`), `:519-538` (`getTrendingTags`), `topic.repository.js:250-293` (`getTrendingTopic`), `user.repository.js:379-399` (`getSuggestedUsers`, COUNT de contenido por usuario), `:401-420` (`getMostActiveUsers`, 2 COUNT por usuario).

**Qué pasa:** son rankings con ventanas temporales y decaimiento exponencial — caros por diseño — y se ejecutan por request, sin cache, en endpoints públicos (`/categories/popular`, `/categories/trending-tags`, `/topics/trending`, `/users/most-active`). La Sidebar y Explore los piden en cada montaje (con staleTime 0).

**Impacto: Medio.**

**Solución:** con el helper `withTTL` de §1.2, una línea por servicio:

```js
// category.service.js
const getPopularCategoriesService = async (days, limit) => {
  const safeDays = ..., safeLimit = ...;
  return withTTL(`popular:${safeDays}:${safeLimit}`, 120_000, () => getPopularCategories(safeDays, safeLimit));
};
```

60–120s de TTL es invisible para el usuario y colapsa el costo a 1 ejecución por ventana. `contenido.fecha_creacion` (§6.2) además indexa la ventana temporal.

**Prioridad: 3.**

### 1.9 `getCategoryById` usada como chequeo de permisos

**Archivo:** `category.repository.js:67-84`; llamada por `deleteCategoryService`, `updateCategoryService`, `assertCategoryModerator`, `assertCategoryExists`, `pinCategoryHomeService`… (`category.service.js`).

**Qué pasa:** para validar "existe y es tuya" se ejecuta la query completa con `COUNT(*)` de temas activos + `ARRAY_AGG` de etiquetas + JOIN usuario. **Impacto: Bajo** (son writes), pero es gratis arreglarlo con un `getCategoryCore(id)` que devuelva `id, autor_id, estado`.

---

## 2. Auditoría de endpoints

### 2.1 `GET /users/me` devuelve 4 payloads y la app usa 1

**Archivos:** `frontend/src/context/AuthContext.jsx:12-17` (`setUser(res.data.user)` — descarta `categories`, `followers`, `following`) vs `user.service.js:488-522`.

**Qué pasa:** el fetch de arranque de la app trae el perfil completo con listas de seguidores/seguidos y categorías propias (cada una con su COUNT), y el AuthContext solo guarda `user`. El único consumidor de las listas es `ProfilePage` cuando mirás tu propio perfil.

**Impacto: Alto** (está en el camino crítico del primer render).

**Solución:** partir el endpoint sin romper nada:

```js
// user.routes.js
router.get('/me', protect, showMe);            // ahora liviano: solo user
router.get('/me/full', protect, showMeFull);   // user + categories + followers + following
```

`showMe` liviano = `getUserById(req.user.id)` (1 query, §1.6). `ProfilePage` cambia su queryFn de `['me']` a `/users/me/full`. AuthContext queda con una request de 1 query.

**Prioridad: 2.**

### 2.2 Cascada del chat: 2 requests donde alcanza 1

**Archivo:** `frontend/src/features/chat/ChatPage.jsx:54-102`; backend `chat.controller.js:25-64`.

**Qué pasa:** entrar a `/chat/:nickname` dispara `GET /chat/conversations/:nickname` (resuelve id + datos del otro usuario) y **recién cuando responde** dispara `GET .../messages`. Dos RTT HTTP en serie, cada uno con sus queries en serie detrás (§1.5).

**Solución:** devolver la primera página de mensajes en la misma respuesta:

```js
// chat.controller.js — getOrStartConversation
const conversacion_id = await getOrCreateConversation(req.user.id, other.id);
// ... límite de carga igual que hoy ...
const conv = await getConversationForUser(conversacion_id, req.user.id);
const mensajes = await getMessages(conversacion_id, { limit: 50, visibleSince: conv.visible_since });
return res.json({
  ok: true,
  data: {
    conversacion_id,
    usuario: { id: other.id, nickname: other.nickname, url_imagen: other.url_imagen },
    mensajes,
  },
});
```

y en `ChatPage` usar `res.data.mensajes` directamente (el efecto de `activeConv` queda solo para "cargar anteriores"). Elimina un RTT completo del camino crítico del síntoma (b).

**Prioridad: 2.**

### 2.3 `GET /chat/conversations` completo solo para el badge

**Archivo:** `frontend/src/components/layout/LeftNav.jsx:85-91`.

**Qué pasa:** al montar la app, LeftNav pide la lista completa de conversaciones (query de §1.4, con último mensaje y unread por conversación) y la reduce a un número.

**Solución:** endpoint dedicado + índice parcial (§6.5):

```js
// chat.repository.js
export const getUnreadTotal = async (userId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM mensaje m
     JOIN conversacion c ON c.id = m.conversacion_id
     WHERE (c.usuario1_id = $1 OR c.usuario2_id = $1)
       AND m.autor_id <> $1 AND m.leido = FALSE
       AND m.fecha_creacion > COALESCE(
         CASE WHEN c.usuario1_id = $1 THEN c.borrado_por_usuario1_at ELSE c.borrado_por_usuario2_at END,
         '1970-01-01'::timestamptz)`,
    [userId]
  );
  return rows[0].total;
};
// chat.routes.js: router.get('/unread-count', protect, getUnreadCount);
```

**Prioridad: 3.**

### 2.4 `GET /categories/:id/subscription` — request extra por página de categoría

**Archivos:** `frontend/src/features/category/CategoryPage.jsx:447-451`; `category.routes.js` (`router.get('/:id', getCategoryById)` — sin auth).

**Qué pasa:** cada CategoryPage con sesión hace una request adicional solo para saber si estás suscrito. La ruta del detalle no tiene `optionalAuth`, así que no puede resolverlo ella misma.

**Solución:** `router.get('/:id', optionalAuth, getCategoryById)` y en el service agregar `suscrito` cuando hay user (`isSubscribedCategory(req.user.id, id)` dentro del mismo handler, o un `EXISTS` en la query). El front elimina la query `['category', id, 'subscription']` y lee `cat.suscrito`. **Impacto: Bajo-Medio. Prioridad: 4.**

### 2.5 Endpoints de listado sin límites o con campos de más

- `GET /categories/active` — sin paginación + card completa (§1.1). El detalle `GET /categories/:id` (`category.service.js:107-108`) también devuelve **todos** los temas embebidos, cada uno con COUNT de comentarios (`getTopicsByCategoryId`, sin LIMIT) — paginable con el mismo patrón de §1.3 cuando haga falta.
- `GET /replies/*` — sin paginación (§1.3). Además `getRepliesByCategoryId/TopicId` devuelven también los comentarios `oculto` (no filtran estado; el front los enmascara) — filas y bytes de más en temas con moderación pesada.
- `GET /topics/recent?limit=30` y `/notifications?limit=30` — bien.
- Procesamiento cacheable en backend: trending/popular/suggested/most-active (§1.8).

---

## 3. Frontend — TanStack Query y fetching

### 3.1 No hay `staleTime` en ningún lado (verificado con grep: 0 ocurrencias)

**Archivo:** `frontend/src/App.jsx:10` — `const queryClient = new QueryClient()`.

**Qué pasa:** con los defaults, **todo** query está stale al instante (`staleTime: 0`) y se refetchea en cada mount y en cada `focus` de la ventana. Volver de otra pestaña = ráfaga de requests de todo lo montado (feed + sidebar + search-index + badges + saved). Navegar Home → categoría → Home re-fetchea el feed completo. Esto es el síntoma (c) en su mayor parte.

**Impacto: Alto. Esfuerzo: 10 líneas.**

**Solución:**

```js
// App.jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 min por defecto: navegación instantánea desde cache
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
```

y overrides puntuales donde el dato lo pide:

```js
// etiquetas: catálogo estático sembrado por schema.sql
useQuery({ queryKey: ['categories','etiquetas'], staleTime: Infinity, ... })
// índice de categorías para búsqueda/sidebar: cambia poco
useQuery({ queryKey: ['categories','index'], staleTime: 5 * 60_000, ... })
// populares / trending / most-active: ya con TTL en backend
useQuery({ queryKey: ['categories','popular'], staleTime: 2 * 60_000, ... })
// unread-count: mantené refetchInterval 60s (el socket cubre el tiempo real)
```

`refetchInterval: 60000` del badge (`LeftNav.jsx:157`, `BottomNav.jsx:14`) está bien (comparten queryKey, se dedupe); es el complemento del socket para cuando el push está pausado por carga.

**Prioridad: 1.**

### 3.2 Doble fetch del feed del Home en cada carga con sesión

**Archivo:** `frontend/src/features/feed/FeedPage.jsx:37-44`.

**Qué pasa:** la queryKey es `['categories','feed', user?.id ?? 'anon']` y AuthContext resuelve el usuario **después** del primer render. Secuencia real en cada cold load logueado: (1) FeedPage monta con `user = null` → fetch del feed **anónimo** (cronológico); (2) llega `/users/me` → la key cambia a `user.id` → fetch del feed **personalizado** (la query más cara, §1.2). El primero se tira a la basura.

**Impacto: Alto** (duplica el costo del Home en el arranque, y el resultado anónimo puede llegar a *pintarse* y ser reemplazado — otro flash).

**Solución:**

```js
const { user, loading: authLoading } = useAuth()
useInfiniteQuery({
  queryKey: ['categories', 'feed', user?.id ?? 'anon'],
  ...,
  enabled: !qParam && !authLoading,   // esperar a saber quién sos
})
```

**Prioridad: 1.**

### 3.3 Invalidaciones demasiado amplias

- **`ReactionButtons.jsx:40-41`**: tras cada like → `invalidateQueries(['replies'])` (TODAS las listas de comentarios cacheadas: categoría, tema, hijos, perfil, likes) **+** `invalidateQueries(['notifications'])`. El toggle ya devuelve `likes` y `mi_reaccion`, y el componente ya hace update optimista local — la invalidación global es innecesaria. Fix:

```js
onSuccess: (res) => {
  // nada de invalidate: el estado local ya refleja likes/mi_reaccion.
  // Si querés consistencia entre vistas duplicadas, actualizá quirúrgicamente:
  queryClient.setQueriesData({ queryKey: ['replies'] }, (old) =>
    Array.isArray(old)
      ? old.map(r => r.id === contenidoId ? { ...r, likes: res.data.likes, mi_reaccion: res.data.mi_reaccion } : r)
      : old
  )
}
```

  (y la de `['notifications']` directamente borrarla: el badge del *otro* usuario llega por socket; tu propio badge no cambia por dar like.)
- **`PollDisplay.jsx:36`**: `predicate: q.queryKey[0] === 'replies'` tras votar → mismo problema; el endpoint de voto devuelve la encuesta actualizada — usar `setQueriesData` sobre el comentario votado.
- **`FollowButton.jsx:72`**: además de invalidar `['user', nickname]` (correcto), invalida `['user']` completo → re-fetch de todos los perfiles cacheados. Borrar esa línea (la específica ya está en :69).
- **`LeftNav.jsx:114,130`**: `invalidateQueries(['user'])` en eventos de socket de follow — aceptable por frecuencia baja, pero mismo patrón; con `['user', nickname]` alcanza si el evento trae el nickname.

**Impacto: Medio** (cada like en un tema grande re-descarga listas completas sin paginar — se siente como "lag" al interactuar). **Prioridad: 2.**

### 3.4 Waterfalls y fetch eager de tabs

- **ProfilePage** (`ProfilePage.jsx:74-119`): espera el perfil (necesario, aporta el id) y después dispara **las 3 tabs a la vez** (temas + comentarios + likes; los dos últimos son las queries pesadas de §1.3), aunque solo una tab es visible. Fix mínimo:

```js
const { data: replies = [] } = useQuery({
  queryKey: ['replies', 'user', profile?.id],
  queryFn: ...,
  enabled: !!profile && canView() && activeTab === 'comentarios',
})
// ídem likes con activeTab === 'me-gusta'; topics (la tab default) queda eager
```

  Con `staleTime` de §3.1, cambiar de tab y volver no re-fetchea.
- **ProfilePage `['me']` duplicado** (`:88-92`): mirando el perfil de otro, pide `/users/me` de nuevo (AuthContext ya lo tiene, pero fuera de TanStack). Fix barato: en AuthContext, sembrar el cache — `queryClient.setQueryData(['me'], res.data)` después del fetch inicial — o migrar AuthContext a `useQuery(['me'])` y derivar `user` de ahí (una sola fuente).
- **ChatPage**: waterfall estructural resuelto en §2.2; además no usa TanStack (todo `useState`) → cero cache entre conversaciones: cada click en la lista re-descarga los mensajes ya vistos. Migrar mensajes a `useQuery(['chat','messages',convId], { staleTime: 30_000 })` los hace instantáneos al volver. Y `ChatPage.jsx:129`: cada mensaje entrante por socket dispara `fetchConversations()` (lista completa, §1.4) **además** del update local de :123-127 que ya hace lo mismo — borrar el `fetchConversations()` del handler.
- **`ChatPage.jsx:104-110`**: el efecto de mark-as-read depende de `messages.length` → hace `PATCH .../read` también cuando **vos** mandás un mensaje. Condicionar a mensajes entrantes (`last.autor_id !== user.id`).

**Prioridad: 2-3.**

### 3.5 Prefetching (mejora barata, no urgente)

Con los datos del feed ya en memoria, precargar el detalle al hover hace la navegación percibida ~0ms:

```jsx
// CategoryCard.jsx
const queryClient = useQueryClient()
const prefetch = () => {
  queryClient.prefetchQuery({ queryKey: ['category', String(category.id)],
    queryFn: () => apiGet(`/categories/${category.id}`).then(r => r.data), staleTime: 30_000 })
  queryClient.prefetchQuery({ queryKey: ['replies', 'category', String(category.id)],
    queryFn: () => apiGet(`/replies/category/${category.id}`).then(r => r.data), staleTime: 30_000 })
}
<article className="category-card" onMouseEnter={prefetch} onTouchStart={prefetch} ...>
```

También válido: `setQueryData(['category', id], categoríaDelFeed)` como placeholder inicial (`placeholderData`) para pintar título/descripcion al instante mientras llega el detalle. **Prioridad: 5.**

### 3.6 Datos duplicados con keys distintas

En general está bien resuelto (Sidebar y CategoryPage comparten `['category', id]` y `['replies','category',id]` — dedupe automático). Las excepciones: el `/users/me` triplicado (AuthContext sin key + `['me']`, §3.4) y `/chat/conversations` (LeftNav badge + ChatPage, sin key ninguna, §2.3).

---

## 4. Imágenes y avatares — el flash de default

### 4.1 `UserAvatar` no tiene transición fallback → imagen

**Archivo:** `frontend/src/components/shared/UserAvatar.jsx:43-65`.

**Qué pasa:** el componente elige **o** fallback **o** `<img>` según `url_imagen`. Cuando el dato llega tarde (chat, notificaciones, perfil) pasa de fallback a `<img>` vacío que recién empieza a descargar → flash doble. No hay `onLoad`, no hay crossfade.

**Solución** (mantiene la API del componente):

```jsx
export function UserAvatar({ url_imagen, nickname, size = 'md', inactive = false, className = '', style, onClick, eager = false }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  // ... sizeCls/sizeStyle igual que hoy ...
  const showImg = url_imagen && !failed
  return (
    <div className={`user-avatar-wrap ${cls}`} onClick={onClick}
         style={{ ...sizeStyle, background: hashColor(nickname), ...style }} aria-label={nickname}>
      {(!showImg || !loaded) && <span className="user-avatar-initial">{getInitials(nickname)}</span>}
      {showImg && (
        <img
          className="user-avatar-img"
          src={cldThumb(url_imagen, isNumeric ? size : SIZE_PX[size])}
          alt={nickname}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 120ms ease' }}
        />
      )}
    </div>
  )
}
```

```css
/* UserAvatar.css */
.user-avatar-wrap { position: relative; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  color: #fff; font-weight: 600; user-select: none; }
.user-avatar-wrap .user-avatar-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
```

El fallback queda **debajo** de la imagen hasta que `onLoad` dispara: nunca hay hueco, y el paso inicial→foto es un fade en vez de un flash. `eager` se pasa en el avatar del header/chat activo; el resto va `lazy` (hoy ningún avatar tiene `loading="lazy"`; solo `CommentAttachments.jsx:58` lo usa).

### 4.2 Avatares servidos sin transformación de Cloudinary

**Archivos:** `backend/src/utils/uploadToCloudinary.js:23-42` (devuelve `secure_url` cruda; el `optimizeImageUrl` con `f_auto,q_auto` de :78-81 solo se aplica a **adjuntos**), `frontend/src/components/shared/ImageCropperModal.jsx:39,48-49` (crop 400×400 JPEG q0.92).

**Qué pasa:** la URL guardada en `usuario.url_imagen` es el JPEG 400×400 original (~30-100 kB) y se descarga entero para renders de 28-40px. Sin `f_auto` no hay AVIF/WebP; sin `w_` no hay downscale. La respuesta del endpoint SÍ trae la URL (no se resuelve después) — el problema es solo el peso/formato.

**Solución:** transformación **en la URL de entrega** (gratis, cacheada por el CDN de Cloudinary, no toca la subida ni la DB):

```js
// frontend/src/utils/cloudinary.js
export function cldThumb(url, px) {
  if (!url || !url.includes('/image/upload/')) return url
  const w = Math.min(Math.ceil(px * 2), 400)   // 2x para retina, cap al original
  return url.replace('/image/upload/', `/image/upload/c_fill,g_face,w_${w},h_${w},f_auto,q_auto/`)
}
```

Usada dentro de `UserAvatar` (§4.1): un avatar de 36px pasa de ~60 kB JPEG a ~3-6 kB AVIF. En listas (chat, notificaciones, feed) la diferencia es descargar 100 kB vs 1 MB.

### 4.3 El chat puede pintar el avatar sin esperar al backend

**Archivo:** `frontend/src/features/chat/ChatPage.jsx:28-31, 232-238, 303-305`.

**Qué pasa:** la lista de conversaciones ya tiene `otro_nickname` y `otro_url_imagen`; al clickear una conversación se navega a `/chat/:nickname` y el header **espera** al `GET /chat/conversations/:nickname` para conocer `otherUser` — dato que ya estaba en pantalla.

**Solución:** sembrar `otherUser` desde la lista al instante:

```js
useEffect(() => {
  if (!nickname) { ... return }
  // pintar YA con lo que la lista ya sabe (avatar + nickname), sin esperar la red
  const known = conversations.find(c => c.otro_nickname === nickname)
  if (known) setOtherUser({ id: known.otro_id, nickname: known.otro_nickname, url_imagen: known.otro_url_imagen })
  ...fetch igual que hoy (confirma/corrige)...
}, [nickname, conversations, navigate])
```

Con §4.1 + §4.2 + esto, el flash del chat desaparece: inicial→foto es un fade de una imagen de 4 kB que casi siempre ya está en cache del navegador.

### 4.4 Preload de imágenes críticas

Marginal pero válido para el avatar propio (header, visible en todas las páginas):

```js
// AuthContext, tras resolver /users/me
if (res.data.user?.url_imagen) {
  const link = document.createElement('link')
  link.rel = 'preload'; link.as = 'image'
  link.href = cldThumb(res.data.user.url_imagen, 32)
  document.head.appendChild(link)
}
```

No hay imágenes críticas conocidas en el HTML estático (el avatar depende de la sesión), así que `<link rel="preload">` en `index.html` no aplica. **Prioridad: 5.**

### 4.5 Bonus: gifs de RegisterPage

`public/assets/gif/working.gif` = **1.78 MB**, `figure.gif` = 0.88 MB (usados en `RegisterPage`). Solo afectan esa página, pero convertirlos a WebP animado o `<video muted loop>` (MP4) los baja ~10x. **Impacto: Bajo. Prioridad: 5.**

---

## 5. Carga inicial de la app

### 5.1 Secuencia real (medida sobre el código)

```
HTML (1.3 kB)
 └─ theme-init.js (bloqueante, trivial) 
 └─ index-*.js  653.72 kB — SIN gzip por el bug de §7.2, y SIN cache-headers (§7.3)
     └─ React mount
         ├─ AuthContext: GET /users/me        ← 5 queries SQL secuenciales (§1.6), payload 4x (§2.1)
         ├─ FeedPage:    GET /categories/feed ← versión 'anon', se descarta (§3.2)
         ├─ useSiteSearch (Header): GET /categories/active  ← CATEGORY_CARD_QUERY completa (§1.1)
         ├─ Sidebar:     GET /categories/active (dedupe con la anterior) + trending-tags/most-active según página
         ├─ useSaved:    GET /saved/ids (cuando hay user)
         ├─ LeftNav:     GET /notifications/unread-count + GET /chat/conversations (§2.3)
         └─ al resolver /users/me → socket.io connect + REFETCH del feed (key cambió)
```

### 5.2 Sin code splitting: todo en un chunk

**Archivo:** `frontend/src/router.jsx:1-22` — 20 imports estáticos; el build lo confirma (1 solo JS de 653.72 kB). AdminPage (+5 secciones), ChatPage, SettingsPage, las 4 páginas About, SetupProfile, Login/Register y `react-image-crop` (vía EditProfileModal → ProfilePage) viajan en la primera visita del Home de un invitado.

**Impacto: Medio** (con gzip arreglado, 178 kB; sin arreglar, es Alto).

**Solución** — lazy por ruta, con Suspense en el router:

```jsx
// router.jsx
import { lazy, Suspense } from 'react'
const AdminPage = lazy(() => import('./features/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const ChatPage = lazy(() => import('./features/chat/ChatPage').then(m => ({ default: m.ChatPage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
// ídem About*, SetupProfilePage, LoginPage, RegisterPage

const lazyEl = (el) => <Suspense fallback={<div className="page-loading" />}>{el}</Suspense>
// { path: 'admin', element: <AdminRoute>{lazyEl(<AdminPage />)}</AdminRoute> },
```

Para exportar default más limpio, agregá `export default` en esas páginas. El core (Feed/Category/Topic/Profile + layout) conviene dejarlo eager — es lo que se usa siempre. Estimo −80 a −120 kB minificados fuera del chunk inicial, y sobre todo aísla el admin (que solo ve una persona).

### 5.3 CSS

121.57 kB → 19.06 kB gzip, un solo archivo. No es el cuello de botella; no encontré duplicación grosera (los .css por componente son chicos; `responsive.css` 11 kB es el mayor). Con compression activada (§7.2) queda resuelto; code-splitting de §5.2 también parte el CSS por ruta automáticamente. **Impacto: Bajo.**

---

## 6. Base de datos — índices

PostgreSQL **no** indexa FKs automáticamente. Crucé cada índice de `schema.sql` + migraciones contra las queries reales. Índices que existen y están bien: `comentario(tema_id)`, `comentario(comentario_padre_id)`, `reaccion(contenido_id)` + UNIQUE `(usuario_id, contenido_id)`, `adjunto(contenido_id)`, `encuesta(contenido_id)`, `encuesta_voto(opcion_id)`, `mensaje(conversacion_id, fecha DESC)`, `notificacion(usuario_id, fecha DESC)` + parcial no-leídas, `tema(categoria_id)`, `contenido(autor_id)`, parciales de moderación/apelaciones/guardado.

**Faltantes, en orden de impacto** (todos `IF NOT EXISTS`, aplicables en caliente con `CREATE INDEX CONCURRENTLY` si ya hay datos):

```sql
-- 6.1 ALTO — comentarios directos de categoría: getRepliesByCategoryId, contador de
-- cards del Home (§1.1), scoring del feed (§1.2), FK sin índice.
CREATE INDEX IF NOT EXISTS idx_comentario_categoria
  ON comentario (categoria_id) WHERE categoria_id IS NOT NULL;

-- 6.2 ALTO — todos los ORDER BY fecha_creacion y ventanas temporales sobre contenido
-- (recientes, popular, trending, ultimo_tema/ultimo_comentario de las cards).
CREATE INDEX IF NOT EXISTS idx_contenido_fecha ON contenido (fecha_creacion DESC);

-- 6.3 ALTO — TODOS los lookups de usuario usan LOWER(nickname)/LOWER(email)
-- (login, /users/me, perfiles, follow, chat): el UNIQUE actual sobre la columna
-- cruda NO sirve para esos predicados → seq scan de usuario en cada auth-lookup.
-- (Verificar antes que no existan duplicados que difieran solo en mayúsculas.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_nickname_lower ON usuario (LOWER(nickname));
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_email_lower    ON usuario (LOWER(email));

-- 6.4 MEDIO — seguidores de X: el PK (seguidor_id, seguido_id) no sirve para
-- buscar por seguido_id (getFollowersByUserId, acceptAllPendingFollowRequests).
CREATE INDEX IF NOT EXISTS idx_seguidor_seguido ON usuario_seguidor (seguido_id, estado);

-- 6.5 MEDIO — badge de chat y conteo de no-leídos por conversación (§1.4, §2.3).
CREATE INDEX IF NOT EXISTS idx_mensaje_no_leido
  ON mensaje (conversacion_id, autor_id) WHERE leido = FALSE;

-- 6.6 MEDIO — dedup de notificaciones (notificationExists corre en cada like) y
-- FK actor_id/contenido_id con ON DELETE SET NULL (hoy borran con seq scan).
CREATE INDEX IF NOT EXISTS idx_notificacion_actor ON notificacion (actor_id, tipo);
CREATE INDEX IF NOT EXISTS idx_notificacion_contenido ON notificacion (contenido_id);

-- 6.7 MEDIO — fanout de suscripciones y listado de participantes: ambos PK
-- empiezan por usuario_id, las queries filtran por categoria_id.
CREATE INDEX IF NOT EXISTS idx_suscripcion_categoria ON suscripcion_categoria (categoria_id);
CREATE INDEX IF NOT EXISTS idx_participacion_categoria ON participacion_categoria (categoria_id);

-- 6.8 BAJO — joins liderados por etiqueta (afinidad del feed, trending-tags):
-- el PK (categoria_id, etiqueta_id) no sirve entrando por etiqueta_id.
CREATE INDEX IF NOT EXISTS idx_cat_etiqueta_etiqueta ON categoria_etiqueta (etiqueta_id);

-- 6.9 BAJO — FKs de guardado: los UNIQUE parciales empiezan por usuario_id;
-- el borrado en cascada de contenido/categoría escanea la tabla.
CREATE INDEX IF NOT EXISTS idx_guardado_contenido ON guardado (contenido_id) WHERE contenido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guardado_categoria ON guardado (categoria_id) WHERE categoria_id IS NOT NULL;
```

**Índices que sobran / neutros:** `idx_tema_estado` (baja selectividad, las queries siempre filtran antes por `categoria_id`; inofensivo) y `idx_apelacion_estado` (ídem). No hace falta borrarlos.

**ORDER BY sin índice:** cubiertos por 6.2 (`contenido.fecha_creacion`). `getMessages` ordena por `id DESC` filtrando por conversación — el índice existente `(conversacion_id, fecha_creacion DESC)` es equivalente en la práctica (ids crecen con la fecha); si algún día un EXPLAIN muestra sort, cambiarlo a `(conversacion_id, id DESC)`.

**Cómo verificar (sin adivinar):**

```sql
EXPLAIN (ANALYZE, BUFFERS)  SELECT ... ;      -- antes y después de cada índice
-- y en producción, activar el módulo de stats para encontrar lo realmente lento:
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT calls, mean_exec_time, query FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 15;
```

---

## 7. Backend — middleware y overhead

### 7.1 `protect`/`optionalAuth` hacen 1 query por request

**Archivo:** `backend/src/middlewares/auth.middleware.js:13-16, 53-56` (+ `socket.js:38-41` en cada handshake).

**Qué pasa:** cada request autenticada consulta `usuario` para validar estado y traer rol/nickname. Una página como el perfil dispara 5-6 requests → 5-6 queries idénticas seguidas. La consulta es barata (PK), pero es un RTT a la DB **en serie** antes de cada handler.

**Solución incremental** (sin tocar el modelo de JWT): micro-cache en memoria con TTL corto e invalidación explícita en los puntos que cambian estado (ban/desactivación):

```js
// auth.middleware.js
const userCache = new Map();               // id -> { user, exp }
const USER_TTL_MS = 30_000;
export const invalidateUserCache = (id) => userCache.delete(Number(id));

const getAuthUser = async (id) => {
  const hit = userCache.get(id);
  if (hit && hit.exp > Date.now()) return hit.user;
  const { rows } = await pool.query('SELECT id, rol, nickname, estado FROM usuario WHERE id = $1', [id]);
  const user = rows[0] || null;
  userCache.set(id, { user, exp: Date.now() + USER_TTL_MS });
  return user;
};
// protect/optionalAuth usan getAuthUser(decoded.id)
// user.service.js: llamar invalidateUserCache(id) en banUserService / updateUserEstadoById / deactivateAccountService
```

Con TTL 30s, un usuario baneado puede colar requests por ≤30s — mitigado por la invalidación explícita en los servicios de ban. **Impacto: Medio. Prioridad: 3.**

### 7.2 `compression()` montado DESPUÉS de los estáticos — el bundle viaja sin gzip

**Archivo:** `backend/src/app.js:62-65`:

```js
app.use(express.static(FRONTEND_DIST));      // ← sirve index-*.js (653 kB) SIN comprimir
app.use('/central', express.static(...));
app.use('/assets', express.static(...));
app.use(compression());                      // ← solo comprime lo que viene después (la API)
```

**Qué pasa:** en Express, un middleware solo afecta lo que se monta después. El JS de 653.72 kB, el CSS de 121 kB y todo `/central` se sirven **sin compresión** (a menos que haya un CDN adelante, y en Railway directo no lo hay). Es 3.6x más bytes en el asset más pesado de la app, en cada primera visita.

**Impacto: ALTO. Esfuerzo: mover una línea.**

**Solución:**

```js
app.use(compression());                       // ANTES de los estáticos
app.use(express.static(FRONTEND_DIST, staticOpts));
...
```

### 7.3 Estáticos sin `Cache-Control` — revalidación en cada visita

**Mismo archivo.** `express.static` sin opciones manda ETag pero no `max-age`: cada visita re-valida cada asset (RTTs de 304). Vite genera nombres con hash → es seguro cachear "para siempre":

```js
const staticOpts = {
  setHeaders: (res, filePath) => {
    if (/[/\\]assets[/\\]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // JS/CSS hasheados
    } else if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');                            // el HTML siempre fresco
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
};
app.use(express.static(FRONTEND_DIST, staticOpts));
```

**Impacto: Alto para visitas repetidas. Prioridad: 1 (mismo commit que 7.2).**

### 7.4 Rate limiters y resto

- Los limiters de `express-rate-limit` son Maps en memoria: latencia despreciable. Único detalle: `app.use('/api/reports', limiterIf(reporteLimiter))` (app.js:171) también limita los **GET** de listado de reportes del admin — inofensivo hoy, filtrable por método como ya hacés con reactions (app.js:151-152).
- No hay middleware global que haga queries innecesarias fuera de auth. `/health` hace `SELECT 1` — correcto.
- Pool de PG (`config/db.js`) sin `max` explícito → default 10 conexiones. Para single-instance está bien; dejalo anotado por si algún día hay más instancias.

---

## Resumen ejecutivo — Top 5 por impacto/esfuerzo

**1. Servir el frontend comprimido y cacheado (§7.2 + §7.3) — 15 minutos.**
Mover `app.use(compression())` arriba de los estáticos y agregar `Cache-Control` immutable a `/assets`. El bundle pasa de 653 kB a 179 kB en primera visita y a ~0 en las siguientes. Es la mejora más grande dividida el esfuerzo de toda la auditoría.

**2. Defaults de TanStack Query + doble-fetch del feed (§3.1 + §3.2) — 30 minutos.**
`staleTime: 60s`, `refetchOnWindowFocus: false`, overrides para etiquetas/índice de categorías, y `enabled: !authLoading` en el feed. Elimina la mayoría de las micro-demoras de navegación (síntoma c) y el fetch descartado del Home en cada arranque.

**3. Índices faltantes (§6.1-6.5) — 1 hora incluyendo verificación con EXPLAIN.**
`comentario(categoria_id)`, `contenido(fecha_creacion)`, `LOWER(nickname)/LOWER(email)`, `usuario_seguidor(seguido_id)`, parcial de mensajes no leídos. Bajan el costo real de las queries que hoy dominan: cards del Home, feeds, lookups de usuario en cada auth, badge de chat.

**4. Paquete chat + avatar (§1.5, §2.2, §2.3, §4.1-4.3) — medio día.**
Fusionar las queries de pertenencia/visibleSince, devolver la primera página de mensajes junto con la conversación, endpoint `unread-count`, sembrar `otherUser` desde la lista, crossfade con `onLoad` en `UserAvatar` y thumbnails de Cloudinary (`c_fill,w_,f_auto,q_auto`). Resuelve de raíz los síntomas (a) y (b).

**5. Aligerar los endpoints calientes (§1.1, §1.6, §2.1) — medio día.**
`/users/me` liviano (por id, con `Promise.all`, sin listas) + `/categories/index` liviano para buscador/sidebar/recientes. Después de esto, la única query pesada que queda en el arranque es el feed paginado — que es exactamente la que debe serlo.

**Siguientes en la cola** (cuando el foro crezca): paginar comentarios (§1.3, el límite estructural más importante a futuro), TTL cache de trending/popular (§1.8), lazy-loading de rutas (§5.2), invalidaciones quirúrgicas (§3.3), cache de auth middleware (§7.1).

### Cómo medir (para no optimizar a ciegas)

- **SQL:** `EXPLAIN (ANALYZE, BUFFERS)` antes/después de cada índice; `pg_stat_statements` en producción para el ranking real de queries.
- **HTTP:** `curl -s -o /dev/null -w '%{size_download} %{time_total}\n' --compressed https://.../assets/index-*.js` antes/después del fix de compression.
- **Frontend:** pestaña Network con "Disable cache" off para ver el efecto de staleTime; React Query Devtools (`@tanstack/react-query-devtools`, solo dev) para ver refetches; Lighthouse para LCP antes/después del code splitting.
