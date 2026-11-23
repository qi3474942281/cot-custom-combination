#!/usr/bin/env python3
"""Read the pinned game and apply upstream translations at their original offsets.
For offline UI audits only; never writes to game files or browser storage.
"""
import html,json,re,zipfile
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
raw=(ROOT/'vanilla/game.html').read_text()
s=re.search(r'<script[^>]+id="twine-user-script"[^>]*>(.*?)</script>',raw,re.S)[1]
parts=re.split(r'/\* twine-user-script #\d+: "([^"]+)" \*/',s)
scripts={parts[i]:parts[i+1] for i in range(1,len(parts),2)}
passages={html.unescape(m[0]):html.unescape(m[1]) for m in re.findall(r'<tw-passagedata[^>]*name="([^"]+)"[^>]*>(.*?)</tw-passagedata>',raw,re.S)}
with zipfile.ZipFile(ROOT/'mods/ModI18N.mod.zip') as z: rows=json.loads(z.read('i18n.json'))['typeB']
def patch(target,items,key):
    grouped=defaultdict(list)
    for row in items: grouped[row[key]].append(row)
    for name,changes in grouped.items():
        if name not in target: raise ValueError('Missing source: '+name)
        source=target[name]; edits=[]
        for row in changes:
            before=row['f']; pos=row['pos']
            start=max(0,pos-12)
            local=[m.start()+start for m in re.finditer(re.escape(before),source[start:pos+len(before)+12])]
            hit=min(local,key=lambda h:abs(h-pos)) if local else -1
            if hit<0:
                hits=[m.start() for m in re.finditer(re.escape(before),source)]
                if not hits: raise ValueError('Missing translation fragment: '+name)
                hit=min(hits,key=lambda h:abs(h-pos))
            edits.append((hit,len(before),row['t']))
        for pos,size,after in sorted(set(edits),reverse=True): source=source[:pos]+after+source[pos+size:]
        target[name]=source
patch(scripts,[r for r in rows['TypeBOutputText'] if r.get('js')],'fileName')
patch(passages,rows['TypeBInputStoryScript'],'pN')
print(json.dumps({'scripts':scripts,'passages':passages},ensure_ascii=False))
