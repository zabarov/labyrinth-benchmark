import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceReviewDecision} from '../dist/mirai-source-review.js';

test('settled malformed source review is sanitized and cannot become supported',()=>{
  for(const text of ['null','[]','true','"supported"','{',
    '{"verdict":"supported","uncertainty":[],"approval":true}',
    '{"verdict":"supported","uncertainty":["not checked"]}',
    '{"verdict":"supported","uncertainty":"private payload"}',
    JSON.stringify({verdict:'uncertain',uncertainty:['x'.repeat(1801)]})]){
    assert.deepEqual(parseSourceReviewDecision(text),{valid:false,decision:{verdict:'uncertain',uncertainty:['source_review_transport_invalid']}});
  }
  for(const decision of [{verdict:'supported',uncertainty:[]},{verdict:'contradicted',uncertainty:['Rule mismatch']},{verdict:'uncertain',uncertainty:[]}]){
    assert.deepEqual(parseSourceReviewDecision(JSON.stringify(decision)),{valid:true,decision});
  }
});
