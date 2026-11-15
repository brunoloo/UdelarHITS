# Guía de contribución

Gracias por tu interés en UdelarHITS. Esta guía resume cómo proponer cambios.

## Antes de empezar

- Para un error o una mejora, abrí un issue y describí el caso. Si el cambio es grande, conviene acordar el enfoque antes de escribir código.
- Las vulnerabilidades se reportan según [SECURITY.md](SECURITY.md), no en issues públicos.

## Entorno

Las instrucciones para levantar el proyecto y correr los tests están en el [README](README.md).

## Flujo de trabajo

1. Creá un fork y una rama a partir de `main` (`feat/...`, `fix/...`, `chore/...`).
2. Hacé cambios acotados: un pull request por tema.
3. Verificá que pasen los tests y el lint:
   - `npm test` en `project/backend`
   - `npm test` y `npm run lint` en `project/frontend`
4. Abrí el pull request contra `main` y completá la plantilla.

Los mensajes de commit son breves, en español y con prefijo de tipo: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:` o `test:`.

## Convenciones

### Backend

- El flujo es rutas → controllers → services → repositories. Solo los repositories consultan la base.
- Las consultas SQL siempre van parametrizadas.
- Todo endpoint nuevo define autenticación, autorización y control de propiedad, y lleva tests.
- Un cambio de esquema actualiza `schema.sql` y agrega una migración idempotente en `project/database/migrations/`.

### Frontend

- Los pedidos al backend usan TanStack Query y el cliente de `src/api/client.js`.
- Los colores y las fuentes salen de `src/styles/tokens.css`; los componentes no declaran valores propios.
- El contenido de usuarios nunca se inserta como HTML. Los enlaces externos generados desde ese contenido pasan por `/redirect`.
- Las acciones destructivas piden confirmación.

### Comentarios

Los comentarios explican decisiones que el código no deja ver. No describen lo que el código ya dice.

## Licencia

Al contribuir aceptás que tu aporte se publique bajo la [licencia MIT](LICENSE) del proyecto.
