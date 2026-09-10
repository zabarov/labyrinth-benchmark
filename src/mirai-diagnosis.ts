/** Source-bound diagnostic candidates, not semantic acceptance or executable code. */
export function admitMiraiDiagnosis(value:unknown,source:string,defects:readonly string[],artifacts:Readonly<Record<string,string>>={}){
  const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
  const fail=()=>{throw new Error('mirai_diagnosis_invalid');};
  if(!exact(value,['defects','source_spans','repairs']))fail();
  const candidate=structuredClone(value) as any;
  if(!Array.isArray(candidate.defects)||!candidate.defects.length||candidate.defects.length>16||
    new Set(candidate.defects).size!==candidate.defects.length||candidate.defects.length!==new Set(defects).size||candidate.defects.some((id:unknown)=>typeof id!=='string'||!defects.includes(id)))fail();
  if(!Array.isArray(candidate.source_spans)||!candidate.source_spans.length||candidate.source_spans.length>16)fail();
  const ids=new Set<string>();
  for(const span of candidate.source_spans){
    if(!span||typeof span!=='object'||Array.isArray(span))fail();
    const ref=Object.hasOwn(span,'source_ref')?span.source_ref:'source_text';
    if(!['source_text','candidate_program','compiler_diagnostic','operation_contract','language_reference','outcome_review'].includes(ref))fail();
    const text=ref==='source_text'?source:Object.hasOwn(artifacts,ref)?artifacts[ref]:undefined;
    if(typeof text!=='string')fail();
    delete span.source_ref;
    if(exact(span,['id','quote'])&&typeof span.quote==='string'&&span.quote.length>0){
      const start=text!.indexOf(span.quote);
      if(start<0||text!.indexOf(span.quote,start+1)!==-1)fail();
      span.start=start;span.end=start+span.quote.length;
    }
    if(!exact(span,['id','start','end','quote'])||typeof span.id!=='string'||!/^[a-z][a-z0-9_]{1,63}$/.test(span.id)||ids.has(span.id)||
      !Number.isSafeInteger(span.start)||!Number.isSafeInteger(span.end)||span.start<0||span.end<=span.start||span.end>text!.length||
      typeof span.quote!=='string'||span.quote.length>4000||text!.slice(span.start,span.end)!==span.quote)fail();
    if(ref!=='source_text')span.source_ref=ref;
    ids.add(span.id);
  }
  if(!Array.isArray(candidate.repairs)||!candidate.repairs.length||candidate.repairs.length>16)fail();
  for(const repair of candidate.repairs){
    if(!exact(repair,['defect','source_refs','change'])||!candidate.defects.includes(repair.defect)||
      !Array.isArray(repair.source_refs)||!repair.source_refs.length||new Set(repair.source_refs).size!==repair.source_refs.length||
      repair.source_refs.some((id:unknown)=>typeof id!=='string'||!ids.has(id))||typeof repair.change!=='string'||
      !repair.change.trim()||repair.change.length>2000)fail();
  }
  if(candidate.defects.some((id:string)=>!candidate.repairs.some((repair:any)=>repair.defect===id)))fail();
  return {candidate:structuredClone(candidate),source_binding_verified:true,semantic_acceptance:false,execution_allowed:false,canonical_write_allowed:false};
}
