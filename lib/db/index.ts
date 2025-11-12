import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Allow build to succeed without DATABASE_URL
// Runtime checks will happen in API routes
const connectionString = process.env.DATABASE_URL || "postgresql://placeholder";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
