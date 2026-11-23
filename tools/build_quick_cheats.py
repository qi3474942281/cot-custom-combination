#!/usr/bin/env python3
"""Build the optional quick-cheat controls without editing the core game."""
import io,json,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'tools/quick_cheats'
def build():
    boot={'name':'CoTQuickCheats','version':'1.1.0','scriptFileList_earlyload':['earlyload.js'],
          'scriptFileList':['quick-cheats.js','next-conception.js'],'styleFileList':['quick-cheats.css'],
          'tweeFileList':['widgets.twee'],'imgFileList':[],
          'dependenceInfo':[{'modName':'ModLoader','version':'^2.31.2'},
                            {'modName':'ModI18N','version':'*'},
                            {'modName':'GameVersion','version':'=0.8.5-e'}]}
    files={p.name:p.read_bytes() for p in SOURCE.iterdir() if p.is_file()}
    files['boot.json']=json.dumps(boot,ensure_ascii=False,indent=2).encode()
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,data in sorted(files.items()):
            info=zipfile.ZipInfo(name,date_time=(2026,11,23,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,data)
    return output.getvalue()
if __name__=='__main__':
    data=build();(ROOT/'mods/CoTQuickCheats.mod.zip').write_bytes(data)
    print(f'Built quick cheats: {len(data)} bytes')
