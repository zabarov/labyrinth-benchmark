import test from 'node:test';
import assert from 'node:assert/strict';
import {digest} from '../dist/core.js';
import {inspectJobAccounting} from '../source/audit-campaign-accounting.mjs';
import {assertFreshMazeSeed} from '../source/blind-smoke-history.mjs';
const seal=value=>{const {digest:old,...body}=value;return {...body,digest:digest(body)};};
const extension=value=>({value,digest:digest(value)});

function fixture(){
  const packet=digest('synthetic packet'),quote={cost_micro_usd:100000,input_tokens:1000,output_tokens:1000,model_calls:1};
  const record=seal({call_id:'plain.1',packet_digest:packet,model:'fake',answer:'{}',output_digest:digest('{}'),
    finish_reason:'stop',status:'completed',usage:{calls:1,input_tokens:10,output_tokens:10,cost_usd:0.00002},
    completion_accepted:false,canonical_write_allowed:false});
  const id=`trial.${digest({call_id:record.call_id,packet,model:record.model}).slice(7,31)}`;
  const state=seal({contract_version:'scientific-program-trial.1',status:'completed',packet_digest:packet,
    budget_state:extension({contract_version:'1.0.0',limits:quote,permission_digest:digest('fixture'),overrun:false,
      trials:{[id]:{status:'settled',quote,actual:{cost_micro_usd:20,input_tokens:10,output_tokens:10,model_calls:1},receipt_digest:record.digest}}}),
    transport_state:extension({records:[record]})});
  const job={status:'done',ceiling:1,ledger_digest:digest(state)};
  return {state,job,id};
}

test('scientific receipts settle against the native budget projection, not answer quality',()=>{
  const {state,job}=fixture();
  assert.deepEqual(inspectJobAccounting(job,state),{known:0.00002,held:0,unresolved:[],additional_full_job_reserve:0});
});

test('maze preparation accepts validated non-maze history but rejects a forged ledger',()=>{
  const {state,job}=fixture();
  assert.doesNotThrow(()=>assertFreshMazeSeed(job,state,'fresh-seed'));
  state.packet_digest=digest('tampered');
  assert.throws(()=>assertFreshMazeSeed(job,state,'fresh-seed'));
});

test('uncertain scientific call retains whole job reserve even with a saved response',()=>{
  const {state,job,id}=fixture();
  state.status='uncertain';state.budget_state.value.trials[id].status='uncertain';
  state.budget_state=extension(state.budget_state.value);
  const changed=seal(state),review=inspectJobAccounting({...job,ledger_digest:digest(changed)},changed);
  assert.equal(review.known,0);assert.equal(review.held,0.1);assert.equal(review.additional_full_job_reserve,0.9);
  assert.equal(review.unresolved.length,1);
});

test('uncertain root keeps the whole job ceiling even without unresolved call entries',()=>{
  for(const empty of [false,true]){
    const {state,job}=fixture();state.status='uncertain';
    if(empty){state.budget_state.value.trials={};state.transport_state.value.records=[];}
    state.budget_state=extension(state.budget_state.value);state.transport_state=extension(state.transport_state.value);
    const changed=seal(state),review=inspectJobAccounting({...job,ledger_digest:digest(changed)},changed);
    assert.equal(review.known+review.held+review.additional_full_job_reserve,job.ceiling);
  }
});

test('forged receipt, missing receipt and mismatched usage cannot reduce charges',()=>{
  for(const mutation of ['answer','usage','missing','overrun','status']){
    const {state,job,id}=fixture();
    if(mutation==='answer')state.transport_state.value.records[0].answer='changed';
    if(mutation==='usage')state.budget_state.value.trials[id].actual.cost_micro_usd=0;
    if(mutation==='missing')state.transport_state.value.records=[];
    if(mutation==='overrun')state.budget_state.value.overrun=true;
    if(mutation==='status')state.budget_state.value.trials[id].status='uncertain';
    state.transport_state=extension(state.transport_state.value);state.budget_state=extension(state.budget_state.value);
    const changed=seal(state);
    assert.throws(()=>inspectJobAccounting({...job,ledger_digest:digest(changed)},changed),/scientific_accounting_invalid/,mutation);
  }
});
