## Implementation State

- 当前阶段：执行用户批准的 translator engine platform plan。
- 先建立 OpenSpec loop artifacts，再按 core -> packages -> server -> web -> tests 顺序实施。

## Decisions Taken

- 平台法则优先：新增统一 Translator contract、engine registry、install session 和 runtime resolver。
- 原子正交：browser/NMT/AI 各自为独立 package，平台只依赖协议和 metadata。
- npm alias 是运行时安装法则；local/dev 只切换 resolver，不改变业务 API。
- v1 统一使用 `tsdown`。
- NMT model 选择升级为平台能力，而不是 Settings 文本框补丁：
  - 用户参与模型选择；
  - 搜索以 target language 为重要输入；
  - 排序采用趋势 + 语言适配 + 体积成本的混合排序；
  - UI 展示模型技术简介、体积和兼容性。
- 用户最终选择的是“模型方案”，不是直接手选某个 `.onnx` 文件；
  runtime 再解析实际下载计划，并在安装前展示计划摘要与预计体积。
- NMT install 的平台定义升级为 “package install + model prepare/download + ready” 单一会话；
  不再把模型下载延后到首次 translate。
- Hugging Face 模型目录使用官方 Hub API 的 server-side proxy；
  web 不直接访问 HF API，因为其 CORS 不对第三方页面开放。
- 为了本地走查，必须选择一个极小的 ONNX 翻译模型，完成真实下载与翻译验证，证明接口可用。

## Divergence Notes

- 先前偏差已经在本轮收敛：
  - `installEngine('nmt')` 现在覆盖 package install / local resolver + model prepare + ready。
  - NMT model 已升级为自动补全 Popover，并显示模型说明、体积和下载计划。
  - server 通过 Hugging Face Hub API 聚合详情，并按趋势 + 语言匹配 + 体积成本混合排序。
  - install session 增加了取消后的 session guard，避免后台 prepare 把状态误写回 `installed`。
  - install progress 日志增加去重/节流，避免 Transformers.js 高频进度事件淹没单行日志。
  - server 增加了 proxy-aware fetch dispatcher，Hugging Face 目录查询与 Transformers.js 模型下载都遵守当前机器的代理环境，而不是只依赖 Node 默认直连。

## Loopback Triggers

- 如果动态 import alias 在 bundled CLI 中无法稳定解析，需要回到 research-plan 调整 resolver law。
- 如果 TanStack AI 当前 API 与计划入口不一致，需要先封装 package 内部 adapter，不污染平台协议。
- 如果 Transformers.js 模型下载进度事件过于嘈杂，继续增强进度聚合策略，而不是回退到多行终端流。
- 如果 Hugging Face 目录接口无法稳定给出体积，则在 server 侧补二段详情查询/聚合；
  不回退到前端爬网页。

## Verification Evidence

- Focused tests:
  - `pnpm --filter @openspecui/server test -- src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx --project unit`
  - `pnpm --filter @openspecui/server test -- src/translation-model-catalog.test.ts src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/web typecheck`
- Real runtime smoke:
  - Command: `pnpm verify:nmt`
  - Model: `Xenova/opus-mt-no-de`
  - Verified-catalog audit: among current Hugging Face `transformers.js + onnx + translation` candidates, this was the smallest resolved ONNX plan found during the audit.
  - Resolved ONNX plan: 2 files, about `53506014` bytes total (`~51 MB` binary size display).
  - Observed install session:
    - `Using local workspace package.`
    - `Preparing NMT model Xenova/opus-mt-no-de (~51 MB).`
    - `NMT model Xenova/opus-mt-no-de is ready.`
    - final install state `installed`
  - Real translation:
    - source: `Dette er en liten oversettelsestest fra norsk til tysk.`
    - output: `Dies ist eine leichte Übersetzung aus Norwegisch- und Deutschen.`
