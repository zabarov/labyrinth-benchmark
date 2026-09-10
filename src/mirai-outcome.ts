import type {TaskPacket} from './types.js';

/** Describe observable contract violations, never expected source semantics. */
export function resultProtocolDefects(value:any,packet:Pick<TaskPacket,'length'|'goal'>){
  const defects:{criterion:string;code:string;row_index?:number;previous_index?:number;expected_count?:number;actual_count?:number}[]=[];
  if(value?.status!=='completed')defects.push({criterion:'status',code:'status_not_completed'});
  const trace=value?.trace;
  if(!Array.isArray(trace))defects.push({criterion:'trace',code:'trace_not_array'});
  else{
    if(trace.length!==packet.length)defects.push({criterion:'trace',code:'trace_length_mismatch',expected_count:packet.length,actual_count:trace.length});
    const visited=new Map<string,number>();
    for(let i=0;i<trace.length;i++){
      const row=trace[i];
      if(!row||typeof row.node!=='string'||row.node.length===0||!Number.isSafeInteger(row.before)||!Number.isSafeInteger(row.after)||!['L','C','R'].includes(row.branch))
        defects.push({criterion:'trace',code:'invalid_transition_fields',row_index:i});
      else{
        if(visited.has(row.node))defects.push({criterion:'trace',code:'duplicate_node',row_index:i,previous_index:visited.get(row.node)});
        else visited.set(row.node,i);
        if(i>0&&row.before!==trace[i-1]?.after)defects.push({criterion:'trace',code:'state_discontinuity',row_index:i});
      }
    }
  }
  const rowsValid=!defects.some(defect=>defect.criterion==='trace');
  if(!rowsValid)defects.push({criterion:'goal',code:'goal_requires_valid_trace'});
  else if(!Number.isSafeInteger(value?.value)||value.value!==(packet.goal==='final_state'?trace.at(-1)?.after:trace.filter((row:any)=>row.branch==='L').length))
    defects.push({criterion:'goal',code:'goal_value_mismatch'});
  return defects;
}

/** Protocol criteria only. Never imports a maze parser, expected route or evaluator. */
export function createMiraiResultReview(require:(id:string)=>any,packet:TaskPacket,authorize:()=>boolean,additionalCriteria:any[]=[]){
  packet=structuredClone(packet);
  const {digestValue:d}=require('@zabarov/mirai/core');
  const seal=(body:any)=>({...body,digest:d(body)});
  const criteria=[
    {id:'status',slot_id:'result',requirement:'Successful execution must return status completed.'},
    {id:'trace',slot_id:'result',requirement:`Return ${packet.length} ordered, integer transitions, with distinct node identifiers and L/C/R branches; adjacent states must agree.`},
    {id:'goal',slot_id:'result',requirement:packet.goal==='final_state'?'Return the final after state, not the number of branches.':'Return the number of L branches, not the final state.'}
  ];
  const contract=seal({contract_version:'1.0.0',id:'outcome.result-protocol',goal:JSON.stringify({goal:packet.goal,criteria:[...criteria,...additionalCriteria]}),
    scope:{purpose:'result_protocol',domains:['computation'],effect:'read_only'},outcome_kind:'protocol_conformance',
    required_slots:[{id:'result',label:'Executed result',value_type:'record',critical:true,acquisition:'operation',evidence_required:true,minimum_authority:'derived',freshness_required:'current'}],
    optional_slots:[],completion_policy:{allow_partial:false,all_critical_required:true},interaction_policy:{max_questions:1,ask_one_at_a_time:true},
    conflict_policy:{critical_conflict:'block',noncritical_conflict:'block'},template_authority:'ephemeral_read_only',execution_allowed:false,canonical_write_allowed:false});
  const configuration_digest=d({version:'protocol-admission.2',source:packet.source_digest,scope:packet.scope,contract:contract.digest,criteria});
  const admitted=new Set<string>();
  const review={configuration_digest,contract,
    resolve(request:any,result:any){
      if(!authorize()||packet.access!=='allowed')throw new Error('mirai_outcome_access_denied');
      const value=structuredClone(result.output),valueDigest=d(value);
      const item=seal({id:'evidence.executed',source_ref:'maze.execution',contract_digest:contract.digest,slot_id:'result',value_digest:valueDigest,
        admission_receipt_digest:d({configuration_digest,value_digest:valueDigest}),authority:'derived',freshness:'current',conflict_refs:[],authorized:true});
      const evidence=seal({contract_version:'1.0.0',snapshot_digest:packet.source_digest,policy_digest:configuration_digest,items:[item],partial:false,
        limitations:['Protocol consistency is not proof that arithmetic or routing matches the source; independent evaluation remains required.'],canonical_write_allowed:false});
      admitted.add(d({item:item.digest,evidence:evidence.digest}));
      const candidates=seal({contract_version:'1.0.0',id:'candidate.executed',contract_digest:contract.digest,provider:{id:'maze.executor'},
        input_digest:d(request.input),output_digest:valueDigest,candidates:[{id:'candidate.result',slot_id:'result',value,evidence_refs:[item.id],source_refs:[item.source_ref],provider_ref:'maze.executor'}],
        context:{purpose:'result_protocol',domains:['computation'],availability:'available',handoff_required:false},accepted:false,execution_allowed:false,content_is_untrusted_data:true,canonical_write_allowed:false});
      return {contract:structuredClone(contract),candidates,evidence};
    },
    verify_admission(item:any,evidence:any,candidateContract:any){
      return authorize()&&packet.access==='allowed'&&candidateContract.digest===contract.digest&&admitted.has(d({item:item.digest,evidence:evidence.digest}));
    },
    semantic:{criteria,verifier:{id:'maze.protocol-reviewer',configuration_digest,
      verify(request:any){
        if(!authorize())throw new Error('mirai_outcome_access_denied');
        const defects=resultProtocolDefects(request.value,packet).filter(defect=>defect.criterion===request.criterion.id);
        const supported=criteria.some(criterion=>criterion.id===request.criterion.id)&&defects.length===0;
        return seal({contract_version:'1.1.0',verifier_id:'maze.protocol-reviewer',request_digest:request.digest,criterion_id:request.criterion.id,
          evidence_refs:request.evidence_refs,verdict:supported?'supported':'contradicted',uncertainty:defects.slice(0,8).map(defect=>JSON.stringify(defect))});
      }
    }}
  };
  return review;
}
