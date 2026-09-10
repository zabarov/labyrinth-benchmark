import type {TrialConfig,ParticipantManifest} from './types.js';

export function usesInference(participant:ParticipantManifest,config:TrialConfig):boolean {
  return participant.kind==='openai'||(participant.kind==='mirai'&&config.track!=='execution');
}
export function evidenceKind(config:TrialConfig):'recorded_harness'|'execution_harness'|'live_model'|'mixed' {
  const live=config.participants.filter(p=>usesInference(p,config)).length;
  if(live)return live===config.participants.length?'live_model':'mixed';
  return config.track==='execution'&&config.participants.some(p=>p.kind!=='recorded')?'execution_harness':'recorded_harness';
}
