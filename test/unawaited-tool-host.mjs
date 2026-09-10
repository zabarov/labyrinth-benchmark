// Deliberately invalid SDK host for runner safety tests; not a Mirai implementation.
export const miraiVersion='2.6.0-alpha.1';
export async function createParticipant(){
  return {async prepare(){},async update(){},async reset(){},async cancel(){},
    async execute(_packet,context){
      context.python('while True: pass').catch(()=>{});
      return {status:'failed',value:null,trace:[]};
    }};
}
