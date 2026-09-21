import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export * from "./schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
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
