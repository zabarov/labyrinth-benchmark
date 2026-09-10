import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createMiraiComposition} from '../dist/mirai-composition.js';
import {generate} from '../dist/corpus.js';
import {atomicJSON} from '../dist/core.js';
import {compactProposedProgram} from './program-fixture.mjs';

for(const mode of ['agreement','disagreement','invalid','protocol','generator_secret','reviewer_secret','reviewer_transport'])test(`independent Program review: ${mode}`,async t=>{
  const home=await mkdtemp(join(tmpdir(),'mirai-program-review-'));t.after(()=>rm(home,{recursive:true,force:true}));
  const root=process.env.MIRAI_CANDIDATE_ROOT,require=createRequire(join(root,'package.json'));
  const {digestValue:d}=require('@zabarov/mirai/core');
  const body={contract_version:'1.0.0',id:'test.profile',provider_alias:'test.provider',model_ref:'recorded-test',capabilities:['program_generation'],confidentiality:['public','internal'],
    constraints:{max_input_tokens:100000,max_output_tokens:10000,structured_output:true,local:true},
    economics:{currency:'USD',input_per_million:0,output_per_million:0,latency_p50_ms:1,latency_p95_ms:2},
    calibration:{suite_digest:d('fixture'),result_digest:d('fixture'),scores:{program_generation:1,overall:1},completed_at:'2026-09-07T00:00:00Z'},authority_granted:false,canonical_write_allowed:false};
  const profile=join(home,'profile.json');await atomicJSON(profile,{...body,digest:d(body)});
  const participant=await createMiraiComposition({contract_version:'1.0.0',id:'mirai-test',kind:'mirai',model:'recorded-test',commit:'fixture',memory:false,version:'2.6.0-alpha.1'},home,root,profile,{review:'source',review_strategy:'program'});
  const packet=generate('program-review-fixture',10),program=compactProposedProgram(packet);
  const independent=structuredClone(program);
  if(mode==='disagreement')independent.nodes.find(node=>node.id==='l1record').args.branch={op:'literal',value:'L'};
  if(mode==='invalid')independent.policies.allowed_effects=['network'];
  if(mode==='protocol')for(const node of independent.nodes)if(node.kind==='return')node.values.value={op:'literal',value:-1};
  let calls=0;
  const attempt=participant.execute(packet,{signal:AbortSignal.timeout(30000),budget:{calls:3,input_tokens:100000,output_tokens:30000,cost_usd:1,deadline_ms:30000,input_per_million:0,output_per_million:0,unknown_call_ceiling_usd:null},
    async infer(messages){calls++;const input=JSON.parse(messages[1].content),review=input.stage==='source_review';
      if((mode==='generator_secret'&&!review)||(mode==='reviewer_secret'&&review))throw Error('private_customer_secret_marker');
      if(mode==='reviewer_transport'&&review)throw Error('provider_transport_failed');
      if(review){assert.equal(input.result,undefined);assert.equal(input.candidate_output_digest,undefined);assert.equal(input.text,packet.source_text);assert(input.language_reference);assert.equal(input.review_strategy,'source-program-reconstruction.1');}
      return {text:JSON.stringify(review?independent:{program_source:JSON.stringify(program)}),usage:{calls:1,input_tokens:100,output_tokens:100,cost_usd:0,provider_version:'fixture'}};
    }});
  if(mode==='agreement')assert.equal((await attempt).status,'completed');
  else await assert.rejects(attempt,mode==='generator_secret'?/^Error: cognitive_provider_failed$/:/mirai_source_review_not_accepted/);
  const saved=JSON.parse(await readFile(join(home,'task-1','source-review.json'),'utf8'));
  assert.equal(saved.accepted,mode==='agreement');assert.equal(saved.replay.provider_calls,0);
  if(mode==='generator_secret'||mode==='reviewer_secret'||mode==='reviewer_transport'){
    assert.equal(calls,mode==='generator_secret'?1:2,'uncertain inference is not retried');
    assert(!JSON.stringify(saved).includes('private_customer_secret_marker'));
    assert.equal(mode==='generator_secret'?saved.executor_failure_code:saved.provider_failure_code,
      mode==='reviewer_transport'?'provider_transport_failed':'provider_unclassified_error');
    return;
  }
  assert.equal(calls,mode==='invalid'||mode==='protocol'?3:2);
  const output=saved.ledger.tasks['maze.review-request'].inference_records[0].verification_snapshot.output;
  assert.equal(output.program_source_chunks.join(''),JSON.stringify(independent));
  if(mode!=='invalid')assert.match(output.program_digest,/^sha256:[a-f0-9]{64}$/);
  if(mode==='disagreement')assert.equal(output.decision.verdict,'uncertain');
});
