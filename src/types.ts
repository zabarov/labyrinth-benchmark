export type Phase = 'cold' | 'unchanged' | 'source_edit' | 'goal_change' | 'new_scope' | 'revoked_access';
export type Track = 'execution' | 'text_to_outcome' | 'memory_change';
export interface Transition { node: string; before: number; after: number; branch: string }
export interface Result { status: 'completed' | 'blocked' | 'failed'; value: number | null; trace: Transition[] }
export interface TaskPacket {
  contract_version: '1.0.0'; task_id: string; source_text: string; source_digest: string;
  goal: 'final_state' | 'left_count'; length: number; phase: Phase; scope: string;
  access: 'allowed' | 'revoked'; tools: string[];
  result_contract:'TrialResult@1.0.0';
  constraints:['full_trace_required','integer_state','revoked_access_no_disclosure'];
}
export interface ParticipantManifest {
  contract_version: '1.0.0'; id: string;
  kind: 'recorded' | 'openai' | 'process' | 'mirai';
  model: string | null; endpoint?: string; key_env?: string;
  command?: string[]; module?: string; version?: string;
  commit: string; memory: boolean;
  api_dialect?:'chat_completions'|'chat_completions_reasoning';
  reasoning_effort?:'none'|'low'|'medium'|'high';
}
export interface Budget {
  calls: number; input_tokens: number; output_tokens: number;
  cost_usd: number; deadline_ms: number;
  input_per_million: number | null; output_per_million: number | null;
  unknown_call_ceiling_usd: number | null;
}
export interface TrialConfig {
  contract_version: '1.0.0'; corpus: string; participants: ParticipantManifest[];
  track: Track; mode: 'system_bundle' | 'matched_tools'; repeats: number;
  lengths: number[]; seeds: string[]; budget: Budget;
  live: boolean; permitted_data: 'synthetic-only'; routing: 'fixed';
  sandbox_image?: string;
}
export interface UsageReceipt {
  calls: number; input_tokens: number | null; output_tokens: number | null;
  cost_usd: number | null; provider_version: string | null;
}
export interface ParticipantContext {
  signal: AbortSignal;
  budget?: Readonly<Budget>;
  infer(messages: {role: string; content: string}[], options?: {max_output_tokens?:number;signal?:AbortSignal}): Promise<{text: string; usage: UsageReceipt}>;
  python?(code: string): Promise<string>;
}
export interface Participant {
  prepare(): Promise<void>;
  execute(packet: TaskPacket, context: ParticipantContext, program?: ExecutionProgram): Promise<Result>;
  update(packet: TaskPacket): Promise<void>;
  reset(): Promise<void>;
  cancel(): Promise<void>;
}

export interface Instruction { id:string; add:number; multiply:number; repeat:number }
export interface ExecutionProgram { initial:number; length:number; nodes:Instruction[] }
