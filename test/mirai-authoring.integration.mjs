import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createMiraiComposition} from '../dist/mirai-composition.js';
import {miraiSourceReference} from '../dist/mirai-source-reference.js';
import {generate,oracle} from '../dist/corpus.js';
import {atomicJSON} from '../dist/core.js';
import {compactProposedProgram} from './program-fixture.mjs';
import {executeMiraiBounded} from '../dist/mirai-execution.js';

for(const mode of ['direct','handles','unknown_handle','duplicate_json'])test(`native compact authoring: ${mode}`,async t=>{
  const root=await mkdtemp(join(tmpdir(),'labyrinth-authoring-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const {digestValue:d}=require('@zabarov/mirai/core'),program=require('@zabarov/mirai/program');
  const compact=miraiSourceReference(program.MIRAI_PROGRAM_SCHEMA,'compact'),full=miraiSourceReference(program.MIRAI_PROGRAM_SCHEMA);
  assert(JSON.stringify(compact).length<JSON.stringify(full).length*0.7,'reference size must materially decrease');
  const sample=program.compileProgramSource(JSON.stringify(compact.table_example),'record-example.json').program;
  const episode=await executeMiraiBounded(process.env.MIRAI_CANDIDATE_ROOT,sample,AbortSignal.timeout(10000));
  assert.equal(episode.outputs.sum,37);
  const profile=join(root,'profile.json');
  const body={contract_version:'1.0.0',id:'test.profile',provider_alias:'test.provider',model_ref:'recorded-test',capabilities:['program_generation'],confidentiality:['public','internal'],
    constraints:{max_input_tokens:100000,max_output_tokens:20000,structured_output:true,local:true},
    economics:{currency:'USD',input_per_million:0,output_per_million:0,latency_p50_ms:1,latency_p95_ms:2},
    calibration:{suite_digest:d('fixture'),result_digest:d('fixture'),scores:{program_generation:1,overall:1},completed_at:'2026-09-07T00:00:00Z'},authority_granted:false,canonical_write_allowed:false};
  await atomicJSON(profile,{...body,digest:d(body)});
  const packet=generate('compact-authoring-fixture',10),expected=oracle(packet),source=compactProposedProgram(packet);
  const declaration=source.state.find(slot=>slot.id==='value_x');
  if(['handles','unknown_handle'].includes(mode))source.state=source.state.filter(slot=>slot.id!=='value_x');
  let raw=JSON.stringify(source);if(mode==='duplicate_json')raw=raw.replace('"id":','"id":"duplicate","id":');
  const participant=await createMiraiComposition({contract_version:'1.0.0',id:'recorded',kind:'mirai',model:'recorded-test',commit:'fixture',memory:mode==='direct'||mode==='handles',version:'2.6.0-alpha.1'},
    join(root,'participant'),process.env.MIRAI_CANDIDATE_ROOT,profile,{review:'source',source_transport:'direct_json',review_strategy:'blind',
      ...(mode==='handles'||mode==='unknown_handle'?{refinement:true,semantic_refinement:true,repair_strategy:'scoped',repair_transport:'target_handles'}:{})});
  const stages=[];
  const context={signal:AbortSignal.timeout(60000),budget:{calls:5,input_tokens:300000,output_tokens:40000,cost_usd:1,deadline_ms:60000,input_per_million:0,output_per_million:0,unknown_call_ceiling_usd:null},
    async infer(messages){
      const input=JSON.parse(messages[1].content);assert.equal(input.text,packet.source_text);let answer;
      if(input.stage==='source_review'){stages.push('review');assert.equal(input.result,undefined);answer=expected;}
      else if(messages[0].content.startsWith('Analyze the recorded defect')){
        stages.push('diagnose');const defects=['verification_check_failed:compile','verification_check_failed:result_protocol'];
        const quote=JSON.stringify({op:'ref',path:'state.value_x'}),start=input.diagnostic_artifacts.candidate_program.indexOf(quote);
        answer={defects,source_spans:[{id:'missing',source_ref:'candidate_program',quote,start,end:start+quote.length}],
          repairs:defects.map(defect=>({defect,source_refs:['missing'],change:'Declare the referenced typed initial state.'}))};
      }else if(input.diagnostic_candidate){
        stages.push('repair');assert(!JSON.stringify(input.repair_context).includes('sha256:'));
        const target=input.repair_context.targets.find(item=>item.section==='state'&&item.id==='value_x');
        answer={edits:[{target:mode==='unknown_handle'?'absent':target.target,value:declaration}]};
      }else{stages.push('generate');assert.match(messages[0].content,/Program directly/);assert.deepEqual(input.language_reference,compact);}
      return {text:answer?JSON.stringify(answer):raw,usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }};
  const success=mode==='direct'||mode==='handles';
  if(success)assert.deepEqual(await participant.execute(packet,context),expected);
  else await assert.rejects(participant.execute(packet,context));
  const record=JSON.parse(await readFile(join(root,'participant','task-1','source-review.json'),'utf8'));
  assert.equal(record.accepted,success);assert.equal(record.replay.provider_calls,0);
  const generated=record.ledger.tasks['maze.request'].inference_records[0];
  assert.equal(generated.verification_snapshot.output.program_chunks.join(''),raw,'native ledger retains exact direct JSON bytes');
  assert.equal(generated.receipt.usage.cost_usd,0);
  assert.deepEqual(stages,mode==='direct'?['generate','review']:mode==='handles'?['generate','diagnose','repair','review']:mode==='unknown_handle'?['generate','diagnose','repair']:['generate','generate','generate']);
  assert.equal(record.ledger.reserved_model_calls,stages.length);
  if(mode==='duplicate_json')assert(record.ledger.tasks['maze.request'].inference_records.every(item=>
    item.verification_snapshot.output.program_chunks.join('')===raw&&item.receipt.usage.cost_usd===0));
  if(success){
    assert.deepEqual(await participant.execute({...packet,phase:'unchanged'},context),expected);
    assert.equal(stages.at(-1),'review');assert.equal(stages.filter(stage=>stage==='generate').length,1);
  }
});
