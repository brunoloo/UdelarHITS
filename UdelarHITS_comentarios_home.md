# Comentarios de Home (foro global)

Notas de arquitectura sobre los comentarios publicables directamente en el Home.
Cosas que no se deducen mirando el código y conviene tener escritas antes de
"simplificar".

Un **comentario de Home** es un comentario de primer nivel que no vive dentro de
ninguna categoría ni tema: vive en el foro a nivel global y se mezcla con las
categorías en el feed del Home.

---

## 1. Modelo de datos: tres ámbitos mutuamente excluyentes

Antes, un `comentario` vivía siempre en un tema o en una categoría. El CHECK
viejo exigía exactamente uno de los dos FK. Se agregó un tercer ámbito, marcado
con un **flag explícito** `es_home`:

```sql
ALTER TABLE comentario ADD COLUMN es_home BOOLEAN NOT NULL DEFAULT FALSE;

CONSTRAINT comentario_target_check CHECK (
  (tema_id IS NOT NULL)::int + (categoria_id IS NOT NULL)::int + (es_home)::int = 1
)
```

**Por qué un flag y no "los dos FK en NULL".** El ámbito home NO se deja
implícito en "todo NULL". Si lo fuera, cualquier bug que olvide setear
`categoria_id`/`tema_id` crearía silenciosamente un comentario huérfano que el
feed del Home levantaría. Con el flag explícito, el CHECK garantiza que un
comentario tiene exactamente un ámbito y un huérfano (`es_home = FALSE` y ambos
FK NULL) es un error de base, no un comentario de Home.

Migración: `database/migrations/migration_fase22_comentario_home.sql`. Las filas
legadas (todas con tema o categoría) quedan con `es_home = FALSE`, válidas, sin
migración de datos.

Índice parcial, restringido a lo que el feed realmente consulta (primer nivel):

```sql
CREATE INDEX idx_comentario_home ON comentario(contenido_id)
  WHERE es_home = TRUE AND comentario_padre_id IS NULL;
```

**El ámbito es EXPLÍCITO también en la API.** `POST /replies/create` sólo crea
un comentario de Home si el cliente manda `es_home=true` sin categoría/tema/
padre. Un `{cuerpo}` pelado sin ámbito sigue devolviendo 400 (no se convierte en
home por descarte). Una respuesta a un comentario de Home hereda el ámbito del
padre (no manda el flag).

---

## 2. El feed del Home: dos streams rankeados por separado + intercalado por cadencia

Este es el punto de diseño importante. El Home mezcla dos tipos de ítem:
**categorías** (stream A) y **comentarios de Home** (stream B). La decisión clave
es **cómo** se mezclan.

### Lo que se descartó: un `UNION ALL` con score unificado

La primera idea fue traer ambos tipos en una sola query (`CTE categorías UNION
ALL CTE comentarios`), asignarles un score comparable y `ORDER BY score`. **Se
descartó**, por dos razones:

1. **Calibración de magnitudes.** Un score unificado obliga a que el puntaje de
   una categoría y el de un comentario sean numéricamente comparables. Los
   componentes de la categoría (participación 500, suscripción 400, afinidad de
   etiquetas, actividad reciente, novedad) no tienen equivalente en un
   comentario. Cualquier mapeo (un `FACTOR_COMENTARIO_HOME` global, por ejemplo)
   es un número mágico que desbalancea el feed: subilo y el Home se llena de
   comentarios, bajalo y no aparece ninguno. Es imposible de calibrar bien.

2. **El objetivo no era competir, era entremezclar.** Navegando el Home querés ir
   encontrando categorías y comentarios **alternados**, no un bloque de uno y
   después el otro (que es lo que da un ranking único cuando un tipo puntúa
   sistemáticamente más alto).

### Lo que se hizo: dos streams + cadencia

- **Stream A (categorías):** usa `getPersonalizedFeed` / `getChronoFeed` tal cual
  estaban. Su score y sus pesos **no se tocaron**.
- **Stream B (comentarios de Home):** tiene su propio score (`FEED_COMENTARIO_HOME`
  en `config/feedConfig.js`), que sólo tiene que ordenar comentarios **entre sí**
  — no necesita ser comparable con el de las categorías.
- El servicio pide de cada stream lo que necesita y los **intercala con una
  cadencia fija** (`CADENCIA_HOME = { categorias: 2, comentarios: 3 }`): 2
  categorías, 3 comentarios, y se repite.

**Ventaja:** cada score sólo tiene que ordenar bien dentro de su tipo, así que no
hay que calibrar magnitudes entre tipos, y **el balance del feed se ajusta con un
solo valor —la cadencia— en vez de con pesos.** El 2:3 deja el feed en ~60%
comentarios, apropiado porque los comentarios se publican mucho más seguido que
las categorías.

