import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {atomicJSON,readJSON,digest} from '../dist/core.js';
import {writeCorpus,loadCorpus,oracle} from '../dist/corpus.js';
import {run} from '../dist/runner.js';
import {inspectJobAccounting,auditCampaignAccounting,checkCampaignAllocation} from '../source/audit-campaign-accounting.mjs';
import {blindSmokeStage} from '../source/blind-smoke-stages.mjs';
import {assertFreshMazeSeed} from '../source/blind-smoke-history.mjs';

test('smoke stages use fixed distinct seeds and cannot select arbitrary paths',()=>{
  const first=blindSmokeStage(),next=blindSmokeStage('reference');
  assert.notEqual(first.directory,next.directory);assert.notEqual(first.seed,next.seed);
  for(const id of ['../escape','constructor','toString','unknown'])assert.throws(()=>blindSmokeStage(id));
  next.seed='changed';assert.equal(blindSmokeStage('reference').seed,'blind-reference-source-01');
  const fourth=blindSmokeStage('fragments_4o');
  assert.equal(fourth.budget,30);assert.equal(fourth.plain_ceiling+fourth.mirai_ceiling,0.9);
  assert.equal(fourth.model_slug,'gpt-4o-2024-11-20');
});

test('accounting review retains uncertainty and rejects changed or nonterminal ledgers',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'labyrinth-accounting-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const corpus=join(dir,'corpus');await writeCorpus(corpus,['accounting-01'],[10]);
  const recordings=join(dir,'recordings.json');
  await atomicJSON(recordings,Object.fromEntries((await loadCorpus(corpus)).map(p=>[p.task_id,oracle(p)])));
  const config={contract_version:'1.0.0',corpus,participants:[{contract_version:'1.0.0',id:'fixture',kind:'recorded',model:null,commit:'fixture',memory:false,module:recordings}],
    track:'text_to_outcome',mode:'system_bundle',repeats:1,lengths:[10],seeds:['accounting-01'],
    budget:{calls:3,input_tokens:100000,output_tokens:10000,cost_usd:1,deadline_ms:10000,input_per_million:1,output_per_million:1,unknown_call_ceiling_usd:null},
    live:false,permitted_data:'synthetic-only',routing:'fixed'};
  await run(config,join(dir,'run'),false);
  const original=await readJSON(join(dir,'run','run.json'));
  const state=structuredClone(original),trial=state.trials[0];
  trial.status='uncertain';trial.reason='execution_uncertain';trial.output=null;
  state.calls=[{group:trial.group,trial_id:trial.id,phase:trial.packet.phase,state:'uncertain',reserved:{input_tokens:100,output_tokens:100,cost_usd:0.2},usage:null}];
  const job={status:'done',ledger_digest:digest(state),ceiling:1,known:0,held:0.2};
  assert.doesNotThrow(()=>assertFreshMazeSeed(job,state,'new-seed'));
  assert.throws(()=>assertFreshMazeSeed(job,state,'accounting-01'),/seed_already_used/);
  const before=JSON.stringify(state),review=inspectJobAccounting(job,state);
  assert.equal(review.known,0);assert.equal(review.held,0.2);assert.equal(review.additional_full_job_reserve,0.8);
  assert.equal(review.unresolved.length,1);assert.equal(JSON.stringify(state),before);
  assert.throws(()=>inspectJobAccounting({...job,ledger_digest:digest(original)},state),/changed/);
  assert.throws(()=>inspectJobAccounting({...job,status:'running'},state),/terminal/);
  assert.throws(()=>inspectJobAccounting({...job,held:0},state),/amount_mismatch/);
  assert.throws(()=>inspectJobAccounting({...job,ceiling:0.1},state),/ceiling_exceeded/);
  const running=structuredClone(state);running.trials[0].status='running';
  assert.throws(()=>inspectJobAccounting({...job,ledger_digest:digest(running)},running),/execution_not_terminal/);
  const reserved=structuredClone(state);reserved.calls[0].state='reserved';
  assert.throws(()=>inspectJobAccounting({...job,ledger_digest:digest(reserved)},reserved),/execution_not_terminal/);
  const campaign=join(dir,'accounting','campaign');
  await atomicJSON(join(campaign,'fixture','run.json'),state);
  await atomicJSON(join(campaign,'campaign.json'),{ceiling:30,jobs:[{...job,id:'fixture'}]});
  await assert.rejects(auditCampaignAccounting(join(dir,'accounting')),/campaign_shape_invalid/);
  const additional=await auditCampaignAccounting(join(dir,'accounting'),30);
  assert.equal(additional.additional_authorization_exposure,1);
  assert.equal(additional.additional_authorization_remaining,9);
  await atomicJSON(join(campaign,'campaign.json'),{ceiling:20,jobs:[{...job,id:'fixture'}]});
  const previous=await auditCampaignAccounting(join(dir,'accounting'),30);
  assert.equal(previous.additional_authorization_exposure,0);
  assert.equal(previous.full_job_conservative_exposure,1);
  assert.equal(previous.additional_authorization_remaining,10);
  const pending=join(dir,'accounting','interrupted');
  const preparation={approved_campaign_ceiling:30,jobs:[{id:'plain',ceiling:0.2},{id:'mirai',ceiling:0.8}]};
  await atomicJSON(join(pending,'preparation.json'),{...preparation,digest:digest(preparation)});
  await atomicJSON(join(pending,'execution.json'),{preparation_digest:digest(preparation),jobs:[
    {id:'plain',status:'done',ceiling:0.2},{id:'mirai',status:'running',ceiling:0.8}]});
  const interrupted=await auditCampaignAccounting(join(dir,'accounting'),30);
  assert.equal(interrupted.full_job_conservative_exposure,2);
  assert.equal(interrupted.additional_authorization_remaining,9);
  assert.deepEqual(interrupted.pending_campaigns,[{campaign:'interrupted',ceiling:1,authorization_ceiling:30}]);
  const atLimit={...interrupted,full_job_conservative_exposure:30,additional_authorization_remaining:0,observed_runner_pids:[]};
  assert.deepEqual(checkCampaignAllocation(atLimit,'interrupted',1,30),{already_reserved:1,additional_reservation_required:0});
  assert.throws(()=>checkCampaignAllocation(atLimit,'another',1,30),/accounting_or_execution/);
  assert.throws(()=>checkCampaignAllocation(atLimit,'interrupted',2,30),/reservation_changed/);
  assert.throws(()=>checkCampaignAllocation({...atLimit,observed_runner_pids:[123]},'interrupted',1,30),/accounting_or_execution/);
  assert.throws(()=>checkCampaignAllocation({...atLimit,full_job_conservative_exposure:NaN},'interrupted',1,30),/allocation_invalid/);
  await atomicJSON(join(pending,'campaign.json'),{ceiling:30,jobs:[]});
  await assert.rejects(auditCampaignAccounting(join(dir,'accounting'),30),/campaign_execution_conflict/);
  await rm(join(pending,'campaign.json'));
  await atomicJSON(join(pending,'execution.json'),{preparation_digest:'forged',jobs:[]});
  await assert.rejects(auditCampaignAccounting(join(dir,'accounting'),30),/pending_campaign_invalid/);
});
