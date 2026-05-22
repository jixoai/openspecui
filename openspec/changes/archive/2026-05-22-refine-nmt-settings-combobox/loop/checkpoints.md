## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved for implementation start

## 2. Interface Contract

- [x] 2.1 NMT local inventory and remote search are exposed as separate APIs
- [x] 2.2 Client merges local-first and remote results with duplicate suppression
- [x] 2.3 NMT progress payload exposes enough file-level detail for the Settings card
- [x] 2.4 Remote NMT search exposes subscription-style progressive enrichment
- [x] 2.5 NMT download plans expose selectable profile/group chips with concrete sizes
- [x] 2.6 Local model discovery cache stores raw provider fetch metadata as recomputable truth

## 3. Settings Interaction

- [x] 3.1 Engine installed state no longer duplicates a visible Installed row
- [x] 3.2 NMT Model reads as part of the selected NMT engine control family
- [x] 3.3 Popover shows remote-loading state while combining local and remote results
- [x] 3.4 Download plan header uses circular progress instead of layout-expanding bar
- [x] 3.5 File rows show textual per-file progress detail
- [x] 3.6 Initial selected engine renders from persisted config without browser-default flash
- [x] 3.7 NMT model search debounces automatically without Enter submission
- [x] 3.8 Search results show profile chips and chip-level sizes when strict naming is recognized
- [x] 3.9 Unknown-size chips/results stay disabled until concrete size is known
- [x] 3.10 NMT profile chips render directly under the NMT Model selector, not inside the file download card
- [x] 3.11 Download plan is renamed/reframed as Download files and only manages the selected chip's file lifecycle
- [x] 3.12 Download files renders the complete selected profile file set with internal scrolling instead of row truncation
- [x] 3.13 Unavailable NMT profile chips use dashed borders while fully local profiles use solid borders
- [x] 3.14 NMT runtime plan resolution caches raw Hugging Face repository tree request metadata once a model enters the local lifecycle

## 4. Verification

- [x] 4.1 Implementation progress synchronized with loop artifacts
- [x] 4.2 Focused server tests pass
- [x] 4.3 Focused Settings tests pass
- [x] 4.4 Server and web typecheck pass
- [x] 4.5 Focused tests cover progressive search, debounced query, and grouped download selection
- [x] 4.6 Backend tRPC plan/state verified by starting an explicit server and fetching selected q8/fp16 plans directly

## 5. Workflow Gates

- [ ] 5.1 CI-equivalent local checks passed or scoped exceptions documented
- [ ] 5.2 PR checks passed

## 6. Merge Readiness

- [ ] 6.1 OpenSpec archive flow completed after acceptance
- [ ] 6.2 PR merge approved
