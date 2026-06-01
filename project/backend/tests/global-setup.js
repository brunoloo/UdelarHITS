import { execSync } from 'child_process';

export default async function () {
  execSync('npm run db:test:reset', { stdio: 'inherit' });
}