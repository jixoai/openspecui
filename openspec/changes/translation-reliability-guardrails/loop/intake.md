## User Input

> 最后我们补充一些可靠性：
>
> 1. Test Translate 面板需要提供一个timeout参数的输入，默认值是15s。
>    1.1. 也就是说底层的batchTranslate的接口也要支持这个参数。但是这个参数的意义不是阅读整个batchTranslate，而是针对单个子任务进行约束。
>    1.2. 这也就意味着，我们的上层的相关都要改动，因为batchTranslate可能返回“部分异常”。这是正确的，因为我们如果引擎是依赖网络层进行翻译的时候，这种情况会更明显。
>    1.3. 也就是说，除了返回的数据接口需要支持异常，我们的前端展示的时候也需要对翻译异常的部分进行支持。通常是在异常翻译的地方，也就是译文应该出现的地方，提供一个重试按钮。这里有两种可能，一种是直译，那么仍然显示原文，在原文旁边通过浮动Popover技术，提供重试按钮（理论上会出现多个重试按钮，建议放在同一个topLayer中）；还有一种是双语，那么更简单，在本应该出现译文的地方提供重试按钮即可
>    1.4. 反过来意味着，我们在进行翻译的时候，需要考虑到任务控制的问题，特别是当我们用了transformers技术会吞噬大量计算机设备资源。用户没有真确选择适合自己设备的模型，导致整个计算机卡死，这是完全有可能的。因此我们需要将任务，通过worker或者thread隔离启动。最好是用worker，可以去限制内存的使用上限。
>    1.5. 所以timeout这个参数，本身不单单意味着只有TimeoutError，还包含其它的error的可能，比如MemoryLimitError
>    1.6. 更进一步的，之前batchTranslate本身没有支持单个任务的错误，一旦出现错误，我们会直接识别成一整个翻译任务都出现了错误从而完全停止，现在不是了。现在的新数据结构即便个别出错，整体任务也能继续执行下去。因此体验会更好。
>    1.7. 我们在启动的时候或者切换引擎选择的时候，都会自动做一次任务检查，这个检查如果没有timeout，配合transformer技术，很容易把设备的资源吃掉
>    1.8. 关于内存的使用限制的配置入口，每个引擎独立配置存储。在我们Model Select部分都有一个设置按钮，目前只提供了huggingface源的切换，这里再加一个参数，这个参数是“最大内存占用上限：25%”
>    1.9. 这个参数还有一些技术细节，要考虑两种场景，就是统一内存和独显显存。首先Worker的resourceLimits，或者process的`--max-old-space-size`，都是在限制内存，但这里只能限制统一内存的架构。因此我们还需考虑到独显的情况需要“额外”进行配置，比如onnxruntime是可以独立配置gpu_mem_limit，以及分配策略采用 kSameAsRequested 按需分配、还有 node-llama-cpp 也可以通过 LlamaModel+LlamaContext 去限制 ，比如配置 gpuLayers:10 + contextSize:2048 + flashAttention:true ，通过精细的混合控制来达成。如果是统一内存（没有独显，特别是Apple设备），情况还不一样，如果模型大小合理（1GB），那么可以用 gpuLayers:"max" + useMmap:false + useMlock:false + contextSize:2048 + batchSize:218 + flashAttention:true 。总之，你需要用“最大内存占用上限：25%”这个“模糊的意图导向参数”为基础，去定义出多档策略，它即是一个具体的配置参数，同时也是一个策略参数。我比如说，如果配置了80%，我们认为用户非常激进地要充分榨干设备性能，那么在 node-llama-cpp 的配置的时候，我们就可以使用一种激进策略去配置。我们可以简单归类成三档：性能档[100%~70%)+平衡档[70%~30%]+节能档(30%~0%)
>    使用openspec推进这个任务，把我的原话记录到change中

## Objective Scope

- Add per-subtask `timeoutMs` support to the translation batch interface, with a default of 15s in the Test Translate surface.
- Allow batch translation to return partial failure records instead of failing the whole batch on the first error.
- Surface per-segment retry affordances in document translation UI for both direct and bilingual modes.
- Introduce per-engine memory budget configuration and map the intent-level value to engine-specific runtime strategy.
- Isolate heavy local translation work in worker/thread execution with bounded memory where the runtime supports it.
- Record the requirement and discussion history in OpenSpec as part of the loop artifact trail.

## Non-Goals

- Do not add Tencent-specific UI or service branches.
- Do not change browser translation capability detection semantics beyond the retry/error handling needed for this loop.
- Do not implement a full upstream runtime fork for unsupported GGUF formats in this loop.
- Do not force all engines through the same worker/runtime policy when the platform law only requires heavy local engines to be isolated.

## Acceptance Boundary

- `batchTranslate()` accepts a per-subtask timeout and can yield partial failure results.
- Test Translate defaults to 15s and exposes the timeout input.
- Document translation can render retry affordances for failed translated segments without collapsing the whole document into an error state.
- Heavy local translation engines can be launched with a memory-budget strategy derived from the configured percentage.
- The new OpenSpec loop captures the original requirement and the requirement-bearing discussion trace.
