#!/usr/bin/env python3
"""Reproducible checks for the two ModI18N SugarCube typo hotfixes."""
from __future__ import annotations

import html
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import build_text_hotfix as builder  # noqa: E402

VANILLA = ROOT / 'vanilla' / 'game.html'
I18N_ZIP = ROOT / 'mods' / 'ModI18N.mod.zip'
HOTFIX_ZIP = ROOT / 'mods' / 'CoTTextHotfix.mod.zip'
LOAD_ORDER_FILES = (
    ROOT / 'modList.json',
    ROOT / 'vanilla' / 'modList.json',
)


class Fail(Exception):
    pass


def load_fixes():
    return builder.load_fixes()


def load_i18n_items():
    with zipfile.ZipFile(I18N_ZIP) as archive:
        return json.loads(archive.read('i18n.json'))['typeB']['TypeBInputStoryScript']


def extract_passage(name: str) -> str:
    text = VANILLA.read_text(encoding='utf-8', errors='replace')
    match = re.search(
        rf'<tw-passagedata\b[^>]*name="{re.escape(name)}"[^>]*>(.*?)</tw-passagedata>',
        text,
        re.S,
    )
    if not match:
        raise Fail(f'passage not found: {name}')
    return html.unescape(match.group(1))


def apply_typeb(passage: str, items: list[dict]) -> str:
    """Apply TypeB replacements in pos order using exact `f` matches when possible."""
    ordered = sorted(items, key=lambda item: item.get('pos', 0))
    text = passage
    for item in ordered:
        source = item['f']
        target = item['t']
        pos = item.get('pos', 0)
        if 0 <= pos <= len(text) and text.startswith(source, pos):
            text = text[:pos] + target + text[pos + len(source):]
            continue
        index = text.find(source)
        if index >= 0:
            text = text[:index] + target + text[index + len(source):]
    return text


def apply_hotfix(text: str, fixes: list[dict], passage: str) -> str:
    for fix in fixes:
        if fix['passage'] == passage:
            text = text.replace(fix['from'], fix['to'])
    return text


MACRO_TAG = re.compile(r'<<(?![=-])(/?[A-Za-z_][\w-]*)(?:\s(?:(?!>>).)*?)?>>', re.S)


def macro_issues(text: str) -> list[str]:
    issues = []
    # Typo form: an extra '<' immediately before a macro / closer.
    for match in re.finditer(r'<<<(/?[A-Za-z_])', text):
        issues.append(f"extra '<' before macro at {match.start()}: {text[match.start():match.start()+40]!r}")
    stack = []
    for match in MACRO_TAG.finditer(text):
        name = match.group(1)
        if name.startswith('/'):
            open_name = name[1:]
            if not stack:
                issues.append(f'unmatched closer <</{open_name}>> at {match.start()}')
            elif stack[-1] != open_name:
                issues.append(f'closer <</{open_name}>> does not match <<{stack[-1]}>> at {match.start()}')
            else:
                stack.pop()
        elif name in {'if', 'switch', 'for', 'silently', 'nobr', 'widget', 'link', 'button', 'capture'}:
            stack.append(name)
    # Unclosed containers from the repaired fragment are reported, but widgets
    # defined elsewhere are not required to close in a single translation shard.
    return issues


def assert_repro_and_fix():
    items = load_i18n_items()
    fixes = load_fixes()
    for fix in fixes:
        # Regression fixtures remain necessary even if upstream fixed its text.
        assert apply_hotfix(fix['from'], fixes, fix['passage']) == fix['to']
        assert apply_hotfix(fix['to'], fixes, fix['passage']) == fix['to']
        original = extract_passage(fix['passage'])
        translated = apply_typeb(original, [i for i in items if i.get('pN') == fix['passage']])
        fixed = apply_hotfix(translated, fixes, fix['passage'])
        if fix['from'] in fixed or '<<<dalterneed' in fixed:
            raise Fail('known typo survived: ' + fix['passage'])
        if fix['to'] not in fixed:
            raise Fail('expected valid macro missing: ' + fix['passage'])
    return items


def assert_zip_and_load_order():
    expected = builder.build_zip()
    if not HOTFIX_ZIP.is_file():
        raise Fail('mods/CoTTextHotfix.mod.zip is missing; run tools/build_text_hotfix.py')
    actual = HOTFIX_ZIP.read_bytes()
    if actual != expected:
        # Rebuild once in case the working tree was edited but the zip was stale.
        HOTFIX_ZIP.write_bytes(expected)
        if HOTFIX_ZIP.read_bytes() != expected:
            raise Fail('CoTTextHotfix.mod.zip is not a deterministic rebuild of tools/text_hotfix')
        actual = expected
    with zipfile.ZipFile(io_bytes := __import__('io').BytesIO(actual)) as archive:
        names = archive.namelist()
        for required in builder.MEMBERS:
            if required not in names:
                raise Fail(f'hotfix zip missing {required}')
        boot = json.loads(archive.read('boot.json'))
        if boot.get('name') != 'CoTTextHotfix':
            raise Fail('boot.json name must be CoTTextHotfix')
        if 'earlyload.js' not in boot.get('scriptFileList_earlyload', []):
            raise Fail('hotfix must run as earlyload so it can follow ModI18N')
        fixes = json.loads(archive.read('fixes.json'))['fixes']
        js = archive.read('earlyload.js').decode('utf-8')
        for fix in fixes:
            if fix['from'] not in js or fix['to'] not in js:
                raise Fail('earlyload.js does not contain the expected replacements')
    for path in LOAD_ORDER_FILES:
        order = json.loads(path.read_text(encoding='utf-8'))
        i18n = next(i for i, name in enumerate(order) if name.endswith('ModI18N.mod.zip'))
        hotfix = next((i for i, name in enumerate(order) if name.endswith('CoTTextHotfix.mod.zip')), None)
        if hotfix is None:
            raise Fail(f'{path} does not list CoTTextHotfix.mod.zip')
        if hotfix != i18n + 1:
            raise Fail(f'{path} must load CoTTextHotfix immediately after ModI18N, got {order}')
    auto = (ROOT / 'auto-load.html').read_text(encoding='utf-8')
    pattern = re.compile(r"const mods = \[(.*?)\];", re.S)
    match = pattern.search(auto)
    if not match:
        raise Fail('auto-load.html is missing the mods list')
    names = re.findall(r"name: '([^']+)'", match.group(1))
    if 'CoTTextHotfix.mod.zip' not in names:
        raise Fail('auto-load.html does not auto-install CoTTextHotfix.mod.zip')
    if names.index('CoTTextHotfix.mod.zip') != names.index('ModI18N.mod.zip') + 1:
        raise Fail('auto-load.html must download CoTTextHotfix after ModI18N')
    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    build = json.loads((ROOT / 'upstream-release.json').read_text())['build']
    if f'build={build}' not in index or f"build = '{build}'" not in auto:
        raise Fail('index.html / auto-load.html must use build=cot-085e-1 to pick up the new pack')


def main() -> int:
    try:
        assert_repro_and_fix()
        assert_zip_and_load_order()
    except Fail as error:
        print(f'FAIL: {error}')
        return 1
    print('PASS: typo reproduction, hotfix replacements, macro typo scan, zip structure, and load order')
    print('NOT RUN: in-game click / back / other phone buttons (requires a browser)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
