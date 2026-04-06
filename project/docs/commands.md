# conectarse a la base de datos udelarhits # 
psql -h localhost -p 5432 -U brunoloo -d udelarhits  

# ejecutar servidor con reinicio automático (estar parado en backend) # 
npm run dev 

# dropea, crea db y ejecuta schema.sql  (estar parado en backend) #
npm run db:reset 

🧠 Cómo pensarlo fácil
.get → leer datos
.post → crear datos
.put → actualizar
.delete → borrar
.use → conectar routers