const acorn=require('acorn');const fs=require('fs');const {execFileSync}=require('node:child_process');
const sources=JSON.parse(execFileSync('python',['tools/extract_chinese_sources.py'],{maxBuffer:100*1024*1024}));
const files=sources.scripts;
const pairs={}, conflict={}, missing=[],assigns={};
function val(n){if(!n)return; if(n.type==='Literal')return n.value;if(n.type==='ArrayExpression'){const a=n.elements.map(val);return a.every(x=>x!==undefined)?a:undefined;} }
function key(p){return p.key?.name??p.key?.value;}
function add(a,b,src){if(typeof a!=='string'||typeof b!=='string'||!/[a-zA-Z]/.test(a)||!/[\u4e00-\u9fff]/.test(b)||a.includes('%')||b.includes('%'))return;if(pairs[a]&&pairs[a]!==b){(conflict[a]??=new Set([pairs[a]])).add(b);return;}pairs[a]=b;}
function walk(n,file,path=[]){if(!n||typeof n!=='object')return;
 if(n.type==='AssignmentExpression' && n.operator==='='){const lhs=files[file].slice(n.left.start,n.left.end);assigns[lhs]=n.right;walk(n.right,file,[file,lhs]);return;}
 if(n.type==='ObjectExpression'){
  if(path.at(-1)?.endsWith('_cn_name')) for(const p of n.properties) add(key(p),val(p.value),file);
  const ps=n.properties.filter(p=>p.type==='Property');const props=Object.fromEntries(ps.map(p=>[key(p),p]));
  const name=val(props.cn_name?.value);if(name){add(path.at(-1),name,file);for(const k of ['name','label','item'])add(val(props[k]?.value),name,file);}
  for(const p of ps){const k=key(p); if(typeof k!=='string')continue;
   if(k.endsWith('_cn_name')){const base=k.slice(0,-8);const a=val(props['sub '+base]?.value)||val(props[base]?.value),b=val(p.value);if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length)a.forEach((x,i)=>add(x,b[i],file));}
   if(['label','name'].includes(k)){const v=val(p.value);if(typeof v==='string'&&/[A-Za-z]/.test(v)&&!/[\u4e00-\u9fff]/.test(v))missing.push({file,path:path.join('.'),field:k,value:v,cn:name});}
   if(k.startsWith('sub ')){const a=val(p.value);if(Array.isArray(a))for(const v of a)missing.push({file,path:path.join('.'),field:k,value:v,cn:!!props[k.slice(4)+'_cn_name']});}
   walk(p.value,file,[...path,k]);
  }return;
 }
 for(const [k,v] of Object.entries(n)){if(['start','end'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>walk(x,file,path));else if(v&&typeof v==='object')walk(v,file,path);}
}
for(const [f,s] of Object.entries(files)){try{walk(acorn.parse(s,{ecmaVersion:'latest',allowReturnOutsideFunction:true}),f,[f]);}catch(e){throw Error('Cannot audit '+f+': '+e.message);}}
for(const [lhs,n] of Object.entries(assigns)){if(!lhs.endsWith('_cn_name'))continue;const a=val(assigns[lhs.slice(0,-8)]),b=val(n);if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length)a.forEach((x,i)=>add(x,b[i]));}
for(const k of Object.keys(conflict))delete pairs[k];

const base='tools/chinese_supplement/';
const ui=JSON.parse(fs.readFileSync(base+'ui.json'));
const shopping=JSON.parse(fs.readFileSync(base+'shopping.json'));
const terms=JSON.parse(fs.readFileSync(base+'terms.json'));
const known=new Set([...Object.keys(pairs),...Object.keys(shopping),...Object.keys(terms),...Object.keys(ui.labels),...Object.keys(ui.activities),...Object.values(ui.options).flatMap(Object.keys),...ui.preserve].map(x=>x.toLowerCase()));
const excludedFiles=['sponsors.js','update_vars.js','init.js','people.js'];
const unresolved=missing.filter(x=>!excludedFiles.includes(x.file)&&!x.cn&&typeof x.value==='string'&&x.value.length>1&&/[A-Za-z]{2}/.test(x.value)&&!x.value.includes('%')&&!known.has(x.value.toLowerCase()));
const literalControls={};
for(const [name,source] of Object.entries(sources.passages)){
 for(const match of source.matchAll(/<<(?:link(?:replace|append|prepend)?|button|option)\s+"([^"\n]+)"/g)){
  const value=match[1];if(/^[\$_]/.test(value)||value.includes('<<')||/[\u4e00-\u9fff]/.test(value)||!/[A-Za-z]{2}/.test(value)||known.has(value.toLowerCase()))continue;
  (literalControls[value]??=[]).push(name);
 }
}
const output=JSON.stringify(pairs,null,2);
if(process.argv.includes('--write'))fs.writeFileSync(base+'metadata.json',output);
else if(fs.readFileSync(base+'metadata.json','utf8')!==output)throw Error('Metadata dictionary differs; rebuild with --write');
const report={game:'0.8.5e',scripts:Object.keys(files).length,passages:Object.keys(sources.passages).length,metadataCaptions:Object.keys(pairs).length,ambiguousCaptionsExcluded:Object.keys(conflict).length,displayFieldsInspected:missing.length,unresolvedDisplayFields:unresolved,residualLiteralControls:literalControls,preservedBrands:ui.preserve,excludedFields:'Player input, NPC names, sponsors, legacy migration names and placeholder templates; original identifiers and save data are never renamed.'};
fs.writeFileSync('chinese-ui-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,unresolvedDisplayFields:unresolved.length,residualLiteralControls:Object.keys(literalControls).length}));
if(unresolved.length||Object.keys(literalControls).length)throw Error('UI audit found untranslated controls; see chinese-ui-audit.json');
