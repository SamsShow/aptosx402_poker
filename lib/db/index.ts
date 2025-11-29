/**
 * Database Connection - Neon PostgreSQL
 * 
 * Uses Neon serverless driver for database operations
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("[DB] DATABASE_URL environment variable is required");
}

// Create Neon client
const sql = neon(databaseUrl);

// Export drizzle instance
export const db = drizzle(sql, { schema });

console.log("[DB] Database connection initialized");

// Export schema
export * from "./schema";

// Export raw SQL client for complex queries
export { sql };
