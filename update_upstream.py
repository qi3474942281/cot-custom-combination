#!/usr/bin/env python3
"""Update the repository from the latest Chinese localization release."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path


REPOSITORY = "BlackTeaPie/Course-of-Temptation-Chinese-Localization"
API_URL = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
LATEST_URL = f"https://github.com/{REPOSITORY}/releases/latest"
USER_AGENT = "cot-custom-combination-updater/1.0"

NORMAL_RE = re.compile(r"^CoT-ModLoader-.+(?<!-polyfill)\.zip$")
POLYFILL_RE = re.compile(r"^CoT-ModLoader-.+-polyfill\.zip$")
IMAGE_RE = re.compile(r"^GameOriginalImagePack-.+\.zip$")
I18N_RE = re.compile(r"^ModI18N-.+\.zip$")


@dataclass(frozen=True)
class Release:
    tag: str
    assets: dict[str, str]


def request(url: str) -> urllib.request.Request:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return urllib.request.Request(url, headers=headers)


def latest_release() -> Release:
    try:
        with urllib.request.urlopen(request(API_URL), timeout=30) as response:
            payload = json.load(response)
        return Release(
            tag=payload["tag_name"],
            assets={asset["name"]: asset["browser_download_url"] for asset in payload["assets"]},
        )
    except (urllib.error.URLError, KeyError, json.JSONDecodeError) as error:
        print(f"GitHub API 不可用，改用发布页面查询：{error}", file=sys.stderr)
        return latest_release_from_page()


def latest_release_from_page() -> Release:
    with urllib.request.urlopen(request(LATEST_URL), timeout=30) as response:
        final_url = response.geturl()
    marker = "/releases/tag/"
    if marker not in final_url:
        raise RuntimeError(f"无法从最新发布地址识别 tag：{final_url}")

    tag = urllib.parse.unquote(final_url.split(marker, 1)[1])
    expanded_url = f"https://github.com/{REPOSITORY}/releases/expanded_assets/{urllib.parse.quote(tag)}"
    with urllib.request.urlopen(request(expanded_url), timeout=30) as response:
        page = response.read().decode("utf-8")

    quoted_repository = re.escape(f"/{REPOSITORY}/releases/download/")
    pattern = re.compile(
        rf'href="({quoted_repository}{re.escape(urllib.parse.quote(tag, safe=""))}/([^"]+))"'
    )
    assets = {}
    for path, encoded_name in pattern.findall(page):
        name = html.unescape(urllib.parse.unquote(encoded_name))
        assets[name] = urllib.parse.urljoin("https://github.com", html.unescape(path))
    if not assets:
        raise RuntimeError(f"发布 {tag} 中未找到附件")
    return Release(tag=tag, assets=assets)


def select_asset(
    assets: dict[str, str], pattern: re.Pattern[str], description: str
) -> tuple[str, str]:
    matches = [(name, url) for name, url in assets.items() if pattern.fullmatch(name)]
    if len(matches) != 1:
        names = ", ".join(name for name, _ in matches) or "无"
        raise RuntimeError(f"{description}附件应恰好有一个，实际找到：{names}")
    return matches[0]


def current_loader(index_path: Path) -> str | None:
    content = index_path.read_text(encoding="utf-8")
    match = re.search(r'<meta name="cot-loader-version" content="([^"]+)"\s*/?>', content)
    return match.group(1) if match else None


def download(url: str, target: Path) -> None:
    print(f"下载 {target.name}")
    with urllib.request.urlopen(request(url), timeout=180) as response:
        with target.open("wb") as output:
            shutil.copyfileobj(response, output)


def html_member(archive: Path) -> str:
    with zipfile.ZipFile(archive) as bundle:
        members = [
            name
            for name in bundle.namelist()
            if not name.endswith("/") and name.lower().endswith(".html")
        ]
        if len(members) != 1:
            raise RuntimeError(
                f"{archive.name} 应恰好包含一个 HTML，实际找到 {len(members)} 个"
            )
        return members[0]


def extract_html(archive: Path, member: str, target: Path) -> None:
    with zipfile.ZipFile(archive) as bundle:
        with bundle.open(member) as source, target.open("wb") as output:
            shutil.copyfileobj(source, output)

def remove_itchio_scripts(input_file: Path, output_file: Path | None = None):
    if output_file is None:
        output_file = input_file
    html = input_file.read_text(encoding="utf-8")
    pattern = re.compile(
        r'<script[^>]*\s+src\s*=\s*["\']?[^"\'>]*itch\.io[^"\'>]*["\']?[^>]*>.*?</script>',
        re.IGNORECASE | re.DOTALL
    )
    clean_html = pattern.sub('', html)
    temp_output = output_file.with_name(f"{output_file.name}.tmp")
    temp_output.write_text(clean_html, encoding="utf-8", newline="")
    try:
        temp_output.replace(output_file)
    except PermissionError:
        output_file.unlink(missing_ok=True)
        temp_output.replace(output_file)

def game_version(loader_name: str) -> str:
    match = re.fullmatch(r"CoT-ModLoader-v(.+)-v[^/]+\.zip", loader_name)
    if not match:
        raise RuntimeError(f"无法从附件名识别游戏版本：{loader_name}")
    return match.group(1)


def update_index(index_path: Path, loader_name: str, version: str) -> None:
    content = index_path.read_text(encoding="utf-8")
    meta = f'<meta name="cot-loader-version" content="{loader_name}">'
    content = re.sub(r'<meta name="cot-loader-version"[^>]*>\s*', '', content)
    if "<head>" not in content:
        raise RuntimeError("首页缺少 head")
    content = content.replace("<head>", "<head>\n" + meta, 1)
    index_path.write_text(content, encoding="utf-8", newline="\n")


def run_git(root: Path, *args: str, capture: bool = False) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        check=True,
        text=True,
        capture_output=capture,
    )
    return result.stdout.strip() if capture else ""


def publish(root: Path, tag: str) -> None:
    paths = ["index.html", "vanilla", "mods"]
    run_git(root, "add", "--", *paths)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=root).returncode == 0:
        print("没有需要提交的变更")
        return
    run_git(root, "commit", "-m", f"更新上游汉化版至 {tag}")
    run_git(root, "push", "origin", "HEAD")
    print(f"已提交并推送 {tag}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只检查是否有更新，不下载或修改文件")
    parser.add_argument("--publish", action="store_true", help="更新后提交并推送到 origin")
    parser.add_argument("--force", action="store_true", help="即使加载器文件名一致也重新下载替换")
    args = parser.parse_args()
    if args.check and (args.publish or args.force):
        parser.error("--check 不能与 --publish 或 --force 同时使用")
    return args


def main() -> int:
    args = parse_args()
    root = Path(__file__).resolve().parent
    manifest = json.loads((root / "upstream-release.json").read_text())
    release = latest_release()
    normal = select_asset(release.assets, NORMAL_RE, "普通版")
    if args.check:
        print(f"已适配 {manifest['tag']}；上游最新 {release.tag}。仅检查，不自动覆盖已验证版本。")
        return 0
    if release.tag != manifest["tag"]:
        raise RuntimeError("上游版本尚未适配；先更新固定清单、验证立绘和旧存档，再发布")
    if args.publish and run_git(root, "status", "--porcelain", capture=True):
        raise RuntimeError("--publish 要求工作区干净")
    if current_loader(root / "index.html") == normal[0] and not args.force:
        print("当前已经是经过适配的 " + manifest["tag"])
        return 0
    targets = {
        normal[0]: "vanilla/game.html",
        select_asset(release.assets, POLYFILL_RE, "兼容版")[0]: "vanilla/game-polyfill.html",
        select_asset(release.assets, IMAGE_RE, "原版图片")[0]: "mods/CoTGameOriginalImagePack.mod.zip",
        select_asset(release.assets, I18N_RE, "汉化")[0]: "mods/ModI18N.mod.zip",
    }
    import hashlib
    with tempfile.TemporaryDirectory(prefix="cot-update-") as temp:
        temp_dir = Path(temp)
        staged = {}
        for name, target in targets.items():
            expected = manifest["assets"][name]
            if release.assets[name] != expected["url"]:
                raise RuntimeError("附件地址与已审核清单不符：" + name)
            archive = temp_dir / name
            download(expected["url"], archive)
            if hashlib.sha256(archive.read_bytes()).hexdigest() != expected["sha256"]:
                raise RuntimeError("附件 SHA-256 校验失败：" + name)
            with zipfile.ZipFile(archive) as bundle:
                if bundle.testzip():
                    raise RuntimeError("ZIP 校验失败：" + name)
            if target.endswith(".html"):
                staged[target] = temp_dir / Path(target).name
                extract_html(archive, html_member(archive), staged[target])
                remove_itchio_scripts(staged[target])
                raw = staged[target].read_text()
                # Keep the original game identity and loader storage keys.
                for expected_text in [
                    'name="Course of Temptation"',
                    'ifid="0614E98D-503D-4EA0-97CC-B400D785FEDF"',
                    'format-version="2.36.1"',
                    'CoTmodDataIndexDBZipList',
                    'CoTmodDataIndexDBZip',
                ]:
                    if expected_text not in raw:
                        raise RuntimeError("存档或模组存储标识变化：" + expected_text)
                if "0.8.5e" not in raw:
                    raise RuntimeError("游戏版本不符")
            else:
                staged[target] = archive
        for target, path in staged.items():
            dest = root / target
            dest.parent.mkdir(exist_ok=True)
            shutil.copyfile(path, dest)
    # Existing game bookmarks now pass through backup + mod refresh before boot.
    for name, mode in [("index.html", ""), ("polyfill.html", "&mode=polyfill")]:
        url = "../auto-load.html?build=" + manifest["build"] + mode
        (root / "vanilla" / name).write_text(
            '<!doctype html><html lang="zh-CN"><meta charset="UTF-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>正在保护旧存档并加载游戏</title>'
            f'<meta http-equiv="refresh" content="0;url={url}">'
            f'<a href="{url}">继续进入游戏</a></html>', encoding="utf-8")
    subprocess.run([sys.executable, "tools/build_npc_portraits.py"], cwd=root, check=True)
    subprocess.run([sys.executable, "tools/build_text_hotfix.py"], cwd=root, check=True)
    subprocess.run([sys.executable, "tools/test_text_hotfix.py"], cwd=root, check=True)
    update_index(root / "index.html", normal[0], manifest["version"])
    print("已准备 " + manifest["tag"] + "；汉化、原版图片、NPC/主角立绘和短信修复均保留")
    if args.publish:
        publish(root, release.tag)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError, zipfile.BadZipFile) as error:
        print(f"更新失败：{error}", file=sys.stderr)
        raise SystemExit(1)
