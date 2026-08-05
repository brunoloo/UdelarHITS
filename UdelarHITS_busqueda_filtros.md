# Búsqueda y filtros de categorías

Notas de arquitectura sobre la búsqueda del feed. Tres cosas que no se deducen
mirando el código y que conviene tener escritas antes de "simplificar".

---

## 1. El contrato `q` vs `etiqueta`: son dos intenciones distintas

La búsqueda de categorías tiene **dos parámetros independientes y combinables con
AND**, no uno:

| Param      | Qué es                          | Cómo matchea                                            |
|------------|---------------------------------|--------------------------------------------------------|
| `q`        | Texto libre                     | Substring normalizado (unaccent + lower) sobre el **título**, O igualdad de nombre de etiqueta |
| `etiqueta` | Filtro exacto por una etiqueta  | **Igualdad** (unaccent + lower) sobre `etiqueta.nombre`, nunca substring |

Ejemplos:

- `?q=resumen` → categorías cuyo título contiene "resumen".
- `?etiqueta=FING` → solo categorías etiquetadas FING.
- `?q=resumen&etiqueta=FING` → categorías etiquetadas FING **y** cuyo texto
  matchea "resumen" (AND).

**Por qué están separados — y por qué no se deben fusionar de nuevo.**
El caso que motivó todo esto: buscar `Arquitectura`.

- Como texto (`?q=Arquitectura`) tiene que devolver todo lo que *menciona*
  Arquitectura, incluida la categoría "Teórico Arquitectura de Computadoras"
  (FING) por su título. Eso está bien: es una búsqueda de texto.
- Como filtro (`?etiqueta=Arquitectura`) tiene que devolver **solo** las
  categorías etiquetadas `Arquitectura` (FADU), y NO "Arquitectura de
  Computadoras", que no tiene esa etiqueta.

Son dos preguntas diferentes del usuario. Si en algún momento se "unifica" todo
en un solo `q` que hace OR de título + etiqueta, el filtro exacto desaparece y
clickear la etiqueta `Arquitectura` vuelve a traer "Arquitectura de
Computadoras". Ese es exactamente el bug que este diseño resuelve. **No los
fusiones.**

Por eso, en el frontend, **todo lo que representa una etiqueta** (la ficha de
facultad del sidebar, los chips de etiqueta de las cards, los hero-tags de
Explorar, "Etiquetas populares", el click de etiqueta en el dropdown de
búsqueda) navega a `?etiqueta=`, no a `?q=`. El `?q=` queda para el texto libre
que el usuario escribe en el buscador.

- Backend: `getActiveCategories({ q, etiqueta })` en `category.repository.js`.
  El filtro por etiqueta es un `EXISTS` sobre `categoria_etiqueta`, envolviendo
  `CATEGORY_CARD_QUERY` como subquery para no duplicar filas.
- Índice: `idx_cat_etiqueta_etiqueta` sobre `categoria_etiqueta(etiqueta_id)`.
  La PK es `(categoria_id, etiqueta_id)`, así que entrar por `etiqueta_id`
  (segundo campo) no la aprovecha.
- Frontend: la fuente de verdad del filtro es la URL. `?etiqueta=` se muestra
  como una píldora dentro del buscador; `?q=` es el texto del input.

---

## 2. Causa raíz del bug del contador ("dice 1, renderiza 2")

Síntoma: el dropdown de búsqueda mostraba "Arquitectura — 1 categoría", pero al
clickear se renderizaban 2 cards.

**La causa NO era un endpoint sin etiquetas.** Vale aclararlo porque es la
hipótesis intuitiva y es falsa: `GET /categories/index` es un endpoint liviano
(no trae las previews pesadas de último tema/comentario de la card del Home)
**pero sí incluye las etiquetas** (`ARRAY_AGG(e.nombre)`). Confirmado en
`getCategoryIndex` (`category.repository.js`).

La causa real era **dos criterios de filtrado distintos en dos lugares**:

- **El contador** (dropdown, `SearchDropdown.jsx`) contaba por **etiqueta
  exacta**: categorías cuya etiqueta `=== tag`.
- **La lista** (feed, `FeedPage.jsx`) filtraba por **etiqueta exacta OR título
  substring**, y encima el click navegaba a `?q=tag`.

Entonces para "Arquitectura": el contador contaba 1 (la etiquetada), pero el feed
sumaba "Teórico Arquitectura de Computadoras" por el título → 2. Dos fuentes que
podían divergir por diseño.

**El fix** fue alinear las intenciones: el click de etiqueta navega a
`?etiqueta=` (exacto), y el feed filtrado usa el filtro exacto del backend. Así
el contador (exacto) y la lista (exacto) salen del mismo criterio y no pueden
divergir.

**Si mañana el contador vuelve a no coincidir con la lista**, el diagnóstico
casi siempre es el mismo: alguien está contando con un predicado y renderizando
con otro. Buscá dónde se calcula el número y dónde se filtra la lista, y
confirmá que usan exactamente el mismo criterio (mismo parámetro, misma
normalización).

---

## 3. Por qué no se usan los logos de las facultades

La card de facultades del sidebar usa **sigla + punto de color**, no los
isologotipos institucionales. Es una decisión deliberada, no un placeholder:

- **Restricciones de identidad.** Los manuales de identidad de la Udelar
  restringen el uso de los isologotipos a actividades de la propia institución y
  prohíben redibujarlos o recolorearlos. UdelarHITS es un sitio **no oficial**;
  usar los logos sugeriría un aval institucional que no existe.
- **Varias facultades no tienen isotipo separable.** FING, por ejemplo, es
  puramente tipográfica: no hay un símbolo que aislar. A 32px serían ilegibles
  igual.

El sistema de sigla + color es la solución definitiva. Si alguien propone "poner
los logos que quedaría más lindo", este es el motivo por el que no.

La lista de las 16 facultades (sigla, nombre completo, color) vive hardcodeada en
`frontend/src/config/facultades.js`. Es una lista fija (las facultades no
cambian). El único acoplamiento con la base es un test de backend
(`tests/category/facultades-config.test.js`) que verifica que cada sigla exista
en la tabla `etiqueta` con `grupo = 'Facultades'`: si alguien renombra una
etiqueta, la ficha quedaría filtrando vacío en silencio y el test lo detecta.
