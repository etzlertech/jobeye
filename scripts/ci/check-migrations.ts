import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function listSqlFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => name.startsWith('040_'))
    .map((name) => join(dir, name));
}

function hasBom(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function validateDoBlocks(sql: string, file: string, failures: string[]) {
  const doMatches = [...sql.matchAll(/DO\s+\$\$/gi)];
  for (const match of doMatches) {
    const startIndex = match.index ?? 0;
    const rest = sql.slice(startIndex + match[0].length);
    const endMatch = rest.match(/END;\s*\$\$;/i);
    if (!endMatch) {
      failures.push(`${file}: DO $$ block starting near index ${startIndex} is missing matching END; $$;`);
      continue;
    }

    const nextDoIndex = rest.search(/DO\s+\$\$/i);
    const endIndex = endMatch.index ?? -1;
    if (nextDoIndex !== -1 && nextDoIndex < endIndex) {
      failures.push(`${file}: DO $$ block starting near index ${startIndex} contains another DO $$ before END; $$;`);
    }
  }
}

function main() {
  const files = listSqlFiles(MIGRATIONS_DIR);
  const failures: string[] = [];

  for (const file of files) {
    const buffer = readFileSync(file);
    if (hasBom(buffer)) {
      failures.push(`${file}: file contains UTF-8 BOM`);
    }

    const text = buffer.toString('utf8');
    validateDoBlocks(text, file, failures);
  }

  if (failures.length > 0) {
    console.error('Migration lint failures:');
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }

  console.log('Migration lint passed.');
}

main();
