import { Pool } from 'pg';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      max: process.env.PGPOOL_MAX ? Number(process.env.PGPOOL_MAX) : 10,
      idleTimeoutMillis: 30_000,
      application_name: 'dt-realtime-server',
    });
  }

  return pool;
}
