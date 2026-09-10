import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { executeMiraiBounded } from '../dist/mirai-execution.js';

test('bounded worker passes typed inputs without mutation or cross-run state', async () => {
  const root = process.env.MIRAI_CANDIDATE_ROOT;
  assert(root, 'explicit native checkout required');
  const require = createRequire(join(root, 'package.json'));
  const { compileProgramSource } = require('@zabarov/mirai/program');
  const program = compileProgramSource(JSON.stringify({contract_version:'1.0.0',id:'test.input',version:'1.0.0',imports:[],
    inputs:[{id:'value',type:'int64',required:true}],outputs:[{id:'value',type:'int64',required:true}],state:[],
    nodes:[{id:'done',kind:'return',values:{value:{op:'ref',path:'input.value'}}}],entry:'done',error_routes:[],
    policies:{budgets:{max_steps:4,max_depth:2,max_iterations:1,max_parallel:1,max_duration_ms:1000},allowed_effects:['pure'],canonical_write_allowed:false}
  }), 'typed-input.json').program;
  for (const value of [2, 7, -1]) {
    const input = Object.freeze({value});
    const episode = await executeMiraiBounded(root, program, AbortSignal.timeout(10000), input);
    assert.equal(episode.outputs.value, value);
    assert.deepEqual(input, {value});
  }
  await assert.rejects(executeMiraiBounded(root, program, AbortSignal.timeout(10000), {value:'private-invalid-input'}), error => {
    assert(!String(error).includes('private-invalid-input'));
    return true;
  });
  await assert.rejects(executeMiraiBounded(root, program, AbortSignal.timeout(10000)));
});
