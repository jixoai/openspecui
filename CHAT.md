`references/openspec`这个项目是我常用的openspec工具，我现在要构建一个openspecui的项目，目的是通过webui来提供更好的视觉展示。

1. 请你阅读openspec的源代码，分析其工作原理，分析其cli的功能.
2. 构建出openspecui这个cli工具，默认行为是启动一个http服务，作用将openspec可视化，参考`openspec view+show`的效果
   1. 使用shadcnui
3. 内置AI-Provider，来使用AI进行协作，AI-Provider有两种：
4. ACP-Provider，使用ACP协议来连接Gemini、Codex、Claude、iFLow这些CoderCliAgent工具。默认使用iFlow
5. API-Provider，使用OpenAI的ChatCompactionAPI协议来进行连接。默认使用provider.json中的openaiv1的配置来进行连接
6. 如果可以，把API-Provider也封装成ACP-Provider，这样我们统一面向ACP来进行开发后续的AI功能
7. 可视化的`openspec init`功能
8. 可视化的`openspec archive/validate/spec`等等功能，可以完全等同于`openspec`的功能
9. AI-Provider 可以用来满足各种互动需求：
   1. 比如修改openspec的文件
      1. 提供review模式，可以通过评论来快速修改spec
      2. 这里可以滑动选择一段文本进行评论，或者可以评论某一行
      3. 可以评论一整份spec
      4. 每一个评论都有一个NoId，可以通过 `#{NoId}` 来互相关联
      5. 完成评论后，进行提交，会生成一份新的spec文件，用户可以接受也可以拒绝也可以重新生成
      6. 接受后可以继续迭代
      7. 迭代更新spec的过程中，这些文件不会立刻被清除，而是会被放到一个临时文件夹，作为“历史记录”，在界面上可以查看这份文件的历史，可以被AI追溯。
      8. 一切都是“文件”，所有程序的状态都和“本地文件”进行强关联
      9. AI-Provider可以通过了解文件来了解整个openspecui的程序状态，可以通过修改文件来改变webui的界面内容。这些规则都在内置的提示词中
   2. 比如进行界面上的中英文翻译（openspec的文件默认是英文，可以翻译来显示中英双语）

---

请充分利用monorepo的规范，梳理我们的仓库。
特别是一些关键的功能，作为一个子仓库，进行独立的单元测试。
逐步验证通过后，再最终搭建出我们的webui。
最后再将webui打包到我们的cli中。

---

我提醒你一下，iflow和gemini都原生支持ACP：`--experimental-acp`
Claude Code则是有Zed团队提供的ACP适配：https://github.com/zed-industries/claude-code-acp
OpenAI Codex也是有对应的ACP适配：https://github.com/zed-industries/codex-acp

---

proxy后端的端口是findPort得来的，前端就不能绑定死端口。甚至应该足够灵活，可以自适应。
可以这样考虑，一方面是vite.config中配置proxy，使得能直接访问api接口。（当然这是我自以为是前后端的端口是同时用一个的情况下）
同时还接收通过urlSearchParams来修改源头。

另外，因为我们用了websocket，以及我们的这个服务是绑定某个dir的。
所以我们应该在界面上展示当前的live状态，以及显示目前的dirPath。
在title部分，也应该显示dirName，这样同时开多个实例的时候，好辨别

---

Dashboard 的 Recent Specs / Active Changes, 或者 Specifications 的列表,
我觉得都应该和 Active Changes 显示 Title(spec-title) + SubTitle(spec-id)

---

已经很不错了，但是这个 typography 的样式有点颜色上的问题：
首先是Project的两个md渲染好像和其它spec的渲染不是很一致，你是不是用了两套方案？

比如Project中的pre-code在亮色模式下，颜色居然接近白色，不是黑色，所以看不清楚字。
还有Project的渲染没有适配暗色模式。

Spec中的渲染，只要className有prose，在暗色模式下就是字体发黑，感觉没有适配暗色模式。

另外，我们是不是应该顺便引入代码高亮库，我建议使用shiki

---

内容加入目录导航功能：

- Project页面的加入导航功能，悬浮在滚动视图内，要考虑导航条目过多可能也存在滚动。
- 目录要跟随页面一起高亮滚动（实现方案后续我会仔细给你提示词）。
- 目录导航可以展开收起，在移动端，这条目默认可以收起来
- 注意 spec 页面的 Requirements ，每一个 Requirement 都是一个卡片，这里目录如何做，你得思考一下。
- Change 页面的 Tasks，现在是全部挤在一起的，只是在右边显示了主题。我们现在有了目录，它们应该根据主题进行拆分。这更我们的目录设计也更加搭配。所以这里可能界面和交互上都需要做一定的重新设计与改进。

````md
# Task

我需要为一个 Markdown 文章渲染页面实现“目录跟随内容滚动高亮”的功能。
请使用纯 CSS 方案（无需 JS IntersectionObserver），基于 `view-timeline` 和 `timeline-scope` 实现。

# Requirements

1. **HTML 结构要求**：
   - 在 `<body>` (或共同父级) 上声明 `timeline-scope`，包含所有章节的变量名（如 `--s1, --s2...`）。
   - 在 Markdown 内容的 `h2` 或 `section` 标签上，通过内联样式注入 `view-timeline-name: --sX`。
   - 在目录 `<a>` 标签上，通过内联样式注入 CSS 变量 `--target: --sX`。

2. **CSS 核心逻辑（关键）**：
   - 必须解决“长内容阅读时高亮消失”的问题。
   - **Animation Range**：请使用 `animation-range: cover 0% cover 100%`。这表示只要章节在视口中（哪怕只有一部分），动画就处于播放状态。
   - **Keyframes 设置**：请使用“平顶梯形”曲线，而不是钟形曲线。
     - 0% (不可见): 默认样式
     - 1% (刚进入): 高亮样式 (active)
     - 99% (快离开): 高亮样式 (active)
     - 100% (完全离开): 默认样式
   - 这样设置是为了确保章节在视口中间阅读时，目录链接始终保持高亮，不会因为滚动进度变化而褪色。

