import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createMiraiComposition} from '../dist/mirai-composition.js';
import {generate,oracle} from '../dist/corpus.js';
import {atomicJSON} from '../dist/core.js';
import {proposedProgram,compactProposedProgram} from './program-fixture.mjs';

test('source review is a governed peer task; candidates and memory cannot bypass it',async t=>{
  const root=await mkdtemp(join(tmpdir(),'labyrinth-source-review-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const {digestValue:d}=require('@zabarov/mirai/core');
  const body={contract_version:'1.0.0',id:'test.profile',provider_alias:'test.provider',model_ref:'recorded-test',capabilities:['program_generation'],confidentiality:['public','internal'],
    constraints:{max_input_tokens:100000,max_output_tokens:10000,structured_output:true,local:true},
    economics:{currency:'USD',input_per_million:0,output_per_million:0,latency_p50_ms:1,latency_p95_ms:2},
    calibration:{suite_digest:d('test-only'),result_digest:d('test-only'),scores:{program_generation:1,overall:1},completed_at:'2026-09-07T00:00:00Z'},authority_granted:false,canonical_write_allowed:false};
  const profile=join(root,'profile.json');await atomicJSON(profile,{...body,digest:d(body)});
  const manifest={contract_version:'1.0.0',id:'mirai-test',kind:'mirai',model:'recorded-test',commit:'fixture',memory:true,version:'2.6.0-alpha.1'};
  const home=join(root,'participant'),participant=await createMiraiComposition(manifest,home,process.env.MIRAI_CANDIDATE_ROOT,profile);
  let calls=[],verdict='supported';
  const packet=generate('source-review-01',10);
  const context=(limit=2)=>({signal:AbortSignal.timeout(20000),budget:{calls:limit,input_tokens:100000,output_tokens:20000,cost_usd:1,deadline_ms:20000,input_per_million:0,output_per_million:0,unknown_call_ceiling_usd:null},
    async infer(messages){
      const input=JSON.parse(messages[1].content);calls.push(input.stage??'generate');
      assert.equal(input.text,packet.source_text);assert(!messages[1].content.includes('oracle'));
      if(input.stage==='source_review'){
        assert.match(messages[0].content,/JSON/,'JSON transport requires an explicit format instruction');
        assert.equal(input.result.trace.length,10);assert.match(input.candidate_output_digest,/^sha256:/);assert.equal(input.program_source,undefined);
        return {text:JSON.stringify({verdict,uncertainty:verdict==='supported'?[]:['The candidate disagrees with the source.']}),usage:{calls:1,input_tokens:100,output_tokens:50,cost_usd:0,provider_version:'fixture'}};
      }
      assert(!Array.isArray(input.language_reference));
      assert.equal(input.language_reference.schema.type,'object');
      assert(input.language_reference.table_example.nodes.length>0);
      return {text:JSON.stringify({program_source:JSON.stringify(proposedProgram(packet))}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }});
  assert.equal((await participant.execute(packet,context())).status,'completed');
  assert.deepEqual(calls,['generate','source_review']);
  assert.equal((await participant.execute({...packet,phase:'unchanged'},context())).status,'completed');
  assert.deepEqual(calls,['generate','source_review','source_review'],'warm candidate still receives governed review');
  const artifact=JSON.parse(await readFile(join(home,'task-1','benchmark-artifacts.json'),'utf8'));
  assert.equal(artifact.semantic_acceptance,true);
  assert.equal(artifact.source_review.replay.provider_calls,0);
  assert.equal(artifact.source_review.replay.recorded_completion,true);
  const ledger=artifact.source_review.ledger;
  assert.equal(Object.values(ledger.tasks).flatMap(task=>task.inference_records??[]).length,2);
  assert.equal(ledger.tasks['maze.request'].acceptance,'accepted');
  assert.equal(ledger.tasks['maze.review-request'].inference_records[0].verification_snapshot.dependency_results['maze.source-preparation'].output.semantic_request.value.trace.length,10);
  verdict='contradicted';
  await assert.rejects(participant.execute(packet,context()),/mirai_source_review_not_accepted/);
  assert.equal(calls.length,4,'cache acceptance is not authority');
  verdict='uncertain';
  await assert.rejects(participant.execute(packet,context()),/mirai_source_review_not_accepted/);
  assert.equal(calls.length,5);
  assert.deepEqual(await participant.execute({...packet,access:'revoked'},context()),{status:'blocked',value:null,trace:[]});assert.equal(calls.length,5);
  const limited=await createMiraiComposition({...manifest,memory:false},join(root,'limited'),process.env.MIRAI_CANDIDATE_ROOT,profile);
  verdict='supported';calls=[];
  await assert.rejects(limited.execute(packet,context(1)),/mirai_source_review_not_accepted/);
  assert.deepEqual(calls,['generate'],'review cannot obtain a second root budget');
  const record=JSON.parse(await readFile(join(root,'limited','task-1','source-review.json'),'utf8'));
  assert.match(record.failure,/task_model_budget_exceeded/);
  const wrong=proposedProgram(packet);
  wrong.entry='invented';wrong.nodes=[{id:'invented',kind:'return',values:{status:{op:'literal',value:'completed'},value:{op:'literal',value:0},
    trace:{op:'literal',value:Array.from({length:10},(_,i)=>({node:`invented${i}`,before:0,after:0,branch:'C'}))}}}];
  const invented=await createMiraiComposition({...manifest,memory:false},join(root,'invented'),process.env.MIRAI_CANDIDATE_ROOT,profile);
  let inventedCalls=0;
  await assert.rejects(invented.execute(packet,{...context(),async infer(messages){
    inventedCalls++;
    const input=JSON.parse(messages[1].content);
    if(input.stage==='source_review')assert.equal(input.result.trace[0].node,'invented0');
    return {text:JSON.stringify(input.stage==='source_review'?{verdict:'contradicted',uncertainty:['Invented nodes are absent from the supplied text.']}:{program_source:JSON.stringify(wrong)}),
      usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
  }}),/mirai_source_review_not_accepted/);
  assert.equal(inventedCalls,2,'coherent wrong trace reaches source review, not protocol rejection');
  for(const mode of ['agreement','disagreement','unavailable']){
    const blindHome=join(root,`blind-${mode}`);
    const blind=await createMiraiComposition({...manifest,memory:false},blindHome,process.env.MIRAI_CANDIDATE_ROOT,profile,{review:'source',review_strategy:'blind',...(mode==='disagreement'?{refinement:true,semantic_refinement:true}:{})});
    const candidate={status:'completed',value:0,trace:wrong.nodes[0].values.trace.value};
    const expected=structuredClone(candidate);
    if(mode==='disagreement')expected.trace[3].branch='L';
    let blindCalls=0;
    const attempt=blind.execute(packet,{...context(mode==='disagreement'?6:2),async infer(messages){
      blindCalls++;
      const input=JSON.parse(messages[1].content);
      let answer={program_source:JSON.stringify(wrong)};
      if(input.stage==='source_review'){
        assert.equal(input.text,packet.source_text);
        assert.equal(input.result,undefined);assert.equal(input.candidate_output_digest,undefined);
        assert(!messages[1].content.includes('invented0'),'review prompt must not reveal executor route');
        assert.equal(input.review_strategy,'source-reconstruction.2.disagreement-is-uncertain');
        answer=mode==='unavailable'?{status:'failed',value:null,trace:[]}:expected;
      }
      return {text:JSON.stringify(answer),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }});
    if(mode==='agreement')assert.equal((await attempt).status,'completed');
    else await assert.rejects(attempt,/mirai_source_review_not_accepted/);
    assert.equal(blindCalls,2);
    const saved=JSON.parse(await readFile(join(blindHome,'task-1','source-review.json'),'utf8'));
    assert.equal(saved.accepted,mode==='agreement');assert.equal(saved.replay.provider_calls,0);
    if(mode==='disagreement')assert.equal(saved.failure,'Error: mirai_source_review_disagreement_requires_adjudication');
    const output=saved.ledger.tasks['maze.review-request'].inference_records[0].verification_snapshot.output;
    assert.deepEqual(JSON.parse(output.reconstruction_chunks.join('')),mode==='unavailable'?{status:'failed',value:null,trace:[]}:expected);
    assert.equal(output.result_value_digest,d(candidate),'comparison must bind the executed value separately from program source');
    const dependency=saved.ledger.tasks['maze.review-request'].inference_records[0].verification_snapshot.dependency_results['maze.request'].output;
    assert.equal(output.candidate_output_digest,d(dependency),'program source output binding is preserved');
  }
  const rejected=JSON.parse(await readFile(join(root,'invented','task-1','source-review.json'),'utf8'));
  assert.equal(rejected.ledger.tasks['maze.request'].receipt_state,'verified');
  assert.equal(rejected.accepted,false);assert.equal(rejected.replay.recorded_completion,false);
  const mutable=structuredClone(packet),frozen=await createMiraiComposition({...manifest,memory:false},join(root,'frozen'),process.env.MIRAI_CANDIDATE_ROOT,profile);
  const stable=await frozen.execute(mutable,{...context(),async infer(messages){
    const input=JSON.parse(messages[1].content);assert.equal(input.text,packet.source_text);
    mutable.source_text='untrusted changed source';
    return {text:JSON.stringify(input.stage==='source_review'?{verdict:'supported',uncertainty:[]}:{program_source:JSON.stringify(proposedProgram(packet))}),
      usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
  }});
  assert.equal(stable.status,'completed','active input snapshot cannot change between generation and review');
  const correctionHome=join(root,'review-correction'),correction=await createMiraiComposition({...manifest,memory:false},correctionHome,process.env.MIRAI_CANDIDATE_ROOT,profile);
  let reviewAttempts=0;
  assert.equal((await correction.execute(packet,{...context(3),async infer(messages){
    const input=JSON.parse(messages[1].content);
    let answer={program_source:JSON.stringify(proposedProgram(packet))};
    if(input.stage==='source_review'){
      reviewAttempts++;
      if(reviewAttempts===2){assert(input.correction.binding.defects.includes('verification_check_failed:decision_diagnostic'));assert.equal(input.correction.previous_decision.verdict,'contradicted');}
      answer={verdict:reviewAttempts===1?'contradicted':'supported',uncertainty:[]};
    }
    return {text:JSON.stringify(answer),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
  }})).status,'completed');
  assert.equal(reviewAttempts,2);
  const corrected=JSON.parse(await readFile(join(correctionHome,'task-1','source-review.json'),'utf8'));
  assert.equal(corrected.ledger.reserved_model_calls,3);assert.equal(corrected.replay.provider_calls,0);
  for(const recover of [false,true]){
    const transportHome=join(root,`review-transport-${recover}`);
    const participant=await createMiraiComposition({...manifest,memory:false},transportHome,process.env.MIRAI_CANDIDATE_ROOT,profile);
    let attempts=0;
    const invocation=participant.execute(packet,{...context(3),async infer(messages){
      const input=JSON.parse(messages[1].content);
      let text=JSON.stringify({program_source:JSON.stringify(proposedProgram(packet))});
      if(input.stage==='source_review'){
        attempts++;
        if(attempts===2){
          assert(input.correction.binding.defects.includes('verification_check_failed:decision_transport'));
          assert.deepEqual(input.correction.previous_decision,{verdict:'uncertain',uncertainty:['source_review_transport_invalid']});
        }
        text=recover&&attempts===2?JSON.stringify({verdict:'supported',uncertainty:[]}):'null';
      }
      return {text,usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }});
    if(recover)assert.equal((await invocation).status,'completed');else await assert.rejects(invocation,/mirai_source_review_not_accepted/);
    const state=JSON.parse(await readFile(join(transportHome,'task-1','source-review.json'),'utf8'));
    assert.equal(attempts,2);assert.equal(state.ledger.reserved_model_calls,3);
    const receipts=state.ledger.tasks['maze.review-request'].inference_records;
    assert.equal(receipts.length,2);
    assert(receipts[0].verification.defects.includes('verification_check_failed:decision_transport'));
    assert.equal(receipts[0].receipt.usage.input_tokens,100);
    assert(!Object.values(state.ledger.tasks).some(task=>task.receipt_state==='uncertain'));
    assert.equal(state.accepted,recover);assert.equal(state.replay.provider_calls,0);
  }
  const localized=await createMiraiComposition({...manifest,memory:false},join(root,'localized-correction'),process.env.MIRAI_CANDIDATE_ROOT,profile);
  let generationAttempts=0;
  const duplicated=structuredClone(wrong);
  duplicated.nodes[0].values.trace.value[1].node=duplicated.nodes[0].values.trace.value[0].node;
  assert.equal((await localized.execute(packet,{...context(3),async infer(messages){
    const input=JSON.parse(messages[1].content);
    if(input.stage==='source_review')return {text:JSON.stringify({verdict:'supported',uncertainty:[]}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    generationAttempts++;
    if(generationAttempts===2){
      const diagnostic=JSON.parse(input.correction.compiler_diagnostic);
      const trace=diagnostic.defects.find(d=>d.criterion==='trace');
      const duplicate=trace.diagnostics.map(d=>JSON.parse(d)).find(d=>d.code==='duplicate_node');
      assert.equal(duplicate.row_index,1);assert.equal(duplicate.previous_index,0);
      assert.equal(input.correction.previous_source,JSON.stringify(duplicated));
    }
    return {text:JSON.stringify({program_source:JSON.stringify(generationAttempts===1?duplicated:proposedProgram(packet))}),
      usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
  }})).status,'completed');
  assert.equal(generationAttempts,2);
  const settledHome=join(root,'settled-rejection');
  const settled=await createMiraiComposition({...manifest,memory:false},settledHome,process.env.MIRAI_CANDIDATE_ROOT,profile);
  let rejectedCalls=0;
  await assert.rejects(settled.execute(packet,{...context(3),async infer(){
    rejectedCalls++;return {text:JSON.stringify({program_source:'{}'}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
  }}));
  const rejectedRecord=JSON.parse(await readFile(join(settledHome,'task-1','source-review.json'),'utf8'));
  assert.equal(rejectedCalls,3);
  assert.equal(rejectedRecord.ledger.tasks['maze.request'].state,'failed');
  assert.equal(rejectedRecord.ledger.tasks['maze.request'].receipt_state,'failed','known rejection is not an uncertain provider effect');
  assert.equal(rejectedRecord.replay.provider_calls,0);
  calls=[];
  await assert.rejects(limited.execute({...packet,tools:['python']},{...context(),async python(){throw new Error('not permitted');}}),/matched_tools_not_integrated/);
  assert.deepEqual(calls,[],'unsupported orchestration fails before paid inference');
  await assert.rejects(createMiraiComposition(manifest,root,process.env.MIRAI_CANDIDATE_ROOT,profile,{review:'unknown'}),/mirai_review_mode_invalid/);
  const before=await readFile(join(home,'task-1','benchmark-artifacts.json'),'utf8');
  const reopened=await createMiraiComposition(manifest,home,process.env.MIRAI_CANDIDATE_ROOT,profile);
  verdict='supported';calls=[];
  assert.equal((await reopened.execute(packet,context())).status,'completed');
  assert.equal(await readFile(join(home,'task-1','benchmark-artifacts.json'),'utf8'),before,'re-open never overwrites historical evidence');
  assert.deepEqual(calls,['source_review'],'re-open reuses only the scoped candidate, not its acceptance');
  for(const decision of ['supported','contradicted','forged_quote','malformed_diagnosis','null_diagnosis']){
    const recoveryHome=join(root,`recovery-${decision}`);
    const recovery=await createMiraiComposition({...manifest,memory:decision==='supported'},recoveryHome,process.env.MIRAI_CANDIDATE_ROOT,profile,{review:'source',refinement:true});
    const stages=[];
    const recoveryContext={...context(4),async infer(messages){
      const input=JSON.parse(messages[1].content);
      let answer;
      if(input.stage==='source_review'){
        stages.push('review');answer={verdict:decision,uncertainty:decision==='supported'?[]:['Recorded disagreement']};
      }else if(messages[0].content.startsWith('Analyze the recorded defect')){
        stages.push('diagnose');assert.equal(input.diagnostic_artifacts.candidate_program,'{}');
        assert.match(messages[0].content,/Return directly one JSON object/);
        assert.equal(input.language_reference,undefined,'diagnosis receives one bound language artifact, not a duplicate');
        answer={defects:['verification_check_failed:compile','verification_check_failed:result_protocol'],
          source_spans:[decision==='supported'?{id:'rule',source_ref:'candidate_program',quote:'{}'}:{id:'rule',quote:decision==='forged_quote'?'This text is not in the task.':packet.source_text.slice(0,120)}],
          repairs:['verification_check_failed:compile','verification_check_failed:result_protocol'].map(defect=>({defect,source_refs:['rule'],change:'Rebuild a bounded program preserving every original rule.'}))};
        if(decision==='malformed_diagnosis')answer.defects=answer.defects.map(code=>({code,description:'Not the declared field structure.'}));
        if(decision==='null_diagnosis')answer=null;
      }else if(input.diagnostic_candidate){
        stages.push('rebuild');assert.equal(input.diagnostic_candidate[0].semantic_acceptance,false);
        assert.equal(input.previous_source,'{}');answer={program_source:JSON.stringify(proposedProgram(packet))};
      }else{stages.push('generate');answer={program_source:'{}'};}
      return {text:JSON.stringify(answer),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }};
    if(decision==='supported'){
      let value;
      try{value=await recovery.execute(packet,recoveryContext);}catch(error){
        const record=JSON.parse(await readFile(join(recoveryHome,'task-1','source-review.json'),'utf8').catch(()=>'{"ledger":{"tasks":{}}}'));
        throw new Error(JSON.stringify({error:String(error),failure:record.failure,provider:record.provider_failure_code,stages,tasks:Object.fromEntries(Object.entries(record.ledger.tasks).map(([id,task])=>[id,{state:task.state,blocker:task.blocker,defects:task.inference_records?.at(-1)?.verification?.defects}]))}));
      }
      assert.equal(value.status,'completed');
    }
    else await assert.rejects(recovery.execute(packet,recoveryContext));
    const record=JSON.parse(await readFile(join(recoveryHome,'task-1','source-review.json'),'utf8'));
    const rejectedDiagnosis=['forged_quote','malformed_diagnosis','null_diagnosis'].includes(decision);
    assert.deepEqual(stages,rejectedDiagnosis?['generate','diagnose']:['generate','diagnose','rebuild','review'],JSON.stringify({failure:record.failure,stages}));
    assert.equal(record.ledger.tasks['maze.request'].state,'failed');
    assert.equal(record.accepted,decision==='supported');
    assert.equal(record.replay.provider_calls,0);
    assert.equal(record.ledger.reserved_model_calls,stages.length);
    const diagnosis=Object.values(record.ledger.tasks).flatMap(task=>task.inference_records??[]).find(r=>r.request.operation_id==='diagnose');
    assert.equal(JSON.parse(diagnosis.verification_snapshot.input.diagnostic_artifacts.join('')).candidate_program,'{}','diagnostic materials are bound typed input, not unrecorded provider context');
    if(rejectedDiagnosis){
      assert.deepEqual(diagnosis.verification.defects,['verification_check_failed:diagnosis']);
      assert.equal(diagnosis.receipt.usage.cost_usd,0,'known malformed output retains its actual usage');
      assert(!Object.values(record.ledger.tasks).some(task=>task.receipt_state==='uncertain'));
    }
    if(decision==='supported'){
      assert.equal((await recovery.execute({...packet,phase:'unchanged'},recoveryContext)).status,'completed');
      assert.deepEqual(stages,['generate','diagnose','rebuild','review','review'],'refined cache saves only construction, not acceptance');
    }
  }
  for(const decision of ['supported','blind_supported','contradicted','stale','duplicate','malformed','out_of_scope','replacement','invalid_base']){
    const supported=['supported','blind_supported'].includes(decision);
    const scopedHome=join(root,`scoped-${decision}`),original=compactProposedProgram(packet);
    const declaration=original.state.find(item=>item.id==='value_x');
    original.state=original.state.filter(item=>item.id!=='value_x');
    const originalSource=decision==='invalid_base'?'{}':JSON.stringify(original);
    const scoped=await createMiraiComposition({...manifest,memory:supported},scopedHome,process.env.MIRAI_CANDIDATE_ROOT,profile,
      {review:'source',refinement:true,repair_strategy:'scoped',...(decision==='blind_supported'?{review_strategy:'blind'}:{})});
    const stages=[];let rawRepair;
    const scopedContext={...context(4),async infer(messages){
      const input=JSON.parse(messages[1].content);let answer;
      assert.equal(input.text,packet.source_text);
      if(input.stage==='source_review'){
        stages.push('review');
        if(decision==='blind_supported'){
          assert.equal(input.result,undefined);answer=oracle(packet); // Recorded reviewer fixture only.
        }else answer={verdict:decision,uncertainty:decision==='supported'?[]:['Recorded source disagreement']};
      }else if(messages[0].content.startsWith('Analyze the recorded defect')){
        stages.push('diagnose');
        const defects=['verification_check_failed:compile','verification_check_failed:result_protocol'];
        const quoted=JSON.stringify({op:'ref',path:'state.value_x'});
        const start=input.diagnostic_artifacts.candidate_program.indexOf(quoted);
        answer={defects,source_spans:[{id:'rule',source_ref:'candidate_program',start,end:start+quoted.length,quote:quoted}],
          repairs:defects.map(defect=>({defect,source_refs:['rule'],change:'Restore the missing typed state declaration; preserve all source rules.'}))};
      }else if(input.diagnostic_candidate){
        stages.push('repair');assert.match(messages[0].content,/Return directly one JSON object with exactly source_digest and edits/);
        const bounds=input.repair_context;
        assert.equal(input.candidate_program,originalSource);
        assert.equal(input.diagnostic_artifacts,undefined,'repair transport does not duplicate source and language artifacts');
        assert.equal(input.previous_source,undefined);
        assert.match(input.original_requirements,/Create a Mirai Program/);
        assert.equal(bounds.source_digest,d(originalSource));assert.equal(bounds.execution_allowed,false);
        const target=bounds.targets.find(item=>item.id==='value_x'&&item.section==='state');
        assert.equal(target.expected_digest,null);
        answer={source_digest:decision==='stale'?d('other'):bounds.source_digest,edits:[{...target,value:declaration}]};
        if(decision==='out_of_scope')answer.edits[0]={section:'policies',id:'policy',expected_digest:null,value:{canonical_write_allowed:true}};
        if(decision==='replacement')answer={program_source:JSON.stringify(compactProposedProgram(packet))};
        rawRepair=decision==='malformed'?'{':JSON.stringify(answer);
        if(decision==='duplicate')rawRepair=rawRepair.replace('"source_digest":',`"source_digest":"${bounds.source_digest}","source_digest":`);
      }else{stages.push('generate');answer={program_source:originalSource};}
      return {text:stages.at(-1)==='repair'?rawRepair:JSON.stringify(answer),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }};
    if(supported)assert.deepEqual(await scoped.execute(packet,scopedContext),oracle(packet));
    else await assert.rejects(scoped.execute(packet,scopedContext));
    const record=JSON.parse(await readFile(join(scopedHome,'task-1','source-review.json'),'utf8'));
    const repaired=supported||decision==='contradicted';
    assert.deepEqual(stages,decision==='invalid_base'?['generate']:repaired?['generate','diagnose','repair','review']:['generate','diagnose','repair'],JSON.stringify({failure:record.failure,stages}));
    assert.equal(record.accepted,supported);assert.equal(record.ledger.tasks['maze.request'].state,'failed');
    assert.equal(record.replay.provider_calls,0);assert.equal(record.ledger.reserved_model_calls,stages.length);
    if(decision!=='invalid_base'){
      const repair=Object.values(record.ledger.tasks).flatMap(task=>task.inference_records??[]).find(item=>item.request.operation_id==='rebuild');
      assert.equal(repair.verification_snapshot.output.program_chunks.join(''),rawRepair,'raw patch bytes are never substituted by repaired source');
      assert.equal(repair.receipt.usage.cost_usd,0,'settled malformed repair keeps its known usage');
      assert(!Object.values(record.ledger.tasks).some(task=>task.receipt_state==='uncertain'));
      assert.equal(repair.verification.status==='accepted',repaired);
    }
    if(supported){
      const proposal=JSON.parse(await readFile(join(scopedHome,'task-1','repair-proposal.json'),'utf8'));
      assert.equal(proposal.repair.source_digest,d(originalSource));assert.equal(proposal.semantic_acceptance,false);
      const artifact=JSON.parse(await readFile(join(scopedHome,'task-1','benchmark-artifacts.json'),'utf8'));
      assert.equal(proposal.repair.program_digest,artifact.program.digest,'runtime executes the exact admitted compilation artifact');
      assert.deepEqual(JSON.parse(proposal.repair.candidate_source).nodes,original.nodes);
      assert.equal((await scoped.execute({...packet,phase:'unchanged'},scopedContext)).status,'completed');
      assert.deepEqual(stages,['generate','diagnose','repair','review','review'],'warm reuse saves construction, never the source review');
      if(decision==='blind_supported'){
        const warm=JSON.parse(await readFile(join(scopedHome,'task-2','source-review.json'),'utf8'));
        const review=Object.values(warm.ledger.tasks).flatMap(task=>task.inference_records??[]).at(-1);
        assert(Array.isArray(review.verification_snapshot.output.reconstruction_chunks),'warm mode retains blind reconstruction evidence');
      }
    }
  }
  for(const finalVerdict of ['supported','contradicted']){
    const semanticHome=join(root,`semantic-refinement-${finalVerdict}`);
    const correct=compactProposedProgram(packet),original=structuredClone(correct);
    original.state.find(item=>item.id==='value_x').default+=1;
    const source=JSON.stringify(original),stages=[];
    const participant=await createMiraiComposition({...manifest,memory:false},semanticHome,process.env.MIRAI_CANDIDATE_ROOT,profile,
      {review:'source',refinement:true,repair_strategy:'scoped',semantic_refinement:true});
    const semanticContext={...context(5),async infer(messages){
      const input=JSON.parse(messages[1].content);let answer;
      if(input.stage==='source_review'){
        const verdict=stages.includes('repair')?finalVerdict:'contradicted';stages.push('review');
        answer={verdict,uncertainty:verdict==='supported'?[]:['The initial state does not match the source.']};
      }else if(messages[0].content.startsWith('Analyze the recorded defect')){
        stages.push('diagnose');
        const defects=['outcome:satisfied','criterion:source_alignment:contradicted'];
        const quote=packet.source_text.split('\n')[0];
        answer={defects,source_spans:[{id:'initial',source_ref:'source_text',quote}],
          repairs:defects.map(defect=>({defect,source_refs:['initial'],change:'Restore the source initial state.'}))};
      }else if(input.diagnostic_candidate){
        stages.push('repair');assert.equal(input.candidate_program,source);
        const target=input.repair_context.targets.find(item=>item.section==='state'&&item.id==='value_x');
        answer={source_digest:input.repair_context.source_digest,edits:[{...target,value:correct.state.find(item=>item.id==='value_x')}]};
      }else{stages.push('generate');answer={program_source:source};}
      return {text:JSON.stringify(answer),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }};
    await assert.rejects(participant.execute(packet,{...semanticContext,budget:{...semanticContext.budget,calls:4}}),/semantic_refinement_budget_not_reserved/);
    assert.equal(stages.length,0);
    let answer,error;try{answer=await participant.execute(packet,semanticContext);}catch(e){error=e;}
    const record=JSON.parse(await readFile(join(semanticHome,'task-1','source-review.json'),'utf8'));
    assert.deepEqual(stages,['generate','review','diagnose','repair','review'],record.failure??String(error));
    const parent=record.ledger.tasks['maze.request'];
    assert.equal(parent.state,'completed');assert.equal(parent.acceptance,'pending');
    assert.equal(parent.inference_records[0].verification.status,'accepted','original inference is not forged into a failure');
    assert.equal(parent.outcome_attempts[0].semantic_verification.accepted,false);
    assert.equal(record.ledger.reserved_model_calls,5);assert.equal(record.replay.provider_calls,0);
    if(finalVerdict==='supported')assert.deepEqual(answer,oracle(packet),String(error));
    else assert(error,'a second contradicted outcome must remain unaccepted');
    assert.equal(record.accepted,finalVerdict==='supported');
  }
  const uncertain=await createMiraiComposition({...manifest,memory:false},join(root,'refinement-uncertain'),process.env.MIRAI_CANDIDATE_ROOT,profile,{review:'source',refinement:true});
  let uncertainCalls=0;
  const uncertainContext={...context(4),async infer(){uncertainCalls++;throw Error('provider_response_lost');}};
  await assert.rejects(uncertain.execute(packet,{...uncertainContext,budget:{...uncertainContext.budget,calls:3}}),/budget_not_reserved/);
  assert.equal(uncertainCalls,0);
  await assert.rejects(uncertain.execute(packet,uncertainContext));
  assert.equal(uncertainCalls,1,'uncertain effect cannot activate diagnostic recovery');
  const uncertainRecord=JSON.parse(await readFile(join(root,'refinement-uncertain','task-1','source-review.json'),'utf8'));
  assert.equal(uncertainRecord.executor_failure_code,'provider_response_lost');
});
