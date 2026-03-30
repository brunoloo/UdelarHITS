#!/usr/bin/env bash
set -e

# Crear estructura
mkdir -p project/frontend/{css,js,assets}
mkdir -p project/backend/src/{routes,controllers,services,models,middlewares,config,utils}
mkdir -p project/backend/tests/{unit,integration}
mkdir -p project/database/migrations
mkdir -p project/docs

# Crear archivos base (no sobreescribe contenido existente)
touch project/frontend/index.html
touch project/backend/src/app.js
touch project/backend/src/server.js
touch project/backend/package.json
touch project/backend/.env.example
touch project/database/schema.sql
touch project/database/seed.sql
touch project/docs/architecture.md
touch project/docs/api.md

echo "✅ Estructura creada/actualizada sin sobrescribir README ni .gitignore"