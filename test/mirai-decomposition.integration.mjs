import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createMiraiComposition} from '../dist/mirai-composition.js';
import {generate,oracle} from '../dist/corpus.js';
import {atomicJSON} from '../dist/core.js';
import {compactProposedProgram} from './program-fixture.mjs';

for(const mode of ['success','missing','unknown','wrong_result','repair','cancel','budget'])test(`native source decomposition: ${mode}`,async t=>{
  const root=await mkdtemp(join(tmpdir(),'labyrinth-decomposition-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const {digestValue:d}=require('@zabarov/mirai/core');
  const profile=join(root,'profile.json');
  const body={contract_version:'1.0.0',id:'test.profile',provider_alias:'test.provider',model_ref:'recorded-test',capabilities:['program_generation'],confidentiality:['public','internal'],
    constraints:{max_input_tokens:200000,max_output_tokens:20000,structured_output:true,local:true},
    economics:{currency:'USD',input_per_million:0,output_per_million:0,latency_p50_ms:1,latency_p95_ms:2},
    calibration:{suite_digest:d('fixture'),result_digest:d('fixture'),scores:{program_generation:1,overall:1},completed_at:'2026-09-07T00:00:00Z'},authority_granted:false,canonical_write_allowed:false};
  await atomicJSON(profile,{...body,digest:d(body)});
  const packet=generate('source-decomposition-fixture',10),expected=oracle(packet),source=compactProposedProgram(packet);
  const declaration=source.state.find(slot=>slot.id==='value_x');
  if(mode==='repair')source.state=source.state.filter(slot=>slot.id!=='value_x');
  if(mode==='wrong_result')declaration.default+=1;
  const participant=await createMiraiComposition({contract_version:'1.0.0',id:'recorded',kind:'mirai',model:'recorded-test',commit:'fixture',memory:mode==='success',version:'2.6.0-alpha.1'},
    join(root,'participant'),process.env.MIRAI_CANDIDATE_ROOT,profile,{review:'source',source_transport:'direct_json',review_strategy:'blind',decomposition:true,
      ...(mode==='repair'?{refinement:true,semantic_refinement:true,repair_strategy:'scoped',repair_transport:'target_handles'}:{})});
  const stages=[],abort=new AbortController();let planning=null;
  const context={signal:AbortSignal.any([AbortSignal.timeout(60000),abort.signal]),budget:{calls:mode==='budget'?1:6,input_tokens:600000,output_tokens:120000,cost_usd:1,deadline_ms:60000,input_per_million:0,output_per_million:0,unknown_call_ceiling_usd:null},
    async infer(messages){
      const input=JSON.parse(messages[1].content);assert.equal(input.text,packet.source_text);let answer;
      if(input.stage==='source_decomposition'){
        stages.push('plan');const c=input.decomposition_context;
        for(const unit of c.units)assert.equal(packet.source_text.slice(unit.start,unit.end),unit.text);
        answer={steps:[
          {id:'extract',task:'Extract source operations and conditions.',source_units:c.units.map(u=>u.id),criteria:[],depends_on:[],check:'All text units are represented.'},
          {id:'implement',task:'Implement the original ordered rules.',source_units:[c.units[0].id],criteria:c.criteria.map(c=>c.id),depends_on:['extract'],check:'Compiler and independent source review are required.'}
        ],unknowns:[]};
        if(mode==='missing')answer.steps[0].source_units.pop();
        if(mode==='unknown')answer.unknowns.push('The source is ambiguous.');
        planning=structuredClone(answer);
      }else if(input.stage==='source_review'){stages.push('review');assert.equal(input.result,undefined);answer=expected;}
      else if(messages[0].content.startsWith('Analyze the recorded defect')){
        stages.push('diagnose');assert.deepEqual(input.source_decomposition.candidate,planning);
        const defects=['verification_check_failed:compile','verification_check_failed:result_protocol'];
        const quote=JSON.stringify({op:'ref',path:'state.value_x'}),start=input.diagnostic_artifacts.candidate_program.indexOf(quote);
        answer={defects,source_spans:[{id:'missing',source_ref:'candidate_program',quote,start,end:start+quote.length}],repairs:defects.map(defect=>({defect,source_refs:['missing'],change:'Declare the original typed state.'}))};
      }else if(input.diagnostic_candidate){
        stages.push('repair');assert.deepEqual(input.source_decomposition.candidate,planning);
        const target=input.repair_context.targets.find(item=>item.section==='state'&&item.id==='value_x');
        answer={edits:[{target:target.target,value:declaration}]};
      }else{
        stages.push('generate');assert.deepEqual(input.source_decomposition.candidate,planning);assert.equal(input.source_decomposition.semantic_acceptance,false);answer=source;
      }
      if(mode==='cancel')abort.abort();
      return {text:JSON.stringify(answer),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }};
  const success=mode==='success'||mode==='repair';
  if(success)assert.deepEqual(await participant.execute(packet,context),expected);
  else await assert.rejects(participant.execute(packet,context));
  if(mode==='budget'){assert.deepEqual(stages,[]);return;}
  const record=JSON.parse(await readFile(join(root,'participant','task-1','source-review.json'),'utf8'));
  assert.equal(record.accepted,success);assert.equal(record.replay.provider_calls,0);
  assert.equal(record.ledger.reserved_model_calls,stages.length);
  assert.deepEqual(stages,mode==='success'||mode==='wrong_result'?['plan','generate','review']:mode==='repair'?['plan','generate','diagnose','repair','review']:['plan']);
  if(mode!=='cancel')assert.equal(record.ledger.tasks['maze.decomposition'].inference_records[0].receipt.usage.cost_usd,0);
  if(mode==='success'){
    const r=record.ledger.tasks['maze.request'].inference_records[0];
    assert(r.request.dependency_digest);assert(r.verification_snapshot.dependency_results['maze.decomposition']);
    assert.deepEqual(await participant.execute({...packet,phase:'unchanged'},context),expected);
    assert.deepEqual(stages,['plan','generate','review','review']);
  }
});
