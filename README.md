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
3. `CoTChineseSupplement.mod.zip`：动态地点、住房、房间和常用界面译名补充及租房显示修复。
4. `CoTGameOriginalImagePack.mod.zip`：0.8.5e 原版图片包。
5. `NPCVisualization.mod.zip`：适配当前界面的 NPC 和主角立绘。

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

### 购物界面补充（1.1.0）

购物列表、商品详情及颜色/款式选择显式调用中文标签函数，并支持用中文商品名搜索，同时保留英文查询。复用现有汉化包的 1735 条无歧义商品标签、分类和说明译文；有歧义的名称优先参考对应商品数据的中文名称，不修改商品标识或价格。下拉选项仅更新显示标签，不改变原选项值。

### 造型师页面补充（1.2.0）

修复 VStylistPickStyle 风格下拉框漏译，Map 显式区分中文标签与原英文选择值。覆盖 25 个风格/别名、112 个配色名、57 个配色颜色名及推荐服装名称；保留配色键与风格标识。原生下拉框同时更新 label 和文字，在更改文字前固定原选项值，兼容 iOS 选择器。

### 0.8.5e 汉化覆盖检查（cn4）

补充包 1.3.0 统一补齐动态界面标签，包括当面/手机约会活动和家具材质，复用上游 5947 条无歧义元数据译文。扫描 75 个脚本、5562 个 passage 的可提取菜单字段，排除冲突译名、品牌、人物姓名及玩家输入。CI 生成覆盖清单，并在 Chromium/WebKit 检查商品属性、原始选择值、购物、造型师、约会菜单、租房与存档标识。完整剧情仍以原汉化为基础。

### 快捷作弊补充（qc1）

新增独立 `CoTQuickCheats` Mod：作弊菜单可清除退出希腊社团后的重新加入限制，以及一键补满精力、放松、膀胱、饱食、清洁；招新日期和当前成员资格保持原样。人物详情的回忆页对当前恋人显示恋爱天数，开启作弊后可用 −/+ 每次调整 1 天，最低为 0。天数直接修改该人物的现有恋爱起始日，正常参与游戏的关系时长判断，存档继续使用原有字段。

快捷作弊包 1.1.0（qc2）增加“下一次性爱受孕几率100%”：可开启或取消，等待玩家参与的下一次有效受孕判定，覆盖周期和避孕概率。调用原版怀孕初始化，成功后消耗；不会覆盖已有怀孕，不影响 NPC 之间的模拟，未触发时随存档保留。需要开启怀孕内容。

快捷作弊包 1.1.1（qc3）修复冷却按钮漏掉运动队退队限制：在清除希腊社团退出名单的同时，清除 `pcquitsports`。回归直接渲染学校文娱办公室 `SportsSignup`，验证退队后的 14 天提示在点击按钮后消失、四个报名入口恢复，现有成员、队伍名单和进度保持不变。
