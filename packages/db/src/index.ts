import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export * from "./schema";
export * from "./municipalities";
export * from "./covered-cities";

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

let cached: Db | undefined;

/** Lazily creates a singleton client from DATABASE_URL on first use. */
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    cached = createDb(url);
  }
  return cached;
}
