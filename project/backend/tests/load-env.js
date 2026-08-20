import dotenv from 'dotenv';

// El entorno de test se define EXCLUSIVAMENTE por `.env.test` (autocontenido).
// override:true asegura que gane sobre cualquier variable ya presente en el
// proceso. Ver `.env.test.example` para la lista completa de variables.
dotenv.config({ path: '.env.test', override: true });

// ----------------------------------------------------------------------------
// Guard fail-fast: abortar la suite si detecta que se filtró un entorno de
// producción/desarrollo en vez del de test. Es defensa en profundidad contra la
// clase de bug que hacía que los tests pegaran a APIs reales (Vision) o, peor,
// tocaran la base de datos de producción. Preferimos romper ruidosamente a
// consumir cuota o borrar datos reales en silencio.
// ----------------------------------------------------------------------------
const problems = [];

// 1) NODE_ENV debe ser 'test' (los cortocircuitos de Cloudinary/Resend/Vision
//    dependen de esto).
if (process.env.NODE_ENV !== 'test') {
  problems.push(`NODE_ENV="${process.env.NODE_ENV}" (se esperaba "test").`);
}

// 2) La base de datos debe ser LOCAL y de test. DB_NAME con "test" (mismo
//    criterio que setup.js) y DB_HOST sin marcadores de host remoto/gestionado.
if (!process.env.DB_NAME?.includes('test')) {
  problems.push(`DB_NAME="${process.env.DB_NAME}" no parece una BD de test (debe incluir "test").`);
}
const REMOTE_DB_HOST = /supabase|pooler|amazonaws|rds\.|\.azure|\.gcp|render\.com|neon\.tech/i;
if (REMOTE_DB_HOST.test(process.env.DB_HOST || '')) {
  problems.push(`DB_HOST="${process.env.DB_HOST}" apunta a un host remoto/gestionado; en test debe ser local.`);
}

// 3) Ninguna credencial de servicio externo de pago puede tener pinta de real.
//    En un `.env.test` correcto estas están vacías o en dummy. Un valor real
//    acá significa que `.env` se filtró (o que alguien puso una key de verdad).
if (process.env.GOOGLE_VISION_API_KEY) {
  problems.push('GOOGLE_VISION_API_KEY tiene valor: en test debe estar VACÍA (Vision cobra por llamada).');
}
// Cloudinary de producción usa un cloud_name propio; el de test es "test"/dummy.
const cloud = process.env.CLOUDINARY_CLOUD_NAME || '';
if (cloud && !/^(test|dummy|)/i.test(cloud)) {
  problems.push(`CLOUDINARY_CLOUD_NAME="${cloud}" no parece de test (se espera "test"/dummy).`);
}

if (problems.length > 0) {
  throw new Error(
    'ABORTADO: el entorno de test parece contaminado con credenciales de ' +
    'producción/desarrollo. Revisá tu `.env.test` (plantilla en ' +
    '`.env.test.example`).\n  - ' + problems.join('\n  - ')
  );
}
