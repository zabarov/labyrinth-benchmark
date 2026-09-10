import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createMiraiComposition as createComposition} from '../dist/mirai-composition.js';
import {generate,writeCorpus,parseText} from '../dist/corpus.js';
import {run} from '../dist/runner.js';
import {evaluateRun} from '../dist/report.js';
import {score} from '../dist/evaluate.js';
import {atomicJSON} from '../dist/core.js';
import {proposedProgram} from './program-fixture.mjs';
import {pythonSandbox} from '../dist/sandbox.js';
import {miraiSourceReference} from '../dist/mirai-source-reference.js';
import {executeMiraiBounded} from '../dist/mirai-execution.js';

// Preserve the frozen protocol-only control explicitly, not as a live default.
const createMiraiComposition=(...args)=>createComposition(...args,{review:'protocol'});

test('authored reference compiles and executes through real public Mirai without a supplied digest',async()=>{
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const program=require('@zabarov/mirai/program');
  const before=JSON.stringify(program.MIRAI_PROGRAM_SCHEMA);
  const reference=miraiSourceReference(program.MIRAI_PROGRAM_SCHEMA);
  assert.equal(JSON.stringify(program.MIRAI_PROGRAM_SCHEMA),before);
  const {default:Ajv}=await import('ajv/dist/2020.js');
  const validate=new Ajv({strict:false}).compile(reference.schema);
  assert.equal(validate(reference.example),true,JSON.stringify(validate.errors));
  assert.equal(validate(reference.table_example),true,JSON.stringify(validate.errors));
  assert.deepEqual(reference.schema.$defs.node.properties.kind.enum,['call','branch','match','return']);
  assert(JSON.stringify(reference.schema).length<before.length,'capability projection reduces schema context');
  const unsupported=structuredClone(reference.example);unsupported.nodes[0].kind='foreach';
  assert.equal(validate(unsupported),false);
  const external=structuredClone(reference.example);external.nodes[0].target={kind:'program',program:'other.program'};
  assert.equal(validate(external),false);
  const compiled=program.compileProgramSource(JSON.stringify(reference.example),'reference.mirai.json').program;
  assert.match(compiled.digest,/^sha256:/);
  const episode=await executeMiraiBounded(process.env.MIRAI_CANDIDATE_ROOT,compiled,AbortSignal.timeout(10000));
  assert.deepEqual(episode.outputs,{sum:15});
  const table=program.compileProgramSource(JSON.stringify(reference.table_example),'reference.table.mirai.json').program;
  assert.deepEqual((await executeMiraiBounded(process.env.MIRAI_CANDIDATE_ROOT,table,AbortSignal.timeout(10000))).outputs,{sum:37});
  assert.throws(()=>program.compileProgramSource(JSON.stringify({...reference.example,digest:'sha256:'+'0'.repeat(64)}),'reference.mirai.json'),/digest_mismatch/);
});

