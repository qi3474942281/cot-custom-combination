const {chromium,webkit,devices}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='http://127.0.0.1:8765/cot-custom-combination/';
const server=spawn('python',['-m','http.server','8765','--directory',path.dirname(process.cwd())],{stdio:'ignore'});
const results=process.env.COT_ENGINE==='webkit'&&fs.existsSync('chinese-test-results.json')?JSON.parse(fs.readFileSync('chinese-test-results.json')):[];
const terms=JSON.parse(fs.readFileSync('tools/chinese_supplement/terms.json'));
async function script(p,source){
 await p.evaluate(source=>SugarCube.Wikifier.wikifyEval('<<script>>'+source+'<</script>>'),source);
 return p.evaluate(()=>window.__result);
}
async function boot(p,url){await p.goto(url);await p.waitForFunction(()=>window.SugarCube?.State?.passage,null,{timeout:120000});}
const rental=`
 State.variables.people ||= {};State.variables.niches ||= {};State.variables.virginity ||= {};
 State.variables.pc=setup.check_revive(JSON.parse(JSON.stringify(setup.store_class(new Person({person:'PC'})))));
 State.variables.pchousing={};delete State.variables.housing;delete State.variables.roommateSearch;
 State.variables.gameday=1;State.variables.pcmoney=10000;State.variables.lastlocpassage='BancroftSuites';
 State.variables.housingbuilding='Bancroft Suites';
 State.variables.housingunit=setup.Housing.buildings['Bancroft Suites'].units[0];
 State.variables.housingrent=1800;State.variables.housingdeposit=180;
 const host=document.createElement('div');host.id='rent-test';document.querySelector('#passages .passage').appendChild(host);
 new Wikifier(host,'<<include "HousingRentNew">>');
 window.__result={text:host.textContent,errors:[...host.querySelectorAll('.error')].map(n=>n.textContent),money:State.variables.pcmoney,keys:Object.keys(State.variables.pchousing),housing:State.variables.pchousing,links:[...host.querySelectorAll('a')].map(n=>n.textContent)};
`;
async function run(type,engine){
 const browser=await type.launch({headless:true,...(type===chromium?{channel:'chrome'}:{})});
 try{
  const baseline=await browser.newContext({...devices['iPhone 13']});
  const beforePage=await baseline.newPage();beforePage.on('dialog',d=>d.dismiss());
  const list=JSON.parse(fs.readFileSync('modList.json')).filter(n=>!n.includes('CoTChineseSupplement'));
  await beforePage.route('**/modList.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(list)}));
  await boot(beforePage,root+'vanilla/game.html');
  const before=await script(beforePage,rental);console.log('BASELINE',JSON.stringify(before));
  assert(before.errors.some(e=>/housing|undefined/i.test(e)),'baseline did not reproduce rental error');
  assert.equal(before.money,8020);assert.equal(before.keys.length,1);await baseline.close();
  const context=await browser.newContext({...devices['iPhone 13']});const p=await context.newPage();p.on('dialog',d=>d.dismiss());
  await p.goto(root+'backup.html');await p.evaluate(()=>localStorage.setItem('cot-localization-test-setting','keep-original'));
  await boot(p,root+'index.html');
  const after=await script(p,rental);console.log('PATCHED',JSON.stringify(after));
  assert.deepEqual(after.errors,[]);assert.equal(after.money,before.money);assert.equal(after.keys.length,1);
  assert(/^Suite \d+$/.test(after.keys[0]));assert.equal(after.housing[after.keys[0]].building,'Bancroft Suites');
  assert.equal(after.housing[after.keys[0]].plan,'One Bedroom Suite');assert.equal(after.housing[after.keys[0]].paidUntil,29);
  assert(after.text.includes('班克罗夫特套房')&&after.text.includes('号套房'));assert(after.links.some(l=>l.includes('进去')));
  assert.equal(await p.evaluate(()=>localStorage.getItem('cot-localization-test-setting')),'keep-original');
  const preserved=await script(p,`
   const key=Object.keys(State.variables.pchousing)[0];
   const outside=setup.Housing.get_room_label('One Bedroom Suite','living room');
   State.variables.housing={key,plan:'One Bedroom Suite',building:'Bancroft Suites'};
   State.variables.pchousing[key].rooms.bedroom={label:'My custom room'};
   const original=JSON.stringify(State.variables.pchousing);
   const custom=setup.Housing.get_room_label('One Bedroom Suite','bedroom');
   window.__result={outside,custom,unchanged:original===JSON.stringify(State.variables.pchousing),caption:Story.get('StoryCaption').text.includes('include "PlayerPortrait"'),hotfix:!Story.get('EventPhoneMailGiftResult').text.includes('<<<dalterneed'),id:Config.saves.id,terms:setup.CoTChinese.termCount};
  `);
  assert.equal(preserved.outside,'客厅');assert.equal(preserved.custom,'My custom room');
  assert(preserved.unchanged&&preserved.caption&&preserved.hotfix);assert.equal(preserved.id,'course-of-temptation');
  assert.equal(preserved.terms,Object.keys(terms).length);
  const stable=await script(p,`window.__result=${JSON.stringify(Object.keys(terms))}.every(t=>setup.CoTChinese.text(setup.CoTChinese.text(t))===setup.CoTChinese.text(t));`);
  assert(stable,'translation repeatedly changes its own output');
  await p.evaluate(()=>{
   const host=document.createElement('div');host.id='display-test';
   host.innerHTML='<span id="phrase">Bancroft Suites</span><span id="unit">Suite 31</span><input id="untouched-input" value="Bancroft Suites"><select id="untouched-select"><option>Bancroft Suites</option></select><a id="untouched-id" data-passage="HousingRoom">Kitchen</a><pre id="untouched-code">Bancroft Suites</pre>';
   document.querySelector('#passages .passage').appendChild(host);
  });
  await p.waitForFunction(()=>document.querySelector('#phrase').textContent==='班克罗夫特套房');
  const display=await p.evaluate(()=>({unit:document.querySelector('#unit').textContent,input:document.querySelector('#untouched-input').value,select:document.querySelector('#untouched-select').value,id:document.querySelector('#untouched-id').getAttribute('data-passage'),kitchen:document.querySelector('#untouched-id').textContent,code:document.querySelector('#untouched-code').textContent}));
  assert.deepEqual(display,{unit:'31 号套房',input:'Bancroft Suites',select:'Bancroft Suites',id:'HousingRoom',kitchen:'厨房',code:'Bancroft Suites'});
  results.push({engine,pass:true,terms:preserved.terms,rentalErrorBefore:before.errors.length,rentalErrorAfter:after.errors.length,money:after.money,saveId:preserved.id});await context.close();
 }finally{await browser.close();}
}
(async()=>{
 try{
  if(process.env.COT_ENGINE!=='webkit')await run(chromium,'Chromium iPhone profile');
  if(process.env.COT_ENGINE!=='chromium')await run(webkit,'WebKit iPhone profile');
  console.log(JSON.stringify(results,null,2));
 }catch(e){results.push({pass:false,error:e.stack});console.error(e);process.exitCode=1;}
 finally{fs.writeFileSync('chinese-test-results.json',JSON.stringify(results,null,2));server.kill();}
})();
