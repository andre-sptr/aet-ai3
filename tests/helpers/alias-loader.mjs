import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Production Next.js resolves @/ through tsconfig. Node-only route integration
// tests use exactly the same source files, without replacing their dependencies.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = new URL('../../' + specifier.slice(2), import.meta.url);
    const candidates = [new URL(base.href + '.ts'), new URL(base.href + '/index.ts')];
    const file = candidates.find(url => existsSync(fileURLToPath(url)));
    if (file) return nextResolve(file.href, context);
  }
  return nextResolve(specifier, context);
}
