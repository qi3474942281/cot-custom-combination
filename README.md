# cot-custom-combination

## 更新上游汉化版

脚本使用 Python 标准库，无需安装依赖。它会查询
`BlackTeaPie/Course-of-Temptation-Chinese-Localization` 的最新 release，并完成以下操作：

- 从普通版与兼容版加载器压缩包中提取 HTML，保存为固定文件名
  `vanilla/index.html` 和 `vanilla/polyfill.html`。
- 将图片包和汉化包去掉版本号后保存为
  `mods/CoTGameOriginalImagePack.mod.zip` 和 `mods/ModI18N.mod.zip`。
- 更新首页版本号、加载器元数据，并启用兼容模式入口。

仅更新本地文件：

```powershell
python .\update_upstream.py
```

仅检查是否存在新版本：

```powershell
python .\update_upstream.py --check
```

更新后自动提交并推送到 `origin`：

```powershell
python .\update_upstream.py --publish
```

`--publish` 要求运行前工作区干净。脚本默认根据首页中的
`cot-loader-version` 元数据判断是否需要更新；使用 `--force` 可强制重新下载。
设置 `GITHUB_TOKEN` 或 `GH_TOKEN` 可以避免 GitHub API 的匿名请求限流；
未设置或 API 限流时，脚本会自动改用 GitHub release 页面查询。

## 自动更新

GitHub Actions 工作流每天北京时间凌晨 3:17 自动运行更新脚本。也可以在仓库的
Actions 页面手动运行 `Update upstream release` 工作流，或发送类型为
`upstream_release` 的 `repository_dispatch` 事件触发更新。

工作流使用仓库自带的 `GITHUB_TOKEN` 提交并推送更新，需要仓库允许 GitHub
Actions 对内容进行写入。

## NPC 人物立绘

已随游戏自动加载 Maenoko 的 [NPC-Visualization-Mod](https://github.com/Maenoko/NPC-Visualization-Mod) 手机版，并为当前 CoT 0.8.0h 的人物界面做兼容处理。NPC 立绘显示在人物列表和 NPC 详情页；主角立绘显示在创建角色完成后的侧栏，以及主角自己的“人物”面板。立绘随外观、发型及衣服变化。

`mods/NPCVisualization.mod.zip` 保留原作者的图片和 README。兼容包由 `tools/build_npc_portraits.py` 构建；脚本会校验固定上游发行包的 SHA-256，以及标准/兼容模式中的插入位置。重建方式：

```sh
python tools/build_npc_portraits.py
```

没有对应图片的新增发型和衣服会使用原图包中的回退图片。

## 汉化文本热修复

`mods/CoTTextHotfix.mod.zip` 只修正汉化里两处 SugarCube 标签笔误，不改关系或需求数值，也不改存档：

- 礼物短信结果 `EventPhoneMailGiftResult`：`<<<dalterneed Romance _romance>>` 改回 `<<dalterneed Romance _romance>>`
- `EventSmashersShootSuperheroDom4`：`<<</if>>` 改回 `<</if>>`

该包必须排在 `ModI18N.mod.zip` 之后加载。
自行加载时请把该 zip 放在 `ModI18N.mod.zip` 后面，不要清除网站数据或存档。若使用本仓库的 `auto-load.html`（构建号 `text-hotfix-1`），它会在已有模组列表中插入热修复包并保留你原来安装的其他模组，不会清空存档。

重建与自动检查：

```sh
python tools/build_text_hotfix.py
python tools/test_text_hotfix.py
```
