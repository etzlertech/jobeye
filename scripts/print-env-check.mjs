const fs = require('fs');
const src = '.env.local';
if (!fs.existsSync(src)) { console.error('Missing .env.local'); process.exit(1); }
const line = fs.readFileSync(src, 'utf8').split(/\r?\n/).find(l=>l.startsWith('SUPABASE_DB_URL='));
if (!line) { console.error('SUPABASE_DB_URL not found'); process.exit(1); }
let v = line.slice('SUPABASE_DB_URL='.length);
if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
const redacted = v.replace(/:\/\/([^:]+):([^@]+)@/, (_,4u,4p)=>);
console.log('DB URL:', redacted);
console.log('Has pgbouncer=true?', /[?&]pgbouncer=true\b/i.test(v));
console.log('sslmode=', (v.match(/sslmode=([^&]+)/i)||[])[1] || '(none)');
