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

现在我对Change进行Archive之后，会出现问题，我们的对Archive本来应该在Dialog中显示我们的终端打印，然后成功后，Dialog继续现实终端打印，并且提示用户Archive已经成功。并且我们的路由自动跳转到archive页面。

然而现在路由没变，界面上现实着：“Change not found”；同时我们的Arcihive的Dialog也消失不见了，导致我们连终端打印也看不到了。


---

我们现在界面上有一个全局安装cli的按钮，目前只会在全局openspec不存在的时候会可用。也应该发生`npx @fission-ai/openspec --version`的版本号高于本地的时候，那么这时候界面上应该提示用户更新，同时全局安装的cli按钮也可用。
