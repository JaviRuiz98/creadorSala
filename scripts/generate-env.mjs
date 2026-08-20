import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function readDotEnv() {
  if (!existsSync('.env')) return {};
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
      })
  );
}

const dotEnv = readDotEnv();
const url = process.env.SUPABASE_URL || dotEnv.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || dotEnv.SUPABASE_ANON_KEY || '';

const makeEnvironment = production => `export const environment = {
  production: ${production},
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)},
};
`;

if (url && key) {
  writeFileSync('src/environments/environment.ts', makeEnvironment(false));
  writeFileSync('src/environments/environment.prod.ts', makeEnvironment(true));
  console.log('Supabase environment generated.');
} else {
  console.warn('Supabase environment not configured. Create .env from .env.example.');
}
