import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resultProtocolDefects} from '../dist/mirai-outcome.js';

test('correction localizes observed duplicate and continuity defects without a source oracle',()=>{
  const packet={length:2,goal:'final_state'};
  const value={status:'completed',value:9,trace:[{node:'first',before:1,after:2,branch:'L'},{node:'first',before:3,after:9,branch:'R'}]};
  const before=JSON.stringify(value),defects=resultProtocolDefects(value,packet);
  assert(defects.some(d=>d.code==='duplicate_node'&&d.row_index===1&&d.previous_index===0));
  assert(defects.some(d=>d.code==='state_discontinuity'&&d.row_index===1));
  assert(defects.some(d=>d.code==='goal_requires_valid_trace'));
  assert.equal(JSON.stringify(value),before);
  value.trace[1].node='second';value.trace[1].before=2;
  assert.deepEqual(resultProtocolDefects(value,packet),[],'coherent does not mean source-correct');
  assert(resultProtocolDefects(value,{...packet,goal:'left_count'}).some(d=>d.code==='goal_value_mismatch'));
});

test('malformed results produce bounded metadata rather than copied private content',()=>{
  for(const value of [null,{}, {status:'completed',trace:null},{trace:[null]}, {trace:['private untrusted content']}]){
    const diagnostics=resultProtocolDefects(value,{length:1,goal:'final_state'});
    assert(diagnostics.length>0);assert(!JSON.stringify(diagnostics).includes('private untrusted content'));
  }
});
