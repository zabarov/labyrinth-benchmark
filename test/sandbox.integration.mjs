import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pythonSandbox} from '../dist/sandbox.js';
test('isolated Python tool has no host mount or secrets',async()=>{
  const image=process.env.LABYRINTH_SANDBOX_IMAGE;
  assert.ok(image,'explicit locally available digest-pinned image required');
  const output=await pythonSandbox('import os,json\nprint(json.dumps({"uid":os.getuid(),"key":os.getenv("LABYRINTH_API_KEY"),"host":os.path.exists("/Users")}))',image,AbortSignal.timeout(15000));
  assert.deepEqual(JSON.parse(output),{uid:65534,key:null,host:false});
});

test('isolated Python cannot connect to the network or write the image',async()=>{
  const image=process.env.LABYRINTH_SANDBOX_IMAGE;
  assert.ok(image);
  const code=`import json,socket
result={}
try:
    socket.create_connection(('192.0.2.1',443),timeout=1)
    result['network']='allowed'
except OSError:
    result['network']='blocked'
try:
    open('/usr/local/lib/labyrinth-probe','w').write('probe')
    result['write']='allowed'
except OSError:
    result['write']='blocked'
print(json.dumps(result))`;
  const output=await pythonSandbox(code,image,AbortSignal.timeout(15000));
  assert.deepEqual(JSON.parse(output),{network:'blocked',write:'blocked'});
});

test('isolated Python fails closed on excessive output',async()=>{
  const image=process.env.LABYRINTH_SANDBOX_IMAGE;
  assert.ok(image);
  await assert.rejects(pythonSandbox("print('x' * 2000000)",image,AbortSignal.timeout(15000)),/sandbox_failed/);
});

test('isolated Python cannot read evaluator through relative or absolute paths',async()=>{
  const image=process.env.LABYRINTH_SANDBOX_IMAGE;
  assert.ok(image);
  const output=await pythonSandbox(`import json
results=[]
for path in ['../evaluator/text_oracle.py','/workspace/evaluator/text_oracle.py','/evaluator/text_oracle.py']:
    try:
        open(path).read()
        results.append('read')
    except OSError:
        results.append('unavailable')
print(json.dumps(results))`,image,AbortSignal.timeout(15000));
  assert.deepEqual(JSON.parse(output),['unavailable','unavailable','unavailable']);
});

test('isolated Python can be cancelled while executing',async()=>{
  const image=process.env.LABYRINTH_SANDBOX_IMAGE;
  assert.ok(image);
  const started=performance.now();
  await assert.rejects(pythonSandbox('while True: pass',image,AbortSignal.timeout(1500)),/sandbox_failed/);
  assert.ok(performance.now()-started<8000,'cancellation must terminate execution promptly');
});
