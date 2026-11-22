/* Isolated synthetic data only; never accesses a player's browser or save. */
const {chromium, webkit, devices} = require('playwright');
const {spawn} = require('node:child_process');
const path = require('node:path'), fs = require('node:fs');
const assert = require('node:assert/strict');
const server = spawn('python', ['-m','http.server','8765','--directory',path.dirname(process.cwd())], {stdio:'ignore'});
const root='http://127.0.0.1:8765/cot-custom-combination/', results=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(page,url) {
  await page.goto(url);
  await page.waitForFunction(()=>window.SugarCube?.State?.passage && window.SugarCube?.Story?.has('StoryInit'), null, {timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#passages .passage'), null, {timeout:30000});
}
async function storyScript(page,source) {
  await page.evaluate(source => SugarCube.Wikifier.wikifyEval('<<script>>'+source+'<</script>>'),source);
  return page.evaluate(()=>window.__result);
}
async function run(browserType, name) {
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({...devices['iPhone 13'], acceptDownloads:true});
  const page=await context.newPage();
  try {
    await page.goto(root+'backup.html');
    await page.evaluate(async()=>{
      localStorage.setItem('cot-test-sentinel','old-settings');
      await new Promise((resolve,reject)=>{
        const r=indexedDB.open('ModLoader_IndexDBLoader',1);
        r.onupgradeneeded=()=>r.result.createObjectStore('ModLoader_IndexDBLoader');
        r.onerror=()=>reject(r.error);
        r.onsuccess=()=>{
          const db=r.result,tx=db.transaction('ModLoader_IndexDBLoader','readwrite'),s=tx.objectStore('ModLoader_IndexDBLoader');
          s.put(JSON.stringify(['CustomTest.mod.zip','NPCVisualization.mod.zip']),'CoTmodDataIndexDBZipList');
          s.put(new Uint8Array([80,75,3,4]),'CoTmodDataIndexDBZip:CustomTest.mod.zip');
          s.put(new Uint8Array([9,8,7]),'CoTmodDataIndexDBZip:NPCVisualization.mod.zip');
          tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
        };
      });
    });
    await page.route('**/vanilla/game.html*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Boundary</title>'}));
    await page.goto(root+'vanilla/index.html');
    await page.waitForURL('**/vanilla/game.html*',{timeout:120000});
    await page.goto(root+'backup.html');
    const preserved=await page.evaluate(async()=>{
      const snap=await CoTBackup.read();
      const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('ModLoader_IndexDBLoader',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
      const list=await new Promise((resolve,reject)=>{const q=db.transaction('ModLoader_IndexDBLoader').objectStore('ModLoader_IndexDBLoader').get('CoTmodDataIndexDBZipList');q.onsuccess=()=>resolve(JSON.parse(q.result));q.onerror=()=>reject(q.error);});
      db.close();
      localStorage.setItem('cot-test-sentinel','new-settings');
      await CoTBackup.ensure();
      const repeated=await CoTBackup.read();
      return {current:localStorage.getItem('cot-test-sentinel'),old:snap.localStorage['cot-test-sentinel'],repeat:repeated.localStorage['cot-test-sentinel'],list,oldBytes:Array.from(snap.modCache.find(r=>r[0]==='CoTmodDataIndexDBZip:NPCVisualization.mod.zip')[1])};
    });
    assert.equal(preserved.old,'old-settings');assert.equal(preserved.repeat,'old-settings');
    assert.equal(preserved.current,'new-settings');assert.deepEqual(preserved.oldBytes,[9,8,7]);
    assert(preserved.list.includes('CustomTest.mod.zip'));
    assert(preserved.list.indexOf('CoTTextHotfix.mod.zip')===preserved.list.indexOf('ModI18N.mod.zip')+1);
    await page.getByRole('button',{name:'下载升级前备份'}).click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已准备下载'));
    results.push({engine:name,test:'immutable backup, custom mods, old bookmark gate, export',pass:true});
    await page.route('**/mods/ModI18N.mod.zip*',route=>route.fulfill({status:503,body:'test failure'}));
    await page.goto(root+'auto-load.html');
    await page.waitForFunction(()=>document.querySelector('#msg').textContent.includes('HTTP 503'));
    assert(!page.url().includes('game.html'));
    await context.close();
    const fresh=await browser.newContext({...devices['iPhone 13']});
    const p=await fresh.newPage(), errors=[];
    p.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
    p.on('console',m=>{if(m.type()==='error')console.log('GAME ERROR',m.text().slice(0,400));});
    await p.route('**/modList.json',route=>route.fulfill({contentType:'application/json',body:'[]'}));
    await boot(p,root+'.compat-old/vanilla/index.html');
    const old=await storyScript(p,"idb.active=false; Config.saves.isAllowed=()=>true; window.__result={id:Config.saves.id, saved:Save.slots.save(0),slot:Save.slots.get(0)};");
    assert.equal(old.saved,true);assert(old.slot);
    const oldStorage=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
    await p.unroute('**/modList.json');
    await boot(p,root+'index.html');
    const now=await storyScript(p,`
      window.__result={
        id:Config.saves.id, version:Config.saves.version, slot:Save.slots.get(0),
        player:Story.has('PlayerPortrait'),
        caption:Story.get('StoryCaption').text.includes('include "PlayerPortrait"'),
        character:Story.get('Character').text.includes('include "PlayerPortrait"'),
        npc:Story.get('DisplayNPC').text.includes('mes-portrait-large'),
        social:Story.get('SocialWidgets').text.includes('mes-portrait-small'),
        sms:Story.get('EventPhoneMailGiftResult').text.includes('<<<dalterneed'),
        brokenIf:Story.get('EventSmashersShootSuperheroDom4').text.includes('<<</if>>')
      };
    `);
    assert.equal(now.id,old.id);assert(now.slot);assert.equal(now.slot.date,old.slot.date);
    assert(now.player && now.caption && now.character && now.npc && now.social);
    assert(!now.sms && !now.brokenIf);assert(String(now.version).includes('0.8.5'));
    const backedUp=await p.evaluate(async()=>{
      const s=document.createElement('script');s.src='../save-backup.js';
      document.head.appendChild(s);await new Promise((r,j)=>{s.onload=r;s.onerror=j;});
      return (await CoTBackup.read()).localStorage;
    });
    for(const [key,value] of Object.entries(oldStorage)) assert.equal(backedUp[key],value,'Old save backup changed: '+key);
    const portrait=await storyScript(p,`
      State.variables.people ||= {}; State.variables.niches ||= {}; State.variables.virginity ||= {};
      State.variables.pc=setup.check_revive(JSON.parse(JSON.stringify(setup.store_class(new Person({person:'PC'})))));
      const host=document.createElement('div');host.id='portrait-test';document.body.appendChild(host);
      new Wikifier(host,'<<include "PlayerPortrait">>');
      window.__result={images:host.querySelectorAll('img').length,errors:[...host.querySelectorAll('.error')].map(n=>n.textContent)};
    `);
    assert(portrait.images>0);assert.deepEqual(portrait.errors,[]);
    await p.waitForFunction(()=>[...document.querySelectorAll('#portrait-test img')].every(i=>i.complete && i.naturalWidth>0),null,{timeout:30000});
    assert.equal(errors.filter(x=>x.includes('An error has occurred')).length,0);
    results.push({engine:name,test:'0.8.0h save slot visible in 0.8.5e, four mods applied, player portrait images',pass:true,oldId:old.id,newId:now.id,version:now.version});
    await fresh.close();
  } finally {await browser.close();}
}
(async()=>{
  try {
    for(let i=0;i<40;i++){try{await fetch(root);break;}catch{await delay(250);}}
    await run(chromium,'Chromium iPhone profile');
    await run(webkit,'WebKit iPhone profile');
    console.log(JSON.stringify(results,null,2));
  }catch(e){results.push({pass:false,error:e.stack});console.error(e);process.exitCode=1;}
  finally{fs.writeFileSync('upgrade-test-results.json',JSON.stringify(results,null,2));server.kill();}
})();
