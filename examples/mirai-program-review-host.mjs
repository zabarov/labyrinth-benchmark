import {createMiraiComposition} from '../dist/mirai-composition.js';
export const miraiVersion='2.6.0-alpha.1';
export async function createParticipant({manifest,cwd}){
  const root=process.env.LABYRINTH_MIRAI_ROOT,profile=process.env.LABYRINTH_MIRAI_PROFILE;
  if(!root||!profile)throw new Error('mirai_host_configuration_required');
  return createMiraiComposition(manifest,cwd,root,profile,{review:'source',review_strategy:'program',
    refinement:true,semantic_refinement:true,source_transport:'direct_json',fragments:true,candidate_revision:true});
}
