import {mkdtemp,cp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

// Copy only distribution sources; never carry caches, recordings or credentials.
const root=await mkdtemp(join(tmpdir(),'labyrinth-clean-room-'));
const files=['package.json','package-lock.json','tsconfig.json','src','schemas','evaluator','test','scripts','examples','README.md','LICENSE','NOTICE'];
const checks=[];
try{
  for(const file of files)await cp(resolve(file),join(root,file),{recursive:true});
  const env={PATH:process.env.PATH,HOME:process.env.HOME,LABYRINTH_PYTHON:process.env.LABYRINTH_PYTHON};
  const run=(command,args)=>{
    const result=spawnSync(command,args,{cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
    if(result.status!==0)throw new Error(`clean_room_failed:${command}:${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    checks.push([command,...args].join(' '));
  };
  run(process.platform==='win32'?'npm.cmd':'npm',['ci','--ignore-scripts','--offline']);
  run(process.execPath,['node_modules/typescript/bin/tsc']);
  run(process.execPath,['--test','test/benchmark.test.mjs']);
  run(process.execPath,['dist/cli.js','corpus','generate','--config','examples/corpus.json','--out','output/corpus']);
  run(process.execPath,['dist/cli.js','corpus','verify','output/corpus']);
  run(process.execPath,['scripts/recorded-demo.mjs']);
  run(process.execPath,['dist/cli.js','run','--config','examples/offline.json','--out','output/demo']);
  run(process.execPath,['dist/cli.js','report','output/demo','--out','output/report']);
  run(process.execPath,['dist/cli.js','export','output/demo','--out','output/export']);
  const report=JSON.parse(await readFile(join(root,'output/report/report.json'),'utf8'));
  if(report.totals.exact!==6||report.totals.assigned!==6||report.evidence_kind!=='recorded_harness')throw new Error('clean_room_outcome_mismatch');
  console.log(JSON.stringify({status:'passed',node:process.version,platform:process.platform,checks,exact:6,assigned:6,live_calls:0},null,2));
}finally{await rm(root,{recursive:true,force:true});}
