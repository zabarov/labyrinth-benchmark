// Evaluator-side fixture generation, never a live participant or model packet.
import {loadCorpus,oracle} from '../dist/corpus.js';
import {atomicJSON} from '../dist/core.js';
const packets=await loadCorpus('output/corpus');
await atomicJSON('output/recordings.json',Object.fromEntries(packets.map(p=>[p.task_id,oracle(p)])));
console.log('Recorded harness fixtures written. These are NOT live model results.');
