import { mkdir, rmdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { atomicJSON, digest, fail, readJSON } from './core.js';
import { phases, loadCorpus, parseText, independentOracle, oracle } from './corpus.js';
import { validate } from './validate.js';
import { createParticipant } from './participants.js';
import { reservation, invoke, providerFailureCode } from './provider.js';
import { pythonSandbox } from './sandbox.js';
import { verifyJournal } from './journal.js';
import {evidenceKind,usesInference} from './evidence-kind.js';
import type { TrialConfig, ParticipantManifest, TaskPacket, Result, UsageReceipt } from './types.js';

export interface Trial {
  id:string; group:string; participant:string; packet:TaskPacket;
  status:'assigned'|'running'|'completed'|'failed'|'uncertain'|'blocked';
  output:Result|null; reason:string|null; elapsed_ms:number|null;
}
interface CallRecord { group:string; trial_id:string; phase:string; state:'reserved'|'settled'|'uncertain'; reserved:{input_tokens:number;output_tokens:number;cost_usd:number}; usage:UsageReceipt|null; failure_code?:string }
export interface RunState {
  contract_version:'1.0.0'; config:TrialConfig; config_digest:string; corpus_digest:string;
  isolation:'trusted_local'; evidence_kind:ReturnType<typeof evidenceKind>;
  trials:Trial[]; calls:CallRecord[];
  preparation_ms:Record<string,number>;
}
export async function plan(config:TrialConfig) {
  validate('TrialConfig',config);
  if(new Set(config.participants.map(p=>p.id)).size!==config.participants.length)fail('duplicate_participant');
  if(config.participants.some(p=>p.kind==='process') && config.live)fail('live_process_requires_host_inference_bridge');
  if(config.mode==='matched_tools' && (!config.sandbox_image || config.participants.some(p=>!['openai','mirai'].includes(p.kind))))fail('matched_tools_requires_host_participants_and_pinned_sandbox');
  const packets=await loadCorpus(resolve(config.corpus));
  const trials:Trial[]=[];
  for(const participant of config.participants)for(const seed of config.seeds)for(const length of config.lengths)for(let repeat=0;repeat<config.repeats;repeat++){
    const group=digest({participant:participant.id,seed,length,repeat}).slice(7);
    for(const phase of config.track==='memory_change'?phases:['cold'] as const){
      const packet=packets.find(p=>p.task_id.split('.').slice(1,2)[0]===seed && p.length===length && p.phase===phase);
      if(!packet)fail('missing_corpus_case');
      const copy=structuredClone(packet!);copy.tools=config.mode==='matched_tools'?['python']:[];
      trials.push({id:`${group}.${phase}`,group,participant:participant.id,packet:copy,status:'assigned',output:null,reason:null,elapsed_ms:null});
    }
  }
  if(trials.length>20000)fail('allocation_limit');
  return {trials,corpus_digest:digest(packets),assigned_trials:trials.length,
    maximum_calls:new Set(trials.map(t=>t.group)).size*config.budget.calls,
    maximum_cost_usd:new Set(trials.map(t=>t.group)).size*config.budget.cost_usd};
}

export async function run(config:TrialConfig,root:string,live=false,resume=false):Promise<RunState>{
  const allocation=await plan(config);
  const hasLive=config.participants.some(p=>usesInference(p,config));
  if(hasLive && (!config.live || !live || config.budget.cost_usd<=0))fail('live_approval_required');
  if(!hasLive && config.live)fail('live_label_without_live_participant');
  if(config.mode==='matched_tools') await pythonSandbox('print("sandbox-ready")',config.sandbox_image!,AbortSignal.timeout(15000));
  root=resolve(root);
  if(!resume){await mkdir(root,{recursive:true});if((await readdir(root)).length)fail('run_directory_not_empty');}
  const lock=join(root,'.writer-lock');
  await mkdir(lock).catch(()=>fail('run_locked_manual_reconciliation_required'));
  let state:RunState;
  try{
    state=resume?await readJSON(join(root,'run.json')):{contract_version:'1.0.0',config:structuredClone(config),config_digest:digest(config),
      corpus_digest:allocation.corpus_digest,isolation:'trusted_local',evidence_kind:evidenceKind(config),trials:allocation.trials,calls:[],preparation_ms:{}};
    verifyJournal(state);
    if(state.config_digest!==digest(config)||state.corpus_digest!==allocation.corpus_digest)fail('resume_binding_mismatch');
    if(digest(state.trials.map(t=>({id:t.id,group:t.group,participant:t.participant,packet:t.packet})))!==digest(allocation.trials.map(t=>({id:t.id,group:t.group,participant:t.participant,packet:t.packet}))))fail('resume_allocation_mismatch');
    let writing=Promise.resolve();
    const persist=()=>{const snapshot=structuredClone(state);writing=writing.then(()=>atomicJSON(join(root,'run.json'),snapshot));return writing;};
    await persist();
    // Validate all unique text inputs before handing any of them to a participant.
    const checked=new Set<string>();
    for(const trial of state.trials){const key=digest(trial.packet);if(!checked.has(key)){
      if(digest(oracle(trial.packet))!==digest(await independentOracle(trial.packet)))fail('oracle_disagreement');checked.add(key);
    }}
    for(const group of new Set(state.trials.map(t=>t.group))){
      const trials=state.trials.filter(t=>t.group===group);
      if(trials.every(t=>t.status!=='assigned'&&t.status!=='running'))continue;
      if(resume && (trials.some(t=>t.status!=='assigned')||state.calls.some(c=>c.group===group))){
        for(const trial of trials)if(trial.status==='running'||trial.status==='assigned'){
          trial.status=trial.status==='running'?'uncertain':'blocked';trial.reason='session_reconciliation_required';
        }
        for(const call of state.calls)if(call.group===group&&call.state==='reserved')call.state='uncertain';
        await persist();continue;
      }
      const manifest=config.participants.find(p=>p.id===trials[0].participant)!;
      const working=join(root,'participants',group);await mkdir(working,{recursive:true});
      let participant;
      try{participant=await createParticipant(manifest,working);}catch{
        for(const trial of trials){trial.status='blocked';trial.reason=manifest.kind==='mirai'?'mirai_incompatible_host_bridge':'participant_unavailable';}await persist();continue;
      }
      const controller=new AbortController();const deadline=setTimeout(()=>controller.abort(),config.budget.deadline_ms);
      let activeTrial: Trial | null = null;
      const pendingCalls = new Set<Promise<unknown>>();
      const pendingTools = new Set<Promise<unknown>>();
      let serial=Promise.resolve();
      const saveCall=async(messages:{role:string;content:string}[],owner:Trial,options?:{max_output_tokens?:number;signal?:AbortSignal})=>{
        let unlock!:()=>void;const before=serial;serial=new Promise<void>(r=>unlock=r);await before;
        let record:CallRecord;
        try{
          if(controller.signal.aborted || options?.signal?.aborted || activeTrial !== owner)fail('inference_scope_closed');
          const previous=state.calls.filter(c=>c.group===group);
          if(previous.some(c=>c.state==='uncertain')||previous.length>=config.budget.calls)fail('call_budget_exceeded');
          const used=previous.reduce((sum,c)=>({input:sum.input+(c.usage?.input_tokens??c.reserved.input_tokens),output:sum.output+(c.usage?.output_tokens??c.reserved.output_tokens),cost:sum.cost+(c.usage?.cost_usd??c.reserved.cost_usd)}),{input:0,output:0,cost:0});
          const remaining={...config.budget,input_tokens:config.budget.input_tokens-used.input,output_tokens:config.budget.output_tokens-used.output};
          if(options?.max_output_tokens!==undefined){
            if(!Number.isSafeInteger(options.max_output_tokens)||options.max_output_tokens<=0)fail('invalid_output_ceiling');
            remaining.output_tokens=Math.min(remaining.output_tokens,options.max_output_tokens);
          }
          if(remaining.output_tokens<=0)fail('token_budget_exceeded');
          const reserved=reservation(messages,remaining);
          if(used.cost+reserved.cost_usd>config.budget.cost_usd)fail('cost_budget_exceeded');
          record={group,trial_id:owner.id,phase:owner.packet.phase,state:'reserved',reserved,usage:null};state.calls.push(record);await persist();
        }finally{unlock();}
        try{
          const signal=options?.signal?AbortSignal.any([controller.signal,options.signal]):controller.signal;
          const response=await invoke(manifest,messages,{...config.budget,output_tokens:record!.reserved.output_tokens},signal);
          if(signal.aborted)fail('inference_scope_closed');
          record!.usage=response.usage;
          if((response.usage.input_tokens??record!.reserved.input_tokens)>record!.reserved.input_tokens || (response.usage.output_tokens??record!.reserved.output_tokens)>record!.reserved.output_tokens || (response.usage.cost_usd??record!.reserved.cost_usd)>record!.reserved.cost_usd){record!.state='uncertain';await persist();fail('actual_usage_exceeds_reservation');}
          record!.state='settled';await persist();
          if(response.finish_reason!=='stop')fail('provider_output_incomplete');
          return response;
        }catch(e){if(record!.state!=='settled')record!.state='uncertain';record!.failure_code=providerFailureCode(e);await persist();throw e;}
      };
      const bounded=<T>(promise:Promise<T>)=>new Promise<T>((resolve,reject)=>{
        const abort=()=>reject(new Error('deadline_exceeded'));
        if(controller.signal.aborted){abort();return;}
        controller.signal.addEventListener('abort',abort,{once:true});
        promise.then(resolve,reject).finally(()=>controller.signal.removeEventListener('abort',abort));
      });
      try{
        const preparationStarted=performance.now();
        await bounded(participant.prepare());
        state.preparation_ms[group]=performance.now()-preparationStarted;
        for(const trial of trials){
          if(controller.signal.aborted || state.calls.some(c=>c.group===group&&c.state==='uncertain')){
            trial.status='blocked';trial.reason='root_stopped';await persist();continue;
          }
          trial.status='running';await persist();const started=performance.now();
          activeTrial=trial;
          let toolCalls=0;
          try{
            if(!manifest.memory || trial.packet.phase==='new_scope' || trial.packet.access==='revoked')await bounded(participant.reset());
            await bounded(participant.update(structuredClone(trial.packet)));
            const program=config.track==='execution' && trial.packet.access==='allowed'?parseText(trial.packet.source_text):undefined;
            const result=await bounded(participant.execute(structuredClone(trial.packet),{signal:controller.signal,budget:Object.freeze(structuredClone(config.budget)),
              infer:(messages,options)=>{
                if(!live||!usesInference(manifest,config))fail('inference_not_authorized');
                if(options?.signal!==undefined&&!(options.signal instanceof AbortSignal))fail('invalid_inference_signal');
                // AbortSignal is a live cancellation handle, not cloneable task data.
                const call=saveCall(structuredClone(messages),trial,options?{max_output_tokens:options.max_output_tokens,signal:options.signal}:undefined);
                pendingCalls.add(call);
                call.then(()=>pendingCalls.delete(call),()=>pendingCalls.delete(call));
                return call;
              },
              ...(config.mode==='matched_tools'?{python:(code:string)=>{
                if(controller.signal.aborted||activeTrial!==trial)fail('tool_scope_closed');
                if(pendingTools.size||toolCalls>=8)fail('tool_budget_exceeded');
                toolCalls++;
                const call=pythonSandbox(code,config.sandbox_image!,controller.signal);
                pendingTools.add(call);
                call.then(()=>pendingTools.delete(call),()=>pendingTools.delete(call));
                return call;
              }}:{})},program));
            if(pendingCalls.size)fail('unawaited_inference');
            if(pendingTools.size)fail('unawaited_tool');
            validate('TrialResult',result);trial.output=structuredClone(result);trial.status='completed';
          }catch{
            trial.status=controller.signal.aborted||state.calls.some(c=>c.group===group&&c.state==='uncertain')?'uncertain':'failed';trial.reason=trial.status==='uncertain'?'execution_uncertain':'participant_failed';
          }
          activeTrial=null;
          if(pendingCalls.size){controller.abort();await Promise.allSettled([...pendingCalls]);trial.status='uncertain';trial.output=null;trial.reason='unawaited_inference';}
          if(pendingTools.size){controller.abort();await Promise.allSettled([...pendingTools]);trial.status='uncertain';trial.output=null;trial.reason='unawaited_tool';}
          trial.elapsed_ms=performance.now()-started;await persist();
        }
      }catch{for(const trial of trials)if(trial.status==='assigned'||trial.status==='running'){trial.status='blocked';trial.reason='participant_setup_failed';}await persist();}
      finally{activeTrial=null;clearTimeout(deadline);controller.abort();await Promise.allSettled([...pendingCalls,...pendingTools]);await Promise.race([participant.cancel(),new Promise(r=>setTimeout(r,1000))]);}
    }
    await persist();return state;
  }finally{await rmdir(lock);}
}
