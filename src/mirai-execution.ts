import {Worker} from 'node:worker_threads';
export async function executeMiraiBounded(root:string,program:unknown,signal:AbortSignal,inputs:Record<string,unknown>={}):Promise<any>{
  if(signal.aborted)throw new Error('mirai_execution_cancelled');
  const worker=new Worker(new URL('./mirai-worker.js',import.meta.url),{workerData:{root,program,inputs},env:{},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:32}});
  try{return await new Promise((resolve,reject)=>{
    const cancel=()=>reject(new Error('mirai_execution_cancelled'));
    const timer=setTimeout(()=>reject(new Error('mirai_execution_deadline')),30000);
    signal.addEventListener('abort',cancel,{once:true});
    const clear=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);};
    worker.once('message',message=>{clear();message.error?reject(new Error(
      typeof message.error==='string'&&/^mirai_execution_failed(?::[a-z_]{2,64}(?::[A-Za-z0-9_.-]{2,128})?)?(?::expected=(?:bool|boolean|string|int64|float64|number|decimal|bytes|timestamp|duration|enum|record|list|map|option|result|null|undefined|undeclared):actual=(?:bool|boolean|string|int64|float64|number|decimal|bytes|timestamp|duration|enum|record|list|map|option|result|null|undefined|undeclared))?$/.test(message.error)
        ?message.error:'mirai_execution_failed')):resolve(message.episode);});
    worker.once('error',()=>{clear();reject(new Error('mirai_execution_failed'));});
    worker.once('exit',()=>{clear();reject(new Error('mirai_execution_stopped'));});
  });}finally{await worker.terminate();}
}
