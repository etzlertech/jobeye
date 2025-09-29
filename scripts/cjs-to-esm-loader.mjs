import { readFile } from 'fs/promises';

export async function load(url, context, defaultLoad) {
  if (url.endsWith('/scripts/patch-scripts.mjs') || url.endsWith('\scripts\patch-scripts.mjs')) {
    const source = await readFile(new URL(url));
    const text = source.toString().replace("const fs = require('fs');", "import fs from 'fs';");
    return {
      format: 'module',
      source: text,
      shortCircuit: true,
    };
  }
  return defaultLoad(url, context, defaultLoad);
}
