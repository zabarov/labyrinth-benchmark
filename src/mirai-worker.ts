import {parentPort,workerData} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {primitives} from './mirai-primitives.js';
const require=createRequire(join(workerData.root,'package.json'));
const {executePure,DEFAULT_PURE_ADAPTERS,PureExecutionError}=require('@zabarov/mirai/runtime');
executePure(workerData.program,workerData.inputs??{}, {adapters:{...DEFAULT_PURE_ADAPTERS,benchmark:primitives}}).then((episode:unknown)=>parentPort!.postMessage({episode}),(error:unknown)=>{
  const known=['state_type_mismatch','output_type_mismatch','output_required','unknown_output','step_budget_exceeded',
    'duration_budget_exceeded','iteration_budget_exceeded','depth_budget_exceeded','adapter_operation_not_found','node_not_found','missing_terminal'];
  const failure=error as {code?:string;nodeId?:string;typeMismatch?:{expected?:string;actual?:string}};
  const code=error instanceof PureExecutionError&&known.includes(failure.code??'')?failure.code:null;
  const node=code&&typeof failure.nodeId==='string'&&/^[A-Za-z0-9_.-]{2,128}$/.test(failure.nodeId)&&
    workerData.program.nodes.some((item:{id:string})=>item.id===failure.nodeId)?failure.nodeId:null;
  // Do not transport exception messages, stacks, paths or state values.
  const types=['bool','boolean','string','int64','float64','number','decimal','bytes','timestamp','duration','enum','record','list','map','option','result','null','undefined','undeclared'];
  const mismatch=code==='state_type_mismatch'&&node&&types.includes(failure.typeMismatch?.expected??'')&&types.includes(failure.typeMismatch?.actual??'')
    ?`:expected=${failure.typeMismatch!.expected}:actual=${failure.typeMismatch!.actual}`:'';
  parentPort!.postMessage({error:'mirai_execution_failed'+(code?':'+code:'')+(node?':'+node:'')+mismatch});
});
