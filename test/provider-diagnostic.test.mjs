import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoke,providerFailureCode} from '../dist/provider.js';

for(const mode of ['transport','json','stream','aborted','shape'])test(`provider diagnostics redact ${mode} and never retry`,async t=>{
  const key='LABYRINTH_DIAGNOSTIC_FIXTURE';process.env[key]='synthetic-only';t.after(()=>delete process.env[key]);
  let calls=0;const controller=new AbortController();
  t.mock.method(globalThis,'fetch',async()=>{calls++;
    if(mode==='aborted')controller.abort('secret-cancellation-reason');
    if(mode==='transport'||mode==='aborted')throw new Error('secret-network-message');
    if(mode==='stream')return {ok:true,body:(async function*(){throw new Error('secret-response-body');})()};
    return new Response(mode==='json'?'secret-invalid-json':'null');
  });
  const code={transport:'provider_transport_failed',json:'provider_response_json_invalid',stream:'provider_response_read_failed',aborted:'provider_request_aborted',shape:'unsupported_provider_response'}[mode];
  await assert.rejects(invoke({endpoint:'https://fixture.invalid/v1/chat/completions',model:'fixture',key_env:key},[],{output_tokens:1},controller.signal),error=>error.message===code);
  assert.equal(calls,1);
  assert.equal(providerFailureCode(new Error('private arbitrary exception')),'provider_unclassified_error');
  assert.equal(providerFailureCode(new Error(code)),code);
});

test('provider diagnostics retain only bounded machine-readable HTTP error fields',async t=>{
  const key='LABYRINTH_DIAGNOSTIC_FIXTURE';process.env[key]='synthetic-only';t.after(()=>delete process.env[key]);
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({error:{
    message:'secret provider detail',type:'invalid_request_error',code:'unsupported_value',param:'reasoning_effort'}}),{status:400}));
  const expected='provider_http_error_400_unsupported_value_reasoning_effort';
  await assert.rejects(invoke({endpoint:'https://fixture.invalid/v1/chat/completions',model:'fixture',key_env:key},[],{output_tokens:1},new AbortController().signal),
    error=>error.message===expected&&!error.message.includes('secret'));
  assert.equal(providerFailureCode(new Error(expected)),expected);
});
