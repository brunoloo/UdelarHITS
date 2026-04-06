# Agregar usuario #
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "bruno123",
    "nombre": "Bruno",
    "email": "bruno123@gmail.com",
    "password": "MiPass123!"
  }'

# Login (por email)#
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bruno123@gmail.com","password":"MiPass123!"}'

# Login (por nickname)#
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nickname":"bruno123","password":"MiPass123!"}'