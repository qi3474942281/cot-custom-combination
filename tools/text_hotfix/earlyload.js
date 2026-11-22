(async () => {
  const FIXES = [
    {
      passage: 'EventPhoneMailGiftResult',
      from: '<<<dalterneed Romance _romance>>',
      to: '<<dalterneed Romance _romance>>'
    },
    {
      passage: 'EventSmashersShootSuperheroDom4',
      from: '<<</if>>',
      to: '<</if>>'
    }
  ];

  function applyFixes(sc2) {
    const applied = [];
    const items = sc2 && sc2.passageDataItems && sc2.passageDataItems.items;
    if (!Array.isArray(items)) {
      return applied;
    }
    for (const fix of FIXES) {
      const passage = items.find((item) => item && item.name === fix.passage);
      if (!passage || typeof passage.content !== 'string') {
        continue;
      }
      if (!passage.content.includes(fix.from)) {
        continue;
      }
      const count = passage.content.split(fix.from).length - 1;
      passage.content = passage.content.split(fix.from).join(fix.to);
      applied.push({ passage: fix.passage, count });
    }
    return applied;
  }

  const manager = window.modSC2DataManager;
  if (!manager || typeof manager.getSC2DataInfoAfterPatch !== 'function') {
    console.warn('[CoTTextHotfix] SC2 data manager is not ready');
    return;
  }
  const cache = manager.getSC2DataInfoAfterPatch();
  if (!cache || typeof cache.cloneSC2DataInfo !== 'function') {
    console.warn('[CoTTextHotfix] SC2 data cache is not ready');
    return;
  }
  const sc2 = cache.cloneSC2DataInfo();
  const applied = applyFixes(sc2);
  if (!applied.length) {
    console.log('[CoTTextHotfix] no typo fragments found (already fixed or I18N not applied)');
    return;
  }
  if (sc2.passageDataItems && typeof sc2.passageDataItems.fillMap === 'function') {
    sc2.passageDataItems.fillMap();
  }
  const utils = typeof manager.getModUtils === 'function' ? manager.getModUtils() : null;
  if (!utils || typeof utils.replaceFollowSC2DataInfo !== 'function') {
    console.error('[CoTTextHotfix] replaceFollowSC2DataInfo is unavailable; patches were not committed');
    return;
  }
  utils.replaceFollowSC2DataInfo(sc2, cache);
  console.log('[CoTTextHotfix] applied', applied);
})();
