import test from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken, isAdminToken, SESSION_TTL_MS } from '../lib/auth.ts';
import { verifyFrontierAccessToken, validateAetFrontierAnswers } from '../lib/aet-frontier-access.ts';
import { sameOrigin, readJson, ApiError } from '../lib/http.ts';
import { limit } from '../lib/rate-limit.ts';
import { isPublicAddress, validateWebUrl } from '../lib/ai/safe-web.ts';
const secret='test-only-strong-signing-secret-value-32';
test('forged cookie and purpose substitution cannot authorize admin',()=>{
 process.env.ADMIN_SESSION_SECRET=secret;
 assert.equal(isAdminToken('true'),false);
 assert.equal(isAdminToken(signToken('frontier',secret)),false);
 assert.equal(isAdminToken(signToken('admin',secret)),true);
});
test('signature tampering, future tokens, extra segments and expiry rejected',()=>{
 const now=1000000;const token=signToken('admin',secret,now);
 assert.equal(verifyToken(token+'x','admin',secret,now),false);
 assert.equal(verifyToken(token+'.extra','admin',secret,now),false);
 assert.equal(verifyToken(token,'admin',secret,now-1),false);
 assert.equal(verifyToken(token,'admin',secret,now+SESSION_TTL_MS),false);
 assert.equal(verifyToken(token,'admin',secret,now+10),true);
});
test('Frontier has no public fallback secret or permissive answer matching',()=>{
 delete process.env.AET_FRONTIER_ACCESS_SECRET;
 assert.equal(verifyFrontierAccessToken('anything'),false);
 assert.equal(validateAetFrontierAnswers({aetFounded:'11 april 2008',aetAttributeDay:'selasa',aetFullName:'association electronics telecommunication'}),false);
 assert.equal(validateAetFrontierAnswers({aetFounded:{x:1}}),false);
});
test('cross-site origin and fetch-site denied',()=>{
 assert.throws(()=>sameOrigin(new Request('https://aet.test/api/news',{headers:{origin:'https://evil.test'}})),ApiError);
 assert.throws(()=>sameOrigin(new Request('https://aet.test/api/news',{headers:{'sec-fetch-site':'cross-site'}})),ApiError);
 assert.doesNotThrow(()=>sameOrigin(new Request('https://aet.test/api/news',{headers:{origin:'https://aet.test'}})));
});
test('JSON rejects wrong content type, malformed body, primitives, oversized chunked bodies',async()=>{
 await assert.rejects(()=>readJson(new Request('http://localhost',{method:'POST',body:'{}'})),e=>(e as ApiError).status===415);
 for(const body of ['{','null','[]','"hello"'])await assert.rejects(()=>readJson(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body})),ApiError);
 await assert.rejects(()=>readJson(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'x'.repeat(100)})}),20),e=>(e as ApiError).status===413);
});
test('rate limit blocks excess then resets at window boundary',()=>{
 const key=crypto.randomUUID();limit(key,2,100,1000);limit(key,2,100,1001);
 assert.throws(()=>limit(key,2,100,1002),e=>(e as ApiError).status===429);
 assert.doesNotThrow(()=>limit(key,2,100,1100));
});
for(const ip of ['127.0.0.1','10.2.3.4','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::'])test(`SSRF blocks ${ip}`,()=>assert.equal(isPublicAddress(ip),false));
test('public IP and safe HTTPS URL accepted, credentials and unsafe schemes rejected',()=>{
 assert.equal(isPublicAddress('8.8.8.8'),true);assert.equal(isPublicAddress('2606:4700:4700::1111'),true);
 for(const url of ['http://example.com','https://localhost','https://x.local','https://169.254.169.254','https://user:pass@example.com','https://example.com:8080','https://2130706433'])assert.throws(()=>validateWebUrl(url));
 assert.equal(validateWebUrl('https://example.com/article').pathname,'/article');
});

test('explicit origin supports a trusted reverse-proxy host while rejecting other origins',()=>{
 const saved=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://public.aet.test';
 try{assert.doesNotThrow(()=>sameOrigin(new Request('http://localhost:3000/api/chat',{headers:{origin:'https://public.aet.test'}})));assert.throws(()=>sameOrigin(new Request('http://localhost:3000/api/chat',{headers:{origin:'https://evil.test'}})));}
 finally{if(saved===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=saved;}
});
