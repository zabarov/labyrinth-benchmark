import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareBlindReview} from '../dist/mirai-blind-review.js';

test('blind comparison checks every transition, not final value alone',()=>{
  const packet={length:2,goal:'final_state'};
  const result={status:'completed',value:3,trace:[{node:'a',before:0,after:1,branch:'L'},{node:'b',before:1,after:3,branch:'C'}]};
  assert.equal(compareBlindReview(JSON.stringify(result),result,packet).decision.verdict,'supported');
  const other=structuredClone(result);other.trace[0].branch='R';
  assert.equal(compareBlindReview(JSON.stringify(other),result,packet).decision.verdict,'uncertain');
  assert.deepEqual(compareBlindReview(JSON.stringify(other),result,packet).decision.uncertainty,['independent_reconstruction_disagreement:transition:0:branch']);
  for(const text of ['null','{',JSON.stringify({verdict:'supported',uncertainty:[]}),JSON.stringify({...result,trace:result.trace.slice(0,1)})]){
    assert.equal(compareBlindReview(text,result,packet).valid,false);
  }
  assert.equal(compareBlindReview('{"status":"failed","value":null,"trace":[]}',result,packet).decision.verdict,'uncertain');
  // Agreement is not truth: no source parser or evaluator is present here.
  assert.equal(compareBlindReview(JSON.stringify(other),other,packet).decision.verdict,'supported');
});
