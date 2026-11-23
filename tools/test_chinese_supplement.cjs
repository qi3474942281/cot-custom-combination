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
   const itemSource=Story.get('ShopItem').text;
   const escapeAt=itemSource.indexOf('T.htmlEscape = function');
   const scriptStart=itemSource.lastIndexOf('<<script>>',escapeAt);
   const scriptEnd=itemSource.indexOf('<</script>>',escapeAt)+11;
   if(escapeAt<0||scriptStart<0)throw new Error('Missing real ShopItem option initialization');
   new Wikifier(optionHost,itemSource.slice(scriptStart,scriptEnd));
   State.temporary.cItem=new ClothingItem('T-shirt');
   new Wikifier(optionHost,'<<shopsubsmenu>>');
   const renderedOptions=[...optionHost.querySelectorAll('.shop-item-option')].map(n=>({text:n.textContent,handler:n.getAttribute('onmousedown')}));
   const firstOption=optionHost.querySelector('.shop-item-option');
   if(firstOption)State.temporary.button_clicked_fn('color','black',firstOption,true);
   const selectedValue=State.temporary.subs.color;
   const selectedCaption=optionHost.querySelector('#span-color')?.textContent;
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
    item:product.item,purchase,clothingLabel,detailedLabels,colorNames,renderedOptions,selectedValue,selectedCaption,clothingUnchanged:legacyData===JSON.stringify(legacyClothing),
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
  assert.equal(shopping.selectedValue,'black');assert(/[\u4e00-\u9fff]/.test(shopping.selectedCaption));
  assert(shopping.detailedLabels.length>0);assert(shopping.detailedLabels.every(s=>/[\u4e00-\u9fff]/.test(s)));
  assert.equal(shopping.spent,Math.floor(shopping.price));assert(shopping.spent>0);
  await p.evaluate(()=>{
   const select=document.createElement('select');select.id='shopping-option';
   select.innerHTML='<option>No limit</option>';
   document.querySelector('#passages .passage').appendChild(select);
  });
  await p.waitForFunction(()=>document.querySelector('#shopping-option option').label==='不限制');
  assert.equal(await p.evaluate(()=>document.querySelector('#shopping-option').value),'No limit');
  // Reproduce the exact page in the user's screenshot, including the real
  // SugarCube listbox and its change handler, rather than a synthetic option.
  const stylist=await script(p,`
   State.variables.shop='Valkyrie Clothing';State.variables.palettechoice='midnight';
   delete State.variables.styledoutfit;State.variables.showstyles=false;
   const originalPalettes=JSON.stringify(setup.palette.colors);
   const sourceStyles=setup.clothes_styles.filter(s=>s!=='costume');
   const aliases={schoolpride:'college pride',fashionista:'fashionable',dressy:'preppy',geek:'geeky',punk:'punky',greekpride:'greek pride'};
   const rawStyles=sourceStyles.map(s=>aliases[s]||s).map(s=>s.toUpperFirst()).sort();
   const host=document.createElement('div');host.id='stylist-test';
   document.querySelector('#passages .passage').appendChild(host);
   new Wikifier(host,Story.get('VStylistPickStyle').text);
   window.__realOutfitGenerator=setup.roll_stylish_outfit;
   setup.roll_stylish_outfit=style=>{
     window.__requestedStylistStyle=style;
     return {clothes:[{item:'T-shirt',label:'T-shirt',style:'casual',shop:'Valkyrie Clothing'}]};
   };
   window.__originalPaletteData=originalPalettes;
   window.__result={rawStyles,mapValues:[...setup.CoTChinese.styleOptions(rawStyles).values()],
    options:[...host.querySelector('select').options].map(o=>({text:o.textContent,label:o.label,value:o.value})),
    selectedPalette:host.querySelector('#palette-selected').textContent,
    paletteLabels:[...host.querySelectorAll('.palette-option > span:first-child')].map(n=>n.textContent),
    paletteKeys:[...host.querySelectorAll('.palette-option')].map(n=>n.getAttribute('data-palette')),
    allKeys:Object.keys(setup.palette.colors),allColors:[...new Set(Object.values(setup.palette.colors).flat())].map(v=>setup.CoTChinese.colorLabel(v)),
    errors:[...host.querySelectorAll('.error')].map(n=>n.textContent)};
  `);
  console.log('STYLIST',JSON.stringify(stylist));
  assert.deepEqual(stylist.errors,[]);assert.deepEqual(stylist.mapValues,stylist.rawStyles);
  assert(stylist.options.length===17);assert(stylist.options.every(o=>/[\u4e00-\u9fff]/.test(o.text)&&/[\u4e00-\u9fff]/.test(o.label)));
  assert(stylist.options.some(o=>o.text==='波西米亚风'));assert(stylist.options.some(o=>o.text==='休闲风'));
  assert(stylist.selectedPalette.includes('午夜'));assert(!/[A-Za-z]/.test(stylist.selectedPalette));
  assert.equal(stylist.paletteLabels.length,112);assert(stylist.paletteLabels.every(s=>/[\u4e00-\u9fff]/.test(s)));
  assert.deepEqual(stylist.paletteKeys,stylist.allKeys);assert(stylist.allColors.every(s=>/[\u4e00-\u9fff]/.test(s)));
  await p.locator('#stylist-test select').selectOption({label:'休闲风'});
  const choice=await script(p,'window.__result=State.variables.stylerequest;');
  assert.equal(choice,'Casual');
  await p.locator('#stylist-test a').filter({hasText:'推荐一套'}).click();
  const recommendation=await script(p,`
   const host=document.querySelector('#stylist-test');
   setup.roll_stylish_outfit=window.__realOutfitGenerator;
   State.variables.palettechoice='royal';
   const palette=document.createElement('div');palette.id='retained-palette-test';host.appendChild(palette);
   new Wikifier(palette,'<<palettedropdown>>');
   window.__result={requested:window.__requestedStylistStyle,outfit:host.querySelector('#outfit').textContent,
    paletteKey:State.variables.palettechoice,paletteText:palette.querySelector('.palette-selected').textContent,
    unchanged:JSON.stringify(setup.palette.colors)===window.__originalPaletteData,
    errors:[...host.querySelectorAll('.error')].map(n=>n.textContent)};
  `);
  console.log('STYLIST RECOMMENDATION',JSON.stringify(recommendation));
  assert.equal(recommendation.requested,'casual');assert.deepEqual(recommendation.errors,[]);
  assert(recommendation.outfit.includes('休闲'));assert(recommendation.outfit.includes('T恤'));
  assert(recommendation.outfit.includes('瓦尔基里服饰'));
  assert.equal(recommendation.paletteKey,'royal');assert(recommendation.paletteText.includes('皇家色调'));assert(recommendation.unchanged);
  // Inspect every real catalogue variant, not only screenshot fixtures.
  const catalogue=await script(p,`
   const missing=[];let checked=0;
   const preserved=['F-K','Brandolorian'];
   const snapshot=JSON.stringify(setup.Shops.databases);
   for(const [type,db] of Object.entries(setup.Shops.databases)){
    for(const [item,info] of Object.entries(db)){
     if(!info||typeof info!=='object')continue;
     for(const [field,values] of Object.entries(info)){
      if(!field.startsWith('sub ')||!Array.isArray(values))continue;
      for(const value of values){
       if(typeof value!=='string'||!/[A-Za-z]{2}/.test(value)||preserved.includes(value))continue;
       checked++;const label=setup.CoTChinese.shopOption({type,item},field.slice(4),value);
       if(!/[\\u4e00-\\u9fff]/.test(label)&&/[A-Za-z]{2}/.test(label))missing.push({type,item,field,value,label});
      }
     }
    }
   }
   window.__result={checked,missing,unchanged:JSON.stringify(setup.Shops.databases)===snapshot};
  `);
  console.log('ALL CATALOGUE VARIANTS',JSON.stringify(catalogue));
  assert(catalogue.checked>1000);assert(catalogue.unchanged);
  // Actual wooden desk option widget plus the original mouse handler.
  const furniture=await script(p,`
   State.variables.shopitem={type:'dormstuff',item:'wooden desk',label:'wooden desk'};
   State.variables.showstyles=false;State.temporary.cItem=null;
   State.temporary.sub_info={wood:[...setup.dormstuff['wooden desk']['sub wood']]};State.temporary.subs={};
   const host=document.createElement('div');host.id='furniture-audit';document.querySelector('#passages .passage').appendChild(host);
   const source=Story.get('ShopItem').text;const at=source.indexOf('T.htmlEscape = function');
   new Wikifier(host,source.slice(source.lastIndexOf('<<script>>',at),source.indexOf('<</script>>',at)+11));
   new Wikifier(host,'<<shopsubsmenu>>');
   window.__result={labels:[...host.querySelectorAll('.shop-item-option')].map(n=>n.textContent.trim()),errors:[...host.querySelectorAll('.error')].map(n=>n.textContent)};
  `);
  assert.deepEqual(furniture.errors,[]);assert.deepEqual(furniture.labels,['橡木','枫木','樱桃木','胡桃木','松木']);
  await p.locator('#furniture-audit .shop-item-option').nth(2).dispatchEvent('mousedown');
  const selectedWood=await script(p,`window.__result={value:State.temporary.subs.wood,label:document.querySelector('#furniture-audit #span-wood').textContent};`);
  assert.deepEqual(selectedWood,{value:'cherry',label:'樱桃木'});
  // Both screenshot menus use the real translated page templates and handlers.
  const dates=await script(p,`
   window.__dateOriginal={get_type:setup.people.get_type,lives:setup.people.lives,relationship_with:setup.Relationships.relationship_with,is_roommate:setup.Housing.is_roommate,prefers_motel:setup.people.prefers_motel};
   setup.people.get_type=()=> 'student';setup.people.lives=()=> 'house';setup.Relationships.relationship_with=()=> 'friend';setup.Housing.is_roommate=()=>false;setup.people.prefers_motel=()=>false;
   State.variables.proposeddate={partner:'audit-partner',type:'date'};State.variables.eventnpc='audit-partner';
   State.variables.expandphonelinks=true;delete State.variables.phoneresponsemenu;State.variables.planneddate=[];
   State.temporary.p='audit-partner';
   const keys=Object.keys(setup.Relationships.activities);window.__dateKeys=JSON.stringify(keys);
   const root=document.querySelector('#passages .passage');
   const inPerson=document.createElement('div');inPerson.id='date-audit';root.appendChild(inPerson);
   new Wikifier(inPerson,Story.get('InPersonDialogueHangoutPlanning').text.replace('<<link _linkname InPersonDialogueHangoutPlanningTime>>','<<link _linkname>>'));
   const phone=document.createElement('div');phone.id='phone-audit';document.querySelector('#ui-dialog-body').appendChild(phone);
   new Wikifier(phone,'<<phonetextmenu "hangout location">>');
   window.__result={activities:keys.map(k=>setup.CoTChinese.activityLabel(k)),
    inPerson:[...inPerson.querySelectorAll('a')].map(n=>n.textContent.trim()),phone:[...phone.querySelectorAll('a')].map(n=>n.textContent.trim()),
    errors:[...inPerson.querySelectorAll('.error'),...phone.querySelectorAll('.error')].map(n=>n.textContent),
    activityKeys:JSON.stringify(Object.keys(setup.Relationships.activities))===window.__dateKeys};
  `);
  console.log('DATE MENUS',JSON.stringify(dates));
  assert.deepEqual(dates.errors,[]);assert(dates.activityKeys);assert.equal(dates.activities.length,14);
  assert(dates.activities.every(s=>/[\u4e00-\u9fff]/.test(s)));assert(dates.inPerson.length>=10&&dates.phone.length>=10);
  for(const menu of [dates.inPerson,dates.phone]){
   assert(menu.every(s=>!/[A-Za-z]{2}/.test(s)));assert(menu.some(s=>s.includes('看电影')));assert(menu.some(s=>s.includes('打保龄球')));
  }
  const dateHandler=await script(p,`
   // Isolate navigation only; the real link must set the proposal's original ID.
   [...document.querySelectorAll('#date-audit a')].find(a=>a.textContent.includes('看电影')).click();
   const result={activity:State.variables.proposeddate.activity,location:State.variables.proposeddate.location,header:State.variables.header};
   setup.people.get_type=window.__dateOriginal.get_type;setup.people.lives=window.__dateOriginal.lives;setup.Relationships.relationship_with=window.__dateOriginal.relationship_with;setup.Housing.is_roommate=window.__dateOriginal.is_roommate;setup.people.prefers_motel=window.__dateOriginal.prefers_motel;
   window.__result=result;
  `);
  assert.equal(dateHandler.activity,'see a movie');assert.equal(dateHandler.location,'Cinema');assert(dateHandler.header.includes('看电影'));
  assert.deepEqual(catalogue.missing,[]);
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
