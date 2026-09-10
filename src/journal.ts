import {digest,fail} from './core.js';
import {validate} from './validate.js';
import type {RunState} from './runner.js';
import {evidenceKind} from './evidence-kind.js';
import {providerFailureCode} from './provider.js';

const keys=(value:any,names:string[])=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...names].sort().join())fail('journal_shape_invalid');
};
const amount=(value:any)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0)fail('journal_amount_invalid');};
export function verifyJournal(state:RunState):void{
  keys(state,['contract_version','config','config_digest','corpus_digest','isolation','evidence_kind','trials','calls','preparation_ms']);
  validate('TrialConfig',state.config);
  if(state.contract_version!=='1.0.0'||state.isolation!=='trusted_local'||state.config_digest!==digest(state.config)||!/^sha256:[a-f0-9]{64}$/.test(state.corpus_digest))fail('journal_binding_invalid');
  const label=evidenceKind(state.config);
  if(state.evidence_kind!==label)fail('journal_evidence_label_invalid');
  if(!Array.isArray(state.trials)||state.trials.length>20000||!Array.isArray(state.calls))fail('journal_inventory_invalid');
  const trials=new Map<string,RunState['trials'][number]>();
  for(const trial of state.trials){
    keys(trial,['id','group','participant','packet','status','output','reason','elapsed_ms']);
    validate('TaskPacket',trial.packet);
    if(!/^[a-f0-9]{64}$/.test(trial.group)||trial.id!==trial.group+'.'+trial.packet.phase||trials.has(trial.id)||!state.config.participants.some(p=>p.id===trial.participant))fail('journal_trial_binding_invalid');
    if(!['assigned','running','completed','failed','uncertain','blocked'].includes(trial.status))fail('journal_status_invalid');
    if(trial.elapsed_ms!==null)amount(trial.elapsed_ms);
    if(trial.reason!==null&&(typeof trial.reason!=='string'||!/^\w{1,100}$/.test(trial.reason)))fail('journal_reason_invalid');
    if(trial.output!==null)validate('TrialResult',trial.output);
    if(trial.status==='completed'&&trial.output===null)fail('journal_completed_output_missing');
    trials.set(trial.id,trial);
  }
  for(const call of state.calls){
    keys(call,['group','trial_id','phase','state','reserved','usage',...(Object.hasOwn(call,'failure_code')?['failure_code']:[])]);
    if(Object.hasOwn(call,'failure_code')&&(typeof call.failure_code!=='string'||providerFailureCode(new Error(call.failure_code))!==call.failure_code||call.state==='reserved'))fail('journal_failure_code_invalid');
    const trial=trials.get(call.trial_id);
    if(!trial||call.group!==trial.group||call.phase!==trial.packet.phase||!['reserved','settled','uncertain'].includes(call.state))fail('journal_call_binding_invalid');
    keys(call.reserved,['input_tokens','output_tokens','cost_usd']);
    for(const value of Object.values(call.reserved))amount(value);
    if(!Number.isSafeInteger(call.reserved.input_tokens)||!Number.isSafeInteger(call.reserved.output_tokens))fail('journal_token_invalid');
    if(call.usage!==null){validate('UsageReceipt',call.usage);if(call.usage.calls!==1)fail('journal_call_usage_invalid');}
    if(call.state==='settled'&&!call.usage)fail('journal_settled_usage_missing');
  }
  if(!state.preparation_ms||typeof state.preparation_ms!=='object'||Array.isArray(state.preparation_ms))fail('journal_preparation_invalid');
  for(const [group,value] of Object.entries(state.preparation_ms)){
    if(!state.trials.some(t=>t.group===group))fail('journal_preparation_binding_invalid');amount(value);
  }
}
