import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ts = require(process.env.AET_TYPESCRIPT_MODULE || 'typescript');
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(?:ts|tsx|mts|mjs)$/.test(file) && !file.endsWith('.d.ts')) files.push(file);
  }
}
await walk('.');
let failed = 0;
for (const file of files) {
  if (file.endsWith('.mjs')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) { failed++; console.error(result.stderr); }
  } else {
    const result = ts.transpileModule(await readFile(file, 'utf8'), { fileName: file, reportDiagnostics: true, compilerOptions: { target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext, jsx:ts.JsxEmit.ReactJSX, isolatedModules:true } });
    const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) { failed++; console.error(ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName:f=>f, getCurrentDirectory:()=>process.cwd(), getNewLine:()=> '\n' })); }
  }
}
console.log(JSON.stringify({check:'Syntax/transpilation only, not semantic TypeScript or a Next.js build.',typescript:ts.version,files:files.length,failed}));
if(failed)process.exitCode=1;
