## User Input

1. 一个ToC理论上只需要有一个翻译按钮，我发现在change页面，这类会将多个文件融合在一个文件中，结果就会出现多个翻译按钮
2. 翻译按钮一旦在会话中启用或者关闭（sessionStorage），那么应该所有页面共享这个开关。也就是说我在A 页面点击了翻译，切换到B页面的时候，就不用手动点击翻译了。这个行为直接和翻译按钮绑定在一起就行。因为它是在模拟用户的行为，减少操作的次数
3. 在设置页面中，翻译的语言列表，你显示的语言选择都是英文，建议双语：英文+目标语言，底层用语言代码存储（并用于排序）。比如 zh = `Chinese 中文`; zh-Hans = `Traditional Chinese 繁体中文`。这个选择器最好是支持“AutoComplete”，支持 语言代码、英文、目标语言 的混合模糊搜索（和我们的搜索引擎用同一个库即可）。并且请你补全完整的语言列表，目前的支持是：

```text
Code	Language
ar	Arabic
bg	Bulgarian
bn	Bengali
cs	Czech
da	Danish
de	German
el	Greek
en	English
es	Spanish
fi	Finnish
fr	French
hi	Hindi
hr	Croatian
hu	Hungarian
id	Indonesian
it	Italian
iw	Hebrew
ja	Japanese
kn	Kannada
ko	Korean
lt	Lithuanian
mr	Marathi
nl	Dutch
no	Norwegian
pl	Polish
pt	Portuguese
ro	Romanian
ru	Russian
sk	Slovak
sl	Slovenian
sv	Swedish
ta	Tamil
te	Telugu
th	Thai
tr	Turkish
uk	Ukrainian
vi	Vietnamese
zh	Chinese
zh-Hant	Chinese (Traditional)
```

用户要求：使用openspec推进以上任务

## Objective Scope

- Refine document translation controls so a rendered ToC exposes only one translation action even when a page merges multiple Markdown documents into one reading surface.
- Add a session-scoped translation activation state bound to the translation button, persisted in `sessionStorage`, and shared across document pages in the same browser session.
- Replace the translation language picker with a complete supported-language catalog whose storage value remains the language code while display/search covers language code, English name, and target-language/native name.
- Update the relevant OpenSpec artifacts before implementation.

## Non-Goals

- Do not change the browser Translator API integration or translation quality model.
- Do not persist per-session translation activation into project config or durable settings.
- Do not replace the existing document translation cache storage model.
- Do not introduce a second Markdown viewer or ToC implementation.
- Do not implement a broad global command palette rewrite for this task.

## Acceptance Boundary

- A page with nested or merged Markdown viewers, including change/artifact-style pages, renders at most one translation button in the effective ToC header.
- Clicking the translation button updates a session-scoped state in `sessionStorage`; subsequent document pages automatically start in the same translated/source mode when translation is configured and available.
- The session activation state can be toggled off through the same button and applies to later document pages in the same tab/session.
- Settings exposes all listed language codes with bilingual display labels and stores the selected language code.
- The language selector supports fuzzy search over code, English name, and native/target-language label.
- Unit tests cover ToC action deduplication/ownership, session-scoped activation, and language selector catalog/search behavior.

## Follow-up Input: 2026-05-19

1. Settings页面的语言选择器还得改进。现在点击是直接清空选择。我建议默认不清空，给一个快速清空的按钮。然后要做到，没有选中任何值的情况下，取消Popover后，能自动选中之前的可用值。现在最大的问题是，这个Popover显示出来后，默认就不关掉了。也就是说，你应该不是用html-naitive-popover 实现的。需要改进
2. Settings页面的ToC目前只有宽屏模式下有，需要兼容窄屏，参考其他使用ToC组件的页面如何适配即可

## Follow-up Acceptance Boundary

- Opening the Settings translation language selector keeps the current committed language label visible instead of clearing the field.
- The language selector provides an explicit quick-clear button for starting an empty search.
- If the selector is cleared or left without a committed value and then dismissed, the visible field restores the previous valid committed language.
- The language selector uses the native HTML popover lifecycle so outside click, Escape, and browser light-dismiss behavior close the list.
- Settings renders the shared `Toc` in the same narrow-compatible structural order as other ToC pages, so narrow screens get the collapsible contents control above page content.
