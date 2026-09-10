#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { readJSON, digest, fail } from './core.js';
import { writeCorpus, loadCorpus, oracle, independentOracle } from './corpus.js';
import { plan, run } from './runner.js';
import { validate } from './validate.js';
import { evaluateRun, reportRun, exportRun } from './report.js';

async function main(){
  const {positionals:p,values:v}=parseArgs({allowPositionals:true,options:{config:{type:'string'},out:{type:'string'},metadata:{type:'string'},live:{type:'boolean'}}});
  const required=(s:string|undefined)=>s??fail('missing_argument');
  let result:unknown;
  if(p[0]==='corpus'&&p[1]==='generate'){
    const c=await readJSON(required(v.config));await writeCorpus(required(v.out),c.seeds,c.lengths,c.version);result={status:'generated'};
  }else if(p[0]==='corpus'&&p[1]==='verify'){
    const packets=await loadCorpus(required(p[2]));for(const packet of packets)if(digest(oracle(packet))!==digest(await independentOracle(packet)))fail('oracle_disagreement');result={status:'verified',cases:packets.length};
  }else if(p[0]==='participant'&&p[1]==='validate'){validate('ParticipantManifest',await readJSON(required(p[2])));result={status:'schema_valid',live_readiness:'not_checked'};
  }else if(p[0]==='run'){
    const c=await readJSON(required(v.config));result=p[1]==='plan'?await plan(c):await run(c,required(v.out),v.live);
    if(p[1]!=='plan')result={status:'finished',directory:resolve(required(v.out))};
    else {const {trials,...summary}=result as any;result={...summary,configuration_digest:digest(c)};}
  }else if(p[0]==='resume'){
    const root=required(p[1]),saved=await readJSON(join(root,'run.json'));await run(saved.config,root,v.live,true);result={status:'finished'};
  }else if(p[0]==='evaluate')result=await evaluateRun(required(p[1]));
  else if(p[0]==='report')result=await reportRun(required(p[1]),required(v.out));
  else if(p[0]==='export')result=await exportRun(required(p[1]),required(v.out),v.metadata);
  else fail('usage: corpus generate|verify; participant validate; run plan|run; resume; evaluate; report; export');
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
main().catch(error=>{const message=error instanceof Error?error.message:'';
  process.stderr.write(JSON.stringify({error:/^[a-zA-Z0-9_ :;|]+$/.test(message)?message:'operation_failed'})+'\n');process.exitCode=1;});
