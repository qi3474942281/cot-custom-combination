(() => {
  'use strict';
  const flag = 'cotNextConceptionGuaranteed';
  const pending = () => State.variables[flag] === true;
  function setPending(value) {
    if (!setup.CoTQuickCheats.enabled() || typeof value !== 'boolean') return false;
    if (value) State.variables[flag] = true;
    else delete State.variables[flag];
    return true;
  }
  const pregnancy = setup.Pregnancy;
  const original = pregnancy.inseminated;
  function eligible(donor, receiver) {
    const pc = State.variables.pc;
    return setup.CoTQuickCheats.enabled() && pending() && pc && donor && receiver
      && setup.kinkcontent_has('pregnancy')
      && (pc.equals(donor) || pc.equals(receiver))
      && setup.people.get_name(donor) !== setup.people.get_name(receiver)
      && pregnancy.can_get_someone_pregnant(donor)
      && pregnancy.can_get_pregnant(receiver)
      && !pregnancy.is_pregnant(receiver);
  }
  pregnancy.inseminated = function(donor, receiver) {
    if (!eligible(donor, receiver)) return original.apply(this, arguments);
    // Run the game's real initialization, retaining parentage and progression.
    // Consume only after successful creation; do not alter fertility settings.
    const result = this.initiate_pregnancy(donor, receiver);
    if (this.is_pregnant(receiver)) delete State.variables[flag];
    return result;
  };
  Object.assign(setup.CoTQuickCheats, {
    conceptionPending: pending, setConceptionPending: setPending
  });
})();
