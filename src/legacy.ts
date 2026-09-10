import { generate } from './corpus.js';
import { fail } from './core.js';
/** Exact historical public packet. The runner uses the new envelope separately. */
export function legacyPacket(family:number,length:number){
  if(!Number.isInteger(family)||family<1||family>10)fail('invalid_legacy_family');
  const p=generate(String(family),length,'cold','legacy-v1');
  return {contract_version:'1.0.0',task_id:`maze.${family}.${length}.original.final_state`,source_text:p.source_text,source_digest:p.source_digest,
    goal:'Return the final integer x after every mandatory layer.',
    result_contract:{status:['completed','blocked','failed'],value:'integer_or_null',trace:'ordered_node_before_after_branch_records'},
    external_tools:[],execution_authorized:false};
}
