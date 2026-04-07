cd UdelarHITS/project/backend // conectarse a backend

# Agregar usuario #
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "bruno123",
    "nombre": "Bruno",
    "email": "bruno@gmail.com",
    "password": "MiPass123!"
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

# Login (por email) información reducida #
curl -s -c cookies-user.txt -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bruno@gmail.com","password":"MiPass123!"}'

# Ver cookie guardada #
cat cookies-admin.txt o cat cookies-user.txt

# Probar endpoint protegido usando la cookie guardada #
curl -s -b cookies-user.txt http://localhost:5001/api/users/me // si no estoy logeado no debería mostrar información


# Logout enviando cookie guardada #
curl -i -b cookies-admin.txt -c cookies.txt -X POST http://localhost:5001/api/auth/logout // si sos admin
curl -i -b cookies-user.txt -c cookies.txt -X POST http://localhost:5001/api/auth/logout // si sos user