test('real public Mirai composition requires Outcome protocol admission before delivery',async t=>{
  assert.ok(process.env.MIRAI_CANDIDATE_ROOT,'explicit built candidate required');
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const {digestValue:d}=require('@zabarov/mirai/core');
  const root=await mkdtemp(join(tmpdir(),'labyrinth-mirai-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const body={contract_version:'1.0.0',id:'test.profile',provider_alias:'test.provider',model_ref:'recorded-test',capabilities:['program_generation'],confidentiality:['public','internal'],
    constraints:{max_input_tokens:100000,max_output_tokens:10000,structured_output:true,local:true},
    economics:{currency:'USD',input_per_million:0,output_per_million:0,latency_p50_ms:1,latency_p95_ms:2},
    calibration:{suite_digest:d('test-only'),result_digest:d('test-only'),scores:{program_generation:1,overall:1},completed_at:'2026-09-07T00:00:00Z'},authority_granted:false,canonical_write_allowed:false};
  const profile=join(root,'profile.json');await atomicJSON(profile,{...body,digest:d(body)});
  const manifest={contract_version:'1.0.0',id:'mirai-test',kind:'mirai',model:'recorded-test',commit:'test-only',memory:true,version:'2.6.0-alpha.1'};
  const participant=await createMiraiComposition(manifest,root,process.env.MIRAI_CANDIDATE_ROOT,profile);
  const source={id:'program.test',version:'1.0.0',imports:[],inputs:[],state:[{id:'trace',type:{kind:'list',items:{kind:'record',fields:{node:'string',before:'int64',after:'int64',branch:'string'}}},default:[]}],entry:'answer',
    outputs:[{id:'status',type:'string'},{id:'value',type:'int64'},{id:'trace',type:{kind:'list',items:{kind:'record',fields:{node:'string',before:'int64',after:'int64',branch:'string'}}}}],
    nodes:[{id:'answer',kind:'return',values:{status:{op:'literal',value:'completed'},value:{op:'literal',value:-1},trace:{op:'ref',path:'state.trace'}}}],
    policies:{allowed_effects:['pure'],canonical_write_allowed:false,budgets:{max_steps:10,max_depth:1,max_iterations:1,max_parallel:1,max_duration_ms:1000}}};
  let calls=0;
  require('@zabarov/mirai/program').compileProgramSource(JSON.stringify(source),'candidate.mirai.json');
  const packet=generate('1',10);
  const context={signal:AbortSignal.timeout(15000),budget:{calls:6,input_tokens:100000,output_tokens:10000,cost_usd:1,deadline_ms:15000,input_per_million:0,output_per_million:0,unknown_call_ceiling_usd:null},async infer(messages,options){
    calls++;assert.equal(typeof JSON.parse(messages[1].content).text,'string');
    assert.ok(!messages[1].content.includes('oracle'));
    assert.ok(JSON.parse(messages[1].content).language_reference.join('').includes('Mirai Program'));
    assert.match(JSON.parse(messages[1].content).result_requirements.status,/completed/);
    assert.match(JSON.parse(messages[1].content).result_requirements.value,/final value of x|Return left_count/);
    const ref=JSON.parse(JSON.parse(messages[1].content).language_reference.join(''));
    assert.ok(!ref.schema.required.includes('digest'));assert.ok(options.signal instanceof AbortSignal);
    const input=JSON.parse(messages[1].content);
    return {text:JSON.stringify({program_source:JSON.stringify(proposedProgram({...packet,source_text:input.text,goal:input.goal}))}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'test-only'}};
  }};
  const freshContext=()=>({...context,signal:AbortSignal.timeout(15000)});
  const output=await participant.execute(packet,freshContext());
  assert.equal(calls,1);
  const verdict=await score(packet,output);assert.equal(verdict.exact_outcome,true);assert.equal(verdict.false_completion,false);
  await participant.execute(generate('1',10,'unchanged'),freshContext());assert.equal(calls,1,'warm execution reuses candidate not inference');
  await participant.execute(generate('1',10,'source_edit'),freshContext());assert.equal(calls,2);
  await participant.execute(generate('1',10,'goal_change'),freshContext());assert.equal(calls,3);
  await participant.reset();await participant.execute(generate('1',10,'new_scope'),freshContext());assert.equal(calls,4);
  await participant.reset();const blocked=await participant.execute(generate('1',10,'revoked_access'),freshContext());
  assert.deepEqual(blocked,{status:'blocked',value:null,trace:[]});assert.equal(calls,4);
  const positive=await createMiraiComposition({...manifest,memory:false},join(root,'positive'),process.env.MIRAI_CANDIDATE_ROOT,profile);
  const correct=await positive.execute(packet,{...freshContext(),async infer(){return {text:JSON.stringify({program_source:JSON.stringify(proposedProgram(packet))}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};}});
  assert.equal((await score(packet,correct)).exact_outcome,true,'computed trace matches independent oracle');
  let repairs=0;
  const repairContext={...context,signal:AbortSignal.timeout(15000),budget:{...context.budget,calls:2},async infer(messages){
    repairs++;
    const input=JSON.parse(messages[1].content);
    if(repairs===1){
      assert.equal(input.correction,undefined);
      return {text:JSON.stringify({program_source:JSON.stringify({...source,digest:'sha256:'+'0'.repeat(64)})}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }
    assert.match(input.correction.compiler_diagnostic,/digest_mismatch/);
    assert.ok(input.correction.previous_source.includes('sha256:'));
    assert.ok(input.correction.binding.previous_request_digest);
    assert.equal(input.text,packet.source_text);
    return {text:JSON.stringify({program_source:JSON.stringify(proposedProgram(packet))}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
  }};
  assert.equal((await score(packet,await positive.execute(packet,repairContext))).exact_outcome,true);
  assert.equal(repairs,2,'public Cognitive Kernel owns compiler-directed retry, not a benchmark loop');
  let limited=0;
  await assert.rejects(positive.execute(packet,{...repairContext,signal:AbortSignal.timeout(15000),budget:{...context.budget,calls:1},async infer(){limited++;return {text:JSON.stringify({program_source:JSON.stringify({...source,digest:'sha256:'+'0'.repeat(64)})}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};}}),/task_cognitive_verification_failed/);
  assert.equal(limited,1,'one-call budget forbids correction');
  let semanticRepairs=0;
  const corrected=await positive.execute(packet,{...freshContext(),budget:{...context.budget,calls:2},async infer(messages){
    semanticRepairs++;
    if(semanticRepairs===2){const correction=JSON.parse(messages[1].content).correction;assert.match(correction.compiler_diagnostic,/result_protocol/);assert(correction.binding.defects.includes('verification_check_failed:result_protocol'));}
    return {text:JSON.stringify({program_source:JSON.stringify(semanticRepairs===1?source:proposedProgram(packet))}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
  }});
  assert.equal(semanticRepairs,2);assert.equal((await score(packet,corrected)).exact_outcome,true,'native correction repairs compiled but incomplete output');
  await assert.rejects(positive.execute(packet,{...freshContext(),budget:{...context.budget,calls:1},async infer(){return {text:JSON.stringify({program_source:JSON.stringify(source)}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};}}),/task_cognitive_verification_failed/);
  for(const length of [10,100,1000]){
    const executionPacket=generate('2',length);
    // The outer test includes lowering and validation; the actual pure worker
    // still enforces its independent 30-second execution ceiling.
    const started=performance.now();
    const executed=await positive.execute(executionPacket,{...context,signal:AbortSignal.timeout(120000),async infer(){throw new Error('execution_must_not_infer');}},parseText(executionPacket.source_text));
    t.diagnostic(`Execution ${length} including preparation: ${Math.round(performance.now()-started)}ms`);
    assert.equal((await score(executionPacket,executed)).exact_outcome,true,'execution uses supplied representation without inference');
  }
  const longPacket=generate('1',1000);
  let transported=false;
  await assert.rejects(positive.execute(longPacket,{...context,budget:{...context.budget,calls:1},signal:AbortSignal.timeout(15000),async infer(messages){
    assert.equal(JSON.parse(messages[1].content).text,longPacket.source_text);transported=true;
    return {text:JSON.stringify({program_source:JSON.stringify(source)}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
  }}),/task_cognitive_verification_failed/);
  assert.equal(transported,true);
  if(process.env.LABYRINTH_SLOW_DEADLINE_TEST==='1'){
    const delayed=await positive.execute(packet,{...context,signal:AbortSignal.timeout(40000),budget:{...context.budget,deadline_ms:40000},async infer(){
      await new Promise(done=>setTimeout(done,31000));
      return {text:JSON.stringify({program_source:JSON.stringify(proposedProgram(packet))}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'delayed-fixture'}};
    }});
    assert.equal(delayed.status,'completed','host-authorized inference survives 30 seconds; fixture success is not live-model evidence');
  }
  let toolCalls=0,toolInference=0;
  const toolPacket={...packet,tools:['python']};
  const toolSignal=AbortSignal.timeout(15000);
  const toolResult=await positive.execute(toolPacket,{...context,signal:toolSignal,
    async python(code){toolCalls++;assert.equal(code,'print(2+2)');return process.env.LABYRINTH_SANDBOX_IMAGE?pythonSandbox(code,process.env.LABYRINTH_SANDBOX_IMAGE,toolSignal):'4\n';},
    async infer(messages){
      toolInference++;
      if(toolInference===1)return {text:JSON.stringify({python:'print(2+2)'}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
      assert.ok(JSON.parse(messages[1].content).tool_history.includes('4'));
      return {text:JSON.stringify({program_source:JSON.stringify(proposedProgram(packet))}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }});
  assert.equal(toolCalls,1);assert.equal(toolInference,2);assert.equal(toolResult.status,'completed');
  await assert.rejects(positive.execute(toolPacket,context),/mirai_python_host_required/);
  await assert.rejects(positive.execute(packet,{...context,signal:AbortSignal.timeout(15000),async infer(){return {text:JSON.stringify({python:'print(2+2)'}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};}}),/mirai_candidate_transport_invalid/);
  if(process.env.LABYRINTH_SANDBOX_IMAGE){
    const corpus=join(root,'corpus');await writeCorpus(corpus,['1'],[10]);
    let received=0;
    const server=createServer(async(req,res)=>{
      let raw='';for await(const chunk of req)raw+=chunk;
      const request=JSON.parse(raw);received++;
      const input=JSON.parse(request.messages[1].content);assert.equal(input.text,packet.source_text);
      const candidate=input.tool_history==='[]'?{python:'print(2+2)'}:{program_source:JSON.stringify(proposedProgram(packet))};
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({model:'recorded-test',choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate)}}],usage:{prompt_tokens:100,completion_tokens:100}}));
    });
    await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>server.close(done)));
    const saved={root:process.env.LABYRINTH_MIRAI_ROOT,profile:process.env.LABYRINTH_MIRAI_PROFILE,key:process.env.LABYRINTH_TEST_KEY};
    process.env.LABYRINTH_MIRAI_ROOT=process.env.MIRAI_CANDIDATE_ROOT;process.env.LABYRINTH_MIRAI_PROFILE=profile;process.env.LABYRINTH_TEST_KEY='test-only';
    t.after(()=>{for(const [key,value] of Object.entries({LABYRINTH_MIRAI_ROOT:saved.root,LABYRINTH_MIRAI_PROFILE:saved.profile,LABYRINTH_TEST_KEY:saved.key})){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
    const config={contract_version:'1.0.0',corpus,participants:[{...manifest,memory:false,module:resolve('examples/mirai-host.mjs'),endpoint:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,key_env:'LABYRINTH_TEST_KEY'}],track:'text_to_outcome',mode:'matched_tools',repeats:1,lengths:[10],seeds:['1'],budget:{...context.budget,calls:2,input_tokens:1000000},live:true,permitted_data:'synthetic-only',routing:'fixed',sandbox_image:process.env.LABYRINTH_SANDBOX_IMAGE};
    const success=await run(config,join(root,'runner-two'),true);
    assert.equal(received,2);assert.equal(success.calls.length,2);assert.equal(success.trials[0].status,'completed',success.trials[0].reason);
    const limited=await run({...config,budget:{...config.budget,calls:1}},join(root,'runner-one'),true);
    assert.equal(received,3,'second request must not reach HTTP under one-call budget');assert.equal(limited.calls.length,1);assert.notEqual(limited.trials[0].status,'completed');
    const unawaited=await run({...config,participants:[{...config.participants[0],module:resolve('test/unawaited-tool-host.mjs')}]},join(root,'unawaited-tool'),true);
    assert.equal(unawaited.trials[0].status,'uncertain');assert.equal(unawaited.trials[0].reason,'unawaited_tool');assert.equal(unawaited.calls.length,0);assert.equal(received,3);
    const offlineRoot=join(root,'offline-execution');
    const execution=await run({...config,track:'execution',mode:'system_bundle',live:false,budget:{...config.budget,cost_usd:0}},offlineRoot);
    assert.equal(execution.evidence_kind,'execution_harness');assert.equal(execution.calls.length,0);assert.equal(received,3);
    assert.equal(execution.trials[0].status,'completed',execution.trials[0].reason);
    const executionReport=await evaluateRun(offlineRoot);assert.equal(executionReport.totals.exact,1);
  }
});
