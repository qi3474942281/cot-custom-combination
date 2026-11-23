(() => {
  const terms = /* TERMS */;
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('(^|[^A-Za-z0-9_])(' + Object.keys(terms)
    .sort((a, b) => b.length - a.length).map(escape).join('|') + ')(?=$|[^A-Za-z0-9_])', 'g');
  function text(value) {
    return typeof value === 'string'
      ? value.replace(pattern, (_, prefix, term) => prefix + terms[term]) : value;
  }
  function unitLabel(key) {
    if (typeof key !== 'string') return '';
    if (/^Suite \d+$/.test(key)) return key.slice(6) + ' 号套房';
    if (/^Apartment \d+$/.test(key)) return key.slice(10) + ' 号公寓';
    const address = /^(\d+) (?:Saffron Street|番红花街)$/.exec(key);
    if (address) return '番红花街 ' + address[1] + ' 号';
    return text(key);
  }
  setup.CoTChinese = {text, unitLabel, version: '1.0.0', termCount: Object.keys(terms).length};

  // Only presentation data: keep housing keys, room IDs and save variables intact.
  if (setup.Housing) {
    for (const name of ['Bancroft Suites', 'Date Palm Apartments']) {
      if (setup.Housing.buildings[name]) setup.Housing.buildings[name].cn_name = terms[name];
    }
    setup.Housing.get_room_label = function(plan, roomID) {
      const here = State.variables.housing;
      const saved = here?.plan === plan
        ? State.variables.pchousing?.[here.key]?.rooms?.[roomID] : null;
      // Player-assigned labels always take precedence.
      if (saved?.label) return saved.label;
      const info = this.plans[plan]?.rooms?.[roomID];
      const roomClass = saved?.class || info?.class;
      if (saved?.class) return text(this.roomClasses[roomClass]?.cn_name || roomClass);
      return text(info?.label || info?.cn_name || this.roomClasses[roomClass]?.cn_name || roomClass || roomID || '房间');
    };
  }
  if (setup.dormstuff?.['fabric sofa']?.name === '%color sofa') {
    setup.dormstuff['fabric sofa'].name = '%color沙发';
  }

  const roots = '#passages, #ui-dialog, #ui-bar';
  const skip = 'script, style, pre, code, textarea, input, select, option, [contenteditable], .error-view, .debug';
  function translateNode(node) {
    const parent = node.parentElement;
    if (!parent || !parent.closest(roots) || parent.closest(skip)) return;
    // Unit identifiers are formatted for display, never renamed in game state.
    const units = node.data.replace(/(^|[^A-Za-z0-9_])(Suite \d+|Apartment \d+)(?=$|[^A-Za-z0-9_])/g,
      (_, prefix, key) => prefix + unitLabel(key));
    const translated = text(units);
    if (translated !== node.data) node.data = translated;
  }
  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { translateNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateNode(node);
  }
  $(document).one(':storyready', () => {
    for (const root of document.querySelectorAll(roots)) walk(root);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') translateNode(record.target);
        else for (const added of record.addedNodes) walk(added);
      }
    });
    observer.observe(document.body, {subtree: true, childList: true, characterData: true});
  });
})();
