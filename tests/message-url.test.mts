import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMessageUrl } from '../lib/ai/safe-message-url.ts';
test('untrusted Markdown rejects script schemes, active data documents, credentials and obfuscation',()=>{
  for(const value of ['javascript:alert(1)',' JAVASCRIPT:alert(1)','java\tscript:alert(1)','vbscript:msgbox(1)','data:text/html;base64,PHNjcmlwdD4=','data:image/svg+xml;base64,PHN2Zz4=','file:///etc/passwd','https://user:pass@example.com/']) {
    assert.equal(safeMessageUrl(value), ''); assert.equal(safeMessageUrl(value,'media'), '');
  }
});
test('safe web, relative, mail links and supported raster/video previews are retained',()=>{
  for(const value of ['https://example.com/paper','http://example.com','/news','#section','data:image/png;base64,AA==','data:video/mp4;base64,AA=='])assert.equal(safeMessageUrl(value),value);
  assert.equal(safeMessageUrl('mailto:hello@example.com'),'mailto:hello@example.com');
  assert.equal(safeMessageUrl('mailto:hello@example.com','media'),'');
});
