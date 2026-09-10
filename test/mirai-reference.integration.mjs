import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {miraiSourceReference} from '../dist/mirai-source-reference.js';
import {executeMiraiBounded} from '../dist/mirai-execution.js';

test('documented match compares raw JSON values, not evaluated equals expressions',async()=>{
  const root=process.env.MIRAI_CANDIDATE_ROOT;
  const require=createRequire(join(root,'package.json'));
  const {MIRAI_PROGRAM_SCHEMA,compileProgramSource}=require('@zabarov/mirai/program');
  const reference=miraiSourceReference(MIRAI_PROGRAM_SCHEMA);
  for(const [equals,expected] of [['standard',7],[{op:'literal',value:'standard'},0]]){
    const source={...reference.example,entry:'select',nodes:[
      {id:'select',kind:'match',value:{op:'literal',value:'standard'},cases:[{equals,to:'selected'}],default:'other'},
      {id:'selected',kind:'return',values:{sum:{op:'literal',value:7}}},
      {id:'other',kind:'return',values:{sum:{op:'literal',value:0}}}
    ]};
    const compiled=compileProgramSource(JSON.stringify(source),'reference-match.json').program;
    const episode=await executeMiraiBounded(root,compiled,AbortSignal.timeout(10000));
    assert.equal(episode.outputs.sum,expected);
  }
  assert.match(reference.notes.join(' '),/Each equals is raw JSON data, not an expression/);
});
