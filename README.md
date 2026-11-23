# Course of Temptation 汉化整合版

当前固定版本：**0.8.5e**，汉化 **1.0.0**，ModLoader **2.101.1**。
来源：[汉化作者发布页](https://github.com/BlackTeaPie/Course-of-Temptation-Chinese-Localization/releases/tag/v0.8.5e-1.0.0)。
附件地址与 SHA-256 固定在 `upstream-release.json`，更新时逐一校验。

[进入游戏](https://qi3474942281.github.io/cot-custom-combination/) ·
[下载升级前本机备份](https://qi3474942281.github.io/cot-custom-combination/backup.html)

## 存档与设置

游戏名称、IFID、SugarCube 2.36.1 和原有模组存储键保持一致，沿用原浏览器的存档与设置。
首页及旧的 `vanilla/index.html`、`vanilla/polyfill.html` 书签先经过备份和模组安装，再进入对应的游戏文件。

首次升级时，`save-backup.js` 在独立的 `CoTUpgradeBackups` 数据库中保留一份 localStorage、sessionStorage 和 ModLoader 缓存快照。
该快照只保存在本机，不上传，也不会被后续进入覆盖。备份失败时不继续更新模组或启动新版。
iPhone 上游戏沿用 localStorage 存档；此备份不包含桌面版可能使用的独立游戏存档 IndexedDB。

仍建议先通过游戏“存档 → 导出”保留标准存档文件。备份页下载的 JSON 是恢复用数据包，不能直接作为游戏 .save 导入。
不要清除网站数据。浏览器清理、无痕模式、换设备均可能使本机存档及本机备份不可用。
自动备份不是存档兼容性保证；升级后的剧情迁移仍由游戏上游负责。

升级前代码与全部整合模组保存在分支 `backup/cot080h-before-085e-20261123`。
需要回退时应同时评估存档版本；请保留升级前导出的存档，不要直接用旧引擎覆盖新版进度。

## 保留的模组

加载顺序由两个 `modList.json` 和 `auto-load.html` 保持一致：

1. `ModI18N.mod.zip`：0.8.5e 官方汉化包。
2. `CoTTextHotfix.mod.zip`：礼物短信及另一处 SugarCube 标签笔误修复，上游已修复时不重复改动。
3. `CoTGameOriginalImagePack.mod.zip`：0.8.5e 原版图片包。
4. `NPCVisualization.mod.zip`：适配当前界面的 NPC 和主角立绘。

[Maenoko 的立绘原作](https://github.com/Maenoko/NPC-Visualization-Mod)手机版图片及 README 均保留。
适配包在 NPC 列表、NPC 详情、主角面板和创建角色后的侧栏显示分层静态立绘；
缺少的服装、发型图片使用已有图片回退。此模组不提供场景动画。
已有的其他旁加载模组及其启用列表保留；其与新版的兼容性由各模组决定。

## 更新与验证

```sh
python update_upstream.py --check
python update_upstream.py --force
python tools/test_text_hotfix.py
npm install --no-save playwright@1.56.1
npx playwright install --with-deps chromium webkit
node tools/test_upgrade.cjs
```

浏览器检查依赖 `.compat-old` 中的升级前引擎，工作流会从备份分支准备。
在隔离测试配置中检查旧版真实存档槽能否被新版识别、存档标识、
原始数据备份、其他模组保留、下载失败阻止启动、模组插入点与主角图片加载。
测试不读取玩家手机，不能代替玩家实际进度的迁移验证。

每日工作流仅查询新发布，不再未经适配就覆盖线上文件。
`--publish` 可提交并推送已固定版本；未审核的新版本会被拒绝。
立绘包可用 `python tools/build_npc_portraits.py` 重建，
文本修复可用 `python tools/build_text_hotfix.py` 重建。

## 界面汉化补充（1.0.0）

新增 `CoTChineseSupplement.mod.zip`，提供 244 个地点、住房、房间和常用界面译名，地图与房间类型译名沿用原汉化。按显示文本匹配，不改住房键、房间 ID、商品键、存档数据或输入/下拉框的值。补充房间名称显示，并修复租房成功提示在住房外调用房间标签导致的报错。保留原汉化、短信修复、图片与立绘。

构建：`python tools/build_chinese_supplement.py`。浏览器回归：`node tools/test_chinese_supplement.cjs`；在隔离配置中重现原租房报错，再检查补丁后的租房扣款、住房登记、房间编号、中文显示、存档标识和输入框值不变。此补充包不代表全部剧情已逐句校对。
