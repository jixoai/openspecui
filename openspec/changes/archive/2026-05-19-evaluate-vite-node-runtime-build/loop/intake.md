## User Input

<user>我的想法是，用vite@v8替代tsdown。只是一个想法，还需要调查和讨论：

由于 Vite 8 提出了全新的环境 API（Environment API）并内置了强大的底层模块运行器，你需要通过“条件导出（Conditional Exports）+ 多入口库模式（Multi-Entry Lib Mode）”的黄金组合来实现这个闭环。

第一步：配置 package.json（源码即标准）
Vite 8 完全遵循 Node.js 条件导出规范。你可以在 package.json 里利用 development（开发期条件）直接指向 .ts 源码，而在 default 或 import 里指向未来的打包产物。

开发时（npm run dev）：使用 tsx 运行，它会触发 development 环境变量，使得代码中所有的自引用（Self-Reference）路径直接指向 src/_.ts 文件。
发布后：用户作为依赖安装时，Node.js 无法命中 development 灰度，会自动落入 default 规则，解析到 dist/_.js 编译产物。

第二步：编写主/子进程代码（完全面向 TS 心智）

得益于上面的配置，你在主进程里不需要写任何动态后缀检测或 dist 路径。直接通过你的 Package Name 自引用加载子进程。

或者也可以使用 worker_thread 模块。不过我们没有共享内存的需求，所以也许不需要。但 worker 的成本更低，启动会更快。综合体验会更好，所以你考虑一下，如果 deno/bun/node 都能全面兼容，那么可以考虑改用 worker。通讯的能力还能更强

第三步：配置 Vite 8 vite.config.ts（实现自动发布重写）
Vite 8 采用 Rolldown 作为底层，打包速度极快。为了能够把多进程所需的多个入口文件在发布时打包到位，你需要把它们配置为多入口 Library。</user>

<user>同意，毕竟vite8其实更扁平。tsdown内置了更多的能力。那就按你说的开始探索</user>

## Objective Scope

- Explore whether OpenSpecUI Node-facing packages should keep `tsdown`, switch to Vite 8 library mode, or adopt a hybrid law based on conditional exports.
- Investigate a platform law where development runtime resolution uses source TypeScript through Node conditional exports, while published runtime resolution uses built `dist` artifacts.
- Verify the user's assumption that `tsx` development automatically activates the `development` export condition, and record the actual behavior across Node/tsx and potentially Bun/Deno if practical.
- Evaluate whether Vite 8 Environment API / ModuleRunner is appropriate for OpenSpecUI CLI/server runtime execution, not only for web/SSR framework use cases.
- Evaluate multi-entry library output for `openspecui`, `@openspecui/server`, and `@openspecui/core` style packages, including CLI bin entries, subpath exports, declaration output, external native dependencies, and workspace self-reference.
- Compare `child_process` and `worker_threads` only for runtime topology fit; do not migrate worktree handoff or process management during this exploration.
- Produce an evidence-backed recommendation and an implementation plan if migration is justified.

## Non-Goals

- Do not replace `tsdown` with Vite in this loop.
- Do not change package exports, build scripts, CLI startup, worktree handoff behavior, or release scripts as part of exploration.
- Do not mix this research with the active worktree handoff protocol fix or document translation changes.
- Do not assume Vite 8 is preferable because it is newer; compare against `tsdown`/Rolldown on this repository's actual Node package constraints.
- Do not rely on undocumented runtime behavior for production or development resolution.
- Do not require every package in the monorepo to share the same builder if package roles justify different toolchains.

## Acceptance Boundary

- Current builder/runtime facts are documented for `packages/cli`, `packages/server`, `packages/core`, and existing Vite web/app packages.
- Official Vite 8 documentation and local experiments are used to evaluate Environment API, ModuleRunner, library mode, conditional exports, and resolve conditions.
- A local conditional exports experiment records whether `development` is selected by default under Node and `tsx`, and whether explicit conditions are required.
- A local multi-entry Vite library experiment records output shape, externalization behavior, and any declaration-generation gap.
- Runtime topology notes explain whether `worker_threads` is suitable for worktree sibling servers or only for smaller in-process/near-process tasks.
- The final recommendation classifies the path as one of:
  - keep `tsdown` and add conditional exports/dev-condition discipline;
  - migrate selected Node packages to Vite 8 library mode;
  - migrate selected packages directly to Rolldown;
  - defer migration pending upstream/tooling maturity.
- If a follow-up implementation is recommended, the plan includes BDD-style tests for source-vs-dist resolution, package exports, CLI bin startup, and worktree handoff compatibility.
