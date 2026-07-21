import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Runtime queries use the pooled connection.
const sql = neon(process.env.NEON_POOLED_URL!);

export const db = drizzle(sql, { schema });
