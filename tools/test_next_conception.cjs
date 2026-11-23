const assert=require('node:assert/strict');
module.exports=async function(p,script){
 const ready=await script(p,`
  const P=setup.Pregnancy;
  window.__conceptionTest={original:{content:setup.kinkcontent_has,receive:P.can_get_pregnant,donate:P.can_get_someone_pregnant,fertility:P.fertility_today,wants:P.wants_pregnancy},content:true,receive:true};
  const test=window.__conceptionTest;
  setup.kinkcontent_has=tag=>tag==='pregnancy'?test.content:test.original.content(tag);
  P.can_get_pregnant=()=>test.receive;P.can_get_someone_pregnant=()=>true;
  P.fertility_today=()=>0;P.wants_pregnancy=()=>false;
  State.variables.cheatsenabled=true;delete State.variables.cotNextConceptionGuaranteed;
  delete State.variables.pc.pregnant;delete State.variables.people['CoT Test B'].pregnant;
  $('#cot-next-conception').empty().wiki('<<cotnextconceptioncontent>>');
  window.__result={natural:Boolean(P.will_become_pregnant({person:'CoT Test A'},State.variables.pc)),label:document.querySelector('#cot-next-conception').textContent,version:setup.CoTQuickCheats.version};
 `);
 try{
  assert.equal(ready.natural,false);assert(ready.label.includes('下一次性爱受孕几率100%'));assert.equal(ready.version,'1.1.1');
  await p.locator('#cot-next-conception a').filter({hasText:'下一次性爱受孕几率100%'}).click();
  const waiting=await script(p,`
   State.create(State.passage);Save.slots.save(1,'Pending conception cheat');
   const slot=Save.slots.get(1),history=State.deltaDecode(slot.state.delta);
   const saved=history[slot.state.index].variables.cotNextConceptionGuaranteed;
   window.__result={pending:setup.CoTQuickCheats.conceptionPending(),saved,text:document.querySelector('#cot-next-conception').textContent};
  `);
  assert(waiting.pending&&waiting.saved);assert(waiting.text.includes('已开启（待触发）'));
  await p.locator('#cot-next-conception a').filter({hasText:'取消下一次受孕保证'}).click();
  const cancelled=await script(p,`window.__result=setup.CoTQuickCheats.conceptionPending();`);assert.equal(cancelled,false);
  await p.locator('#cot-next-conception a').filter({hasText:'下一次性爱受孕几率100%'}).click();
  const guards=await script(p,`
   const P=setup.Pregnancy,test=window.__conceptionTest,pc=State.variables.pc;
   const a={person:'CoT Test A'},b={person:'CoT Test B'};
   P.inseminated(a,b);const npcPair={pending:setup.CoTQuickCheats.conceptionPending(),pregnant:P.is_pregnant(b)};
   test.content=false;P.inseminated(a,pc);const disabledContent={pending:setup.CoTQuickCheats.conceptionPending(),pregnant:!!pc.pregnant};test.content=true;
   test.receive=false;P.inseminated(a,pc);const invalidBody={pending:setup.CoTQuickCheats.conceptionPending(),pregnant:!!pc.pregnant};test.receive=true;
   pc.pregnant={donor:'Original',start:1};const originalPregnancy=JSON.stringify(pc.pregnant);
   P.inseminated(a,pc);const existing={pending:setup.CoTQuickCheats.conceptionPending(),unchanged:originalPregnancy===JSON.stringify(pc.pregnant)};delete pc.pregnant;
   State.variables.cheatsenabled=false;const cannotArm=setup.CoTQuickCheats.setConceptionPending(true);P.inseminated(a,pc);
   const cheatsOff={pending:setup.CoTQuickCheats.conceptionPending(),pregnant:!!pc.pregnant,cannotArm};State.variables.cheatsenabled=true;
   const originalInit=P.initiate_pregnancy;P.initiate_pregnancy=()=>undefined;P.inseminated(a,pc);P.initiate_pregnancy=originalInit;
   const failedInit={pending:setup.CoTQuickCheats.conceptionPending(),pregnant:!!pc.pregnant};
   window.__result={npcPair,disabledContent,invalidBody,existing,cheatsOff,failedInit};
  `);
  assert.deepEqual(guards.npcPair,{pending:true,pregnant:false});
  assert.deepEqual(guards.disabledContent,{pending:true,pregnant:false});
  assert.deepEqual(guards.invalidBody,{pending:true,pregnant:false});
  assert.deepEqual(guards.existing,{pending:true,unchanged:true});
  assert.deepEqual(guards.cheatsOff,{pending:true,pregnant:false,cannotArm:false});
  assert.deepEqual(guards.failedInit,{pending:true,pregnant:false});
  const result=await script(p,`
   const P=setup.Pregnancy,pc=State.variables.pc,a={person:'CoT Test A'};
   const settings=JSON.stringify({fertility:State.variables.optfertility,duration:State.variables.optpregduration});
   P.inseminated(a,pc);
   const pcResult={pregnancy:pc.pregnant,pending:setup.CoTQuickCheats.conceptionPending()};
   delete pc.pregnant;P.inseminated(a,pc);
   const after={pregnant:!!pc.pregnant,pending:setup.CoTQuickCheats.conceptionPending()};
   setup.CoTQuickCheats.setConceptionPending(true);P.inseminated(pc,{person:'CoT Test B'});
   const partnerResult={pregnancy:State.variables.people['CoT Test B'].pregnant,pending:setup.CoTQuickCheats.conceptionPending()};
   delete State.variables.people['CoT Test B'].pregnant;
   window.__result={pcResult,after,partnerResult,settingsUnchanged:settings===JSON.stringify({fertility:State.variables.optfertility,duration:State.variables.optpregduration}),day:State.variables.gameday};
  `);
  assert.equal(result.pcResult.pregnancy.donor,'CoT Test A');assert.equal(result.pcResult.pregnancy.start,result.day);assert.equal(result.pcResult.pregnancy.known,false);assert.equal(result.pcResult.pending,false);
  assert.deepEqual(result.after,{pregnant:false,pending:false});assert.equal(result.partnerResult.pregnancy.donor,'PC');assert.equal(result.partnerResult.pending,false);assert(result.settingsUnchanged);
  console.log('NEXT CONCEPTION PASS',JSON.stringify({waiting,cancelled,guards,result}));
 }finally{
  await script(p,`
   const old=window.__conceptionTest.original;
   setup.kinkcontent_has=old.content;setup.Pregnancy.can_get_pregnant=old.receive;setup.Pregnancy.can_get_someone_pregnant=old.donate;
   setup.Pregnancy.fertility_today=old.fertility;setup.Pregnancy.wants_pregnancy=old.wants;
   delete State.variables.cotNextConceptionGuaranteed;window.__result=true;
  `);
 }
};
