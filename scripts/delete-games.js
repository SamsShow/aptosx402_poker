/**
 * Script to delete all games from the database
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { neon } = require('@neondatabase/serverless');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function deleteAllGames() {
  try {
    console.log('Deleting all games and related data from database...');
    
    // Delete in order to respect foreign key constraints
    // Thoughts reference actions, so delete thoughts first
    console.log('  - Deleting thoughts...');
    await sql`DELETE FROM thoughts`;
    
    // Then delete actions (which reference hands)
    console.log('  - Deleting actions...');
    await sql`DELETE FROM actions`;
    
    // Transactions don't have foreign keys to other tables we're deleting
    console.log('  - Deleting transactions...');
    await sql`DELETE FROM transactions`;
    
    // Hands reference games
    console.log('  - Deleting hands...');
    await sql`DELETE FROM hands`;
    
    // Finally delete games
    console.log('  - Deleting games...');
    await sql`DELETE FROM games`;
    
    console.log('✓ All games and related data deleted successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error deleting games:', error);
    process.exit(1);
  }
}

deleteAllGames();

