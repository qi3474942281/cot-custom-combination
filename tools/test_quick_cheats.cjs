const assert=require('node:assert/strict');
module.exports=async function(p,script){
 const initial=await script(p,`
  if(!setup.CoTQuickCheats)throw new Error('Quick-cheat mod did not load');
  State.variables.cheatsenabled=true;State.variables.gameday=20;
  State.variables.lefthouse=['Alpha Xi Alpha','Delta Delta Rho'];State.variables.tradgreeks=false;
  State.variables.latepledgeday=99;State.variables.pchouse='Sigma Omicron Theta';
  State.variables.greekpledge='Zeta Kappa Xi';
  State.variables.pcneeds={Rest:12,Relaxation:34,Bladder:56,Food:78,Hygiene:90,Attention:123,Composure:0,Release:234,Arousal:345,Satisfaction:456,Pain:567,Humiliation:678,Drunkenness:789};
  State.variables.passnextbladdercheck=true;State.variables.bladderchecks=4;
  const host=document.createElement('div');host.id='quick-cheats-test';document.querySelector('#passages .passage').appendChild(host);
  new Wikifier(host,Story.get('Cheats').text);
  window.__result={blocked:!setup.Houses.can_join('Alpha Xi Alpha'),
   links:[...host.querySelectorAll('a')].map(a=>a.textContent.trim()),errors:[...host.querySelectorAll('.error')].map(n=>n.textContent),
   memoryPatched:Story.get('DisplayNPCMemories').text.includes('<<cotromancedays _name>>')};
 `);
 assert.deepEqual(initial.errors,[]);assert(initial.blocked&&initial.memoryPatched);
 assert(initial.links.includes('重置社团冷却时间'));
 await p.locator('#quick-cheats-test a').filter({hasText:'重置社团冷却时间'}).click();
 const house=await script(p,`window.__result={left:State.variables.lefthouse,allowed:setup.Houses.can_join('Alpha Xi Alpha'),house:State.variables.pchouse,pledge:State.variables.greekpledge,opening:State.variables.latepledgeday};`);
 assert.deepEqual(house,{left:[],allowed:true,house:'Sigma Omicron Theta',pledge:'Zeta Kappa Xi',opening:99});
 await p.locator('#quick-cheats-test a').filter({hasText:'一键重置精神'}).click();
 const needs=await script(p,`window.__result={needs:State.variables.pcneeds,day:State.variables.gameday,bladderCheck:State.variables.bladderchecks??null,status:document.querySelector('#cot-quick-cheats-status').textContent};`);
 for(const key of ['Rest','Relaxation','Bladder','Food','Hygiene'])assert.equal(needs.needs[key],1000,key);
 assert.deepEqual(Object.fromEntries(Object.entries(needs.needs).filter(([k])=>!['Rest','Relaxation','Bladder','Food','Hygiene'].includes(k))),{Attention:123,Composure:0,Release:234,Arousal:345,Satisfaction:456,Pain:567,Humiliation:678,Drunkenness:789});
 assert.equal(needs.day,20);assert.equal(needs.bladderCheck,null);assert(needs.status.includes('100%'));
 const romance=await script(p,`
  State.variables.people['CoT Test A']={relationship:'partner',partner:'PC',partneredday:10,relationshipChangeDay:8,lastRelEvent:19,attitude:{romance:777}};
  State.variables.people['CoT Test B']={relationship:'poly partner',partner:'PC',partneredday:4,lastRelEvent:18};
  State.variables.people['CoT Test Friend']={relationship:'friend',relationshipChangeDay:3};
  window.__otherNPC=JSON.stringify(State.variables.people['CoT Test B']);
  const host=document.createElement('div');host.id='quick-romance-test';document.querySelector('#ui-dialog-body').appendChild(host);
  new Wikifier(host,'<<cotromancedays "CoT Test A">>');
  window.__result={days:setup.Relationships.relationship_age('CoT Test A'),text:host.textContent,errors:[...host.querySelectorAll('.error')].map(n=>n.textContent)};
 `);
 assert.deepEqual(romance.errors,[]);assert.equal(romance.days,10);assert(romance.text.includes('成为恋人'));
 // Real widget links and replacement callbacks, including repeated re-renders.
 await p.locator('#quick-romance-test .cot-romance-controls a').filter({hasText:'+'}).dispatchEvent('click');
 const added=await script(p,`window.__result={days:setup.Relationships.relationship_age('CoT Test A'),display:document.querySelector('#quick-romance-test .cot-romance-count').textContent};`);
 assert.deepEqual(added,{days:11,display:'11'});
 await p.locator('#quick-romance-test .cot-romance-controls a').filter({hasText:'−'}).dispatchEvent('click');
 const bounds=await script(p,`
  const plus=document.querySelector('#quick-romance-test .cot-romance-controls a:last-child');
  for(let i=0;i<10;i++)setup.CoTQuickCheats.changeRelationshipDays('CoT Test A',1);
  const zeroDate={start:State.variables.people['CoT Test A'].partneredday,age:setup.Relationships.relationship_age('CoT Test A')};
  setup.CoTQuickCheats.changeRelationshipDays('CoT Test A',1);
  const beforeGame={start:State.variables.people['CoT Test A'].partneredday,age:setup.Relationships.relationship_age('CoT Test A')};
  for(let i=0;i<25;i++)setup.CoTQuickCheats.changeRelationshipDays('CoT Test A',-1);
  $('#quick-romance-test').empty().wiki('<<cotromancedays "CoT Test A">>');
  window.__result={zeroDate,beforeGame,age:setup.Relationships.relationship_age('CoT Test A'),
   minusLinks:[...document.querySelectorAll('#quick-romance-test a')].filter(a=>a.textContent==='−').length,
   otherUnchanged:window.__otherNPC===JSON.stringify(State.variables.people['CoT Test B']),
   event:State.variables.people['CoT Test A'].lastRelEvent,changeDay:State.variables.people['CoT Test A'].relationshipChangeDay,
   romance:State.variables.people['CoT Test A'].attitude.romance,
   friendChange:setup.CoTQuickCheats.changeRelationshipDays('CoT Test Friend',1),
   friendDays:setup.CoTQuickCheats.relationshipDays('CoT Test Friend')};
 `);
 assert.deepEqual(bounds.zeroDate,{start:0,age:20});assert.deepEqual(bounds.beforeGame,{start:-1,age:21});
 assert.equal(bounds.age,0);assert.equal(bounds.minusLinks,0);assert(bounds.otherUnchanged);assert.equal(bounds.event,19);assert.equal(bounds.changeDay,8);assert.equal(bounds.romance,777);assert.equal(bounds.friendChange,false);assert.equal(bounds.friendDays,null);
 const off=await script(p,`
  // Nonexclusive and legacy records follow the same field as the game's reader.
  State.variables.people['CoT Legacy']={relationship:'open partner',relationshipChangeDay:5};
  setup.CoTQuickCheats.changeRelationshipDays('CoT Legacy',1);
  const legacy={age:setup.Relationships.relationship_age('CoT Legacy'),start:State.variables.people['CoT Legacy'].relationshipChangeDay};
  State.variables.cheatsenabled=false;
  const before=JSON.stringify({needs:State.variables.pcneeds,people:State.variables.people,left:State.variables.lefthouse});
  const denied=[setup.CoTQuickCheats.resetHouseCooldown(),setup.CoTQuickCheats.restoreBasicNeeds(),setup.CoTQuickCheats.changeRelationshipDays('CoT Test A',1)];
  $('#quick-romance-test').empty().wiki('<<cotromancedays "CoT Test A">>');
  window.__result={legacy,denied,unchanged:before===JSON.stringify({needs:State.variables.pcneeds,people:State.variables.people,left:State.variables.lefthouse}),
   buttons:document.querySelectorAll('#quick-romance-test a').length,text:document.querySelector('#quick-romance-test').textContent};
 `);
 assert.deepEqual(off.legacy,{age:16,start:4});assert.deepEqual(off.denied,[false,false,false]);assert(off.unchanged);assert.equal(off.buttons,0);assert(off.text.includes('成为恋人'));
 const saved=await script(p,`
  State.variables.cheatsenabled=true;
  const ok=Save.slots.save(0,'Quick cheats regression');
  const slot=Save.slots.get(0);
  const exported=JSON.stringify(slot);
  const parsed=JSON.parse(exported);
  window.__result={ok,id:parsed.id,containsAge:exported.includes('partneredday'),left:State.variables.lefthouse,mod:setup.CoTQuickCheats.version};
 `);
 assert.equal(saved.ok,true);assert.equal(saved.id,'course-of-temptation');assert(saved.containsAge);assert.deepEqual(saved.left,[]);assert.equal(saved.mod,'1.0.0');
 console.log('QUICK CHEATS PASS',JSON.stringify({house,needs:needs.needs,added,bounds,legacy:off.legacy,save:saved}));
};
