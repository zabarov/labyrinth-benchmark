export const sourceNodeKinds=['call','branch','match','return'] as const;
export const sourceReferenceTransport='reference-object.1';

export function decodeMiraiSourceReference(chunks:string[]){
  const value=JSON.parse(chunks.join(''));
  if(!value||typeof value!=='object'||Array.isArray(value)||!value.schema||!Array.isArray(value.notes)||!value.example||!value.table_example)
    throw new Error('mirai_language_reference_invalid');
  return value;
}

/** Task-independent authoring aid; the installed public compiler remains authoritative. */
export function miraiSourceReference(irSchema:Record<string,any>,mode:'full'|'compact'='full'){
  if(mode!=='full'&&mode!=='compact')throw new Error('mirai_reference_mode_invalid');
  const schema=structuredClone(irSchema);
  schema.title='Mirai Program authored source';
  schema.required=(schema.required??[]).filter((key:string)=>!['digest','source_map','contract_version','error_routes'].includes(key));
  schema.properties={...schema.properties,digest:false,source_map:false};
  for(const key of ['inputs','imports'])if(schema.properties[key])schema.properties[key]={...schema.properties[key],maxItems:0};
  const node=schema.$defs?.node;
  if(node){
    node.properties.kind.enum=[...sourceNodeKinds];
    node.allOf=(node.allOf??[]).filter((rule:any)=>sourceNodeKinds.includes(rule.if?.properties?.kind?.const));
    const allowed=new Set(['id','kind','next','target','args','result','effects','on_error','condition','then','else','value','cases','default','values']);
    node.properties=Object.fromEntries(Object.entries(node.properties).filter(([key])=>allowed.has(key)));
    const target=node.properties.target;
    if(target?.oneOf)node.properties.target=target.oneOf.find((variant:any)=>variant.properties?.kind?.const==='adapter');
    if(node.properties.effects?.items)node.properties.effects.items={const:'pure'};
    // Retain only reachable definitions; do not send unavailable language features as context.
    const needed=new Set<string>();
    const visit=(value:any):void=>{
      if(!value||typeof value!=='object')return;
      if(typeof value.$ref==='string'&&value.$ref.startsWith('#/$defs/')){
        const key=value.$ref.slice('#/$defs/'.length);
        if(!needed.has(key)&&schema.$defs[key]){needed.add(key);visit(schema.$defs[key]);}
      }
      for(const child of Object.values(value))visit(child);
    };
    const {$defs,...root}=schema;visit(root);
    schema.$defs=Object.fromEntries(Object.entries($defs).filter(([key])=>needed.has(key)));
  }
  const example={
    contract_version:'1.0.0',id:'reference.addition',version:'1.0.0',imports:[],inputs:[],
    outputs:[{id:'sum',type:'int64'}],state:[{id:'total',type:'int64',default:0}],entry:'add',
    nodes:[
      {id:'add',kind:'call',target:{kind:'adapter',adapter:'pure',operation:'add_int64'},args:{left:{op:'literal',value:7},right:{op:'literal',value:8}},result:'total',effects:['pure'],next:'done'},
      {id:'done',kind:'return',values:{sum:{op:'ref',path:'state.total'}}}
    ],
    policies:{allowed_effects:['pure'],canonical_write_allowed:false,budgets:{max_steps:10,max_depth:1,max_iterations:1,max_parallel:1,max_duration_ms:1000}}
  };
  const lit=(value:unknown)=>({op:'literal',value}),ref=(id:string)=>({op:'ref',path:`state.${id}`});
  const tableExample={id:'reference.inventory',version:'1.0.0',inputs:[],imports:[],entry:'check',
    outputs:[{id:'sum',type:'int64'}],state:[{id:'prices',type:{kind:'list',items:'int64'},default:[7,11,19]},
      ...['index','selected','total'].map(id=>({id,type:'int64',default:0}))],
    nodes:[
      {id:'check',kind:'branch',condition:{op:'lt',left:ref('index'),right:lit(3)},then:'lookup',else:'done'},
      {id:'lookup',kind:'call',target:{kind:'adapter',adapter:'pure',operation:'list_get'},args:{value:ref('prices'),index:ref('index')},result:'selected',effects:['pure'],next:'add'},
      {id:'add',kind:'call',target:{kind:'adapter',adapter:'pure',operation:'add_int64'},args:{left:ref('total'),right:ref('selected')},result:'total',effects:['pure'],next:'advance'},
      {id:'advance',kind:'call',target:{kind:'adapter',adapter:'pure',operation:'add_int64'},args:{left:ref('index'),right:lit(1)},result:'index',effects:['pure'],next:'check'},
      {id:'done',kind:'return',values:{sum:ref('total')}}],
    policies:{allowed_effects:['pure'],canonical_write_allowed:false,budgets:{max_steps:20,max_depth:1,max_iterations:5,max_parallel:1,max_duration_ms:1000}}};
  if(mode==='compact'){
    const recordType={kind:'record',fields:{price:'int64'}};
    const recordTable=structuredClone(tableExample) as any;
    recordTable.id='reference.record_inventory';
    recordTable.state.find((slot:any)=>slot.id==='prices').type={kind:'list',items:recordType};
    recordTable.state.find((slot:any)=>slot.id==='prices').default=[{price:7},{price:11},{price:19}];
    recordTable.state.find((slot:any)=>slot.id==='selected').type=recordType;
    recordTable.state.find((slot:any)=>slot.id==='selected').default={price:0};
    recordTable.nodes.find((node:any)=>node.id==='add').args.right={op:'get',target:ref('selected'),key:'price'};
    return {schema:{type:'object',required:['id','version','outputs','state','entry','nodes','policies']},
      notes:[
        'Return one direct authored Mirai Program JSON object, not a program_source wrapper or JSON string. The installed compiler owns digest/source_map: never emit them. This is an authoring guide, not the complete validation schema.',
        'inputs and imports must be empty arrays. Each state slot has id,type,default; each output has id,type. Types: string, boolean, int64, {kind:"list",items:TYPE}, {kind:"record",fields:{FIELD:TYPE}}. IDs have at least two characters. Declare all intermediate state slots.',
        'Expressions: {op:"literal",value:DATA}, {op:"ref",path:"state.SLOT"}, {op:"get",target:EXPR,key:"FIELD"}; comparisons {op:"eq"|"ne"|"lt"|"lte"|"gt"|"gte",left:EXPR,right:EXPR}. get requires a RECORD, never an entire list. Read a list element using pure.list_get into a record slot, then get its field as in record_inventory. Do not overwrite a slot with another record shape.',
        'call: {id,kind:"call",target:{kind:"adapter",adapter,operation},args:{ARG:EXPR},result:"SLOT",effects:["pure"],next:"NODE"}. Arithmetic is an adapter call, not an expression operator. Available pure adapters: identity(value), add_int64(left,right), length(value), list_get(value,index). Available benchmark adapters: multiply(left,right), modulo(left,right), record(flat named expression args), append(items,value).',
        'branch: {id,kind:"branch",condition:EXPR,then:"NODE",else:"NODE"}. match: {id,kind:"match",value:EXPR,cases:[{equals:RAW_VALUE,to:"NODE"}],default:"NODE"}. equals is raw data, not a literal expression. return: {id,kind:"return",values:{OUTPUT:EXPR}}. Supply every output on every return.',
        'Only call, branch, match, return; loops use explicit bounded back-edges. Every entry/target must exist. Prefer a data table and reusable loop rather than copied instructions. The inventory example is unrelated syntax, not this task or its algorithm.',
        'policies: allowed_effects:["pure"],canonical_write_allowed:false,budgets:{max_steps<=30000,max_iterations<=10000,max_depth<=4,max_parallel:1,max_duration_ms<=30000}. These bounds do not authorize omitted steps, invented data or early success.'
      ],example,table_example:recordTable};
  }
  return {schema,notes:[
    'This is the host-authorized subset of Mirai Program, not a replacement language. Use only call, branch, match and return. Loops use branch back-edges as in the inventory example. Subprogram calls, foreach, parallel, imports and external inputs are unavailable in this participant.',
    'Author JSON source, not sealed IR. Omit digest and source_map; the compiler generates them. Never guess a checksum.',
    'Declare each mutable slot in state with id, type and default. Reference it as {op:"ref",path:"state.slot"}; call.result is the bare slot id.',
    'Identifiers must contain at least two characters. A text variable named x can use a state slot named current_value. Declare intermediate slots before referencing them.',
    'benchmark.record accepts flat args: {label:{op:"literal",value:"example"},amount:{op:"ref",path:"state.total"}}. There is no named wrapper. Each arg value is an expression. benchmark.append takes items and value expressions and returns the updated list.',
    'Use kind:"call" with target:{kind:"adapter",adapter:"pure",operation:"add_int64"}, args containing expressions, effects:["pure"], result and next.',
    'Expressions are literal, ref, get, eq, ne, lt, lte, gt, gte, and, or, in, not, coalesce. Arithmetic uses adapter calls, not invented expression operators.',
    'Prefer one bounded reusable control-flow loop and typed data tables over copying the same instructions for every row. pure.list_get(value,index) reads an array element at a zero-based integer index and fails outside its bounds. Store repeated data in a list, then use get for record fields. The inventory example is generic syntax, not task data or a prepared algorithm for this task.',
    'A branch uses condition, then and else. A match uses value as an expression, cases:[{equals:"standard",to:"done"}], and default. Each equals is raw JSON data, not an expression: use equals:"standard", never equals:{op:"literal",value:"standard"} to match a string. There is no node kind named program.',
    'Return a complete executable graph, not a skeleton: entry and every next, then, else, cases[].to and default must name an existing node. Implement each target and every required state update. Do not output placeholders or assume a missing node will be generated later.',
    'A return node uses values:{outputId:expression}; declare all output slots and supply them on every return.',
    'The example only demonstrates addition syntax; it is not a solution to the task. Build the actual operations and control flow from the supplied text.',
    'Host limits: max_steps<=30000, max_iterations<=10000, max_depth<=4, max_parallel=1, max_duration_ms<=30000. Do not invent imports, capabilities or external effects.'
  ],example,table_example:tableExample};
}
