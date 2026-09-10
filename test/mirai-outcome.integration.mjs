import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {generate} from '../dist/corpus.js';
import {createMiraiResultReview} from '../dist/mirai-outcome.js';

test('native Outcome admission rejects protocol false completion without reading the oracle',()=>{
  const require=createRequire(join(process.env.MIRAI_CANDIDATE_ROOT,'package.json'));
  const {digestValue:d}=require('@zabarov/mirai/core');
  const {assessOutcome}=require('@zabarov/mirai/outcome');
  const {verifyOutcomeSemantics}=require('@zabarov/mirai/cognition');
  const packet=generate('outcome-regression',10);
  // This deliberately does not claim that the fabricated arithmetic matches
  // the source. Protocol admission and independent correctness are distinct.
  const trace=Array.from({length:10},(_,i)=>({node:`node.${i}`,before:i,after:i+1,branch:'L'}));
  const review=createMiraiResultReview(require,packet,()=>true);
  const evaluate=output=>{
    const input={source_digest:packet.source_digest,goal:packet.goal};
    const bindings=review.resolve({input},{output,evidence:[]});
    const assessment=assessOutcome(bindings.contract,bindings.candidates,bindings.evidence,review.verify_admission);
    return verifyOutcomeSemantics(assessment,'maze.executor',review.semantic.criteria,review.semantic.verifier);
  };
  assert.equal(evaluate({status:'completed',value:10,trace}).accepted,true);
  assert.equal(evaluate({status:'ok',value:10,trace}).accepted,false);
  assert.equal(evaluate({status:'completed',value:4,trace}).accepted,false);
  assert.equal(evaluate({status:'completed',value:10,trace:trace.slice(0,1)}).accepted,false);
  assert.equal(evaluate({status:'completed',value:10,trace:trace.map((row,i)=>i===5?{...row,before:99}:row)}).accepted,false);
  assert.equal(evaluate({status:'completed',value:10,trace:trace.map(row=>({...row,branch:'invented'}))}).accepted,false);
  const revoked=createMiraiResultReview(require,packet,()=>false);
  assert.throws(()=>revoked.resolve({input:{}},{output:{},evidence:[]}),/access/);
  const frozen=review.contract.digest;
  packet.goal='left_count';packet.length=100;
  assert.equal(review.contract.digest,frozen);
  assert.match(d(review.contract),/^sha256:/);
});
