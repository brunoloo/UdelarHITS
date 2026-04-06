# conectarse a la base de datos udelarhits # 
psql -h localhost -p 5432 -U brunoloo -d udelarhits  

# ejecutar servidor con reinicio automático (estar parado en backend) # 
npm run dev 

# dropea, crea db y ejecuta schema.sql  (estar parado en backend) #
npm run db:reset 

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

# Información general # 
.get → leer datos
.post → crear datos
.put → actualizar
.delete → borrar
.use → conectar routers