#!/usr/bin/env python3
"""Reuse unambiguous display translations from the pinned ModI18N archive."""
import collections
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = {'database_shop.js', 'database_clothes.js', 'database_food.js',
         'database_dormstuff.js', 'database_cosmetics.js', 'database_miscitems.js'}
FIELD = re.compile(r'"?(label|description)"?\s*:\s*("(?:[^"\\]|\\.)*")')

def extract():
    with zipfile.ZipFile(ROOT / 'mods/ModI18N.mod.zip') as archive:
        rows = json.loads(archive.read('i18n.json'))['typeB']['TypeBOutputText']
    choices = collections.defaultdict(set)
    for row in rows:
        if row.get('fileName') not in FILES:
            continue
        source, target = collections.defaultdict(list), collections.defaultdict(list)
        for field, value in FIELD.findall(row['f']):
            source[field].append(json.loads(value))
        for field, value in FIELD.findall(row['t']):
            target[field].append(json.loads(value))
        for field, values in source.items():
            if len(values) != len(target[field]):
                continue
            for english, chinese in zip(values, target[field]):
                if re.search('[A-Za-z]', english) and re.search('[\u4e00-\u9fff]', chinese):
                    choices[english].add(chinese)
    return {key: next(iter(values)) for key, values in choices.items() if len(values) == 1}

if __name__ == '__main__':
    terms = extract()
    (ROOT / 'tools/chinese_supplement/shopping.json').write_text(
        json.dumps(terms, ensure_ascii=False, indent=2) + '\n')
    print(f'Extracted {len(terms)} unambiguous display translations')
