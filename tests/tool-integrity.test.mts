import test from 'node:test';
import assert from 'node:assert/strict';
import { routeTools, runTools } from '../lib/ai/tools.ts';
import { boundedJson } from '../lib/ai/safe-web.ts';

test('multi-word negative tool instructions suppress implicit unit/currency calls', () => {
  for(const text of ['Jangan gunakan alat apa pun; 10 km ke m', 'Tidak perlu menjalankan tool untuk konversi 10 km ke m', 'Do not use any tools; 10 USD to IDR', 'Jangan hitung statistik: 1, 2, 3']) assert.deepEqual(routeTools(text), []);
  assert.equal(routeTools('10 km ke m')[0].name, 'unit');
});

test('malformed external responses never become successful source evidence', async () => {
  const original = globalThis.fetch;
  const originalKey = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = 'test-fixture-not-a-key';
  try {
    globalThis.fetch = async () => Response.json({});
    for(const prompt of ['cari sumber terbaru tentang elektronika', '10 USD ke IDR', 'cuaca di Pekanbaru']) {
      const result = await runTools(prompt);
      assert.equal(result.evidence[0].status, 'error');
      assert.match(JSON.stringify(result.evidence[0].data), /Jangan mengarang/);
    }
    globalThis.fetch = async () => Response.json({results:[{name:'Pekanbaru',country:'ID',latitude:0.5,longitude:101.4}]});
    assert.equal((await runTools('cuaca di Pekanbaru')).evidence[0].status, 'error', 'missing current weather is not a success');
  } finally {
    globalThis.fetch = original;
    if(originalKey === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = originalKey;
  }
});

test('non-success external HTTP bodies are cancelled to release resources', async () => {
  const original = globalThis.fetch;
  let cancelled = false;
  try {
    globalThis.fetch = async () => new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:503});
    await assert.rejects(()=>boundedJson('https://example.com'), /unavailable/);
    assert.equal(cancelled, true);
  } finally { globalThis.fetch = original; }
});
