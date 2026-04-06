# Comandos UBUNTU #
# conectarse a la base de datos udelarhits # 
psql -h localhost -p 5432 -U brunoloo -d udelarhits  

# ejecutar servidor con reinicio automático (estar parado en backend) # 
npm run dev 

# dropea, crea db y ejecuta schema.sql  (estar parado en backend) #
npm run db:reset 

-------------------------------------------------------------------

# Comandos de github #
# 1) cambiar a main
git checkout main

# 2) traer últimos cambios de main remoto
git pull origin main

# 3) borrar branch local
git branch -d nombre-de-tu-branch
# si no te deja porque no está mergeada:
# git branch -D nombre-de-tu-branch

# 4) borrar branch remota (opcional)
git push origin --delete nombre-de-tu-branch

-------------------------------------------------------------------

# Información general # 
.get → leer datos
.post → crear datos
.put → actualizar
.delete → borrar
.use → conectar routers

Siguiente checklist para mantener ese orden (sin tocar archivos ahora):

Route
Solo define endpoint y delega al controller.

Controller
Recibe req/res, valida input básico, llama a capa de lógica.

Service 
Lógica de negocio (hash password, reglas, etc.).

Repository/DB
Queries a Postgres (pg) separadas de la lógica HTTP.

Errores
Respuestas consistentes (400, 409, 500) y mensajes claros.

Validación
Email válido, password mínima, campos obligatorios.

Seguridad
Nunca guardar password plano (usar bcrypt).

Estructura endpoint
Más estándar: POST /api/auth/...

# Flujo #
• Controller
Recibe HTTP (req/res), delega, obtiene información y decide status (400, 409, 201, 500). 

• Service
valida datos (nulos/formato/reglas),
chequea si existe usuario (vía repository),
hashea password,
decide crear usuario.

• Repository
Ejecuta SQL contra la DB (buscar/insertar).

• DB
Guarda usuario con password_hash (nunca password plana).

