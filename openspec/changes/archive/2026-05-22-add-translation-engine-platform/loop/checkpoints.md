## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved

## 2. Platform Contracts

- [x] 2.1 Core translator contract and engine settings schema implemented
- [x] 2.2 Cache key contract includes engine/model/version dimensions
- [x] 2.3 User global settings include extension install and AI/NMT config

## 3. Translator Atoms

- [x] 3.1 `@openspecui/browser-translator` package created and built with tsdown
- [x] 3.2 `@openspecui/nmt-translator` package created and built with tsdown
- [x] 3.3 `@openspecui/ai-translator` package created and built with tsdown

## 4. Server Platform

- [x] 4.1 Translation engine registry service implemented
- [x] 4.2 User-cache npm alias install commands implemented
- [x] 4.3 Local/dev resolver no-op install implemented
- [x] 4.4 Install session single-line log and cancel implemented
- [x] 4.5 tRPC router exposes engine list/settings/install/translate APIs

## 5. Web UI and Runtime

- [x] 5.1 Settings Translation panel extracted from settings route
- [x] 5.2 Engine selector, install/cancel, and single-line log rendered
- [x] 5.3 AI base URL/token/model and NMT model controls rendered
- [x] 5.4 Document translation hook uses unified engine platform

## 6. Verification Gates

- [x] 6.1 Focused unit tests pass
- [x] 6.2 New packages build
- [x] 6.3 Web SSG build passes
- [x] 6.4 CI-equivalent checks pass or scoped subset justified
- [x] 6.5 Changeset included

## 7. Model Catalog and Prepare Flow

- [x] 7.1 Core translator contract exposes model catalog and prepare/download plan types
- [x] 7.2 Server proxies Hugging Face model search/detail and computes mixed ranking
- [x] 7.3 NMT install session upgrades to package install + model prepare + ready
- [x] 7.4 Settings NMT model input upgrades to autocomplete Popover with description, size, and compatibility
- [x] 7.5 Install surface shows resolved download plan before/while preparing model

## 8. Real Runtime Verification

- [x] 8.1 Select a minimal ONNX translation model for local verification
- [x] 8.2 Complete a real local model download/prepare session
- [x] 8.3 Run a real translation through the unified server API and verify output
