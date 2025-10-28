#!/usr/bin/env node

/**
 * Check environment variables at build time
 */

console.log('\n🔍 Build-time Environment Check\n');
console.log('================================\n');

const geminiKey = process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY;

console.log('NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY:');
console.log('  Defined:', typeof geminiKey !== 'undefined');
console.log('  Type:', typeof geminiKey);
console.log('  Length:', geminiKey?.length || 0);
console.log('  First 20 chars:', geminiKey ? geminiKey.substring(0, 20) + '...' : 'N/A');
console.log('  Last 10 chars:', geminiKey ? '...' + geminiKey.substring(geminiKey.length - 10) : 'N/A');

console.log('\nAll NEXT_PUBLIC_* variables:');
Object.keys(process.env)
  .filter(key => key.startsWith('NEXT_PUBLIC_'))
  .forEach(key => {
    const value = process.env[key];
    const displayValue = key.includes('KEY') || key.includes('SECRET')
      ? `***${value?.substring(value.length - 10) || 'N/A'}`
      : value;
    console.log(`  ${key}: ${displayValue}`);
  });

console.log('\n================================\n');

if (!geminiKey) {
  console.error('❌ ERROR: NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY not available at build time!');
  console.error('   This means Railway is not passing the variable to the build environment.');
  console.error('   The app will build, but Gemini features will not work.\n');
} else {
  console.log('✅ SUCCESS: NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY is available at build time!\n');
}
