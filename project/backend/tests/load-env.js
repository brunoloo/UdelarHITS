import dotenv from 'dotenv';

// El entorno de test se define solo por `.env.test`; override hace que gane sobre lo ya presente.
dotenv.config({ path: '.env.test', override: true, quiet: true });

// Aborta la suite si detecta un entorno que no es de test: evita llamar a servicios reales
// o tocar otra base.
const problems = [];

// Los cortocircuitos de los servicios externos dependen de NODE_ENV.
if (process.env.NODE_ENV !== 'test') {
  problems.push(`NODE_ENV="${process.env.NODE_ENV}" (se esperaba "test").`);
}

// La base debe ser local y tener "test" en el nombre.
if (!process.env.DB_NAME?.includes('test')) {
  problems.push(`DB_NAME="${process.env.DB_NAME}" no parece una BD de test (debe incluir "test").`);
}
const REMOTE_DB_HOST = /supabase|pooler|amazonaws|rds\.|\.azure|\.gcp|render\.com|neon\.tech/i;
if (REMOTE_DB_HOST.test(process.env.DB_HOST || '')) {
  problems.push(`DB_HOST="${process.env.DB_HOST}" apunta a un host remoto/gestionado; en test debe ser local.`);
}

// Ninguna credencial de un servicio externo puede parecer real.
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
