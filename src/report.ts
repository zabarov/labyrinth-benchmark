import { join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { atomicJSON, readJSON, digest, fail } from './core.js';
import { score } from './evaluate.js';
import { validate } from './validate.js';
import { verifyJournal } from './journal.js';
import { plan, type RunState } from './runner.js';

export async function evaluateRun(root:string){
  const state:RunState=await readJSON(join(root,'run.json'));
  verifyJournal(state);
  if(digest(state.config)!==state.config_digest)fail('run_binding_mismatch');
  const allocation=await plan(state.config);
  if(state.corpus_digest!==allocation.corpus_digest || digest(state.trials.map(t=>({id:t.id,packet:t.packet})))!==digest(allocation.trials.map(t=>({id:t.id,packet:t.packet}))))fail('evaluation_allocation_mismatch');
  const rows: Array<{id:string;group:string;participant:string;length:number;phase:string;status:string;elapsed_ms:number|null} & Awaited<ReturnType<typeof score>>> = [];
  for(const t of state.trials) rows.push({id:t.id,group:t.group,participant:t.participant,length:t.packet.length,phase:t.packet.phase,
    status:t.status,elapsed_ms:t.elapsed_ms,...await score(t.packet,t.status==='completed'?t.output:null)});
  const totals={assigned:rows.length,exact:rows.filter(r=>r.exact_outcome).length,false_completion:rows.filter(r=>r.false_completion).length,unauthorized_disclosure:rows.filter(r=>r.unauthorized_disclosure).length};
  const usage={calls:state.calls.length,input_tokens:state.calls.some(c=>c.usage?.input_tokens==null)?null:state.calls.reduce((n,c)=>n+c.usage!.input_tokens!,0),
    output_tokens:state.calls.some(c=>c.usage?.output_tokens==null)?null:state.calls.reduce((n,c)=>n+c.usage!.output_tokens!,0),
    cost_usd:state.calls.some(c=>c.usage?.cost_usd==null)?null:state.calls.reduce((n,c)=>n+c.usage!.cost_usd!,0)};
  const groups=[...new Set(rows.map(r=>r.group))].map(group=>({group,preparation_ms:state.preparation_ms[group]??0,total_ms:rows.filter(r=>r.group===group).reduce((n,r)=>n+(r.elapsed_ms??0),state.preparation_ms[group]??0),
    cold_plus_unchanged_cost_usd:state.calls.filter(c=>c.group===group&&['cold','unchanged'].includes(c.phase)).some(c=>c.usage?.cost_usd==null)?null:state.calls.filter(c=>c.group===group&&['cold','unchanged'].includes(c.phase)).reduce((n,c)=>n+c.usage!.cost_usd!,0),
    cold_plus_unchanged_ms:rows.filter(r=>r.group===group&&['cold','unchanged'].includes(r.phase)).reduce((n,r)=>n+(r.elapsed_ms??0),state.preparation_ms[group]??0)}));
  const phase_usage=state.trials.map(trial=>{
    const calls=state.calls.filter(call=>call.trial_id===trial.id);
    return {trial_id:trial.id,phase:trial.packet.phase,calls:calls.length,
      input_tokens:calls.some(c=>c.usage?.input_tokens==null)?null:calls.reduce((n,c)=>n+c.usage!.input_tokens!,0),
      output_tokens:calls.some(c=>c.usage?.output_tokens==null)?null:calls.reduce((n,c)=>n+c.usage!.output_tokens!,0),
      cost_usd:calls.some(c=>c.usage?.cost_usd==null)?null:calls.reduce((n,c)=>n+c.usage!.cost_usd!,0)};
  });
  const body={contract_version:'1.0.0',benchmark_version:'0.1.0',config_digest:state.config_digest,corpus_digest:state.corpus_digest,
    evidence_kind:state.evidence_kind,review:'author_reported',isolation:state.isolation,totals,usage,rows,groups,phase_usage,
    limitations:['Fixed synthetic grammar; no arbitrary-document or population generalization.','Recorded results test the harness, not model quality.','Nested lengths and repeats are not independent tasks.','Trusted-local participants are not protected from a malicious host.','Adaptive routing is not implemented in v0.1.0.','No human review or independent reproduction is implied.']};
  const report={...body,digest:digest(body)};validate('EvaluationReport',report);await atomicJSON(join(root,'evaluation.json'),report);return report;
}
export async function reportRun(root:string,out:string){
  const report=await evaluateRun(root);await mkdir(out,{recursive:true});await atomicJSON(join(out,'report.json'),report);
  const text=['# Labyrinth Benchmark Report','',`Evidence: ${report.evidence_kind}. Review: author-reported.`,
    `Exact success: ${report.totals.exact}/${report.totals.assigned}. False completion: ${report.totals.false_completion}.`,
    `Unauthorized disclosure: ${report.totals.unauthorized_disclosure}.`,
    `Calls: ${report.usage.calls}. Cost USD: ${report.usage.cost_usd??'unknown'}.`,'',
    '| Participant | Length | Phase | State | Exact | Correct transitions | Latency ms |','|---|---:|---|---|---|---:|---:|',
    ...report.rows.map(r=>`| ${r.participant} | ${r.length} | ${r.phase} | ${r.status} | ${r.exact_outcome} | ${r.correct_transitions}/${r.required_transitions} | ${r.elapsed_ms??'unknown'} |`),
    '', '## Cold plus unchanged', '| Group | Total cost USD | Time including preparation ms |','|---|---:|---:|',
    ...report.groups.map(g=>`| ${g.group} | ${g.cold_plus_unchanged_cost_usd??'unknown'} | ${g.cold_plus_unchanged_ms} |`),
    '', '## Limitations',...report.limitations.map(l=>'- '+l),''].join('\n');
  await writeFile(join(out,'report.md'),text);return report;
}
export async function exportRun(root:string,out:string,metadataFile?:string){
  if(resolve(root)===resolve(out))fail('separate_export_directory_required');
  // Only evaluator-generated, bounded fields leave the private run directory.
  const state:RunState=await readJSON(join(root,'run.json'));
  let approved:any=null;
  if(metadataFile){
    approved=await readJSON(metadataFile);
    validate('PublicMetadata',approved);
    if(approved.config_digest!==state.config_digest||approved.participants.length!==state.config.participants.length)fail('public_metadata_binding_mismatch');
    for(const p of state.config.participants){const item=approved.participants.find((x:any)=>x.id===p.id);
      if(!item||item.model!==p.model||item.commit!==p.commit||item.version!==(p.version??null))fail('public_metadata_participant_mismatch');}
  }
  const report=await reportRun(root,out);
  const packets=state.trials.map(t=>t.packet);
  await atomicJSON(join(out,'synthetic-packets.json'),packets);
  await atomicJSON(join(out,'reproduction.json'),{contract_version:'1.0.0',benchmark_version:'0.1.0',config_digest:state.config_digest,
    corpus_digest:state.corpus_digest,track:state.config.track,mode:state.config.mode,routing:state.config.routing,
    seeds:state.config.seeds,lengths:state.config.lengths,repeats:state.config.repeats,
    participants:state.config.participants.map(p=>({id:p.id,kind:p.kind,memory:p.memory})),
    reproducibility:approved?'metadata_supplied_not_independently_reproduced':'incomplete_private_identifiers_withheld',
    approved_metadata:approved,budget:state.config.budget,
    notice:'Raw outputs, host paths, provider identifiers and credentials are excluded. Verify private run metadata before replication.'});
  return report;
}
