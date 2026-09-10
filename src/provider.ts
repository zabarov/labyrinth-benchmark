import type { Budget, ParticipantManifest, UsageReceipt } from './types.js';
import { fail } from './core.js';
import { validate } from './validate.js';

export function providerFailureCode(error:unknown):string {
  const code=error instanceof Error?error.message:'';
  const known=['provider_request_aborted','provider_transport_failed','provider_response_read_failed','provider_response_json_invalid',
    'provider_response_limit','provider_empty_response','provider_model_mismatch','unsupported_provider_response','provider_usage_invalid',
    'inference_scope_closed','actual_usage_exceeds_reservation','provider_output_incomplete','provider_response_lost'];
  return known.includes(code)||/^provider_http_error_[1-5][0-9]{2}(?:_[a-z0-9_]{1,64}){0,2}$/.test(code)?code:'provider_unclassified_error';
}

async function httpFailure(response:Response):Promise<never>{
  let suffix='';
  try{
    const text=await response.text();
    if(Buffer.byteLength(text,'utf8')<=65536){
      const body=JSON.parse(text),error=body?.error;
      const clean=(value:unknown)=>typeof value==='string'&&/^[a-z0-9_]{1,64}$/.test(value)?value:null;
      const details=[clean(error?.code),clean(error?.param)].filter(Boolean);
      if(details.length)suffix=`_${details.join('_')}`;
    }
  }catch{}
  return fail(`provider_http_error_${response.status}${suffix}`);
}

export function reservation(messages: {role:string;content:string}[], budget: Budget) {
  // UTF-8 bytes plus per-message framing is a deliberately conservative ceiling.
  const input = Buffer.byteLength(JSON.stringify(messages))*2 + 1024;
  if(input>budget.input_tokens)fail('input_budget_exceeded');
  const cost=budget.input_per_million!==null && budget.output_per_million!==null
    ? (input*budget.input_per_million+budget.output_tokens*budget.output_per_million)/1e6
    : budget.unknown_call_ceiling_usd;
  if(cost===null)fail('unknown_cost_ceiling_required');
  return {input_tokens:input,output_tokens:budget.output_tokens,cost_usd:cost!};
}
export async function invoke(manifest:ParticipantManifest,messages:{role:string;content:string}[],budget:Budget,signal:AbortSignal) {
  if(!manifest.endpoint || !manifest.model || !manifest.key_env)fail('provider_configuration_required');
  const url=new URL(manifest.endpoint!);
  if(url.username || url.password || url.search || url.hash || (url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))))fail('unsafe_provider_endpoint');
  const key=process.env[manifest.key_env!]; if(!key)fail('provider_credential_unavailable');
  const reasoning=manifest.api_dialect==='chat_completions_reasoning';
  if(!reasoning&&manifest.reasoning_effort!==undefined)fail('reasoning_dialect_required');
  const parameters=reasoning?{max_completion_tokens:budget.output_tokens,reasoning_effort:manifest.reasoning_effort??'none',service_tier:'default'}:{temperature:0,max_tokens:budget.output_tokens};
  const response=await fetch(url,{method:'POST',redirect:'error',signal,
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
    body:JSON.stringify({model:manifest.model,messages,...parameters,stream:false,store:false,response_format:{type:'json_object'}})})
    .catch(()=>fail(signal.aborted?'provider_request_aborted':'provider_transport_failed'));
  if(!response.ok)return httpFailure(response);
  let bytes=0;const chunks:Uint8Array[]=[];
  if(!response.body)fail('provider_empty_response');
  try{for await(const chunk of response.body!){bytes+=chunk.length;if(bytes>4*1024*1024)fail('provider_response_limit');chunks.push(chunk);}}
  catch(error){fail(signal.aborted?'provider_request_aborted':bytes>4*1024*1024?'provider_response_limit':'provider_response_read_failed');}
  let body:any;
  try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('provider_response_json_invalid');}
  if(!body||typeof body!=='object'||Array.isArray(body))fail('unsupported_provider_response');
  if(body.model!==manifest.model)fail('provider_model_mismatch');
  if(body.choices?.length!==1 || !['stop','length'].includes(body.choices[0].finish_reason) || typeof body.choices[0].message?.content!=='string')fail('unsupported_provider_response');
  const input=body.usage?.prompt_tokens??null, output=body.usage?.completion_tokens??null;
  const cost=typeof input==='number' && typeof output==='number' && budget.input_per_million!==null && budget.output_per_million!==null
    ? (input*budget.input_per_million+output*budget.output_per_million)/1e6:null;
  const usage:UsageReceipt={calls:1,input_tokens:input,output_tokens:output,cost_usd:cost,provider_version:typeof body.system_fingerprint==='string'?body.system_fingerprint:null};
  try{validate('UsageReceipt',usage);}catch{fail('provider_usage_invalid');}
  return {text:body.choices[0].message.content as string,usage,finish_reason:body.choices[0].finish_reason as 'stop'|'length'};
}
