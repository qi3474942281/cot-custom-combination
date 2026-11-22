#!/usr/bin/env python3
"""Build mods/CoTTextHotfix.mod.zip from tools/text_hotfix sources."""
from __future__ import annotations

import argparse
import io
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'tools' / 'text_hotfix'
OUTPUT = ROOT / 'mods' / 'CoTTextHotfix.mod.zip'
MEMBERS = ('boot.json', 'earlyload.js', 'fixes.json', 'README.md')
ZIP_DATE = (2026, 1, 1, 0, 0, 0)


def load_fixes() -> list[dict]:
    data = json.loads((SRC / 'fixes.json').read_text(encoding='utf-8'))
    fixes = data['fixes']
    if len(fixes) != 2:
        raise SystemExit(f'expected exactly 2 fixes, found {len(fixes)}')
    return fixes


def assert_upstream_typos() -> None:
    pack = ROOT / 'mods' / 'ModI18N.mod.zip'
    with zipfile.ZipFile(pack) as archive:
        items = json.loads(archive.read('i18n.json'))['typeB']['TypeBInputStoryScript']
    typo_items = [item for item in items if isinstance(item.get('t'), str) and '<<<' in item['t']]
    fixes = load_fixes()
    by_passage = {item['pN']: item for item in typo_items}
    if len(typo_items) != 2:
        raise SystemExit(f'expected 2 typo records in ModI18N, found {len(typo_items)}')
    for fix in fixes:
        item = by_passage.get(fix['passage'])
        if not item:
            raise SystemExit(f'ModI18N is missing typo in {fix["passage"]}')
        if fix['from'] not in item['t']:
            raise SystemExit(f'ModI18N typo text no longer matches {fix["id"]}')
        if fix['to'] not in item['f'] and fix['passage'] == 'EventPhoneMailGiftResult':
            raise SystemExit('gift SMS English source no longer has <<dalterneed Romance _romance>>')


def build_zip() -> bytes:
    load_fixes()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in MEMBERS:
            path = SRC / name
            info = zipfile.ZipInfo(name)
            info.date_time = ZIP_DATE
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    return buffer.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-upstream-check', action='store_true')
    args = parser.parse_args()
    if not args.skip_upstream_check:
        assert_upstream_typos()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(build_zip())
    print(f'wrote {OUTPUT}')


if __name__ == '__main__':
    main()
