const fs = require('fs');
const src = '.env.local';
const dst = '.env._noverify.local';
if (!fs.existsSync(src)) { console.error('Missing .env.local'); process.exit(1); }
const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const out = lines.map(l=>{
  if (!l.startsWith('SUPABASE_DB_URL=')) return l;
  let v = l.slice('SUPABASE_DB_URL='.length);
  // strip quotes if any
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
  // ensure pgbouncer param
  if (!/[?&]pgbouncer=true\b/i.test(v)) v += (v.includes('?')?'&':'?') + 'pgbouncer=true';
  // force sslmode=no-verify
  if (/[?&]sslmode=[^&]+/i.test(v)) v = v.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
  else v += '&sslmode=no-verify';
  return 'SUPABASE_DB_URL=' + v;
}).join('\n');
fs.writeFileSync(dst, out);
console.log(dst);
