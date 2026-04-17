cd UdelarHITS/project/backend // conectarse a backend
# conectarse a la base de datos udelarhits # 
psql -h localhost -p 5432 -U brunoloo -d udelarhits  

# Consultas psql #
SELECT * FROM usuario; // ahora como tengo url img esto queda muy grande
SELECT id, rol, nickname, nombre, email, LEFT(password_hash, 10), LEFT(biografia, 10), LEFT(url_imagen, 10), estado FROM usuario ORDER BY id ASC; // empezar a pedir así

# Agregar usuario #
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "nicoAlberro",
    "nombre": "nico",
    "email": "nico@gmail.com",
    "password": "12345678"
  }'

# Agregar administrador siendo admin, de no serlo esto debería fallar #
curl -i -b cookies.txt -X POST http://localhost:5001/api/auth/admin/register \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "admin",
    "nombre": "Admin Dos",
    "email": "admin@gmail.com",
    "password": "Admin123!",
    "rol": "admin"
  }'

# Login siendo administrador #
curl -i -c cookies-admin.txt -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gmail.com",
    "password": "Admin123!"
  }'

# Login (nickname) información reducida #
curl -s -c cookies-user.txt -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nickname":"brunoloo","password":"12345678"}'

# Ver cookie guardada #
cat cookies-admin.txt o cat cookies-user.txt

# Probar endpoint protegido usando la cookie guardada #
curl -s -b cookies-user.txt http://localhost:5001/api/users/me // si no estoy logeado no debería mostrar información

# Logout enviando cookie guardada #
curl -i -b cookies-admin.txt -c cookies.txt -X POST http://localhost:5001/api/auth/logout // si sos admin
curl -i -b cookies-user.txt -c cookies.txt -X POST http://localhost:5001/api/auth/logout // si sos user

# Obtener usuarios #
curl -i -X GET http://localhost:5001/api/users/ \
  -H "Content-Type: application/json" \
  --cookie "jwt=TOKEN_DE_ADMINISTRADOR"

# Obtener usuario #
curl -i -X GET http://localhost:5001/api/users/admin \
  -H "Content-Type: application/json" \
  --cookie "jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIiLCJpYXQiOjE3NzU5NzY2NDQsImV4cCI6MTc3NjU4MTQ0NH0.j28WEhxO35Xn4KuQW59Okoz-53puKt9C1oCrOHfH1Dk"  

# Modificar usuario #
curl -X PATCH "http://localhost:5001/api/users/me" \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJpYXQiOjE3NzU3OTY4NzEsImV4cCI6MTc3NjQwMTY3MX0.XRTerGK4rgGr-Fy8iUC8V1KvXMh_peCuZjg5oti11ps" \
  -d '{"nombre":"BrunoDP","biografia":"hola mundoo!","url_imagen":"https://static.wikitide.net/deathbattlewiki/2/28/Portrait.monkeydluffy.png"}'

# Obtener avatar #
curl -I http://localhost:5001/api/users/1/avatar

# Suspender usuario #
curl -X PATCH "http://localhost:5001/api/users/brunoloo/ban" -H "Cookie: jwt=TOKEN_DE_ADMINISTRADOR"

# Activar usuario #
curl -X PATCH "http://localhost:5001/api/users/brunoloo/active" -H "Cookie: jwt=TOKEN_DE_ADMINISTRADOR"

# Eliminar usuario #
curl -X DELETE "http://localhost:5001/api/users/brunoloo/delete" -H "Cookie: jwt=TOKEN_DE_ADMINISTRADOR"