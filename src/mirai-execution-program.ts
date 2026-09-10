import type {ExecutionProgram as Program} from './types.js';
import {fail} from './core.js';

/** Execution-track lowering only. No text parsing or route evaluation. */
export function lowerExecutionProgram(program:Program,goal:string):unknown {
  if(![10,100,1000].includes(program.length)||program.nodes.length!==program.length*3||!Number.isSafeInteger(program.initial)||program.initial<0||program.initial>=97)fail('execution_representation_invalid');
  const literal=(value:unknown)=>({op:'literal',value}),ref=(name:string)=>({op:'ref',path:'state.'+(name==='x'?'value_x':name)});
  const field=(name:string)=>({op:'get',target:ref('operation'),key:name});
  const nodes:any[]=[];
  const call=(id:string,adapter:string,operation:string,args:unknown,result:string,next:string)=>nodes.push({id,kind:'call',target:{kind:'adapter',adapter,operation},args,result:result==='x'?'value_x':result,effects:['pure'],next});
  for(let layer=1;layer<=program.length;layer++){
    const p=`l${layer}`;
    nodes.push({id:p,kind:'match',value:ref('branch'),cases:['L','C','R'].map(branch=>({equals:branch,to:p+branch})),default:'failed'});
    for(const branch of ['L','C','R']){
      const operation=program.nodes[(layer-1)*3+'LCR'.indexOf(branch)];
      if(operation.id!==`S${layer}${branch}`||!Number.isSafeInteger(operation.add)||operation.add<1||operation.add>36||!Number.isSafeInteger(operation.multiply)||operation.multiply<1||operation.multiply>4||!Number.isSafeInteger(operation.repeat)||operation.repeat<1||operation.repeat>3)fail('execution_operation_invalid');
      call(p+branch,'pure','identity',{value:literal({a:operation.add,m:operation.multiply,k:operation.repeat,node:operation.id})},'operation',p+'before');
    }
    call(p+'before','pure','identity',{value:ref('x')},'before',p+'k');
    call(p+'k','pure','identity',{value:field('k')},'remaining',p+'add');
    call(p+'add','pure','add_int64',{left:ref('x'),right:field('a')},'x',p+'mul');
    call(p+'mul','benchmark','multiply',{left:ref('x'),right:field('m')},'x',p+'mod');
    call(p+'mod','benchmark','modulo',{left:ref('x'),right:literal(97)},'x',p+'dec');
    call(p+'dec','pure','add_int64',{left:ref('remaining'),right:literal(-1)},'remaining',p+'repeat');
    nodes.push({id:p+'repeat',kind:'branch',condition:{op:'gt',left:ref('remaining'),right:literal(0)},then:p+'add',else:p+'choose'});
    call(p+'choose','benchmark','modulo',{left:ref('x'),right:literal(3)},'route',p+'route');
    nodes.push({id:p+'route',kind:'match',value:ref('route'),cases:['L','C','R'].map((branch,i)=>({equals:i,to:p+'out'+branch})),default:'failed'});
    for(const branch of ['L','C','R'])call(p+'out'+branch,'pure','identity',{value:literal(branch)},'branch',branch==='L'?p+'left':p+'record');
    call(p+'left','pure','add_int64',{left:ref('left'),right:literal(1)},'left',p+'record');
    call(p+'record','benchmark','record',{node:field('node'),before:ref('before'),after:ref('x'),branch:ref('branch')},'item',p+'append');
    call(p+'append','benchmark','append',{items:ref('trace'),value:ref('item')},'trace',layer===program.length?'answer':`l${layer+1}`);
  }
  for(const status of ['completed','failed'])nodes.push({id:status==='completed'?'answer':'failed',kind:'return',values:{status:literal(status),value:ref(goal==='left_count'?'left':'x'),trace:ref('trace')}});
  const itemType={kind:'record',fields:{node:'string',before:'int64',after:'int64',branch:'string'}};
  return {id:'program.execution',version:'1.0.0',inputs:[],imports:[],entry:'l1',nodes,
    outputs:[{id:'status',type:'string'},{id:'value',type:'int64'},{id:'trace',type:{kind:'list',items:itemType}}],
    state:[...['x','left','before','remaining','route'].map(id=>({id:id==='x'?'value_x':id,type:'int64',default:id==='x'?program.initial:0})),{id:'branch',type:'string',default:'C'},
      {id:'operation',type:{kind:'record',fields:{a:'int64',m:'int64',k:'int64',node:'string'}},default:{a:0,m:1,k:1,node:'S1C'}},
      {id:'item',type:itemType,default:{node:'S1C',before:0,after:0,branch:'C'}},{id:'trace',type:{kind:'list',items:itemType},default:[]}],
    policies:{allowed_effects:['pure'],canonical_write_allowed:false,budgets:{max_steps:30000,max_iterations:10000,max_depth:4,max_parallel:1,max_duration_ms:30000}}};
}
