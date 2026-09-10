export const miraiVersion='cancel-test';
let pending=null;
export function cancelAfterRequestReceived(){pending?.abort();}
export async function createParticipant({manifest}){
  return {async prepare(){},async update(){},async reset(){},async cancel(){},
    async execute(packet,context){
      const controller=new AbortController();
      if(manifest.id==='preabort')controller.abort();
      pending=controller;
      const timer=manifest.id==='preabort'?null:setTimeout(()=>controller.abort(),1500);
      try{
        await context.infer([{role:'user',content:'Return JSON.'}],{max_output_tokens:10,signal:controller.signal});
        return {status:'failed',value:null,trace:[]};
      }finally{pending=null;if(timer)clearTimeout(timer);}
    }
  };
}
