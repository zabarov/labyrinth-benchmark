import {createMiraiComposition} from '../dist/mirai-composition.js';
export const miraiVersion='2.6.0-alpha.1';
export async function createParticipant({manifest,cwd}) {
  const root=process.env.LABYRINTH_MIRAI_ROOT,profile=process.env.LABYRINTH_MIRAI_PROFILE;
  if(!root||!profile)throw new Error('mirai_host_configuration_required');
  return createMiraiComposition(manifest,cwd,root,profile,{review:'source',refinement:true,review_strategy:'blind',repair_strategy:'scoped'});
}
