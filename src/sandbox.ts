import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fail } from './core.js';

export async function pythonSandbox(code: string, image: string, signal: AbortSignal): Promise<string> {
  if (!/^[a-zA-Z0-9_./:-]+@sha256:[a-f0-9]{64}$/.test(image)) fail('sandbox_image_digest_required');
  if (Buffer.byteLength(code) > 65536 || signal.aborted) fail('sandbox_input_rejected');
  const name = 'labyrinth-' + randomUUID();
  return new Promise((resolve,reject)=>{
    const child = spawn('docker',['run','--pull=never','--rm','--name',name,'--network=none','--read-only',
      '--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=32','--memory=128m','--cpus=1',
      '--user=65534:65534','--tmpfs=/tmp:rw,noexec,nosuid,size=8m','-i',image,'python','-I','-'],
      {env:{PATH:process.env.PATH},stdio:['pipe','pipe','pipe']});
    let output='', outputBytes=0, exceeded=false;
    let cleanupPromise:Promise<void>|undefined;
    const removeContainer=()=>cleanupPromise??=(new Promise<void>(done=>{
      const cleanup=spawn('docker',['rm','-f',name],{stdio:'ignore',env:{PATH:process.env.PATH}});
      const cleanupTimer=setTimeout(()=>{cleanup.kill();done();},5000);
      const finish=()=>{clearTimeout(cleanupTimer);done();};
      cleanup.on('error',finish);cleanup.on('close',finish);
    }));
    const stop=()=>{if(exceeded)return;exceeded=true;child.kill();void removeContainer();};
    const timer=setTimeout(stop,10000); signal.addEventListener('abort',stop,{once:true});
    child.on('error',()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(new Error('sandbox_unavailable'));});
    child.stdout.on('data',data=>{
      outputBytes+=data.length;
      if(outputBytes>1048576){stop();return;}
      if(!exceeded)output+=data;
    }); child.stderr.resume();
    child.on('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',stop);
      if(!exceeded && code===0){resolve(output);return;}
      // Killing the Docker client does not guarantee the container has stopped.
      void removeContainer().then(()=>reject(new Error('sandbox_failed')));
    });
    child.stdin.on('error',()=>{});child.stdin.end(code);
  });
}
