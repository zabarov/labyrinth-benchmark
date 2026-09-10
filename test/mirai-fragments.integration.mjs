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

for(const mode of ['success','bad_id','bad_type','duplicate_json','override_state','wrong_result','unqualified_repair','duplicate_node','repair','revision','revision_override','revision_wrong','revision_runtime','revision_runtime_forged','cancel','budget'])test(`native fragment authoring: ${mode}`,async t=>{
  const root=await mkdtemp(join(tmpdir(),'labyrinth-fragments-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const {digestValue:d}=require('@zabarov/mirai/core');
  const profile=join(root,'profile.json');
  const body={contract_version:'1.0.0',id:'test.profile',provider_alias:'test.provider',model_ref:'recorded-test',capabilities:['program_generation'],confidentiality:['public','internal'],
    constraints:{max_input_tokens:200000,max_output_tokens:20000,structured_output:true,local:true},
    economics:{currency:'USD',input_per_million:0,output_per_million:0,latency_p50_ms:1,latency_p95_ms:2},
    calibration:{suite_digest:d('fixture'),result_digest:d('fixture'),scores:{program_generation:1,overall:1},completed_at:'2026-09-07T00:00:00Z'},authority_granted:false,canonical_write_allowed:false};
  await atomicJSON(profile,{...body,digest:d(body)});
  const packet=generate('fragment-authoring-fixture',10),expected=oracle(packet),source=compactProposedProgram(packet);
  const revision=mode.startsWith('revision');
  const runtimeFailure=mode.startsWith('revision_runtime');
  const replacement=structuredClone(source);
  if(revision){
    if(runtimeFailure)source.nodes.find(node=>node.id==='l1record').result='trace';
    else source.nodes.push(structuredClone(source.nodes[0]));
    replacement.state.push({id:'revision_marker',type:'int64',default:0});
    const oldEntry=replacement.entry;
    replacement.nodes.find(node=>node.id===oldEntry).id='revision_start';
    for(const node of replacement.nodes)for(const key of ['next','then','else','default'])if(node[key]===oldEntry)node[key]='revision_start';
    replacement.entry='revision_start';
  }
  const declaration=source.state.find(slot=>slot.id==='value_x');
  if(mode==='bad_id')declaration.id='x';
  if(mode==='bad_type')declaration.default='wrong';
  if(mode==='wrong_result')declaration.default+=1;
  if(mode==='repair')source.state=source.state.filter(slot=>slot.id!=='value_x');
  if(mode==='unqualified_repair'){source.nodes.find(node=>node.id===source.entry).id='x';source.entry='x';}
  if(mode==='duplicate_node')source.nodes.push(structuredClone(source.nodes[0]));
  const useRepair=mode==='repair'||mode==='unqualified_repair'||mode==='duplicate_node';
  const participant=await createMiraiComposition({contract_version:'1.0.0',id:'recorded',kind:'mirai',model:'recorded-test',commit:'fixture',memory:mode==='success',version:'2.6.0-alpha.1'},
    join(root,'participant'),process.env.MIRAI_CANDIDATE_ROOT,profile,{review:'source',source_transport:'direct_json',review_strategy:'blind',fragments:true,
      ...(useRepair?{refinement:true,semantic_refinement:true,repair_strategy:'scoped',repair_transport:'target_handles',repair_preflight:true}:revision?{refinement:true,semantic_refinement:true,candidate_revision:true}:{})});
  const stages=[],abort=new AbortController();let rawDeclarations;
  const context={signal:AbortSignal.any([AbortSignal.timeout(60000),abort.signal]),budget:{calls:mode==='budget'?1:6,input_tokens:600000,output_tokens:120000,cost_usd:1,deadline_ms:60000,input_per_million:0,output_per_million:0,unknown_call_ceiling_usd:null},
    async infer(messages){
      const input=JSON.parse(messages[1].content);assert.equal(input.text,packet.source_text);let answer;
      if(input.stage==='state_declarations'){
        stages.push('declare');answer={state:source.state};rawDeclarations=JSON.stringify(answer);
        if(mode==='duplicate_json')rawDeclarations=rawDeclarations.replace('"state":','"state":[],"state":');
        if(mode==='cancel')abort.abort();
        return {text:rawDeclarations,usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
      }else if(input.stage==='source_review'){stages.push('review');assert.equal(input.result,undefined);answer=expected;}
      else if(messages[0].content.startsWith('Analyze the recorded defect')){
        stages.push('diagnose');const defects=['verification_check_failed:compile','verification_check_failed:result_protocol'];
        const quote=revision?'"entry":'+JSON.stringify(source.entry):JSON.stringify({op:'ref',path:'state.value_x'}),start=input.diagnostic_artifacts.candidate_program.indexOf(quote);
        answer={defects,source_spans:[{id:'missing',source_ref:'candidate_program',quote,start,end:start+quote.length}],repairs:defects.map(defect=>({defect,source_refs:['missing'],change:'Declare the original typed state.'}))};
        if(runtimeFailure){
          assert.equal(input.diagnostic_artifacts.compiler_diagnostic,'Error: mirai_execution_failed:state_type_mismatch:l1record:expected=list:actual=record');
          const defect='verification_check_failed:result_protocol';
          answer={defects:[defect],source_spans:[{id:'runtime_error',source_ref:mode==='revision_runtime_forged'?'candidate_program':'compiler_diagnostic',quote:'state_type_mismatch:l1record'}],
            repairs:[{defect,source_refs:['runtime_error'],change:'Store the record in its declared record slot, then append to the list.'}]};
        }
      }else if(input.diagnostic_candidate){
        stages.push('repair');
        if(revision){
          assert.equal(input.repair_context,undefined);assert(input.fragment_envelope);
          answer={state:replacement.state,entry:replacement.entry,nodes:replacement.nodes};
          if(mode==='revision_override')answer.policies={canonical_write_allowed:true};
          if(mode==='revision_wrong')answer.state.find(slot=>slot.id==='value_x').default+=1;
        }else{
          const target=input.repair_context.targets.find(item=>item.section==='state'&&item.id==='value_x');
          answer={edits:[{target:target.target,value:declaration}]};
        }
      }else{
        stages.push('body');assert.equal(input.stage,'program_body');assert.deepEqual(input.declarations.state,source.state);
        assert.equal(input.declarations.semantic_acceptance,false);assert.equal(input.fragment_envelope.policies.canonical_write_allowed,false);
        answer={entry:source.entry,nodes:source.nodes};if(mode==='override_state')answer.state=[];
      }
      return {text:JSON.stringify(answer),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }};
  const success=mode==='success'||mode==='repair'||mode==='revision'||mode==='revision_runtime';
  if(success)assert.deepEqual(await participant.execute(packet,context),expected);
  else await assert.rejects(participant.execute(packet,context));
  if(mode==='budget'){assert.deepEqual(stages,[]);return;}
  const record=JSON.parse(await readFile(join(root,'participant','task-1','source-review.json'),'utf8'));
  assert.equal(record.accepted,success);assert.equal(record.replay.provider_calls,0);
  assert.equal(record.ledger.reserved_model_calls,stages.length);
  assert.deepEqual(stages,mode==='success'||mode==='wrong_result'?['declare','body','review']:mode==='repair'||mode==='revision'||mode==='revision_wrong'||mode==='revision_runtime'?['declare','body','diagnose','repair','review']:mode==='revision_runtime_forged'?['declare','body','diagnose']:mode==='revision_override'?['declare','body','diagnose','repair']:
    mode==='unqualified_repair'||mode==='duplicate_node'?['declare','body']:mode==='override_state'?['declare','body','body','body']:['declare']);
  if(mode!=='cancel')assert.equal(record.ledger.tasks['maze.declarations'].inference_records[0].verification_snapshot.output.program_chunks.join(''),rawDeclarations);
  if(mode==='unqualified_repair'||mode==='duplicate_node'){
    assert.equal(record.repair_qualification.status,'requires_replan');assert.match(record.failure,/requires_replan/);
  }
  if(mode==='repair')assert.equal(record.repair_qualification.status,'candidate_required');
  if(mode==='revision'){
    const artifacts=JSON.parse(await readFile(join(root,'participant','task-1','benchmark-artifacts.json'),'utf8'));
    assert.equal(artifacts.revision_proposal.compile_valid,true);
    assert(artifacts.revision_proposal.parent_source_digest);
    assert.equal(artifacts.program.entry,'revision_start');
    assert(artifacts.program.state.some(slot=>slot.id==='revision_marker'));
  }
  if(mode==='success'){
    const r=record.ledger.tasks['maze.request'].inference_records[0];assert(r.request.dependency_digest);
    assert(r.verification_snapshot.dependency_results['maze.declarations']);
    assert.deepEqual(await participant.execute({...packet,phase:'unchanged'},context),expected);
    assert.deepEqual(stages,['declare','body','review','review']);
  }
});
