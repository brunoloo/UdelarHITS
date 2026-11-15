# Arquitectura

## Backend (`project/backend`)

API en Node.js con Express, PostgreSQL mediante `pg` y Socket.IO para el chat y las notificaciones.

El código se organiza en capas con dependencia en un solo sentido:

```
rutas → controllers → services → repositories → base de datos
```

- `src/routes/`: definen los endpoints y delegan en un controller. Se agregan en `src/routes/API.js`, montado en `/api`.
- `src/controllers/`: leen el pedido, llaman al service y eligen el código de respuesta.
- `src/services/`: reglas de negocio (validación, permisos, moderación).
- `src/repositories/`: única capa que ejecuta SQL.

### Autenticación

La sesión es un JWT en una cookie `httpOnly`; no hay sesiones de servidor. `src/middlewares/auth.middleware.js` expone `protect` (exige sesión y cuenta activa), `isAdmin` y `optionalAuth` (identifica al usuario si hay sesión y sigue como invitado si no). El inicio de sesión con Google usa Passport y emite la misma cookie.

El token incluye una huella de la contraseña vigente: cambiarla o restablecerla invalida las sesiones abiertas.

### Composición de la aplicación

`src/app.js` monta los middlewares en un orden que importa:

1. Modo mantenimiento.
2. Cabeceras de seguridad (Helmet y CSP).
3. Compresión.
4. Archivos estáticos: frontend compilado, `central/` y assets propios.
5. `/health`.
6. CORS con lista de orígenes permitidos.
7. Límites de frecuencia por tipo de endpoint.
8. API, rutas de SEO y fallback de la SPA.
9. Manejadores de error.

Las rutas de SEO (`src/routes/seo.routes.js`) inyectan metadata por URL en el `index.html` para buscadores y previsualizaciones, y generan `sitemap.xml` y `robots.txt`.

### Tiempo real y tareas periódicas

- `src/socket.js` autentica cada conexión con la misma cookie y une al usuario a su sala.
- `src/utils/realtimeMode.js` pausa el envío en tiempo real cuando hay mucha carga; las notificaciones se siguen guardando.
- `src/jobs/cleanup.job.js` borra mensajes de chat antiguos, registros de verificación vencidos e imágenes sin revisar.

### Moderación

Los reportes sobre categorías, temas y comentarios se acumulan y, al superar un umbral, el contenido queda inactivo u oculto con un motivo explícito. El autor puede apelar; un administrador acepta (el contenido se restaura) o rechaza (se elimina con sus respuestas). Los umbrales se configuran en `src/config/reportConfig.js`.

Las imágenes pueden pasar por un análisis automático; las marcadas quedan en una cola de revisión para administradores.

El contenido oculto o inactivo no se entrega al cliente: los services lo quitan de las respuestas (`src/services/visibility.service.js`).

### Eliminación de contenido

El contenido sin respuestas se elimina. El que tiene respuestas queda inactivo u oculto, para que el hilo siga siendo navegable.

## Frontend (`project/frontend`)

SPA en React con Vite.

- `src/router.jsx`: rutas. La página de inicio se carga de forma directa y el resto bajo demanda.
- `src/api/client.js`: único cliente HTTP; envía la cookie de sesión y lanza ante respuestas de error.
- `src/context/` y `src/hooks/`: estado global (sesión, socket, tema, avisos) y sus hooks.
- `src/features/<dominio>/`: páginas y componentes de cada área.
- `src/components/`: piezas compartidas (`shared`, `ui`) y estructura de la aplicación (`layout`).
- `src/styles/tokens.css`: colores y tipografías de todos los temas.

Las rutas privadas se protegen con `ProtectedRoute` y `AdminRoute`; el control de acceso real está en el backend.

## Páginas estáticas (`project/central`)

HTML, CSS y JavaScript sin framework para ayuda, normas, textos legales y gestión de cuenta. Las sirve el backend en `/central`.

## Base de datos (`project/database`)

Ver [project/database/README.md](../project/database/README.md).

## Tests

- Backend: `project/backend/tests/<área>/`, con Jest y Supertest contra una base local de test. `tests/helpers.js` reúne las utilidades para crear usuarios y contenido.
- Frontend: tests junto al código, en carpetas `__tests__`, con Vitest y Testing Library.
