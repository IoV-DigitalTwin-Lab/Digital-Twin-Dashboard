import type { QueryResult, QueryResultRow } from 'pg';
import { getPool } from './pool';

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export { getPool } from './pool';
