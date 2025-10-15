import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { loadEnv } from '../config/env';
import { getPool } from '../db';

async function runMigrations(): Promise<void> {
  loadEnv();

  const pool = getPool();
  const sqlDir = path.resolve(__dirname, '..', '..', 'sql');
  const files = (await readdir(sqlDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  console.log(`Applying ${files.length} migration(s)...`);

  for (const file of files) {
    const fullPath = path.join(sqlDir, file);
    const sql = await readFile(fullPath, 'utf-8');
    console.log(`\n>>> ${file}`);
    await pool.query(sql);
  }

  await pool.end();
  console.log('\nMigrations completed.');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
