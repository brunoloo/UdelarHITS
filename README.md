# UdelarHITS

Foro para la comunidad de la Universidad de la República (Uruguay). El contenido se organiza en categorías, temas y comentarios en hilo.

Sitio en producción: [udelarhits.com](https://udelarhits.com)

UdelarHITS es un proyecto independiente, sin afiliación oficial con la Universidad de la República.

## Funcionalidades

- Categorías con etiquetas, temas y comentarios anidados, con historial de edición.
- Inicio con feed personalizado, páginas de recientes, populares y exploración.
- Búsqueda unificada de categorías, temas, comentarios y usuarios.
- Perfiles con seguidores, cuentas privadas y bloqueo entre usuarios.
- Chat 1:1 y notificaciones en tiempo real, con notificaciones push opcionales.
- Adjuntos y encuestas en comentarios.
- Moderación comunitaria por reportes, con apelaciones y panel de administración.
- Registro con verificación por correo e inicio de sesión con Google.

## Tecnologías

| Capa | Tecnologías |
|------|-------------|
| Frontend | React 19, Vite, React Router, TanStack Query |
| Backend | Node.js, Express 5, Socket.IO |
| Base de datos | PostgreSQL |
| Tests | Jest y Supertest (backend), Vitest y Testing Library (frontend) |

## Estructura

```
project/
  backend/    API en Express: rutas, controllers, services y repositories
  frontend/   SPA en React
  central/    Páginas estáticas: ayuda, normas, legales y gestión de cuenta
  database/   Esquema (schema.sql) y migraciones
  scripts/    Utilidades de mantenimiento
docs/         Documentación técnica
```

La arquitectura se describe en [docs/arquitectura.md](docs/arquitectura.md).

## Puesta en marcha

Requisitos: Node.js 22 o superior y PostgreSQL con la extensión `unaccent` (producción usa PostgreSQL 17).

Los scripts de base de datos usan `psql` contra `localhost` con el usuario del sistema. Para usar otro, definir `PGUSER` y `PGPASSWORD`.

### 1. Backend

```bash
cd project/backend
npm install
cp .env.example .env        # completar DB_USER, DB_PASSWORD y JWT_SECRET
npm run db:reset            # crea la base udelarhits y aplica el esquema
npm run dev                 # API en http://localhost:5001
```

Cloudinary y Resend son necesarios para subir imágenes y enviar correos. El inicio de sesión con Google, la moderación automática de imágenes y las notificaciones push son opcionales: sin sus variables, esas funciones quedan desactivadas. Todas las variables están descritas en [`project/backend/.env.example`](project/backend/.env.example).

Para crear una cuenta de administrador:

```bash
ADMIN_NICKNAME=admin ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='una-clave-larga' npm run admin:create
```

### 2. Frontend

```bash
cd project/frontend
npm install
npm run dev                 # http://localhost:5173
```

El servidor de desarrollo redirige `/api`, `/central` y `/socket.io` al backend.

## Tests

```bash
# Backend: requiere una base local de test
cd project/backend
cp .env.test.example .env.test   # completar DB_USER y DB_PASSWORD
npm test

# Frontend
cd project/frontend
npm test
npm run lint
```

La suite del backend recrea la base `udelarhits_test` y trunca sus tablas antes de cada test. Se niega a correr si el nombre de la base no contiene `test` o si detecta credenciales de servicios externos.

## Base de datos

`project/database/schema.sql` es el esquema completo y la referencia para crear una base nueva. Los cambios sobre una base existente se aplican con los archivos de `project/database/migrations/`:

```bash
npm run db:migrate -- ../database/migrations/<archivo>.sql
```

Ver [project/database/README.md](project/database/README.md).

## Despliegue

Desde `project/`, `npm run build` compila el frontend e instala las dependencias del backend, y `npm start` levanta el servidor, que sirve la API, la SPA compilada y las páginas de `central/`.

- `GET /health` verifica la conexión con la base.
- `MAINTENANCE_MODE=true` responde 503 en todas las rutas salvo `/health`.
- `.github/workflows/backup-db.yml` genera un respaldo diario de la base. Requiere los secrets `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_ENDPOINT`.

## Contribuir

Las contribuciones son bienvenidas. Antes de abrir un pull request, leé [CONTRIBUTING.md](CONTRIBUTING.md).

## Seguridad

Para reportar una vulnerabilidad, seguí las indicaciones de [SECURITY.md](SECURITY.md). No abras un issue público.

## Licencia

[MIT](LICENSE)
