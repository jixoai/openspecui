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
