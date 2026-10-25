import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { buildSystemPrompt } from './personas/prompt-builder.ts';

/** Dirty working trees and platform line endings are handled explicitly.
 * Hashes bind operator-controlled evidence to code; they do not authenticate a provider. */
export async function calibrationSource() {
  const files = ['lib/sumopod.ts','lib/ai-models.ts','lib/http.ts','lib/rate-limit.ts','lib/aet-frontier-access.ts','types/index.ts','scripts/evaluate-ai.mjs'];
  async function walk(dir: string) {
    for (const entry of await readdir(dir,{withFileTypes:true})) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (file.endsWith('.ts')) files.push(file);
    }
  }
  await walk('lib/ai');
  const digest = createHash('sha256');
  for (const file of files.sort()) digest.update(file+'\0'+(await readFile(file,'utf8')).replaceAll('\r\n','\n')+'\0');
  const productionPromptSha256 = createHash('sha256').update((['daily','report','coding'] as const)
    .map(mode=>buildSystemPrompt(mode,'',[],new Date('2026-01-01T00:00:00Z'))).join('\n')).digest('hex');
  return {pipelineSha256:digest.digest('hex'),productionPromptSha256,promptFingerprintClock:'2026-01-01T00:00:00Z'};
}
