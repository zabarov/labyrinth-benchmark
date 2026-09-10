import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {executeMiraiBounded} from '../dist/mirai-execution.js';
import {compactProposedProgram} from './program-fixture.mjs';
import {generate} from '../dist/corpus.js';

test('worker preserves safe runtime code and failing node, never raw error or state',async()=>{
  const root=process.env.MIRAI_CANDIDATE_ROOT;
  const require=createRequire(join(root,'package.json'));
  const {compileProgramSource}=require('@zabarov/mirai/program');
  const candidate=compactProposedProgram(generate('runtime-diagnostic-fixture',10));
  candidate.nodes.find(node=>node.id==='l1record').result='trace';
  const compiled=compileProgramSource(JSON.stringify(candidate),'fixture.json').program;
  await assert.rejects(executeMiraiBounded(root,compiled,AbortSignal.timeout(10000)),
    error=>error.message==='mirai_execution_failed:state_type_mismatch:l1record:expected=list:actual=record');
});
