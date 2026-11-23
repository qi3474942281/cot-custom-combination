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
  const shopping=await script(p,`
   const foodShop=setup.Shops.db['Chonk-o-Choco vending machine'];
   const original=JSON.stringify(foodShop);
   State.variables.shop='Chonk-o-Choco vending machine';
   State.variables.shopsearch='巧克';State.variables.lastshopcategoryindex=0;
   State.variables.perPage=10;delete State.variables.shopstyles;delete State.variables.shopskills;
   const host=document.createElement('div');host.id='shopping-test';
   document.querySelector('#passages .passage').appendChild(host);
   new Wikifier(host,'<<include "ShopMenu">>');
   const labels=[...host.querySelectorAll('a[data-passage="ShopMenu"]')].map(n=>n.textContent.trim());
   const item=foodShop.items.find(i=>i.type==='food');
   const product={...item,label:'Chonk-o-Choco'};
   const before=JSON.stringify(product);
   const localized=setup.CoTChinese.shopLabel(product);
   const clothing=Object.values(setup.Shops.db).flatMap(s=>Array.isArray(s?.items)?s.items:[])
     .find(i=>i.type==='clothes' && /[\\u4e00-\\u9fff]/.test(setup.clothes[i.item]?.cn_name||''));
   if(!clothing)throw new Error('No clothing catalogue fixture');
   const legacyClothing={...clothing,label:clothing.item};
   const legacyData=JSON.stringify(legacyClothing);
   State.variables.shopitem=legacyClothing;
   const detail=Story.get('ShopItem').text.match(/<div class="shop-item-name">.*?<\\/div>/s)?.[0];
   if(!detail)throw new Error('Missing actual item heading template');
   const heading=document.createElement('div');host.appendChild(heading);new Wikifier(heading,detail);
   const clothingLabel=heading.textContent;
   const clothingStore=Object.entries(setup.Shops.db).find(([key,s])=>s?.detailed&&Array.isArray(s.items)&&s.items.some(i=>i.type==='clothes'&&!i.checkvar));
   if(!clothingStore)throw new Error('No detailed clothing shop fixture');
   const [storeKey,store]=clothingStore;
   const categories=setup.Shops.parse_categories(store.items);
   const categoryIndex=categories.findIndex(c=>c.items.some(i=>i.type==='clothes'&&!i.checkvar));
   const target=categories[categoryIndex].items.find(i=>i.type==='clothes'&&!i.checkvar);
   State.variables.shop=storeKey;State.variables.lastshop=storeKey;
   State.variables.lastshopcategoryindex=categoryIndex;
   State.variables.shopsearch=setup.CoTChinese.shopLabel(target);
   State.variables.showstyles=false;
   const detailList=document.createElement('div');host.appendChild(detailList);
   new Wikifier(detailList,'<<include "ShopMenu">>');
   const detailedLabels=[...detailList.querySelectorAll('.shop-item-name')].map(n=>n.textContent.trim());
   State.variables.shop='Chonk-o-Choco vending machine';
   State.variables.shopitem={type:'clothes',item:'T-shirt',label:'T-shirt'};
   const colorOptions=['black','white'];
   const colorNames=colorOptions.map(v=>setup.CoTChinese.shopOption(State.variables.shopitem,'color',v));
   State.temporary.sub_info={color:colorOptions};State.temporary.subs={};
   const optionHost=document.createElement('div');host.appendChild(optionHost);
   new Wikifier(optionHost,'<<shopsubsmenu>>');
   const renderedOptions=[...optionHost.querySelectorAll('.shop-item-option')].map(n=>({text:n.textContent,handler:n.getAttribute('onmousedown')}));
   const money=State.variables.pcmoney;
   const price=setup.Shops.get_price(product.item,product.type)*setup.Shops.price_multiplier(State.variables.shop);
   const advance=setup.Time.advance_time;
   let purchase;
   try {
     // Isolate world simulation; exercise the game's own item and payment code.
     setup.Time.advance_time=()=>{};
     purchase=setup.Shops.maybe_purchase(foodShop,product.type,product.item,{});
   } finally {setup.Time.advance_time=advance;}
   window.__result={labels,localized,productUnchanged:before===JSON.stringify(product),
    catalogUnchanged:original===JSON.stringify(foodShop),price,spent:money-State.variables.pcmoney,
    item:product.item,purchase,clothingLabel,detailedLabels,colorNames,renderedOptions,clothingUnchanged:legacyData===JSON.stringify(legacyClothing),
    errors:[...host.querySelectorAll('.error')].map(n=>n.textContent),
    detailPatched:Story.get('ShopItem').text.includes('setup.CoTChinese.shopLabel($shopitem)'),
    count:setup.CoTChinese.shoppingCount};
  `);
  console.log('SHOPPING',JSON.stringify(shopping));
  assert.deepEqual(shopping.errors,[]);assert(shopping.labels.length>0);
  assert(shopping.labels.every(s=>/[\u4e00-\u9fff]/.test(s)),'Chinese product search did not render translated labels');
  assert.equal(shopping.localized,'喵喵巧克宝');assert(shopping.productUnchanged&&shopping.catalogUnchanged);
  assert(shopping.detailPatched);assert.equal(shopping.item,'chocolate candy bar');
  assert(/[\u4e00-\u9fff]/.test(shopping.clothingLabel));assert(shopping.clothingUnchanged);
  assert(shopping.colorNames.every(s=>/[\u4e00-\u9fff]/.test(s)));
  assert(shopping.renderedOptions.length===2);assert(shopping.renderedOptions.every(o=>/[\u4e00-\u9fff]/.test(o.text)));
  assert(shopping.renderedOptions[0].handler.includes('black'));
  assert(shopping.detailedLabels.length>0);assert(shopping.detailedLabels.every(s=>/[\u4e00-\u9fff]/.test(s)));
  assert.equal(shopping.spent,Math.floor(shopping.price));assert(shopping.spent>0);
  await p.evaluate(()=>{
   const select=document.createElement('select');select.id='shopping-option';
   select.innerHTML='<option>No limit</option>';
   document.querySelector('#passages .passage').appendChild(select);
  });
  await p.waitForFunction(()=>document.querySelector('#shopping-option option').label==='不限制');
  assert.equal(await p.evaluate(()=>document.querySelector('#shopping-option').value),'No limit');
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
