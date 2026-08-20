// Carga centralizada de variables de entorno. ÚNICO punto donde la app invoca
// dotenv: server.js y db.js importan este módulo en vez de llamar
// dotenv.config() por su cuenta.
//
// Por qué existe: antes cada módulo hacía su propio dotenv.config() sin `path`,
// o sea que cargaba `.env` (el de desarrollo/producción). En los tests eso era
// una filtración: load-env.js fijaba `.env.test`, pero al importar db.js su
// dotenv.config() rellenaba TODA variable ausente de `.env.test` con el valor
// real de `.env` — incluida GOOGLE_VISION_API_KEY, que hacía que la suite
// pegara a la API de Google de verdad. Mismo mecanismo del incidente de
// Cloudinary. Ver tests/load-env.js y .env.test.example.
//
// Regla dura: en test NUNCA se toca `.env`. El entorno de test se define
// exclusivamente por `.env.test` (que tests/load-env.js ya cargó con override
// antes de importar cualquier módulo). Este módulo lo recarga de forma
// idempotente para el caso de que se importe fuera del setup de Jest, pero
// jamás cae de vuelta a `.env`.
import dotenv from 'dotenv';

// Jest fija NODE_ENV='test' por defecto; load-env.js además lo reafirma desde
// `.env.test`. Cualquiera de los dos alcanza para que esta rama sea confiable.
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test', override: true });
} else {
  dotenv.config();
}
