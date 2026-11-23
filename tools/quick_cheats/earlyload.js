(() => {
  const fixes = [
    {passage:'Cheats', from:'<<link "重置所有需求">>', to:'<<cotquickcheats>><br><br>\n<<link "重置所有需求">>'},
    {passage:'DisplayNPCMemories', from:'<<set _personobj to new Person({person: _name})>>', to:'<<set _personobj to new Person({person: _name})>>\n<<cotromancedays _name>>'}
  ];
  const manager = window.modSC2DataManager;
  const cache = manager.getSC2DataInfoAfterPatch();
  const patched = cache.cloneSC2DataInfo();
  const applied = [];
  for (const fix of fixes) {
    const passage = patched.passageDataItems.items.find(p => p.name === fix.passage);
    if (!passage || !passage.content.includes(fix.from)) {
      console.warn('[CoTQuickCheats] missing expected display fragment', fix.passage);
      continue;
    }
    passage.content = passage.content.split(fix.from).join(fix.to);
    applied.push(fix.passage);
  }
  if (applied.length) {
    patched.passageDataItems.fillMap();
    manager.getModUtils().replaceFollowSC2DataInfo(patched, cache);
  }
  console.log('[CoTQuickCheats] patched display fragments', applied);
})();