# DEMO

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Markdown ToC Highlight (Fixed)</title>
    <style>
      :root {
        --w-sidebar: 240px;
        --c-active: #2563eb; /* 高亮色：蓝色 */
        --c-text: #64748b; /* 默认色：灰色 */
        --c-bg-active: #eff6ff; /* 高亮背景 */
      }

      body {
        margin: 0;
        display: grid;
        grid-template-columns: var(--w-sidebar) 1fr;
        height: 100vh;
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
        overflow: hidden; /* 锁定 body，让 main 滚动 */
      }

      /* =========================================
       1. 侧边栏 (目录)
       ========================================= */
      aside {
        border-right: 1px solid #e2e8f0;
        padding: 20px;
        overflow-y: auto;
        background: #f8fafc;
      }

      .toc-link {
        display: block;
        padding: 8px 12px;
        margin-bottom: 4px;
        text-decoration: none;
        color: var(--c-text);
        border-radius: 6px;
        font-size: 0.95rem;
        border-left: 3px solid transparent;
        transition: all 0.2s; /* 仅用于 hover 效果，不要干扰 animation */
      }

      /* 
       ★ 核心动画逻辑 ★ 
    */
      @keyframes activate-link {
        /* 0% - 刚进入视口前：默认状态 */
        0% {
          color: var(--c-text);
          background-color: transparent;
          border-left-color: transparent;
          font-weight: 400;
        }

        /* 1% - 只要有一点点进入视口：立即高亮 */
        /* 保持高亮状态一直到 99% */
        1%,
        99% {
          color: var(--c-active);
          background-color: var(--c-bg-active);
          border-left-color: var(--c-active);
          font-weight: 600;
        }

        /* 100% - 完全离开视口：回到默认 */
        100% {
          color: var(--c-text);
          background-color: transparent;
          border-left-color: transparent;
          font-weight: 400;
        }
      }

      .toc-link {
        /* 绑定时间轴：使用 HTML 中定义的变量 */
        animation-timeline: var(--target);

        /* 引用上面的动画 */
        animation-name: activate-link;

        /* 关键配置 1：both 确保动画状态跟随滚动位置 */
        animation-fill-mode: both;

        /* 关键配置 2：cover 范围
         cover 0%   = 元素头部刚进入视口底部
         cover 100% = 元素尾部刚离开视口顶部
         配合 1%-99% 的关键帧，实现“只要在屏即高亮” */
        animation-range: cover 0% cover 100%;
      }

      /* =========================================
       2. 主内容区域 (Markdown)
       ========================================= */
      main {
        padding: 40px 60px;
        overflow-y: auto;
        scroll-behavior: smooth;
      }

      /* 模拟 Markdown 生成的 Section 容器 */
      section {
        margin-bottom: 100px;
        padding-top: 20px;
      }

      h2 {
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
      }
      p {
        line-height: 1.8;
        color: #334155;
        margin-bottom: 20px;
      }

      /* 占位符，模拟长文 */
      .spacer {
        height: 80vh;
        background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 10px, #fff 10px, #fff 20px);
        border-radius: 8px;
      }
    </style>
  </head>

  <!-- 
  ★ STEP 1: 在共同父级声明 timeline-scope 
  渲染器需要收集所有 ID 并填在这里
-->
  <body style="timeline-scope: --s-intro, --s-install, --s-usage, --s-api;">
    <aside>
      <h3>Project Docs</h3>
      <nav>
        <!-- 
        ★ STEP 2: 目录链接绑定目标 
        style="--target: --[ID]"
      -->
        <a href="#intro" class="toc-link" style="--target: --s-intro">1. Introduction</a>
        <a href="#install" class="toc-link" style="--target: --s-install">2. Installation</a>
        <a href="#usage" class="toc-link" style="--target: --s-usage">3. Basic Usage</a>
        <a href="#api" class="toc-link" style="--target: --s-api">4. API Reference</a>
      </nav>
    </aside>

    <main>
      <h1>Documentation</h1>
      <p>Scroll down to see the magic.</p>

      <!-- 
      ★ STEP 3: 内容章节声明时间轴名字
      style="view-timeline-name: --[ID]"
      注意：建议把 ID 加在 section 容器上，而不是 h2 上，这样高亮范围更准确（包含正文）。
    -->

      <section id="intro" style="view-timeline-name: --s-intro">
        <h2>1. Introduction</h2>
        <p>Start reading this section. Watch the sidebar.</p>
        <div class="spacer">Markdown Content Area...</div>
      </section>

      <section id="install" style="view-timeline-name: --s-install">
        <h2>2. Installation</h2>
        <p>As you scroll past the previous section, the highlight switches instantly.</p>
        <div class="spacer">npm install ...</div>
      </section>

      <section id="usage" style="view-timeline-name: --s-usage">
        <h2>3. Basic Usage</h2>
        <p>Even if you stay in the middle of this huge section, the link remains active.</p>
        <div class="spacer">import { ... } from ...</div>
      </section>

      <section id="api" style="view-timeline-name: --s-api">
        <h2>4. API Reference</h2>
        <p>Final section.</p>
        <div class="spacer">API details...</div>
        <div style="height: 200px;">End of page</div>
      </section>
    </main>
  </body>
