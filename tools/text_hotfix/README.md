# CoTTextHotfix

Fixes two typo-only SugarCube tag errors introduced by the Chinese TypeB
translation in `ModI18N`. It does not change relationship or need values,
save data, or other passage text.

1. `EventPhoneMailGiftResult`: `<<<dalterneed Romance _romance>>` → `<<dalterneed Romance _romance>>`
2. `EventSmashersShootSuperheroDom4`: `<<</if>>` → `<</if>>`

This pack must load after `ModI18N.mod.zip`. Rebuild with:

```
python tools/build_text_hotfix.py
python tools/test_text_hotfix.py
```