### Reglas del intercalado (en `getCategoryFeedService`)

- `slot` (posición en el ciclo de cadencia) avanza **una posición por cada ítem
  colocado**. La preferencia de cada slot sale del patrón `[C,C,c,c,c]`.
- **Si el stream preferido por un slot está agotado, se toma del otro** (relleno
  sin huecos). Foro solo con comentarios → feed de comentarios; solo categorías →
  feed de categorías. Sin código especial para esos casos.
- **Determinístico:** la misma posición de cursor produce siempre la misma
  secuencia. Nada de random ni shuffle.
- Aplica a los **dos modos**: personalizado y cronológico. En cronológico cada
  stream se ordena por `fecha_creacion DESC, id DESC` y se intercala igual.
- La **categoría fijada por un admin** se prepende en la página 1 **fuera** del
  intercalado, y se excluye del stream A (vía el filtro `fijada_hasta`) para no
  duplicarse.

### El cursor (versionado `v:2`)

El cursor lleva el estado de **ambos** streams más la posición en la cadencia:

```
{ v:2, m:'p'|'c', cat:{s,id}|{f,id}|null|{}, com:{...}|null|{}, slot:n }
```

- `m` distingue personalizado/cronológico (rechaza un cursor de otro modo si se
  hace login/logout a mitad de scroll).
- `v:2` hace que un cursor viejo (formato Fase <22) devuelva 400 en vez de
  reinterpretarse mal.
- Por stream: `null` = agotado (no se vuelve a pedir); `{}` = **activo pero sin
  avanzar** (se pide desde el inicio); `{s,id}`/`{f,id}` = posición del último
  ítem consumido.

**El marcador `{}` no es cosmético.** Distingue "agotado" de "activo, en el
inicio". Sin él, en páginas muy chicas (page size 1–2) una página que no llega a
tocar un stream lo marcaría `null` (agotado) y ese stream se perdería para
siempre. Test que lo cubre: `home-feed-interleave.test.js` → "page size = 2".

Se piden `pageSize + 1` filas de **cada** stream por página. Es necesario porque
una página podría llenarse toda de un tipo si el otro se agota; el `+1` además
detecta si quedan más. Costo: duplica el fetch del feed. Aceptable a escala de
foro; optimizable si hiciera falta.

---

## 3. Umbral de reportes de un comentario de Home

Un comentario de Home no tiene categoría → **no hay participantes ni comunidad**
que ponderen el reporte. La fórmula dual participante/visitante (que escala con
el tamaño de la categoría) no aplica.

Se usa un umbral **plano y explícito**: `REPORT_THRESHOLD.HOME` (env `UMBRAL_HOME`,
default **10**) reportantes distintos → se oculta. Ver `debeInactivarHome` en
`config/reportConfig.js`, ruteado desde `report.service` cuando
`getContenidoTipo` marca `es_home`.

**Por qué 10, y por qué explícito.** La portada es la superficie de máxima
visibilidad: un puñado de reportes no debería tumbar contenido visto por todos, y
sin comunidad que lo respalde un umbral chico facilitaría la censura por
brigading. El default coincide numéricamente con el piso de visitantes actual
(10), pero es **deliberado y ajustable por separado** — no un default heredado
"por accidente".

---

## 4. Permalink independiente del ámbito: `/comment/:id`

Los comentarios de categoría/tema derivan su URL del contenedor
(`/category/:id?tab=comentarios&commentId=…` o `/topic/:id?commentId=…`). Un
comentario de Home no tiene contenedor, así que se agregó una **ruta de
comentario independiente del ámbito**: `/comment/:id` (`CommentPage`, reusa
`CommentThread`). La usan las notificaciones, guardados y el perfil para los
comentarios de Home. Carga **sin sesión** (`GET /replies/:id/context` es
`optionalAuth`). El sidebar de esa ruta muestra Comunidad + Facultades (mismo que
el Home), porque el comentario vive a nivel foro global.

---

## 5. Aislamiento: dónde un comentario de Home NO aparece

Por construcción (filtran por FK o son superficies de categorías), un comentario
de Home **no** aparece en:

- `GET /replies/category/:id` ni `GET /replies/topic/:id` (filtran por FK).
- Recientes, Populares, Explorar (usan `/categories/active`, `/index`,
  `/popular` — sólo categorías).
- El buscador del header (etiquetas + usuarios).
- Las notificaciones de suscripción a categoría (la campanita sólo aplica a
  comentarios directos de una categoría y a creación de temas).

Los comentarios de Home viven **sólo** en el Home y en su permalink.
