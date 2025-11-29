/**
 * Quick script to check if environment variables are loaded
 * Run: node scripts/check-env.js
 */

console.log('=== Environment Variables Check ===\n');

const requiredVars = [
  'GEOMI_API_KEY',
  'APTOS_NETWORK',
  'DATABASE_URL',
];

const optionalVars = [
  'GEOMI_NODE_URL',
  'GEOMI_FAUCET_URL',
  'APTOS_API_KEY', // Fallback for GEOMI_API_KEY
];

console.log('Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // Mask sensitive values
    const displayValue = varName.includes('KEY') || varName.includes('URL')
      ? `${value.slice(0, 8)}...` 
      : value;
    console.log(`  ✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`  ❌ ${varName}: NOT SET`);
  }
});

console.log('\nOptional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    const displayValue = varName.includes('KEY') || varName.includes('URL')
      ? `${value.slice(0, 8)}...` 
      : value;
    console.log(`  ✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`  ⚪ ${varName}: not set (optional)`);
  }
});

console.log('\n=== Tips ===');
console.log('1. Make sure your .env or .env.local file is in the project root');
console.log('2. Restart your Next.js dev server after adding env vars');
console.log('3. In Next.js, use .env.local for local development (gitignored)');
console.log('4. Variables without NEXT_PUBLIC_ prefix are server-side only\n');

