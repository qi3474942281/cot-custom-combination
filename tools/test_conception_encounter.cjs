const assert=require('node:assert/strict');
module.exports=async function(p,script){
 const result=await script(p,`
  const P=setup.Pregnancy,pc=State.variables.pc;
  window.__realConceptionFixture={body:pc.body_parts,name:pc.name,content:[...State.variables.kinkcontent],fertility:State.variables.optfertility,wants:P.wants_pregnancy};
  State.variables.cheatsenabled=true;State.variables.optfertility=0;
  const enable=tag=>{if(!State.variables.kinkcontent.includes(tag))State.variables.kinkcontent.push(tag);const req=setup.kink_content[tag]?.prereq;if(req)enable(req);};enable('pregnancy');
  pc.name='CoT Engine Player';pc.body_parts=['vagina'];delete pc.pregnant;
  const donor=Object.assign(Object.create(Person.prototype),{person:'CoT Test A',name:'CoT Engine Donor',is_pc:false,body_parts:['penis'],condom:'condom',sextoys:[]});
  const receiver=Object.assign(Object.create(Person.prototype),{person:'CoT Test B',name:'CoT Engine Receiver',is_pc:false,body_parts:['vagina'],sextoys:[]});
  const act=Object.entries(setup.sexacts).find(([k,a])=>(a['action type']||[])[0]==='penetrate'&&a['subject parts']?.[0]==='penis'&&a['object parts']?.[0]==='vagina'&&!a.toys&&!a['target toys']);
  if(!act)throw Error('No real compatible act fixture');
  const encounter=()=>{const e=new Encounter({});State.variables.encounter=e;State.variables.partner1=donor;delete State.variables.partner2;return e;};
  setup.CoTQuickCheats.setConceptionPending(true);
  encounter().conclude();
  const empty={pending:setup.CoTQuickCheats.conceptionPending(),pregnant:!!pc.pregnant,status:setup.CoTQuickCheats.conceptionStatusText()};
  const first=encounter();donor.add_act(act[0],pc);
  const recorded={count:first.all_acts.length,subject:first.all_acts[0].subject,object:first.all_acts[0].object};
  // No climax/conception event is fired: this is the real branch missed before.
  first.conclude();
  const success={pregnant:!!pc.pregnant,donor:pc.pregnant?.donor,pending:setup.CoTQuickCheats.conceptionPending(),status:setup.CoTQuickCheats.conceptionStatusText()};
  const old=JSON.stringify(pc.pregnant);first.conclude();const duplicateUnchanged=old===JSON.stringify(pc.pregnant);
  delete pc.pregnant;const second=encounter();donor.add_act(act[0],pc);second.conclude();const once=!!pc.pregnant;
  setup.CoTQuickCheats.setConceptionPending(true);
  const observed=encounter();State.variables.partner2=receiver;donor.add_act(act[0],receiver);observed.conclude();
  const npcOnly={pending:setup.CoTQuickCheats.conceptionPending(),pregnant:!!State.variables.people['CoT Test B'].pregnant};
  State.variables.kinkcontent=State.variables.kinkcontent.filter(t=>t!=='pregnancy');
  const disabled=encounter();donor.add_act(act[0],pc);disabled.conclude();
  const contentOff={pending:setup.CoTQuickCheats.conceptionPending(),status:setup.CoTQuickCheats.conceptionStatusText()};enable('pregnancy');
  pc.pregnant={donor:'Existing',start:1};const existing=JSON.stringify(pc.pregnant);
  const protectedEncounter=encounter();donor.add_act(act[0],pc);protectedEncounter.conclude();
  const already={pending:setup.CoTQuickCheats.conceptionPending(),unchanged:existing===JSON.stringify(pc.pregnant),status:setup.CoTQuickCheats.conceptionStatusText()};delete pc.pregnant;
  // Preserve real actor, act registration and pregnancy initialization. Only
  // isolate the unrelated NPC preference calculation for the small fixture.
  P.wants_pregnancy=()=>false;
  pc.body_parts=['penis'];pc.condom='condom';
  const opposite=encounter();State.variables.partner1=receiver;pc.add_act(act[0],receiver);opposite.conclude();
  const partner={pregnant:!!State.variables.people['CoT Test B'].pregnant,donor:State.variables.people['CoT Test B'].pregnant?.donor,pending:setup.CoTQuickCheats.conceptionPending()};
  $('#cot-next-conception').empty().wiki('<<cotnextconceptioncontent>>');
  window.__result={recorded,empty,success,duplicateUnchanged,once,npcOnly,contentOff,already,partner,probabilityUnchanged:State.variables.optfertility===0,ui:document.querySelector('#cot-next-conception').textContent};
 `);
 try{
  assert.equal(result.recorded.count,1);assert.equal(result.recorded.object,'PC');
  assert(result.empty.pending&&!result.empty.pregnant);assert(result.empty.status.includes('没有记录可受孕行为'));
  assert.deepEqual({pregnant:result.success.pregnant,donor:result.success.donor,pending:result.success.pending},{pregnant:true,donor:'CoT Test A',pending:false});assert(result.success.status.includes('已生效'));
  assert(result.duplicateUnchanged);assert.equal(result.once,false);assert.deepEqual(result.npcOnly,{pending:true,pregnant:false});
  assert(result.contentOff.pending&&result.contentOff.status.includes('未开启怀孕内容'));
  assert(result.already.pending&&result.already.unchanged&&result.already.status.includes('已经怀孕'));
  assert.deepEqual(result.partner,{pregnant:true,donor:'PC',pending:false});assert(result.probabilityUnchanged);assert(result.ui.includes('已生效并自动关闭'));
  console.log('REAL CONCEPTION ENCOUNTER PASS',JSON.stringify(result));
 }finally{
  await script(p,`
   const old=window.__realConceptionFixture;State.variables.pc.body_parts=old.body;State.variables.pc.name=old.name;
   State.variables.kinkcontent=old.content;State.variables.optfertility=old.fertility;setup.Pregnancy.wants_pregnancy=old.wants;
   delete State.variables.pc.condom;delete State.variables.pc.pregnant;delete State.variables.people['CoT Test B'].pregnant;
   delete State.variables.encounter;delete State.variables.partner1;delete State.variables.partner2;
   setup.CoTQuickCheats.setConceptionPending(false);window.__result=true;
  `);
 }
};
