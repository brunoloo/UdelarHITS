// Único punto que carga dotenv. En test solo se lee `.env.test`, nunca `.env`.
import dotenv from 'dotenv';

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test', override: true, quiet: true });
} else {
  dotenv.config({ quiet: true });
}
