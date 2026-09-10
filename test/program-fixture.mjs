// Test-only compiler fixture. Parses parameters but never calculates a route.
export function proposedProgram(packet){
  const lines=packet.source_text.split('\n'),initial=Number(/x=(\d+)/.exec(lines[0])[1]);
  const literal=value=>({op:'literal',value}),ref=name=>({op:'ref',path:'state.'+(name==='x'?'value_x':name)});
  const field=name=>({op:'get',target:ref('operation'),key:name});
  const nodes=[];
  const call=(id,adapter,operation,args,result,next)=>nodes.push({id,kind:'call',target:{kind:'adapter',adapter,operation},args,result:result==='x'?'value_x':result,effects:['pure'],next});
  for(let layer=1;layer<=packet.length;layer++){
    const p=`l${layer}`;
    nodes.push({id:p,kind:'match',value:ref('branch'),cases:['L','C','R'].map(branch=>({equals:branch,to:p+branch})),default:'failed'});
    for(const branch of ['L','C','R']){
      const [,a,m,k]=/a=(\d+); m=(\d+); k=(\d+)/.exec(lines[5+(layer-1)*3+'LCR'.indexOf(branch)]);
      call(p+branch,'pure','identity',{value:literal({a:Number(a),m:Number(m),k:Number(k),node:`S${layer}${branch}`})},'operation',p+'before');
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
    call(p+'append','benchmark','append',{items:ref('trace'),value:ref('item')},'trace',layer===packet.length?'answer':`l${layer+1}`);
  }
  for(const status of ['completed','failed'])nodes.push({id:status==='completed'?'answer':'failed',kind:'return',values:{status:literal(status),value:ref(packet.goal==='left_count'?'left':'x'),trace:ref('trace')}});
  const itemType={kind:'record',fields:{node:'string',before:'int64',after:'int64',branch:'string'}};
  return {id:'program.fixture',version:'1.0.0',inputs:[],imports:[],entry:'l1',nodes,
    outputs:[{id:'status',type:'string'},{id:'value',type:'int64'},{id:'trace',type:{kind:'list',items:itemType}}],
    state:[...['x','left','before','remaining','route'].map(id=>({id:id==='x'?'value_x':id,type:'int64',default:id==='x'?initial:0})),{id:'branch',type:'string',default:'C'},
      {id:'operation',type:{kind:'record',fields:{a:'int64',m:'int64',k:'int64',node:'string'}},default:{a:0,m:1,k:1,node:'S1C'}},
      {id:'item',type:itemType,default:{node:'S1C',before:0,after:0,branch:'C'}},{id:'trace',type:{kind:'list',items:itemType},default:[]}],
    policies:{allowed_effects:['pure'],canonical_write_allowed:false,budgets:{max_steps:30000,max_iterations:10000,max_depth:4,max_parallel:1,max_duration_ms:30000}}};
}

// Recorded transport fixture only: reuse the first layer's control flow over
// all source parameters. No route or expected outcome is computed here.
export function compactProposedProgram(packet){
  const original=proposedProgram(packet),program=structuredClone(original);
  const table=original.nodes.filter(node=>/^l\d+[LCR]$/.test(node.id)).map(node=>node.args.value.value);
  program.nodes=program.nodes.filter(node=>/^l1(?:[A-Z]|[a-z])/.test(node.id)||['l1','answer','failed'].includes(node.id));
  const literal=value=>({op:'literal',value}),ref=id=>({op:'ref',path:'state.'+id});
  const call=(id,operation,args,result,next)=>({id,kind:'call',target:{kind:'adapter',adapter:'pure',operation},args,result,effects:['pure'],next});
  program.state.push({id:'offset',type:'int64',default:0},{id:'selected',type:'int64',default:0},
    {id:'steps',type:{kind:'list',items:original.state.find(item=>item.id==='operation').type},default:table});
  for(const [index,branch] of ['L','C','R'].entries()){
    const node=program.nodes.find(node=>node.id==='l1'+branch);
    Object.assign(node,call(node.id,'add_int64',{left:ref('offset'),right:literal(index)},'selected','read_record'));
  }
  program.nodes.find(node=>node.id==='l1append').next='advance';
  program.nodes.push(call('read_record','list_get',{value:ref('steps'),index:ref('selected')},'operation','l1before'),
    call('advance','add_int64',{left:ref('offset'),right:literal(3)},'offset','more'),
    {id:'more',kind:'branch',condition:{op:'lt',left:ref('offset'),right:literal(table.length)},then:'l1',else:'answer'});
  return program;
}
