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

## Follow-up User Input

> continue
>
> 还有，顺便修复一个问题，我发现你现在对于翻译引擎的配置，是项目级别的。理论上可以支持（但是项目级别的支持我们默认不开放，有需要用户自己去改项目级别的配置字段就好）。
> 默认使用全局配置。
> 这里的写入逻辑是：如果本地项目配置存在相关的配置字段：`"translation": {"engineId": "local-llama"}`，那么就继续写入项目配置中，否则就写入到全局配置中。
> 读取的话，当然也是优先项目，然后全局。
>
> ---
>
> 使用openspec推进任务

## Follow-up Acceptance Boundary

- Translation engine selection SHALL default to global settings.
- Project-level translation engine selection SHALL remain supported when the project config explicitly contains `translation.engineId`.
- Reads SHALL resolve project-level translation engine fields before global settings.
- Writes SHALL update project config only when the related project-level field already exists; otherwise writes SHALL update global settings.

## Native Runtime Crash Follow-up User Input

> 我翻译的时候遇到异常：
>
> ```
> load: control-looking token: 128247 '</s>' was not control-type; this is probably a bug in the model. its type will be overridden
> [node-llama-cpp] load: control-looking token: 128247 '</s>' was not control-type; this is probably a bug in the model. its type will be overridden
> WARNING: Using native backtrace. Set GGML_BACKTRACE_LLDB for more info.
> WARNING: GGML_BACKTRACE_LLDB may cause native MacOS Terminal.app to crash.
> See: https://github.com/ggml-org/llama.cpp/pull/17869
> 0   libggml-base.dylib                  0x00000001244ad44c ggml_print_backtrace + 276
> 1   libggml-base.dylib                  0x00000001244c34fc _ZL23ggml_uncaught_exceptionv + 12
> 2   libc++abi.dylib                     0x000000018738d75c _ZSt11__terminatePFvvE + 16
> 3   libc++abi.dylib                     0x000000018738fbe4 __cxa_get_exception_ptr + 0
> 4   libc++abi.dylib                     0x000000018737c09c __cxa_get_globals + 0
> 5   llama-addon.node                    0x0000000124377874 _ZNK4Napi5Error26ThrowAsJavaScriptExceptionEv + 224
> 6   llama-addon.node                    0x000000012437e198 _ZN4Napi11AsyncWorker14OnWorkCompleteENS_3EnvE11napi_status + 232
> 7   node                                0x0000000100421f04 _ZN12_GLOBAL__N_16uvimpl4Work19AfterThreadPoolWorkEi + 136
> 8   node                                0x000000010042242c _ZZN4node14ThreadPoolWork12ScheduleWorkEvENKUlP9uv_work_siE_clES2_i + 320
> 9   node                                0x00000001004222e0 _ZZN4node14ThreadPoolWork12ScheduleWorkEvENUlP9uv_work_siE_8__invokeES2_i + 28
> 10  node                                0x000000010131de24 uv__work_done + 184
> 11  node                                0x0000000101321874 uv__async_io + 304
> 12  node                                0x000000010133616c uv__io_poll + 1432
> 13  node                                0x00000001013221c8 uv_run + 568
> 14  node                                0x00000001003e6a74 _ZN4node11Environment14CleanupHandlesEv + 188
> 15  node                                0x00000001003e7188 _ZN4node11Environment10RunCleanupEv + 292
> 16  node                                0x000000010035550c _ZN4node15FreeEnvironmentEPNS_11EnvironmentE + 120
> 17  node                                0x000000010059d4bc _ZN4node6worker6Worker3RunEv + 2428
> 18  node                                0x00000001005a1cd4 _ZZN4node6worker6Worker11StartThreadERKN2v820FunctionCallbackInfoINS2_5ValueEEEEN3$_08__invokeEPv + 80
> 19  libsystem_pthread.dylib             0x00000001873d9c58 _pthread_start + 136
> 20  libsystem_pthread.dylib             0x00000001873d4c1c thread_start + 8
> libc++abi: terminating due to uncaught exception of type Napi::Error:
> /Users/kzf/Dev/GitHub/jixoai-labs/openspecui/packages/cli:
>  ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  openspecui@3.11.3 dev: `NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development" tsx src/cli.ts --dir /Users/kzf/Dev/GitHub/jixoai-labs/agenter`
> Exit status 134
>  ELIFECYCLE  Command failed with exit code 134.
> ```
>
> 两个问题，为什么会有异常？为什么异常会导致程序崩溃

> 那就升级成子进程，同时内存限制也要做。

## Native Runtime Crash Follow-up Acceptance Boundary

- Native-crash-risk translation engines SHALL run outside the OpenSpecUI server process.
- A native runtime abort or uncaught N-API/C++ exception SHALL surface as a classified translation runtime failure, not terminate the CLI/server process.
- The process-isolated host SHALL still receive the engine memory budget policy.
- The process-isolated host SHALL enforce a V8 heap limit and an RSS watchdog derived from the engine memory budget.

## Process Lifecycle Follow-up User Input

> 好像有点问题，子进程应该是死掉了，然后主进程似乎没有意识到这个问题。也没有自动重启

## Process Lifecycle Follow-up Acceptance Boundary

- If the managed local translation child process dies, disconnects, closes, or fails to spawn before completing a batch, the parent SHALL observe that lifecycle event.
- Observed child-process failure SHALL be normalized into per-item runtime failures for every unsettled input, instead of leaving the parent generator hanging.
- A failed process-host batch SHALL NOT poison future batches; the next invocation SHALL create a fresh child process.
- This loop does not require a persistent engine daemon. In the current per-batch process-host law, "restart" means the next translation attempt starts a new process host automatically.

## Runtime Budget Algorithm Follow-up User Input

> 底层算法有问题：
>
> ```
> Selected GGUF model is estimated to need 1.58GB, but the 50% memory budget only allows 0.01GB. Choose a smaller model, lower the memory budget risk by closing other apps, or raise the engine memory budget intentionally.
> ```

## Runtime Budget Algorithm Follow-up Acceptance Boundary

- The memory-budget percentage SHALL remain an intent-level budget derived from total/constrained memory.
- Apple Silicon/unified-memory budget calculation SHALL NOT treat transient `os.freemem()` as a hard cap that can collapse a 50% budget to near zero.
- Local-llama preflight SHALL still reject models whose estimated requirement exceeds the intent-derived safe budget.
- RSS watchdog limits SHALL continue to enforce the selected budget at process runtime.

## Translation Settings Ownership Follow-up User Input

> 1. 另外，取消一个默认行为：现在切换Engine后，会自动做Test 。取消这个行为，通过前端的改进，来提示用户自己来做 Test Translate。这样能看到异常、延迟 等详情。
>
> 2.  ` "translation": {    "enabled": true,    "cacheEnabled": true}` 这些配置默认不是project，属于global。和engineId字段一样，默认都是全局，但是不排除手动再project做配置。准确来说translation下的所有字段都是这样的行为。你看看还有什么遗漏的字段是默认写project，改成global。

## Translation Settings Ownership Follow-up Acceptance Boundary

- Switching translation engines SHALL NOT automatically run runtime/test probes that can hide errors, latency, or resource impact.
- Settings UI SHALL prompt users to run Test Translate manually to validate errors and latency.
- `translation.enabled`, `translation.targetLanguage`, `translation.displayMode`, `translation.cacheEnabled`, and `translation.engineId` SHALL default to global settings.
- Project-level `translation.*` overrides SHALL remain supported when the project config explicitly contains the related field.
- Managed local and OpenAI model-selection fields under `translation.engines.*` SHALL default to global settings unless the project config explicitly owns the related engine settings.
