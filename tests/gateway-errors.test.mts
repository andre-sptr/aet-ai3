import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayErrorKind, boundedResponseText, readGatewayError, redactGatewayText } from '../lib/ai/gateway-errors.ts';

test('gateway diagnostics classify observations without claiming an exact root cause',async()=>{
  for(const [status,kind] of [[401,'authentication'],[402,'billing'],[403,'permission'],[404,'model_or_endpoint'],[400,'request'],[429,'rate_limit'],[503,'provider']] as const){
    assert.equal(gatewayErrorKind(status),kind);
    const error=await readGatewayError(Response.json({error:{code:'example_error',message:'Bearer confidential-token'}},{status}));
    assert.equal(error.kind,kind);assert.equal(error.providerCode,'example_error');assert.equal(error.causeVerified,false);
    assert.doesNotMatch(JSON.stringify(error),/confidential-token/);
  }
});
test('provider error capture is bounded, cancelled and redacted',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(9000)));},cancel(){cancelled=true;}}));
  assert.equal((await boundedResponseText(response,256)).length,256);assert.equal(cancelled,true);
  assert.doesNotMatch(redactGatewayText('key=known-private; Authorization: Bearer other-private','known-private'),/known-private|other-private/);
  const safe=redactGatewayText(JSON.stringify({sentAuthorization:true,output:'Bearer hidden-private'}));
  assert.equal(JSON.parse(safe).sentAuthorization,true);assert.doesNotMatch(safe,/hidden-private/);
});
