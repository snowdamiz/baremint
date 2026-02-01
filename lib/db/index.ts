import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

export const db: NeonHttpDatabase<typeof schema> = new Proxy(
  {} as NeonHttpDatabase<typeof schema>,
  {
    get(_target, prop) {
      if (!_db) {
        const sql = neon(process.env.DATABASE_URL!);
        _db = drizzle({ client: sql, schema });
      }
      return Reflect.get(_db, prop);
    },
  }
);
