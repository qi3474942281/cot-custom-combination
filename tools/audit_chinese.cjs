const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const server=spawn('python',['-m','http.server','8765','--directory',path.dirname(process.cwd())],{stdio:'ignore'});
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 try {
  const p=await b.newPage(); p.on('dialog',d=>d.dismiss());
  await p.goto('http://127.0.0.1:8765/cot-custom-combination/vanilla/game.html');
  await p.waitForFunction(()=>window.SugarCube?.State?.passage,null,{timeout:120000});
  await p.evaluate(()=>SugarCube.Wikifier.wikifyEval(`<<script>>
   const cache=window.modSC2DataManager.getSC2DataInfoAfterPatch();
   window.__audit={housing:setup.Housing, dictionaries:{},passages:cache.passageDataItems.items.filter(p=>/^(Housing|PhoneMain|Inventory$|CharacterStats|ShopWidgets|OptionsWidget|SaveOptions)/.test(p.name)).map(p=>({name:p.name,content:p.content})),setupKeys:Object.keys(setup)};
   for(const key of Object.keys(setup)){
     const v=setup[key]; if(!v || typeof v!=='object' || Array.isArray(v))continue;
     const rows=[];
     for(const [k,x] of Object.entries(v)){
       if(x&&typeof x==='object'&&typeof x.name==='string')rows.push({key:k,name:x.name,cn_name:x.cn_name});
     }
     if(rows.length)window.__audit.dictionaries[key]=rows;
   }
  <</script>>`));
  const result=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__audit)));
  fs.writeFileSync('chinese-audit.json',JSON.stringify(result,null,2));
  console.log('Audited',result.passages.length,'passages and',Object.keys(result.dictionaries).length,'display dictionaries');
 }finally{await b.close();server.kill();}
})().catch(e=>{console.error(e);server.kill();process.exit(1)});
