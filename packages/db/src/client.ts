import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres() creates a connection pool to your Neon database.
// A pool keeps a few connections open and reuses them instead of
// opening a new one for every query (which is slow).
//
// DATABASE_URL comes from your .env file. It looks like:
// postgresql://user:password@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { ssl: "require" });

// drizzle() wraps the raw connection with Drizzle's query builder.
// Passing the schema lets Drizzle know about your tables so you
// get autocomplete and type checking on queries.
export const db = drizzle(client, { schema });

// Export the type so other packages can accept the db as a parameter
// without importing the actual connection.
export type Database = typeof db;
