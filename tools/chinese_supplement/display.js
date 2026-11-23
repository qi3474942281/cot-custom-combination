(() => {
  const terms = /* TERMS */;
  const shopping = /* SHOPPING */;
  const stylist = /* STYLIST */;
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
  function shopText(value) {
    return typeof value === 'string' ? (shopping[value] || text(value)) : value;
  }
  function shopLabel(item) {
    if (!item) return '';
    const label = item.label || item.item || '';
    if (/[\u4e00-\u9fff]/.test(label)) return label;
    const translated = shopText(label);
    if (translated !== label) return translated;
    const info = setup.Shops?.databases?.[item.type]?.[item.item];
    const name = info?.cn_name;
    return typeof name === 'string' && /[\u4e00-\u9fff]/.test(name) && !name.includes('%') ? name : label;
  }
  function shopOption(item, sub, value) {
    const info = setup.Shops?.databases?.[item?.type]?.[item?.item];
    const values = info?.['sub ' + sub];
    const names = info?.[sub + '_cn_name'];
    const index = Array.isArray(values) ? values.indexOf(value) : -1;
    if (index >= 0 && Array.isArray(names) && names[index]) return names[index];
    for (const key of ['clothes_standard_cloth_colors', 'clothes_advanced_cloth_colors',
      'clothes_standard_denim_colors', 'clothes_standard_leather_colors', 'clothes_neon_colors',
      'standard_furniture_colors', 'standard_furniture_leather_colors']) {
      const i = setup[key]?.indexOf(value) ?? -1;
      if (i >= 0 && setup[key + '_cn_name']?.[i]) return setup[key + '_cn_name'][i];
    }
    return shopText(typeof value === 'string' ? setup.capitalize_each(value) : value);
  }
  function styleLabel(value) {
    if (typeof value !== 'string') return value;
    const key = value.toLowerCase();
    return stylist.styles[key] || setup.styles_cn_name?.[key] || shopText(value);
  }
  function styleOptions(values) {
    return new Map(values.map(value => [styleLabel(value), value]));
  }
  function paletteLabel(key) { return stylist.palettes[key] || shopText(key); }
  function colorLabel(value) { return stylist.colors[value] || shopOption(null, 'color', value); }
  function garmentLabel(item) {
    return shopLabel({...item, type: 'clothes', item: item.item || item.archetype});
  }
  function garmentStyleLabel(item) {
    const label = shopOption({...item, type: 'clothes'}, 'style', item.style);
    return /[\u4e00-\u9fff]/.test(label || '') ? label : styleLabel(item.style);
  }
  setup.CoTChinese = {text, unitLabel, shopText, shopLabel, shopOption,
    styleLabel, styleOptions, paletteLabel, colorLabel, garmentLabel, garmentStyleLabel, version: '1.2.0',
    termCount: Object.keys(terms).length, shoppingCount: Object.keys(shopping).length};

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
    const core = units.trim();
    const translated = shopping[core] ? units.replace(core, () => shopping[core]) : text(units);
    if (translated !== node.data) node.data = translated;
  }
  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { translateNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    // iOS native pickers must also receive translated textContent. Freeze the
    // original implicit value before changing either visible caption.
    const options = root.matches('option') ? [root] : root.querySelectorAll('option');
    for (const option of options) {
      if (!option.closest(roots)) continue;
      const label = styleLabel(shopText(option.label));
      if (label !== option.label || (/[\u4e00-\u9fff]/.test(label) && /[A-Za-z]/.test(option.textContent))) {
        const value = option.value;
        option.value = value;
        option.label = label;
        option.textContent = label;
      }
    }
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
