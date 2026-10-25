---
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
'openspecui': major
---

OpenSpecUI 15: adapt to OpenSpec CLI 1.15.x as a new single-series line (`>=1.15.0 <1.16.0`); the previous 1.14 v14 window, prereleases, `>=1.16.0`, and unparseable versions are blocked by default. The line's one hard contract break: the `openspec version --json` `install.scope` closed enum gains `'standalone'` beside the four historical values, so a standalone binary install no longer fails the whole envelope decode. The new `update --dry-run`/`--json` surfaces and the `openspec install` command stay CLI-owned this release — standalone CLI installs are installed and upgraded with `openspec install`, the standalone upgrade command that reinstalls the binary in place (`openspec update` remains the project instruction-file updater; never switch an install to a different method on your own). The Agent delivery registry rotates to the 1.15 series with every 1.14 physical fact carried forward (upstream ships no new or removed tools this line), and the pinned generator baseline moves to 1.15.0 with series-aware staleness. The pinned executable fixture matrix rotates to `@fission-ai/openspec@1.15.0` with the retained 1.14.3 executable proving below-admitted boundary rejections and the 1.15-only surfaces absent, and the reference submodule pin moves to `v1.15.0` (`8e0288df`). Repository README (en/zh) and the npm package README re-scope to the 1.15 release line; the 1.14 line's READMEs are archived as `README-1.14.0.md` / `README-zh-1.14.0.md`.
