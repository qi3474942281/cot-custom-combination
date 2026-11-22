#!/usr/bin/env python3
"""Inspect the pinned upgrade without publishing or touching browser saves."""
import hashlib, html, json, re, tempfile, urllib.request, zipfile
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import update_upstream as upstream

ROOT = Path(__file__).resolve().parents[1]
TAG = "v0.8.5e-1.0.0"
def attrs(raw):
    text = re.search(r"<tw-storydata\b[^>]*>", raw)[0]
    return dict(re.findall(r'([\w-]+)="([^"]*)"', text))
def passage(raw, name):
    m=re.search(r'<tw-passagedata\b[^>]*name="'+re.escape(name)+r'"[^>]*>(.*?)</tw-passagedata>',raw,re.S)
    return html.unescape(m[1]) if m else ""
def main():
    release=upstream.latest_release()
    assert release.tag==TAG, release.tag
    report={}
    with tempfile.TemporaryDirectory() as tmp:
        for key,pattern in [("normal",upstream.NORMAL_RE),("polyfill",upstream.POLYFILL_RE)]:
            name,url=upstream.select_asset(release.assets,pattern,key)
            path=Path(tmp)/name
            upstream.download(url,path)
            with zipfile.ZipFile(path) as z: new=z.read(upstream.html_member(path)).decode()
            old=(ROOT/"vanilla"/("index.html" if key=="normal" else "polyfill.html")).read_text()
            report[key]={"old":attrs(old),"new":attrs(new),"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"passages":{}}
            anchors={"DisplayNPC":'<div class="npc-display-header">',"SocialWidgets":'<div class="view-people-person-header">',"Character":'<div id="character-dialog" style="width: 38em">',"StoryCaption":'<<if _finishedchargen>>\n    <<run setup.Needs.repair()>>'}
            for p,a in anchors.items():
                report[key]["passages"][p]={"old_anchor":passage(old,p).count(a),"new_anchor":passage(new,p).count(a)}
            for label,raw in [("old",old),("new",new)]:
                sections=[passage(raw,"StoryInit")]
                sections+=re.findall(r'<script[^>]*id="twine-user-script"[^>]*>(.*?)</script>',raw,re.S)
                report[key][label+"_storage"]=[]
                for section in sections:
                    for match in re.finditer(r"(?:Config\.saves|Config\.history|idb\.active|CoTmodData|storageId|Story\.name)", section):
                        report[key][label+"_storage"].append(section[max(0,match.start()-100):match.start()+200])
                report[key][label+"_loader_keys"]=sorted(set(re.findall(r"CoTmodData[A-Za-z0-9_]+",raw)))
            if key=="normal":
                (ROOT/"upgrade-inspection.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(report,ensure_ascii=False,indent=2))
        (ROOT/"upgrade-inspection.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=="__main__":main()