</html>
```
````

---

1. 我们必须和官方的cli保持一致
   1. 现在的界面上的“Archive按钮”，底层是调用 `openspec archive` 吗？
   2. 界面上的“Initialize OpenSpec按钮”，底层是调用 `openspec init` 吗？
2. 我们所有的接口都用上订阅模式了吗？这点很重要，我们整个应用都应该是实时更新的。

---

不能简单的流式，但确实需要存在交互，或者说，archive和init这两个命令可能没必要流式，这里的关键在于:
我们要参考 `openspec init --help` 和 `openspec archive --help` 的打印结果，来在界面上呈现一些内容。
这里有两种方案，一种是直接拦截`openspec init`的命令，呈现出一个终端界面到前端，在前端使用键盘来完成工作。
一种是直接参考openspec init做一套存前端的交互，组合成最终`openspec init --tools=A,B,C`这样无交互式命令来执行。

我个人的建议是直接做一套前端，跟最新版的openspec的具体实现进行强关联。我们把自己假设成官方团队来维护这个ui工具。

关于配置文件，有两种方案，一种是存储在前端，一种是文件化，存储在磁盘。我建议后者，因为我们底层使用了file watch来实现了整个系统的响应式更新。
所以我觉得可以复用这个底层，让配置文件也能实时更新。
也就是说，我们整个系统的订阅模式，完全基于文件/文件夹的订阅来做到自动推送更新，这应该是非常优雅的架构。我不知道你是不是按我想的这样做，还是僵硬地去一个个接口去实现订阅更新？
我的意思是说，比如我们实现一个普通的函数并在普通的trpc中使用：

```ts
async function getConfig() {
  return (await fs.readFileOrNull(configPath)) ?? defaultConfig
}
getConfig: tProcedure.query(() => getConfig())
```

现在要做成响应式，只需要这样做：

```ts
async function getConfig() {
  // fsProvider 是 watcher-fs/fs/pool-fs 等等都统一抽象，取决于用户是否开启监听模式，或者是否轮询模式等
  return (await fsProvider.readFileOrNull(configPath)) ?? defaultConfig
}
getConfig: tProcedure.subscription(async function* () {
  const effect = fsEffect(() => getConfig())
  try {
    yield* effect.stream()
  } finally {
    effect.stop()
  }
  /// 这里理论上代码还能再简化
})
```

这里的思路，其实就是signal/effect的思路，在单次调用中，我们将过程路径说依赖到的文件/文件夹全部收集起来，然后进行监听。
只要有变动，那么就进行推送。
如果WebSocket断开，那么就释放这些监听：这里同一个文件夹/文件的监听可以共享，一个监听的引用为0的时候，就释放。

还有，要实现这些功能，最关键的技术是AsyncContext这个技术，它可以实现一个异步上下文隐形传递上下文对象。从而实现文件监听的依赖收集，这点非常重要！
是我们响应式监听能否成功的关键。我以前做过简单的技术实现，你可以参考 /Users/kzf/Dev/GitHub/jixo/packages/dev/src/reactive-fs/reactive-fs.ts

---

对于测试,我们可能需要做一份专门的spec,因为这次改攻动非常重要,特别是涉及到我们的内核,是我们项目代码质量飞跃的关键,所以必须附带完整的测试

---

界面上嗅探cli是否可用的时候，要先进入pending状态，然后再显示“不可用”或者“成功获得的版本号”。

---

嗅探直接使用`openspec --version`
如果嗅探到没有全局的openspec命令，界面上应该提供一个全局安装的按钮，点击就弹出终端的对话框。如果安装完成，那么就重新嗅探cli是否可以用。

每次嗅探的结果将会影响后续cli：也就是说用户如果自己卸载了cli，那么只要重新进入settings页面，页面会重新发起cli的嗅探，结果会变更，那么后续cli也能正确使用。

如果用户没有主动配置，那么界面上的input就不该有值，我们嗅探出来的默认值只能作为placeholder来显示

---

关于`shell:true`的使用。我觉得我们应该默认避免，虽然我们允许了自定义cli，导致你觉得应该使用`shell:true`，但这反而会为后续的使用带来很多不一致性的问题。
我个人的建议是：我们自己默认的两种模式：`openspec`和`npx @fission-ai/openspec`，本质其实是`["openspec"]`和`["npx","@fission-ai/openspec"]`,其实完全可以使用`shell:false`。
而对于用户自定义的cli，我们默认用最简单的方式去处理：用正则匹配的方式来拆分成数组，然而shell-parser其实是一件复杂的事情，因此难免我们这种解析会出错，因此我们存在第二种方式，就是自定义JSON-Array。我们只需要判断自定义cli的开头是不是`[`，如果是就进入JSON-Array的解析方式。这样用户就可以通过自定义Array的方式来传递可靠的自定义cli。

---

现在我对Change进行Archive之后，会出现问题:

我们的对Archive本来应该在Dialog中显示我们的终端打印，然后成功后，Dialog继续现实终端打印，并且提示用户Archive已经成功。并且我们的路由自动跳转到archive页面。

然而现在路由没变，界面上现实着：“Change not found”；同时我们的Arcihive的Dialog也消失不见了，导致我们连终端打印也看不到了。

---

我们现在界面上有一个全局安装cli的按钮，目前只会在全局openspec不存在的时候会可用。也应该发生`npx @fission-ai/openspec --version`的版本号高于本地的时候，那么这时候界面上应该提示用户更新，同时全局安装的cli按钮也可用。

---

init底层逻辑依赖的文件夹检测存在问题，目前你的逻辑是按照是否存在再去监听，因为你觉得递归监听会导致性能问题。但这会导致如果我init生成了文件夹，你之前的的路基，这个新的文件夹是不会去设置监听的，因为你看不到它的出现。

我建议我们应该一劳永逸引入 @parcel/watcher ，让我们用最符合直觉的方式来监听我们的一整个项目目录，同时性能还能提高！代码也能进一步简化，质量和性能也能进一步提高。

要注意，我们使用tsdown在做编译，@parcel/watcher是二进制项目，所以应该被exclude，从而确保安装我们 openspecui 的时候 @parcel/watcher 也被作为依赖被安装。

---

基于parcel/watcher的监听机制中，我刚才做了这样的事情：

我首先初始化了 example：pnpm example:setup
然后启动了我们的ui： pnpm dev --dir example

接着最关键的来了，我清理了example目录，然后重新生成了example目录：

pnpm example:clean && pnpm example:setup

接着我发现对于example的文件夹监听就失效了。我需要重启pnpm dev --dir example才能恢复正常。

调查一下这是parcel/watcher的bug还是我们自己的bug，如果是parcel/watcher的bug，有什么规避方案吗？或者有什么本办法吗？

---

不确定你基于projectDir的删除检测是否可靠，但是我可以给你一个非常朴素的检测建议，就是轮询：
具体工作流程是这样的：

1. 首先我们有一个3s的debunce，它会被我们的 parcel/watcher 发出的事件重置时间计时
2. 如果事件陷入了沉默，那么我们就要尝试性地临时生成再删除一个临时文件
3. 如果事件还是没有发出，我们就假设认为parcel/watcher实例实效了，那么就重新创建watcher实例ß

---

这个检查文件，你觉得要不要用我们的配置文件做？
好处是不会产生冗余的文件，缺点是一个文件的职责有点冗余。
而且模式要改成只改变文件最后的变更时间但不变更内容（fs.utimesSync，我不知道只修改时间，watcher能否监听到它的变化，应该可以吧）。
但这就意味着，openspecui在启动并发现projectDir被init好了，那么我们就得在openspec文件夹中去初始化好我们的配置文件，即便它是无配置模式。

你觉得这个方案怎么样？

---

等一下，我突然想到一个方案：我们如果只是utimesSync我们的projectDir这个文件夹呢？这不是最符合直觉的吗？
我们还得测试验证：
创建testDir目录->创建A文件->监听testDir目录->删除testDir目录->再次创建testDir目录和A文件->修改A文件->watcher没有收到事件->修改testDir的时间->watcher也没有收到事件。

---

虽然我们监听了一整个projectDir，但其实我们只是监听特定的几个文件或者文件夹的变更。
我们能否配置这些特点定的文件或者文件夹来提升我们监听的性能。

---

在移动端的模式下，顶部不要单调显示 OpenSpec，而是应该显示当前的 dirName（就是dirPath的最后一段）

---

在设置界面，API Server URL 这里的placeholder没有客观显示“默认的api-server-url”

---

我发现Changes页面，是proposal.md+tasks.md，其它文件你好像就忽略了，
请你仔细阅读 openspec[./references] 的源码了解 Change 的结构

如果你想通实际的案例进一步了解确认Change 的结构，
你可以看一下 `/Users/kzf/Dev/GitHub/chain-services/openspec/changes/add-rwa-org-team-exchange-performance` 这个文件夹的结构。

我的要求：

1. 在 changes 页面中，合理地展示一项 Change 的内容
   1. 一个changes下面可能有多个specs吗？如果是的话，要考虑一下二级路由？如果不是的话，是不是一个 Tabs 就能解决展示的问题？
2. 要更新一下我们的setup-example.ts。
3. 如果这个 Change 的文件夹下面有其它的非 spec 的标准，在Tabs中，新增一个 Folder-Tab， 可以列出这个 Change 的文件夹的所有文件。在这个页面中，将是一个mini的code-editor，右边是文件列表，左边是monaco editor
4. 所有新增或者修改的功能，底层一定是响应式的接口，可以实时变更的。参考现有的接口标准来进行开发。

---

1. Tab-Folder
   1. Folder/Overview结构请你参考我们的ToC组件，它基于容器查询，在桌面端和移动端都有良好的体验。
      - 除了要考虑移动端设计，还需要考虑文件可能过多，溢出列表的问题，因此你可以充分参考markdown-viewer的组件设计
   2. Folder自身没必要做 border 样式，专注于内容的样式就好，否则组件搭配在一起，会出现很多层border，体验会大大下降
   3. 打开Folder，然后切换到别的Tab，再切回Folder，会报错： `InstantiationService has been disposed`
   4. `Change Files`的文件列表的顺序存在问题，是一个低级错误，请你审查并修复
2. Tab-Overview
   1. Affected Specs中的内容是不是重复出现了，我看到它重复展示了两个`rwa-org-team-exchange-performance`。
   2. Affected Specs列表中的 Suffix: `ADDED`，这个是什么意义？还有其它的状态值吗？
   3. Overview混合了多个md文件，但是ToC只显示了一层内容。md文件的ToC应该混入Overview的ToC。

---

因为`Change Files`的宽度有限，因此要考虑加入横向滚动。

---

path-marquee需要改进一下，它居然耦合的copy功能。
因此path-marquee要先拆分成两部分：

1. path-marquee 要改名成 text-marquee，专注于内容的展示
2. 新增一个 copy-button，可以展示“可复制”的小图标，以及复制成功的状态与交互。
   将这两个组件组合在一起，替换现有的path-marquee组件

---

我发现project.tsx是自己维护了Tabs的逻辑，为什么不用我们统一封装的tabs组件，它有什么特殊需求吗？
还有什么地方也是存在这样的特殊性？
你有什么建议吗？

---

Change详情页面的顶部的header，使用容器查询来优化样式：在空间比较不够的时候，Archive按钮简化成只有Icon，不显示文字。

---

我们整个网站的是面向开发者的，因此默认使用monospace 字体。请你给我一些字体上的建议，我想对于到导航相关的字体（和openspec品牌相关的）使用像素字体。你有什么建议吗？

---

请你帮我优化字体，默认使用google font字体。
注意，我们整个架构是编译成静态文件，然后通过server服务来启动前端的。
我的要求是，如果识别到用户的第一语言使用的是中文，那么将html只的google-fonts-cdn换成中文源。
我比如说：

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"
  rel="stylesheet"
/>
```

这里的`fonts.googleapis.com`和`fonts.gstatic.com`统一改成`fonts.googleapis.cn`和`fonts.gstatic.cn`

---

1. 右边的Files列表中，文件和文件夹没有按照正确地关系进行嵌套。比如说`spec.md`应该嵌套在`rwa-org-team-exchange-performance`文件夹下，但是结果却跑到`task.md`文件下嵌套着。
2. FolderEditorViewer 组件外层有一个空的div包裹着，导致h-full没有生效。
3. 在Editor的最上方，最好显示完整的路径（vscode面包屑的那种效果）

---

你确实修复了问题，但是这不是我想看到的结果，因为现在你实在change-overfiew中自己完全实现了一套markdown-viewer的逻辑。
我的目的是让MarkdownViewer易用，所以MarkdownViewer在参数设计上就存在多种重载的可能。
因此我们的重点是：为什么MarkdownViewer无法满足你直接使用达成我们最终的目的？
如何设计MarkdownViewer才能满足我们的这种自定义构建内容的需求？

不要急着写代码，说说你能想到的架构设计

---

我的建议是，做好单层的 MarkdownViewer，使用TocContext来做到多层嵌套。
比如说：

```tsx
interface MarkdownViewerProps {
  markdown: string | MarkdownViewerBuilder
}
{
  /*自动去获取上下文的 TocContext，如果没有会自动创建，内部调用MarkdownContext组件的时候，会返回这个markdown内容的tocItems，然后插入到TocContext中 */
}
;<MarkdownViewer
  markdown={({ H1, H2, Section }) => {
    return (
      <>
        <H1>S1</H1>
        {/*Section 会自动将内容的toc层级+1*/}
        <Section>
          {/*获取到 TocContext，并将渲染的内容注入给TocContext*/}
          <MarkdownViewer markdown={'# markdown1'}></MarkdownViewer>
        </Section>
        <H2>S2</H2>
        <Section>
          <MarkdownViewer markdown={'## markdown2'}></MarkdownViewer>
        </Section>
      </>
    )
  }}
></MarkdownViewer>
```

---

很好，接下来，我需要你将这个核心的 editor 视图独立成一个独立的组件 code-editor.tsx 来维护。

---

CodeEditor的统一逻辑是，非preview模式下，这些修饰全部关闭，而原始的行内容要完整展示，同时原本被隐藏起来的符号，统一是淡色的。

---

使用ViewTransition来配置我们的动画吧。

页面切换的时候，顶部总有一个Loading的文字，在页面内容出来的时候它在淡出，停影响观感的，特别是我们是本地webui项目，不是挂在网络上的，所以这个Loading的文字虽然有意义，但是要考虑一下如何优化？

---

Loading文字的问题是：它现在是和我们的内容做交叉过渡的是吧。这里的问题是，在交叉过渡的时候，很正常Loading淡化并下移动；页面内内容渐显然后向上移动。但是最终动画完成后，Loading又突然显示出来。和我们的页面内容层叠在一起，我试着加上 animation-fill-mode:forwards ，但是没有效果，我觉得是ViewTransition的配置导致的问题。

---

很好，果然是ViewTranstion的问题。大部分的页面都正常了，我还顺便修复了project页面Loading问题，它的Loading不该卸载TabContent中。
另外，Loading的出现除了考虑数据的网络加载，还要考虑页面渲染可能比较慢（因为我们要动态解析md，或者初始化编辑器，可能会比较卡），所以这方面还要考虑。

还有，我们的二级页面，也要考虑Loading的效果

---

change-header虽然做了容器查询的响应式，但是需要更进一步：字体的大小也应该随着容器伸缩而缩放。

---

我在调用archive的时候，前端收到的终端打印：

```
openspec archive -y add-2fa

Proposal warnings in proposal.md (non-blocking):
  ⚠ Requirement must have at least one scenario
  ⚠ Requirement must have at least one scenario

Validation errors in change delta specs:
  ✗ MODIFIED "Email And Password Login" must include at least one scenario

Validation failed. Please fix the errors before archiving.
To skip validation (not recommended), use --no-validate flag.
Process exited with code 0
```

虽然进程返回exit code 0,但是这里我们需要做一些额外的解析：“Validation errors”

我能想到的方案有两种，一种是执行之前调用一次`openspec validate add-2fa`，还有一种是直接解析处理`openspec archive -y add-2fa`。
我的建议是调用`openspec validate add-2fa`，因为它有更加完整的 stderr，exitCode也是相对标准的:1

---

在此之前还有一个问题，就是我明明archive没有成功，但是我们自己居然自己推测出最终archive的文件夹，然后做了去跳转。我觉得这个有点不合理。

1. 要么基于文件夹的变更检查，检测到刚才archive文件夹多了一个文件夹，并且这个文件夹的id符合 yyyy-mm-dd-{id} 的规范，说明我们archive完成了，这时候跳转的按钮才能亮起。
2. 要么基于archive的stdout打印，去做判断.这是我强制移动后的结果打印：

   ```
   ❯ openspec archive add-2fa --no-validate -y

   ⚠️  WARNING: Skipping validation may archive invalid specs.
   [2025-12-02T10:34:59.277Z] Validation skipped for change: add-2fa
   Affected files: openspec/changes/add-2fa
   Task status: 0/6 tasks
   Warning: 6 incomplete task(s) found. Continuing due to --yes flag.

   Specs to update:
     auth: update
     user: update
   Applying changes to openspec/specs/auth/spec.md:
     + 1 added
     ~ 1 modified
   Applying changes to openspec/specs/user/spec.md:
     + 1 added
   Totals: + 2, ~ 1, - 0, → 0
   Specs updated successfully.
   Change 'add-2fa' archived as '2025-12-02-add-2fa'.
   ```

你觉得什么方案最好？

---

这个错误信息，得显示在我们统一的终端里面。但是你可以配置一个红色边框来代表最终的执行结果 exitCode!=0。因为这些内容本来就是来自终端。
这个validate终端的位置也应该和archive终端的位置一样，甚至可以用同一个终端窗口来模拟显示多次执行的内容打印。

对了你这个终端，是一个统一的组件吗？

还有，记得，我们的内容是放在一个Dialog里面的，这里面有Header/Body/Footer三段结果，你要确保整体不能超过溢出屏幕，比如 `max-height:86vh`。
如果超出高度，那边Body应该要能滚动

---

这个终端渲染应该是独立的通用组件，我们Dialog也应该是独立的通用组件。
然后才是把它们组合在一起。

---

我发现一个bug：Change页面的 archive按钮，确定是先执行验证再执行归档的吧？不是同时执行吧？
还有，为什么我只在终端上，看到验证的输出，没有看到归档命令和输出？以及归档成功后的界面也都没有了。

这里的界面是不是过于复杂了？我们只是需要在按下归档按钮的时候，dialog中显示出我们的终端，让我们能看到后端在执行的两个任务，然后基于任务的解析
结果来改变前端的按钮，仅此而已，怎么做得复杂还不好用

---

cli-terminal-modal职责混乱，先定义好cli-terminal-modal的意义是什么。然后再说其它的。否则你一直在这里犯错

开始重构，最终的目的是废弃 cli-terminal-modal。但是这个过程中cli-terminal-modal会分解出一些遗产，这些遗产将是我们原子化构建 'init' | 'archive' | 'install-global' 这三个dialog的关键

---

很好，重构之后界面终于看到一些正常的显示了：

```
$ openspec validate add-2fa
$ openspec archive -y add-2fa --no-validate
$ npx @fission-ai/openspec validate add-2fa
Change 'add-2fa' has issues
✗ [ERROR] auth/spec.md: MODIFIED "Email And Password Login" must include at least one scenario
Next steps:
  - Ensure change has deltas in specs/: use headers ## ADDED/MODIFIED/REMOVED/RENAMED Requirements
  - Each requirement MUST include at least one #### Scenario: block
  - Debug parsed deltas: openspec change show <id> --json --deltas-only
Process exited with code 1
```

1. 最开始的那个预览，改成 `#`开头的注释（灰色）
2. 运行的时候，你的Options被disabled了，但是结束后，Options又被开启了，这个只要一旦被运行，那么就应该是disabled
3. 新增一个Reset按钮：如果出现失败，那么显示这个按钮，可以重置所有状态，从而可以让我重新开始 Archive。效果跟我关闭对话框再重新打开一样。
4. Archive change 这个警告可以移除了。
5. 终端放在中间（Change to archive 的下方，Options的上方）
6. setup-example需要补充一个changes，因为目前的这个 add-2fa 的change是一个`Tasks (0/6)`，请你补充一些新的changes，让我能覆盖更多的测试可能。

---

执行任务的时候，我看到你在Dialog的Title部分显示了 loading 图表。如果有错误你也会在这里显示。

不要在这里显示，直接在我们的cli-terminal的命令的末尾加上这个图表，来代表 loading 的是这个命令，失败的也是这个命令。

---

archive有统一使用我们底层的 openspec cli吗？别的Dialog显示的明明是 `openspec ...`，为什么archive用的是 `npx openspec`?

---

我发现 global-archive-modal.tsx 里面有一个函数：renderLines，这个是我当初提出的需求：

```
直接在我们的cli-terminal的命令的末尾加上这个图表，来代表 loading 的是这个命令，失败的也是这个命令
```

然后我发现AI做的时候，误会了我的意思。我的意思是：

1. idle
   ```
   $ run command
   ```
2. loading
   ```
   $ run command ⏳ #<-- 渲染成一种文字loading的特效，等待后台响应成功创建 child_process
   ```
3. running
   ```
   $ run command 🌼 #<-- 渲染成一种文字loading的特效，模拟光扫过每一个字，配合一个转圈的图标，持续捕捉 child_process 的日子输出
   some stdout
   some error
   some stdout
   ```
4. failure

   ```
   $ run command ❌
   some stdout
   some error
   some stdout
   Process exited with code 1 #<-- red color
   ```

5. success
   ```
   $ run command ✅
   some stdout
   some error
   some stdout
   Process exited with code 0 #<-- green color
   ```

这是关于这个line渲染的需求，但是最关键的是，我们需要重构：CliTerminal 组件。
它目前只是一个渲染器，而要达成我们的目的，它不能只是一个渲染器，它必须还是一个执行器。
它需要有一个 commands 管理器，可以写入要执行的命令队列。这将渲染成

```bash
# command1 args
# command2 args
```

能有一个 `terminalRef.value.commands.run()` 函数，可以执行这些命令，并且有回调，可以监听事件：

```tsx
<CliTerminal
  ref=((terminalRef)=>{
    terminalRef.value.commands
    // 命令的管理队列
    interface Commands {
      add(command:string,args:string[],at:number=-1):uuid
      remove(at:number)
      list():Array<{id:uuid, command:string, args:string[], process?:CommandProcess}>
      run(id:uuid = this.list().find((c)=>!c.process)?.id):Promise<CommandProcess>
    }
  })
  onCreateProcess={(cp) => {
    /// 可以同步收到进程的打印
    cp.on('data', (data) => {
      console.log(`stdout: ${data}`)
    })
    cp.on('error', (err) => {
      console.error(`stderr: ${err}`)
    })
    cp.on('close', (code) => {
      console.log(`child process exited with code ${code}`)
    })
    cp.on('exit', (code) => {
      console.log(`child process exited with code ${code}`)
    })
  }}
/>
```

或者说，我们仍然可以让CliTerminal专注于渲染。然后让 use-cli-stream-runner 来完成我们的需求：

```tsx
const cliRunner = useCliRunner()
useEffect(() => {
  cliRunner.addCommand('command xxx')
  cliRunner.runCommand()
}, [])

// 专注于渲染
;<CliTerminal lines={cliRunner.useLines()}></CliTerminal>
```

等一下，我看到 use-cli-stream-runner 的代码！天啊，这是在太糟糕了，怎么能耦合各种命令的执行呢！
请你立刻重构！按照我的思路，做好在前端运行任意终端命令的功能。你要做的，绝对不可以出现use-cli-stream-runner 这种把全部的命令全部耦合在一个 CliRunnerConfig 中的行为。
这违反了我的工程实践规范。

---

还需要继续改进你的代码：TerminalLine这个设计有一个问题，它导致cli-terminal 作为一个渲染器，失去了独立性。

1. cli-terminal 是独立的，输入参数仍然是lines。有两种类型：ascii / html
2. 我需要你丰富ascii的渲染格式
3. html的渲染，内容就是ReactNode节点

这样的设计，useCliRunner就可以自己闭环所有的渲染

---

我在使用的时候，会遇到持续这个日志：`[ProjectWatcher] Error: [Error: Events were dropped by the FSEvents client. File system must be re-scanned.]`，这个正常吗？

---

我不知道你做 legacy change-view 的目的是什么，我已经明确说明不用兼容，直接面向 openspec@1.1.x 去做开发。你需要给我一个可信的理由

---

引入搜索功能，使用后端提供搜索能力，可用技术方向：microfuzz、Fuse.js 、fuzzysort、MiniSearch

---

引入严格的 CI（相关工具配套到 scripts 中），来约束 PR 的质量，保证一致性：

1. prettier 进行格式化
2. oxlint 对代码质量进行约束
3. tsc 类型检查
4. openspec 不可以有残留的步骤没有完成

---

在你目前的基础上，我需要提出我的一个重构需求：

1. changes页面需要进行重构，参考 Archive （但是目前 Archive 可能也是旧版的）。具体要得到的效果是：顶部是一个 Tabs，这里的 Tabs 是根据 OPSX 的标准来定义一个个Tab，然后最后一个 Tab 是 Folder，点进去就是可以看到原始文件
2. changes 页面中有一些终端、命令。这些请统一剥离：我们需要在左侧导航栏增加一个开关：Terminal，它是一个开关，不是一个导航。打开这个状态开关（背景变成 PrimaryColor），那么底部（在状态栏的上方）就会出现一个终端面板，它将我们的主视图区域分割成上下两部分。上半部分仍然是原本的各个导航页面的内容，下半部分就是一个Tabs+Terminal的面板。这里我们将通过后端来提供一个 pty 的支持，前端使用 xtermjs 来渲染终端。我们的目的，是实现在前端直接使用命令行工具。这样就可以在我们的 openspecui 上启动codex/claude 等这些 Agent-CLI 工具，这些工具负责使用 openspec 驱动进行开发任务，我们的 openspecui 负责将这些任务进度可视化。

---

1. changes 这里的内容，除了 Folder，其它应该使用 Markdown 渲染，而不是用 Editor 去渲染。使用 Markdown 渲染还需要配套 ToC
2. specs 这里，显示“Not yet generated. Use Continue to generate this artifact.”。这是为什么？我看我们opsx-config-center/specs
   这里是有内容的，你的这些数据是自己整理的？还是通过 `openspec xxx --json` 命令得到的？
3. changes这里顶部Tabs 我看到都有绿色“check”的图标，这是什么意思，还有其它什么状态吗？
4. Terminal 不工作。出现的 xterm 实例没有任何内容
5. Terminal 的 Tabs 为什么要搞特殊化，不用我们的标准 Tabs？ 而且没有关闭按钮。
6. 移动端的导航栏缺少了 Terminal 按钮
7. `/schemas`这个路由可以废弃移除了，因为已经有 Config 中已经有 Schema 了。
8. changes 这里每个 tab 内容顶部都有一个bar，比如显示`proposal proposal.md Done`这个到底什么意思？什么作用

---

我们虽然全线使用了 trpc 订阅，但是后端这方面没有做好使用体验：后端需要缓存最后一次结果，因为我们底层是依赖 `openspec xxx --json`来进行返回结果的。然而这个过程是启动一个进程去做任务，这往往需要消耗几秒的时间，所以如果没有缓存，每次都将消耗大量的时间。
利用 trpc 订阅依赖“异步生成器”的原理，我们可以在生成器中缓存最后一次结果。而触发生成器的更新，是基于两点：

1. 文件变更（FileChange），会自动触发相应的cli 任务来重新获取数据；
2. 用户前端进行订阅，等于进行一次“FileChange”事件触发。

这些触发器最终会被统一节流，注意这里的节流本身虽然是基于时间，但是伪代码应该是：

```
loop {
  await doJob(); // 再次期间，依然会收到 file-change 事件，但是并不会导致重入，只有等到doJob 完成了，才会重放 file-change 事件，来让 throttle 进行处理
  await throttle(200); // 等待事件，doJob期间发生的事件会积攒起来到此时进入到节流计算中。注意，不是基于事件发生的时间，而是基于事件进入到节流器的时间为准。
}
```

---

Terminal的字体选择器它应该是个 `Array<string>`+`Input|TextArea`，用户可以直接编辑 Input 里面的东西，然后 Input 尾部有一个`+`Button，点击出现一个 Popover，提供一些Google-Font上可用的字体。Input的值默认使用`/[,\s]+/`来进行分割。

另外，我还希望支持输入一个 url，如果 mime 是 `text/css` 没那么就用 CSS-API 解析，如果 mime 是 `font/*`。通过支持 url，来支持外部注入字体。

---

1. Terminal 实例要持久留在server内存中，触发通过 close 接口进行主动关闭（也就是说，WebSocket 断开不能作为 close 指令）
2. 需要有专门的 list 接口，列出当前正在运行中的终端实例列表（也就是说后端自己要缓存 pty-buffer，基于配置配置的scrollback）
3. 移动端模式下，Terminal 面板无法 resize
4. 我们有一些任务是一次性的，执行完就可以输入任意键关闭终端，这种终端无发现你在 Tab 上做了特殊标识“done”。不要这样做，你可以用 dot 来代表状态，这对任意 Terminal 都适用：
   1. 如果没有正在执行中的任务，就显示绿色
   2. 正在运行中就显示蓝色
   3. 已经终结就显示红色（底层就是 pty 实例，也就是我们的 WebSocket 已经关闭无法再重连，那么前端显示“按任意键关闭”，这个属于前端行为。理论上这时候刷新浏览器，list 接口已经找不到这个 pty 实例了。所以属于前端自己缓存着最后终端的 buffer）
   4. pty 理论上是不支持判断是否有执行中的任务，所以只能基于终端的内容来做一个大概的判断。不过我们可以这样做：做一个多 steps 的“呼吸动画”，如果这个终端的内容在变化，那么就播放这个呼吸动画，如果内容停止更新，那么呼吸动画就停止。呼吸动画是一个 `灰色->蓝色->灰色->蓝色` 的动画循环，如果内容停止更新，那么动画会停止回落到灰色
5. 我在配置文件中修改 Terminal 的配置（ui 字段），结果发现并没有立刻生效，得切换到设置页面，这时候才能实时生效：这里的核心是，文件是我们的单一可信源。不能依赖react 去实现实时更新。需要优化依赖路径。

---

1. xterm 上绑定符合使用习惯的快捷键来实现“快捷键缩放字体”，注意仍然围绕：“配置文件是单一可信原则”。
2. 我把 xterm 升级到了 beta 版本，请你检查一下是否可以向下兼容，还是需要做出额外的适配（基于tsc检查）
3. 改进 xterm 在移动端的使用体验，比如长按文本选择目前都还不支持
   1. 关于移动端的改进，是一个很复杂的问题。官方 xterm 对此并不上心，我们无法改变太多只能适应。
   2. 我个人给出的方案是，提供给一个InputPanel
   3. InputPanel的顶部给出三个 Tab：提供三种面板：
      1. "输入法模式"，只提供一个 textarea，可以在这类直接做原生的输入，然后提供一个发送按钮，将内容发送到 xterm 中
      2. "虚拟键盘"，提供完整的键盘布局，这个键盘的布局基于目标操作系统来适配，同时要考虑这个键盘要专门针对移动端编程做出专门的适配。
      3. “虚拟鼠标”，打开它就提供一个“触摸板”，用这个触摸板来模拟鼠标功能。参考 Microsoft surface pro 的触摸板和 MacOS 的妙控板来做手势适配与振动反馈。
   4. 以上这些功能，请使用 lit.js 进行 WebComponent 的开发来实现。然后再绑定到 react 中。

---

关于InputPanel，有两种布局模式：
一种是固定布局，固定布局会导致，整个页面进入到“顶部 TopBar + 上方 Terminal + 下方InputPanel”，这是一种非常特殊的布局，因为此时底部的 NavBar 是看不到的。需要关闭 InputPanel 才能恢复，通常使用 touchend 事件可以激活 InputPanel；
第二种是浮动布局，浮动布局的模式下，此时的布局还是现在这种 Terminal 嵌入到整个页面的下方。此时浮动的 InputPanel在启动后几乎是完全透明的，但是会进入一种呼吸的状态：半透明->透明->半透明 这样的循环。此时的透明不是依靠 opacity，而是使用mask，这是因为我们需要实现一个效果，就是触摸的地方（虚拟键盘和虚拟触摸板）会立刻半透明，然后淡化。这个效果需要依靠一个 canvas 来实现这个残影淡化的效果，然后把这个canvas 拿来做 mask 的源

---

1. InputPanel 的顶部是一个工具栏，这里除了可以切换三种面板，还可以切换浮动模式还是固定模式
2. 呼吸效果是 canvas 内置的功能，其实我是建议虚拟键盘和虚拟触摸板都是用 canvas 来进行开发是最好，这样性能是最好的，可以使用 pixijs 来实现。这样在布局上和特效上实现起来也比较统一和简单，使用反馈上也能比较统一
3. 其实可以考虑提供一个“浮动按钮”，点击浮动按钮就出现这个虚拟键盘。我们可以在设置中，提供这个浮动按钮的开关：“开｜关｜自动”。其中“自动”就是基于目前的设备是否是touchable 的设备来自动启动这个“浮动按钮”，这个浮动按钮可以拖动。一旦 InputPanel 打开，那么浮动按钮就消失，InputPanel 的工具栏有“关闭 InputPanel” 的功能，关闭 InputPanel，浮动按钮就可以恢复显示
4. 不可见的目的是为了能透过浮动的 InputPanel 来看到下方的内容。但是并不是完全不可见，因为我们在呼吸状态，所以在一半的时间里面，还是可以看到InputPanel。因很多情况下，我们是可以根据肌肉记忆和视觉残留来使用虚拟键盘的。这也是“呼吸效果”的重要所在

---

1. 输入法模式，使用原生的 html 即可，这里还可以基于空闲的空间提供一个历史列表（这个是存储在 server 端，server 端需要提供一个通用的响应式的KV存储接口，这是不落地到磁盘的，只在内存中存储）。我们利用浏览器的 indexedDB存储这个历史记录：Array<{time,text}>，只保留100 条数据，然后启动后，会从 server 端同步这个数据，然后和本地混合，基于时间排序，pick100，然后落地到本地 indexedDB 备份。基于这种逻辑，就可以实现多设备同步。注意，这是一个“笨同步”，就是说，每次我点击 Send，都会触发：“从 server 端同步这个数据，然后和本地混合，基于时间排序，pick100，然后落地到本地 indexedDB 备份”这个逻辑线。这个逻辑线启动的时候也会做一遍
2. 包的大小在这里不是问题，但你只要使用 pixijs-v8 版本，这个版本体积已经优化得很好了，所以自然不是什么问题。
3. 仍然需要 lit.js，因为它是一个基础框架，这里还有工具栏、输入法模式、甚至还有InputPanel 设置需要通过 lit.js 这个框架来提供可靠的封装和测试基础
4. 其实我更加担心的是“固定布局”模式，你一直没有相关的疑问，所以我要主动跟你讨论：
   1. 首先是固定布局模式下，虚拟键盘和虚拟触摸板就不需要浮动模式的那种混合模式特效了
   2. 还有，固定模式的其实还有一种做法可以考虑，就是启用固定模式的时候，Terminal 就变成“固定 Tab”，具体体现在，这是一个特有的路由`/terminal`；同时移动端底部的 NavBar 能看到多处一个 Terminal。但也就意味着不再遮挡底部 NavBar，只是将固定模式作为一个页面来渲染，在这个页面上上下渲染 Terminal 和 InputPanel。这样实现起来会更简单。
   3. 这也就意味着 terminal 其实有两种渲染：bottom 渲染 和 page 渲染。bottom 渲染需要配合 InputPanel 的浮动模式，目的是在看到 Terminal 的同时也能看到 openspecui 的内容；page 渲染需要配合 InputPanel 的固定模式，目的是提供最好的 Terminal 使用体验。

---

触摸板的边缘区域，是特殊的区域，手指移动进入到这个区域的时候，会进入“无限滑动”模式，就是会模拟手指一直朝着最后的方向去移动（基于触摸的起点和当前手势的位置来决定位置），可以发挥触摸板可视化的优势，在进入 mousemove 的时候，这边边缘就可以亮起。你可以做到一种“光晕”的效果，意味着越靠近边缘，移动速度越快。

---

1. 请你禁用 canvas 的右键/系统菜单功能，否则我们需要长按，这可能会和系统菜单冲突。
2. 呼吸效果，现在直接做到整个 InputPanel 上，这样会更简单，而且效果会更好，因为目前工具栏对背景存在遮挡问题
3. 改进一下工具栏的布局和工作原理：Input|Keys|TrackPad|Settings 作为左边四个面板，默认只显示图标，激活时显示图标和Title。右边有两个控制按钮，只有图标：“Pin/Float”｜“Close”。这里的 Pin、Float，本质上是 InputPanel 自己的行为，Float 的工作原理是：使用原生的dialog，配合 showModal来做到。
4. BUG：InputPanelSettigns 中，修改 Fixed mode height，整个 input-panel 的高度要同步改变，现在并没有。
5. InputPanelSettings 的数据存储在 localStorage.xtermInputPanelSettings 中
6. 控制台存在警告：`PixiJS Deprecation Warning: addChild: Only Containers will be allowed to add children in v8.0.0 Deprecated since v8.0.0`； 还有` Handling of 'touchstart' input event was delayed for 115 ms due to main thread being busy. Consider marking event handler as 'passive' to make the page more responsive.`
7. packages/web/src/routes/terminal.tsx 这个文件还在使用“文字符号”而不是“标准图标”

---

1. 拖动浮动的 InputPanel 时，要禁止手势事件被冒泡
2. 进入浮动状态时 InputPanel 默认在底部区域
3. 浮动模式的 InputPanel 要能 resize：四个角都要能 resize。在进行拖动的时候或者刚刚进入拖动模式的时候，四个角会高亮，意味着可以进行 resize
4. resize 的值要能反应在 `Floating mode width|height`，但是 settings 中不显示 left/right 的值，这是隐藏的
5. InputPanel 的所有状态需要记录在数据库中，left/right/width/height 使用% 来进行记录，这样在 屏幕 resize 的时候也能正确重放，但是需要有一个 min|max-width|height 来约束，max 是与屏幕大小有关，min 是与虚拟键盘的排版有关。
6. InputPanel 在浮动状态下，要避免过分溢出屏幕，和屏幕边缘要有一定的碰撞关系，比如最多1/3 的 width|height 能溢出屏幕
7. `呼吸效果，现在直接做到整个 InputPanel 上`,这个你没有完成，现在看到 toolbar 这部分仍然没有呼吸

---

1. 因为拖动需要InputPanel 的工具栏，所以顶部工具栏不可以溢出顶部屏幕
2. “触摸板的边缘区域，是特殊的区域，手指移动进入到这个区域的时候，会进入“无限滑动”模式”，目前这个无限滑动的区域，你要考虑触摸板的大小，使用一种 `minmax(px, %, px)`的设计，来适应可缩放的 InputPanel
3. 这个区域在开始 touchmove 的时候，就应该直接亮起，而不是靠近边缘的时候才亮起，并且样式上应该是一种“光晕”的效果，类似内阴影。

---

1. InputPanel 一旦进行 open，那么就必须和触发 textarea 的 focus（我的目的是强制显示光标）
2. 反之，textarea一旦 focus，也需要触发 InputPanel 的 open
3. addon 原生提供 FAB 按钮，点击 FAB 按钮可以打开 InputPanel；反之 InputPanel 的 close 会变成 FAB
4. 如果一个页面中有多个 xterm-Terminal，也只能存在一个 InputPanel 实例，按需（focus）动态迁移到 xterm-Terimnal 的 DOM 中

---

我们需要彻底优化一下这个 Terminal 的半屏与全屏的控制方式，不论现在是如何控制的，请进行以下的重构和优化：

1. Terminal 的顶部是 Tabs，在 tabs 的右侧，提供两个按钮：“全屏｜半屏切换按钮”、“关闭按钮”
2. Terminal 进入全屏，路由上就是 `push /terminal`，进入半屏或者关闭，那么等同于 goBack，“半屏或者关闭”对url没有影响和改变
3. 在移动模式下，

我想了一下，需要参考 ide 的设计：“存在不同区域，但是每个区域都可以多标签，这些标签可以扩区域移动”。
但我们这个布局最大的复杂点在于，我们是“响应式”设计，对移动端友好，因此不需要像桌面端 IDE 那样有左右上下等区域。
而是更简单：我们始终集中在 main-area 视图区域，然后在 main-area这里扩展出 bottom-area 这个区域。

在这个“上下分层”的基础上，我们围绕这个布局进行设计：

1. 左边的导航部分，其实也要分成上下两个区域。一个是靠上排列，一个是靠下排列，这里本质就是一个“Tabs”
2. 因此我们可以把目前的这些导航都放到“main-area-nav”，就是把Settings 都挪上去。然后Terminal留在底部。这个意思是：如果开启bottom-area-nav的 Terminal，那么因为现在 bottom-area 有东西，所以整个界面就分成了上下两个部分。
3. 这时候其实就没有区分什么Terminal “全屏半屏”，Terminal 的渲染模式始终就是“铺满指定的区域”。这个时候，如果想让 Terminal 全屏渲染，只需要把底部的 bottom-area-nav/Terminal 挪到 main-area-nav/Terminal 即可。因为这个时候如果底部没有内容被激活，那么就会隐藏。
4. 进一步说，用户可以自由改变所有 `*-area-nav/*(Tab)` 的位置，我们需要在这些 Tabs 上提供一个“拖动”标识，方便用户知道这些 Tabs 是可以排序的
5. 在移动模式下，底部的 bottom-nav 映射的是 main-area-nav 的内容
6. 我们需要封装一个 navController，而不是依赖 react，这个 navContaoller 需要同步存储到数据库，然后利用我们后端的 kv 临时存储来做到跨设备同步（这个我之前教过你怎么做，你可以和我确认一下思路）。
7. Terminal-Tab 这里右上角可以提供两个按钮：“切换区域”、“关闭”：
   1. 如果 Terminal-Tab 在 main-area，那么“切换区域”按钮就变成“切换到 bottom-area”，使用 PanelBottomClose 这个 icon
   2. 如果 Terminal-Tab 在 bottom-area， 那么“切换区域”按钮就变成“切换到 main-area”，使用 PanelTopClose 这个 icon
   3. 这些功能，都依赖于 navController 来进行区域切换和关闭。我们的拖动排序，本质也是依赖 navController 来进行排序后的存储。
8. 最后是关于路由，我们的默认路由path 还是面向 main-area，而bottom-area 的路由，则是依赖于 `?bottom=` 这个 searchParams 来进行存储，比如`?bottom=${encodeURIComponent('/terminal?key=value')}`。这个你可以确定一下我这个思路能否和 TanStack Router 进行契合。如果不契合，或者不那么契合，你可以和我讨论一下其它的解决方案。

---

1. 我们的 Tabs 组件在溢出的时候是有提供一个 scroll-button 的，这个难道没有吗？为什么我再 Terminal 的 tabs 这里看不到这 scroll-button？
2. 为什么我刷新页面后，重新进入到`/config`,这的 Schema 没有立刻渲染出来？而是要等一会儿，这个难道没有被统一缓存吗？
3. 我切换 tabs 的时候会触发 `?archiveTab=`变更，这个变更能不能控制好，不要让viewTransactions 动画发生
4. `/config`页面切换 tabs 的时候没有更新`?archiveTab=`
5. 现在`/config`页面最后一个 tab是 Changes，这里界面上显示着：`Change metadata is stored in .openspec.yaml inside each change folder. It is created by /opsx:new and binds schema selection for the change.`，以及`No metadata file found for this change. It should live at openspec/changes/<change>/.openspec.yaml.`这个页面到底要显示什么？是什么作用？请你基于 openspec 官方的一手资料（比如源代码 references/openspec ），给我一个合理的解释。

---

1. `/config` 页面中的第一个 Tab：`Config` ，这里的布局有点问题，请参考 Schema 中的文件编辑，是有明确的“边框”，底部状态栏可以用来显示当前的状态，顶部状态栏可以显示具体的项目相对路径

---

我们需要实现搜索功能：
搜索功能需要支持两种模式，一种是后端搜索，一种是前端搜索。二者本质是一样的，是跟随着数据源在哪去走的。
比如在动态模式下，数据源在后端，那么搜索功能就放在后端。
如果是 SSG 静态模式下，数据源在前端，那么搜索功能就放在前端。
因此架构上要尤为小心：哪些是可以共用的，哪些需要针对平台进行开放。

---

接下来我们将要开发 `2.*` 的版本，对应的是 openspec 的 `1.2.*` 的版本。
你要做的是：

1. 更新 references/openspec 到最新
2. 了解 openspec `1.1.*` -> `1.2.*` 的 CHANGELOG
3. **制定新功能的更新计划**
4. 将当前的 `README.md` 改名成 `README-1.*.md`。
   1. 还有中文也是一起迁移
   2. 比如原本是`@latest`，我们发布 v2 后，就要改成 `@^1`
   3. 可能还有其它我没考虑到的，你迁移的时候阅读全文看一下
5. 要注意使用 `openspecui@^2`的时候，如果发现用户本地的 openspec 版本不到 `1.2.*`，那么就要提示用户进行升级到最新版。我们之前从 `openspec@^0` 升级适配到 `openspec@1^` 的时候就有遇到类似的问题，也就是说，我们自己的 `openspecui@1` 兼容的是 `openspec@1.0~1.1`
