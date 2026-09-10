import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createParticipant} from '../dist/participants.js';
import {generate} from '../dist/corpus.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {writeCorpus} from '../dist/corpus.js';
import {run} from '../dist/runner.js';
import {cancelAfterRequestReceived} from './cancelled-inference-host.mjs';

const manifest={contract_version:'1.0.0',id:'prompt-test',kind:'openai',model:'test',commit:'test',memory:false};
const response={text:JSON.stringify({status:'failed',value:null,trace:[]}),usage:{calls:1,input_tokens:1,output_tokens:1,cost_usd:0,provider_version:null}};
test('plain instructions advertise only the intersection of packet and host tools',async()=>{
  for(const host of [false,true]){
    const p=await createParticipant(manifest,'.');
    await p.execute(generate('prompt',10),{signal:AbortSignal.timeout(1000),...(host?{python:async()=>{throw Error('unexpected tool');}}:{}),async infer(messages){assert.ok(!messages[0].content.toLowerCase().includes('python'));return response;}});
  }
  const p=await createParticipant(manifest,'.');let called=false;
  await p.execute({...generate('prompt',10),tools:['python']},{signal:AbortSignal.timeout(1000),python:async()=>'',async infer(messages){called=true;assert.match(messages[0].content,/Python/);return response;}});
  assert.equal(called,true);
  await assert.rejects(p.execute({...generate('prompt',10),tools:['python']},{signal:AbortSignal.timeout(1000),infer:async()=>{throw Error('must fail before inference');}}),/python_host_required/);
});
test('undeclared tool cannot execute even when the host has a tool implementation',async()=>{
  const p=await createParticipant(manifest,'.');let calls=0;
  await assert.rejects(p.execute(generate('prompt',10),{signal:AbortSignal.timeout(1000),python:async()=>{calls++;return '';},infer:async()=>({...response,text:JSON.stringify({python:'print(1)'})})}),/tool_not_authorized/);
  assert.equal(calls,0);
});
test('authored-source reference excludes compiler-owned digests without mutating IR schema',async()=>{
  const {miraiSourceReference}=await import('../dist/mirai-source-reference.js');
  const ir={title:'Mirai Program',type:'object',required:['id','digest','source_map','contract_version','error_routes'],properties:{id:{type:'string'},digest:{type:'string'}}};
  const before=JSON.stringify(ir),ref=miraiSourceReference(ir);
  assert.equal(JSON.stringify(ir),before);assert.ok(!ref.schema.required.includes('digest'));
  assert.equal(ref.schema.properties.digest,false);
  assert.deepEqual(ref.schema.required,['id'],'compiler-generated and defaulted fields are not required authored input');
  assert.ok(!('digest' in ref.example));assert.match(ref.notes.join(' '),/compiler/i);
  assert.ok(!JSON.stringify(ref.example).includes('S1C'));assert.ok(!('source_text' in ref));
});
test('language reference transport reconstructs structure across chunk boundaries',async()=>{
  const {miraiSourceReference,decodeMiraiSourceReference}=await import('../dist/mirai-source-reference.js');
  const reference=miraiSourceReference({type:'object',properties:{id:{type:'string'}}});
  const serialized=JSON.stringify(reference);
  const chunks=Array.from({length:Math.ceil(serialized.length/19)},(_,i)=>serialized.slice(i*19,(i+1)*19));
  assert.deepEqual(decodeMiraiSourceReference(chunks),reference);
  assert(Buffer.byteLength(JSON.stringify({language_reference:reference}))<Buffer.byteLength(JSON.stringify({language_reference:chunks})));
  for(const invalid of [['null'],['[]'],['{'],['{}']])assert.throws(()=>decodeMiraiSourceReference(invalid));
  assert.match(reference.notes.join(' '),/every next, then, else/);
});
test('native inference cancellation reaches HTTP and pre-abort reserves nothing',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'labyrinth-cancel-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const corpus=join(dir,'corpus');await writeCorpus(corpus,['cancel'],[10]);
  let received=0;
  const server=createServer(async(req,res)=>{
    for await(const chunk of req){}
    received++;
    cancelAfterRequestReceived();
    const timer=setTimeout(()=>res.end(JSON.stringify({model:'test-model',choices:[{finish_reason:'stop',message:{content:'{}'}}],usage:{prompt_tokens:1,completion_tokens:1}})),500);
    res.on('close',()=>clearTimeout(timer));
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  t.after(()=>{server.closeAllConnections();return new Promise(done=>server.close(done));});
  const old=process.env.LABYRINTH_CANCEL_KEY;process.env.LABYRINTH_CANCEL_KEY='fake-test-only';
  t.after(()=>{if(old===undefined)delete process.env.LABYRINTH_CANCEL_KEY;else process.env.LABYRINTH_CANCEL_KEY=old;});
  const config={contract_version:'1.0.0',corpus,participants:[{...manifest,id:'preabort',kind:'mirai',version:'cancel-test',module:resolve('test/cancelled-inference-host.mjs'),model:'test-model',endpoint:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,key_env:'LABYRINTH_CANCEL_KEY'}],track:'memory_change',mode:'system_bundle',repeats:1,lengths:[10],seeds:['cancel'],budget:{calls:1,input_tokens:10000,output_tokens:100,cost_usd:1,deadline_ms:2000,input_per_million:1,output_per_million:1,unknown_call_ceiling_usd:null},live:true,permitted_data:'synthetic-only',routing:'fixed'};
  const pre=await run(config,join(dir,'pre'),true);
  assert.equal(pre.calls.length,0);assert.equal(received,0);
  const active=await run({...config,participants:[{...config.participants[0],id:'inflight'}]},join(dir,'active'),true);
  assert.equal(active.calls.length,1);assert.equal(active.calls[0].state,'uncertain');assert.equal(active.calls[0].usage,null);
  assert.equal(received,1);assert.ok(active.trials.slice(1).every(t=>t.status==='blocked'));
});
