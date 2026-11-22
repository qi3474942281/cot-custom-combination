/* Local-only, immutable snapshot before the 0.8.5e engine or mod update runs. */
(() => {
  const DB = 'CoTUpgradeBackups';
  const STORE = 'snapshots';
  const KEY = 'before-0.8.5e-1';
  function open(name, store) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('备份数据库被其他页面占用，请关闭其他游戏标签页再重试'));
    });
  }
  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function storageCopy(storage) {
    return Object.fromEntries(Array.from({length:storage.length}, (_, i) => {
      const key = storage.key(i);
      return [key, storage.getItem(key)];
    }));
  }
  async function read() {
    const db = await open(DB, STORE);
    try { return await request(db.transaction(STORE).objectStore(STORE).get(KEY)); }
    finally { db.close(); }
  }
  async function ensure() {
    if (await read()) return;
    // Capture browser storage before even downloading/replacing bundled mods.
    const snapshot = {
      schema: 1, target: '0.8.5e', created: new Date().toISOString(),
      origin: location.origin,
      localStorage: storageCopy(localStorage),
      sessionStorage: storageCopy(sessionStorage),
      modCache: []
    };
    const mods = await open('ModLoader_IndexDBLoader', 'ModLoader_IndexDBLoader');
    try {
      snapshot.modCache = await new Promise((resolve, reject) => {
        const tx = mods.transaction('ModLoader_IndexDBLoader');
        const rows = [];
        const req = tx.objectStore('ModLoader_IndexDBLoader').openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (c) { rows.push([c.key, c.value]); c.continue(); }
        };
        tx.oncomplete = () => resolve(rows);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('读取旧模组备份失败'));
      });
    } finally { mods.close(); }
    const db = await open(DB, STORE);
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.get(KEY);
        req.onsuccess = () => { if (!req.result) store.add(snapshot, KEY); };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('保存升级前备份失败'));
      });
    } finally { db.close(); }
    if (!(await read())) throw new Error('升级前备份校验失败');
  }
  function download(snapshot) {
    // Preserve binary mod archives, too. This is a recovery bundle, not a
    // SugarCube .save file; a normal in-game export remains recommended.
    const text = JSON.stringify(snapshot, (_, v) =>
      v instanceof Uint8Array ? {type:'Uint8Array', bytes:Array.from(v)} :
      v instanceof ArrayBuffer ? {type:'Uint8Array', bytes:Array.from(new Uint8Array(v))} : v);
    const url = URL.createObjectURL(new Blob([text], {type:'application/json'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cot-before-085e-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  window.CoTBackup = {ensure, read, download};
})();
