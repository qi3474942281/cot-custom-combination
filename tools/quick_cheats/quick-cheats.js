(() => {
  'use strict';
  const variables = () => State.variables;
  function enabled() { return variables().cheatsenabled === true; }
  function resetHouseCooldown() {
    if (!enabled()) return false;
    // Leaving a Greek house stores a re-entry blacklist, not a timer.
    // Recruitment dates, active membership and mentor/task data stay intact.
    variables().lefthouse = [];
    return true;
  }
  function restoreBasicNeeds() {
    if (!enabled() || !variables().pcneeds || !variables().pc) return false;
    // The built-in restore uses the same amount to overcome low-composure
    // modifiers. Bladder 1000 means empty; hygiene uses the game's cleanup.
    for (const need of ['Rest', 'Relaxation', 'Bladder', 'Food', 'Hygiene']) {
      setup.Needs.increase_need(need, 10000);
    }
    return true;
  }
  function romanticPerson(person) {
    const name = setup.people.get_name(person);
    const info = variables().people?.[name];
    return info && setup.Relationships.db[info.relationship]?.type === 'romantic' ? info : null;
  }
  function relationshipDays(person) {
    if (!romanticPerson(person)) return null;
    const days = setup.Relationships.relationship_age(person);
    return Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
  }
  function changeRelationshipDays(person, delta) {
    if (!enabled() || (delta !== 1 && delta !== -1)) return false;
    const info = romanticPerson(person);
    const day = variables().gameday;
    if (!info || !Number.isSafeInteger(day)) return false;
    const days = relationshipDays(person);
    const next = Math.max(0, days + delta);
    const start = day - next;
    if (!Number.isSafeInteger(start)) return false;
    // Use the field read by the game's relationship-age and unlock checks.
    // Never edit global time, other NPCs, relationship type or event cooldowns.
    const field = variables().pc.equals(info.partner) ? 'partneredday' : 'relationshipChangeDay';
    info[field] = start;
    return true;
  }
  // Day zero is valid after an age adjustment. The original reader mistakes
  // this numeric timestamp for missing data; retain all its other behavior.
  const originalAge = setup.Relationships.relationship_age;
  setup.Relationships.relationship_age = function(person) {
    const info = romanticPerson(person);
    if (info) {
      const field = variables().pc.equals(info.partner) ? 'partneredday' : 'relationshipChangeDay';
      if (info[field] === 0) return variables().gameday;
    }
    return originalAge.call(this, person);
  };
  setup.CoTQuickCheats = {enabled, resetHouseCooldown, restoreBasicNeeds,
    relationshipDays, changeRelationshipDays, version: '1.0.0'};
})();
