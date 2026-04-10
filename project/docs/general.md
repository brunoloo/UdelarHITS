# Comandos UBUNTU #

# ejecutar servidor con reinicio automático (estar parado en backend) # 
npm run dev 

# dropea, crea db y ejecuta schema.sql  (estar parado en backend) #
npm run db:reset 

# Cargar usuario admin en la db
npm run seed:admin

-------------------------------------------------------------------

# Entrar desde la red local #
Ejecutar como administrador en powerShell
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=5001
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=5001 connectaddress=172.25.10.143 connectport=5001

apagar cuando se termine
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=5001
netsh advfirewall firewall delete rule name="WSL 5001"
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


Método	    Qué hace	            Ejemplo

GET	        Obtener datos	        ver usuarios
POST	    Crear datos	            registrar usuario
PUT	        Reemplazar datos	    actualizar usuario completo
PATCH	    Modificar parcialmente	cambiar solo el nombre
DELETE	    Eliminar datos	        borrar usuario

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

# Importante #
En funciones que manipulen la cookie como login o logout debo siempre verificar secure: process.env.NODE_ENV === "production", ya que eso va a proteger la cookie. 
