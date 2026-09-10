import {readdir,readFile,lstat,access} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const roots=['src','test','schemas','scripts','docs','examples','evaluator','.github'];
const files=['README.md','LICENSE','NOTICE','CONTRIBUTING.md','CHANGELOG.md','package.json','package-lock.json','tsconfig.json','.gitignore','.env.example'];
async function walk(relative){
  for(const name of (await readdir(join(root,relative))).sort()){
    const path=join(relative,name),stat=await lstat(join(root,path));
    if(stat.isSymbolicLink())throw new Error('source_symlink_rejected');
    if(stat.isDirectory())await walk(path);else files.push(path);
  }
}
for(const directory of roots)await walk(directory);
const records=[];
for(const file of files.sort()){
  const bytes=await readFile(join(root,file));
  records.push([file.replaceAll('\\','/'),createHash('sha256').update(bytes).digest('hex')]);
  if(file.endsWith('.md')){
    const text=bytes.toString('utf8');
    if(/[\u0400-\u04ff]/u.test(text))throw new Error('documentation_not_english:'+file);
    if(/\/Users\/|\/private\/tmp\/|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9]{20,}/.test(text))throw new Error('private_material_in_documentation:'+file);
    for(const match of text.matchAll(/\]\(([^\s)]+)\)/g)){
      const link=match[1];if(/^(?:https?:|mailto:|#)/.test(link))continue;
      await access(resolve(root,dirname(file),link.split('#')[0]));
    }
  }
}
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
if(pkg.version!=='0.1.0'||pkg.dependencies?.['@zabarov/mirai'])throw new Error('package_boundary_invalid');
console.log(JSON.stringify({status:'passed',files:records.length,source_digest:'sha256:'+createHash('sha256').update(JSON.stringify(records)).digest('hex'),checks:['English documentation','local links','documentation privacy patterns','no source symlinks','optional Mirai dependency','source inventory digest'],limitations:['Pattern checks are not an independent security review.','Untracked local source digest is not a release commit.']},null,2));
