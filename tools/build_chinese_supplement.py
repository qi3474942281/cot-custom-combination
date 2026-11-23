#!/usr/bin/env python3
"""Build the display-only Chinese supplement deterministically."""
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'tools/chinese_supplement'

def build():
    terms = json.loads((SOURCE / 'terms.json').read_text())
    fixes = json.loads((SOURCE / 'fixes.json').read_text())
    shopping = json.loads((SOURCE / 'shopping.json').read_text())
    boot = {
        'name': 'CoTChineseSupplement', 'version': '1.1.0',
        'scriptFileList_earlyload': ['earlyload.js'],
        'scriptFileList': ['display.js'], 'styleFileList': [],
        'tweeFileList': [], 'imgFileList': [],
        'additionFile': ['README.md', 'terms.json', 'fixes.json', 'shopping.json'],
        'dependenceInfo': [
            {'modName': 'ModLoader', 'version': '^2.31.2'},
            {'modName': 'ModI18N', 'version': '*'},
            {'modName': 'GameVersion', 'version': '=0.8.5-e'},
        ],
    }
    files = {name: (SOURCE / name).read_bytes() for name in ['README.md', 'terms.json', 'fixes.json', 'shopping.json']}
    files['boot.json'] = json.dumps(boot, ensure_ascii=False, indent=2).encode()
    for name, marker, data in [('earlyload.js', '/* FIXES */', fixes), ('display.js', '/* TERMS */', terms)]:
        source = (SOURCE / name).read_text()
        if name == 'display.js':
            assert source.count('/* SHOPPING */') == 1
            source = source.replace('/* SHOPPING */', json.dumps(shopping, ensure_ascii=False))
        assert source.count(marker) == 1
        files[name] = source.replace(marker, json.dumps(data, ensure_ascii=False)).encode()
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 11, 23, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    return output.getvalue()

if __name__ == '__main__':
    data = build()
    (ROOT / 'mods/CoTChineseSupplement.mod.zip').write_bytes(data)
    print(f'Built Chinese supplement: {len(data)} bytes')
