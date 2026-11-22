#!/usr/bin/env python3
"""Adapt Maenoko's mobile NPC portraits to this repository's CoT 0.8.0h UI."""
from __future__ import annotations
import argparse
import hashlib
import html
import io
import json
from pathlib import Path
import re
import urllib.request
import zipfile

SOURCE = 'https://github.com/Maenoko/NPC-Visualization-Mod/releases/download/v1.0.6.3/Modloader_Mobile_Mes.NPC.visualization.mod.1.0.6.2.for.v.0.6.1c.zip'
SOURCE_SHA256 = '0932b5f548d835b00b8fa1cfb73563ddb3a76e894f53d776c9db27bd4dc14aba'
ROOT = Path(__file__).resolve().parents[1]

CSS = '''/* Scoped, responsive layers for the current People cards and NPC dialog. */
.mes-portrait { position:relative; flex-shrink:0; overflow:hidden; aspect-ratio:1; }
.mes-portrait-large { width:150px; margin:0.5em auto; }
.mes-portrait-small { width:60px; float:right; margin:0 0 0.5em 0.5em; }
.mes-portrait > div { position:absolute; inset:0; }
.mes-portrait img { position:absolute; inset:0; width:100%; height:100%; max-width:none; display:block; }
.view-people-person:has(.mes-portrait) { min-height:72px; }
'''


def adapt_snippet(source: str, small: bool) -> str:
    old_anchor = '<<if _niche != null>>' if small else '<<if setup.people.has_number(_personobj.person) and (!_anon or _relwith)>>'
    anchor = '<div class="view-people-person-header">' if small else '<div class="npc-display-header">'
    if not source.rstrip().endswith(old_anchor):
        raise ValueError('Upstream portrait insertion format changed')
    source = source.rstrip()[:-len(old_anchor)].strip()
    # Some upstream disabled examples contain nested comments. Strip them as a
    # balanced block rather than leaving a visible trailing */ in SugarCube.
    clean = []
    position = depth = 0
    while position < len(source):
        if source.startswith('/*', position):
            depth += 1
            position += 2
        elif depth and source.startswith('*/', position):
            depth -= 1
            position += 2
        else:
            if not depth:
                clean.append(source[position])
            position += 1
    if depth:
        raise ValueError('Unbalanced upstream comment')
    source = ''.join(clean)
    source = source.replace('<div style="position: relative;">', '<div class="mes-portrait mes-portrait-' + ('small' if small else 'large') + '" role="img" aria-label="人物立绘">', 1)
    # Modern UI has its own dimensions; repeated cards must not reuse element IDs.
    source = re.sub(r'id="([^\"]+-layer(?:-s|-ghost)?)"', r'class="mes-\1"', source)
    # If no upper garment is present, retain the null initialization rather than
    # indexing clothes[null]. Filter layers continue to handle uncovered bodies.
    source = re.sub(r'} else \{(\s*T\.npctop = T\.displaypanel\.clothes\[top\])', r'} else if (top !== null) {\1', source)
    source = re.sub(r'} else \{(\s*T\.npctop2 = T\.displaypanel\.clothes\[top2\])', r'} else if (top2 !== null) {\1', source)
    source = source.replace('!"face" in currentClothing.covers', '!currentClothing.covers.includes("face")')
    source = source.replace('_npcbeardlength isnot 0', '_npcbeardlength gt 0')
    source = source.replace('setup.people.get_person(_displaypanel).job',
                            '(_displaypanel.temporary ? {} : setup.people.get_person(_displaypanel) || {}).job')
    # The upstream nipple overlay checks the player's clothes; use the displayed NPC.
    source = source.replace('$pc.underwear_covering("breasts") != $pc.outermost_covering("breasts")', '_displaypanel.underwear_covering("breasts") != _displaypanel.outermost_covering("breasts")')

    def fallback(match: re.Match) -> str:
        tag = match[0]
        expr = match[1]
        if 'hair-layer' in tag:
            default = 'res/modimg/hair/neatly combed/short.png'
        elif 'eye-layer' in tag or 'eye-ghost-layer' in tag:
            default = 'res/modimg/eye/g00_eye01.png'
        elif 'style-layer' in tag or 'style-ghost-layer' in tag:
            default = 'res/modimg/style/top/T-shirt/001.png'
        else:
            default = 'res/modimg/background-t.png'
        return tag.replace('@src="' + expr + '"', '@src="setup.MesPortrait.image(' + expr + ', \'' + default + '\')"')

    source = re.sub(r'<img\b[^>]*@src="([^\"]+)"[^>]*>', fallback, source)
    return source + '\n' + anchor


def build(data: bytes) -> bytes:
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError('Upstream archive checksum mismatch')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        files = {name: archive.read(name) for name in archive.namelist() if not name.endswith('/')}
    boot = json.loads(files['boot.json'])
    boot['version'] = '1.0.6.2-cot080h.1'
    boot['styleFileList'] = ['modules/containerfornpccomponents.css', 'modules/current-ui.css']
    boot['scriptFileList'] = ['modules/portrait-assets.js']
    boot['additionFile'].append('COMPATIBILITY.md')
    replacements = next(p for p in boot['addonPlugin'] if p['modName'] == 'TweeReplacer')['params']
    for rule in replacements:
        small = rule['passage'] == 'Social'
        rule['passage'] = 'SocialWidgets' if small else 'DisplayNPC'
        rule['findString'] = '<div class="view-people-person-header">' if small else '<div class="npc-display-header">'
        rule['all'] = False
        rule['debug'] = False
        files[rule['replaceFile']] = adapt_snippet(files[rule['replaceFile']].decode('utf-8-sig'), small).encode()
        for game in ['index.html', 'polyfill.html']:
            raw = (ROOT / 'vanilla' / game).read_text()
            passage = re.search(r'<tw-passagedata\b[^>]*name="' + rule['passage'] + r'"[^>]*>(.*?)</tw-passagedata>', raw, re.S)
            if not passage or html.unescape(passage[1]).count(rule['findString']) != 1:
                raise ValueError(f'Expected exactly one {rule["passage"]} insertion point in {game}')
    files['modules/current-ui.css'] = CSS.encode()
    files['modules/portrait-assets.js'] = ('(() => {\nconst paths = new Set(' + json.dumps(boot['imgFileList'], ensure_ascii=False) + ');\nsetup.MesPortrait = {image(path, fallback) {return paths.has(path) ? path : fallback;}};\n})();\n').encode()
    files['COMPATIBILITY.md'] = ('# CoT 0.8.0h compatibility\n\nOriginal portraits and artwork: Maenoko / NPC-Visualization-Mod, mobile v1.0.6.2.\n' + SOURCE + '\n\nAdaptation: current DisplayNPC and SocialWidgets insertion points; scoped responsive layers; guards for uncovered upper bodies; fallback art for new clothing/hair missing from the original pack.\nOriginal README and all artwork are retained.\n').encode()
    files['boot.json'] = (json.dumps(boot, ensure_ascii=False, indent=2) + '\n').encode()
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, date_time=(2026, 11, 22, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, files[name])
    return output.getvalue()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Previously downloaded upstream archive')
    args = parser.parse_args()
    data = args.source.read_bytes() if args.source else urllib.request.urlopen(SOURCE, timeout=120).read()
    target = ROOT / 'mods' / 'NPCVisualization.mod.zip'
    target.write_bytes(build(data))
    print(f'Built {target.name}: {target.stat().st_size} bytes')
