(() => {
  'use strict';
  const flag = 'cotNextConceptionGuaranteed';
  const report = 'cotConceptionResult';
  const pending = () => State.variables[flag] === true;
  function remember(code) { State.variables[report] = {code, day: State.variables.gameday}; }
  function setPending(value) {
    if (!setup.CoTQuickCheats.enabled() || typeof value !== 'boolean') return false;
    if (value) State.variables[flag] = true;
    else delete State.variables[flag];
    remember(value ? 'waiting' : 'cancelled');
    return true;
  }
  const pregnancy = setup.Pregnancy;
  function reason(donor, receiver) {
    const pc = State.variables.pc;
    if (!setup.CoTQuickCheats.enabled()) return 'cheats-off';
    if (!setup.kinkcontent_has('pregnancy')) return 'content-off';
    if (!pc || !donor || !receiver || !(pc.equals(donor) || pc.equals(receiver))) return 'no-player';
    if (setup.people.get_name(donor) === setup.people.get_name(receiver)) return 'incompatible';
    if (!pregnancy.can_get_someone_pregnant(donor) || !pregnancy.can_get_pregnant(receiver)) return 'incompatible';
    if (pregnancy.is_pregnant(receiver)) return 'already-pregnant';
    return null;
  }
  function force(donor, receiver, context = pregnancy) {
    if (!pending()) return false;
    const blocked = reason(donor, receiver);
    if (blocked) { remember(blocked); return false; }
    context.initiate_pregnancy(donor, receiver);
    if (!context.is_pregnant(receiver)) { remember('init-failed'); return false; }
    delete State.variables[flag];
    remember('used');
    return true;
  }
  const original = pregnancy.inseminated;
  pregnancy.inseminated = function(donor, receiver) {
    if (force(donor, receiver, this)) return;
    return original.apply(this, arguments);
  };
  function resolveEncounter(encounter) {
    if (!pending()) return;
    if (!setup.CoTQuickCheats.enabled()) { remember('cheats-off'); return; }
    if (!setup.kinkcontent_has('pregnancy')) { remember('content-off'); return; }
    let found = false;
    const seen = new Set();
    // The engine records completed acts here even when its climax-specific
    // conception event never fires. Only actual, compatible records count.
    for (const act of encounter.all_acts || []) {
      if (act.toy || !(act['action type'] || []).includes('penetrate')) continue;
      const subjectPart = act['subject parts']?.[0], objectPart = act['object parts']?.[0];
      let donor, receiver;
      if (subjectPart === 'penis' && objectPart === 'vagina') {
        donor = encounter.pobj(act.subject); receiver = encounter.pobj(act.object);
      } else if (subjectPart === 'vagina' && objectPart === 'penis') {
        donor = encounter.pobj(act.object); receiver = encounter.pobj(act.subject);
      } else continue;
      const pc = State.variables.pc;
      if (!donor || !receiver || !(pc.equals(donor) || pc.equals(receiver))) continue;
      const key = setup.people.get_name(donor) + '\0' + setup.people.get_name(receiver);
      if (seen.has(key)) continue;
      seen.add(key); found = true;
      if (force(donor, receiver)) return;
    }
    if (!found) remember('no-valid-act');
  }
  // Hook the real engine boundary before it deletes the completed act records.
  const originalConclude = Encounter.prototype.conclude;
  Encounter.prototype.conclude = function() {
    resolveEncounter(this);
    return originalConclude.apply(this, arguments);
  };
  function statusText() {
    const messages = {
      'waiting': '等待下一次符合受孕条件的互动结束。',
      'cheats-off': '作弊已关闭，开启后继续生效。',
      'content-off': '未开启怀孕内容或其前置内容，请在内容设置中开启。',
      'no-player': '上次判定不涉及玩家，次数已保留。',
      'incompatible': '上次互动双方不满足受孕条件，次数已保留。',
      'already-pregnant': '对方或玩家已经怀孕，次数已保留。',
      'no-valid-act': '上次互动没有记录可受孕行为，次数已保留。',
      'init-failed': '未能建立怀孕状态，次数已保留。',
      'used': '已生效并自动关闭；怀孕检测与提示仍按游戏流程出现。',
      'cancelled': '已取消。'
    };
    if (pending()) {
      const code = !setup.CoTQuickCheats.enabled() ? 'cheats-off'
        : !setup.kinkcontent_has('pregnancy') ? 'content-off' : State.variables[report]?.code || 'waiting';
      return '下一次受孕保证：已开启（待触发） ' + (messages[code] || messages.waiting);
    }
    return messages[State.variables[report]?.code] || '下一次受孕保证：未开启。';
  }
  Object.assign(setup.CoTQuickCheats, {
    conceptionPending: pending, setConceptionPending: setPending,
    conceptionStatusText: statusText
  });
})();
