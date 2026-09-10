import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {prepareMiraiDiagnosticRefinement} from '../dist/mirai-refinement.js';

test('diagnostic decomposition uses native qualification and retains the parent boundary',()=>{
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const f=structuredClone(require('./examples/mirai-cognitive-kernel-minimal/run-bundle.json'));
  const {digestValue:d}=require('@zabarov/mirai/core');
  const seal=value=>{const {digest,...body}=value;return {...body,digest:d(body)};};
  const defect=seal({operation_contract_digest:f.contract.digest,status:'retry',defects:['verification_check_failed:result_protocol']});
  const before=JSON.stringify(f);
  const build=(parent=f.plan,input=f.input)=>prepareMiraiDiagnosticRefinement(require,parent,f.contract,defect,f.operation.id,input);
  const result=build();
  assert.equal(JSON.stringify(f),before);
  assert.deepEqual(build(),result);
  const child=result.proposal.child_plan;
  assert.deepEqual(child.operations.map(operation=>({id:operation.id,dependencies:operation.dependencies})),[
    {id:'diagnose',dependencies:[]},{id:'rebuild',dependencies:['diagnose']}
  ]);
  for(const field of ['technology_release_digest','context_pack_digest','policy_digest','outcome_contract_digest','routing_mode'])
    assert.equal(child[field],f.plan[field]);
  assert.equal(result.execution_allowed,false);assert.equal(result.semantic_acceptance,false);
  assert(result.proposal.coverage.every(item=>item.operation_ids.join()==='rebuild'));
  assert.equal(result.proposal.contracts[1].digest,f.contract.digest,'terminal verification cannot weaken original checks');
  assert.throws(()=>build(seal({...f.plan,budgets:{...f.plan.budgets,max_operations:1}})),/not_reserved/);
  assert.throws(()=>build(f.plan,{}),/input_invalid/);
  const accepted=seal({...defect,status:'accepted'});
  assert.throws(()=>prepareMiraiDiagnosticRefinement(require,f.plan,f.contract,accepted,f.operation.id,f.input),/defect_binding/);
});

for(const callLimit of [2,3])test(`native diagnostic children share a ${callLimit}-call root without accepting a goal`,async t=>{
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const f=structuredClone(require('./examples/mirai-cognitive-kernel-minimal/run-bundle.json'));
  const tasks=require('@zabarov/mirai/tasks'),c=require('@zabarov/mirai/cognition');
  const {digestValue:d}=require('@zabarov/mirai/core');
  const {createGraphSnapshot}=require('@zabarov/mirai/stdlib');
  const seal=value=>{const {digest,...body}=value;return {...body,digest:d(body)};};
  f.operation={...f.operation,max_attempts:1};f.plan=seal({...f.plan,operations:[f.operation],routing_mode:'fixed',
    escalation:{allowed:false,profile_ids:[],human_handoff_allowed:true}});
  let calls=0;
  const provider={alias:f.provider.alias,async health(){return {status:'available',checked_at:'2026-09-07T00:00:00Z'};},async invoke(request){
    calls++;
    if(request.request.operation_id==='rebuild')assert(Object.values(request.dependency_results).some(result=>result.output.summary==='diagnostic candidate'));
    return {output:calls===1?{invalid:true}:{summary:request.request.operation_id==='diagnose'?'diagnostic candidate':'rebuilt candidate'},
      usage:{input_tokens:1,output_tokens:1,cost_usd:0.000004},latency_ms:1};
  }};
  const receiver=c.createCognitiveTaskReceiver({...f,id:f.operation.receiver_id,providers:[provider],
    verificationChecks:{diagnosis:output=>output.summary==='diagnostic candidate'},evidenceFromOutput:()=>f.evidence});
  const sources=[...new Map(f.context.items.map(item=>[item.source_ref,{id:item.source_ref,owner_ref:'owner',confidentiality:item.confidentiality,digest:d(item.source_ref)}])).values()];
  const graph=createGraphSnapshot({contract_version:'1.0.0',id:'diagnostic.graph',sources,objects:[{id:'task',kind:'task',scope:'test',metadata:{},source_refs:sources.map(s=>s.id)}],relations:[],canonical_write_allowed:false});
  const policy=tasks.createTaskPolicy({id:'diagnostic.policy',owner:'owner',reviewers:['reviewer'],
    participants:['owner',receiver.id].map(id=>({id,object_ids:['task'],source_ids:sources.map(s=>s.id),delegate_to:[receiver.id]})),
    max_depth:3,max_tasks:3,max_parallel:1,max_duration_ms:30000,max_model_calls:callLimit,max_output_bytes:200000,
    inference_budget:{input_tokens:100000,output_tokens:10000,cost_usd:1}});
  const request={id:'task.main',parent_id:null,receiver_id:receiver.id,receiver_digest:receiver.digest,object_ids:['task'],input:f.input,
    dependencies:[],required_evidence:f.contract.required_evidence,deadline:'2099-01-01T00:00:00Z',outcome:'Test native correction orchestration'};
  const plan=tasks.prepareTaskPlan('diagnostic.tasks',graph,policy,[request],[receiver]);
  const root=await mkdtemp(join(tmpdir(),'mirai-diagnostic-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const host=new tasks.TaskHost({home:root,sandbox:root,graph,policy,receivers:[receiver],authorize:()=>true,
    refinement_review:{id:'test.decomposition-review',configuration_digest:d('recorded-orchestration-only'),verify(request){
      return seal({contract_version:'1.1.0',verifier_id:'test.decomposition-review',request_digest:request.digest,
        criteria:['defect_targeted','smaller_steps','requirements_preserved'].map(criterion=>({criterion,verdict:'supported',operation_ids:['diagnose','rebuild'],rationale:'Recorded orchestration fixture, not semantic evidence',uncertainty:[]}))});
    }}});
  const run=host.create(plan);await host.runReady(run);
  const failed=host.inspect(run).tasks[request.id],record=failed.inference_records.at(-1);
  assert.equal(failed.state,'failed',JSON.stringify({blocker:failed.blocker,receipt_state:failed.receipt_state}));assert.equal(calls,1);
  const prepared=prepareMiraiDiagnosticRefinement(require,record.verification_snapshot.plan,record.verification_snapshot.contract,record.verification,f.operation.id,f.input);
  host.recordRefinement(run,request.id,prepared.proposal);
  host.activateRefinement(run,request.id,prepared.inputs);
  if(callLimit===2)await assert.rejects(host.runReady(run),/task_model_budget_exceeded/);
  else await host.runReady(run);
  const ledger=host.inspect(run),children=Object.values(ledger.tasks).filter(task=>task.request.parent_id===request.id);
  assert.equal(calls,callLimit);assert.equal(ledger.reserved_model_calls,callLimit);
  assert.equal(children.filter(task=>task.receipt_state==='verified').length,callLimit-1);
  assert.equal(ledger.plan.digest,plan.digest,'activation retains the immutable original plan');
  assert.notEqual(ledger.tasks[request.id].acceptance,'accepted','verified children do not accept the parent outcome');
  const replay=tasks.replayTasks(host.historyReplayRecord(run),graph,policy,[{...receiver,execute(){throw Error('replay_must_not_call_provider');}}]);
  assert.equal(replay.provider_calls,0);assert.equal(calls,callLimit);
});
