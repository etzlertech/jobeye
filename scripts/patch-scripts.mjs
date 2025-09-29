const fs = require('fs');
const path = 'package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.scripts = pkg.scripts || {};
const ensure = (k,v)=>{ if (pkg.scripts[k] !== v) pkg.scripts[k]=v; };
ensure('003:seed',      'dotenv -e .env.local -- node scripts/seed-003.mjs');
ensure('003:preflight', 'dotenv -e .env.local -- tsx scripts/preflight-003.ts');
ensure('003:rls',       'dotenv -e .env.local -- tsx scripts/ci/rls-lint.ts');
// runner includes API + repo/service tests; adjust if paths differ
ensure('003:full',      'dotenv -e .env.local -- sh -c "npm run 003:seed && npm run 003:preflight && jest --runTestsByPath tests/integration/scheduling-kits/kitRepo.int.test.ts tests/integration/scheduling-kits/kitService.int.test.ts tests/api/scheduling-kits.api.test.ts"');
fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
console.log('Patched package.json scripts.');
