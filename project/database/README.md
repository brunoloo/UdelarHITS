# Base de datos

- `schema.sql` es el esquema completo. Con él se crea una base nueva (`npm run db:reset` en `project/backend`) y la base de test.
- `migrations/` contiene los cambios incrementales para bases ya creadas. Cada archivo es idempotente y se aplica a mano, en orden:

```bash
cd project/backend
npm run db:migrate -- ../database/migrations/<archivo>.sql
```

Todo cambio de esquema se hace en los dos lugares: se actualiza `schema.sql` y se agrega una migración nueva con el número siguiente al último existente.

El esquema requiere la extensión `unaccent`. Los estados de contenido (`estado_cat`, `estado_tem`, `estado_com`) y `motivo_inactivacion` son enums: la lógica de moderación y los tests dependen de sus valores.
