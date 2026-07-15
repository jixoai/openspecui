<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Specify the backend-owned protocol required by App-native Store management.
2. Preserve upstream OpenSpec locality while allowing remote OpenSpecUI transports.
3. Separate settled protocol boundaries from decisions still requiring discussion.
4. Specify an optional backend-wide access gate without inventing a permission system.
5. Preserve objective OpenSpec facts and reactive propagation across Store and Context projections.

Original request (2026-07-15): "官方支持任何已连接的远程 backend？"
Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
Original request (2026-07-15): "我们刻意开发了一个响应式内核，这是 openspecui 对 openspec 最大的增强。操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
-->

# Hosted environment and Store mutation protocol

## Source boundary

OpenSpec upstream has no network backend abstraction. Its CLI runs against the filesystem and process environment of the machine where it is invoked. The Store registry and Worksets are per-machine state under the effective OpenSpec data home; Store metadata `remote` is a Git clone URL, not an OpenSpec service endpoint.

The hosted backend and persistent App shell are OpenSpecUI contracts. A remote OpenSpecUI backend therefore remains local from OpenSpec's perspective: the backend invokes the CLI on its own host, against that host's filesystem and inherited `XDG_DATA_HOME`.

## Settled connection boundary

- Any connected backend that satisfies the hosted protocol may participate in Store Manager. The product model does not distinguish local and remote backends as different Store feature classes.
- App selects a backend transport; it does not read or synthesize that backend's Store registry.
- URL locality grants nothing. A loopback URL is not a protocol capability, and a remote URL is not a separate Store feature class.
- Capability advertisement states which protocol operations the backend implements. It is compatibility metadata, never an authorization grant.
- Store operations preserve upstream CLI JSON, exit status, diagnostic codes, canonical path validation, conflict detection, and registry locking.
- Destructive removal identifies the environment, backend host, Store id, and checkout path before explicit confirmation.

This is not a new category of remote authority. A connected project backend already exposes terminal, file, and project mutation surfaces. Store Manager must use the same backend trust boundary instead of inventing a separate local-only rule.

## Settled Backend Access Gate

OpenSpecUI may optionally protect one hosted backend with one shared Bearer credential. The gate is deliberately smaller than an authorization system:

```text
operator starts backend
        |
        +-- no flag ----------------------> current unguarded behavior
        |
        +-- --auth -----------------------> generate strong credential
        |
        `-- --password [secret] ----------> normalize supplied secret
                                                |
                                                v
                              Authorization: Bearer <credential>
                                                |
                   +----------------------------+-----------------------+
                   |                            |                       |
              HTTP / tRPC              tRPC subscription          PTY WebSocket
              header                   connection params          first message
```

- There are no users, roles, ACLs, permissions, or multi-tenant identities.
- `--auth` generates a high-entropy credential and prints the complete Authorization header.
- `--password` produces the same canonical Bearer credential. A valueless flag should prompt without echo; `--password=...` may be accepted with a warning about shell history and process-list exposure.
- Enabling the gate protects the entire backend: `/api/*`, HTTP tRPC, tRPC subscriptions, PTY WebSocket, file operations, terminal operations, notifications, and future Store operations.
- PTY authentication completes before any command can execute.
- When CLI launches App automatically, it may transfer the credential once in a URL fragment. App reads it into session memory and immediately removes the fragment. Credentials never enter query parameters, persisted tab records, or `localStorage`.
- The gate supplies access control, not encryption. Non-loopback deployments require HTTPS/WSS.

## Settled environment identity

The public hosted-protocol field is `envUri`, not `environmentId`.

- `envUri` identifies the combination of backend host identity and effective OpenSpec data home.
- It is backend-issued, opaque, and non-dereferenceable. App compares and persists it but never constructs it.
- Multiple backend processes, projects, ports, and `apiBaseUrl` values share one `envUri` when they execute on the same host against the same data home.
- Changing the backend host or effective data home changes `envUri`.
- Raw hostname and data-home path are not encoded into the public URI.
- `apiBaseUrl` remains the locator for a particular backend instance; `envUri` is only the canonical environment identity.

## Settled capability model

```text
hosted protocol version
        |
        `-- required connection contract

optional runtime capabilities
        |
        +-- stores.inspect  -> list / detail / doctor projection
        +-- stores.mutate   -> setup / register / unregister / remove
        `-- contexts.inspect -> project Root / Reference relationships
```

- Capabilities report implementation compatibility only. They do not encode access, permission, Store health, or whether one operation will succeed for a particular input.
- Individual Store subcommands are not separate capabilities. Their applicability and failure details remain upstream CLI results and diagnostics.
- The current `runtimeCapabilities` rule that requires every known capability must be split conceptually: protocol requirements gate the connection, while absent optional capabilities disable only their dependent surfaces.
- OpenSpecUI is an objective visual projection. It preserves upstream field meanings, diagnostics, exit status, and unknown states. UI summaries may compress these facts but cannot silently replace them with invented domain conclusions.

## Settled projection sources

```text
OpenSpec CLI fact source                     OpenSpecUI projection

store list --json -------------------------> Inventory
store doctor [id] --json ------------------> Inspector
context --json on online project backend --> Observed Context
                                                    |
                                                    v
                                      Matrix join by envUri + Store id
```

- Hosted responses may wrap upstream output with provenance such as `envUri`, CLI version, observation time, and exit status. They preserve upstream field meanings, diagnostics, and unknown values.
- Context Matrix is the join of currently observed online project contexts, not a global answer to "which projects use this Store?" OpenSpec has no project reverse registry.
- UI wording says "observed references" and "no reference currently observed". It never upgrades absence from the observed set into "unreferenced".
- An offline project contributes an unknown relationship. A cached relationship may be shown only as an explicitly stale snapshot carrying its observation time.
- App never scans a backend filesystem for OpenSpec projects and never writes its own project-to-Store registry.

## Settled mutation lifecycle

```text
start(requestId)
      |
      v
accepted -> running -> succeeded
                    `-> failed

client disconnect ------------> observer detaches; operation continues
terminal result unrecoverable -> indeterminate
```

- The backend owns the operation. A WebSocket subscription only observes it, so unsubscribing or closing App never kills the CLI process.
- A client-generated request id deduplicates starts within one backend process. Mutations are never retried automatically.
- `succeeded` means CLI exit zero with a valid final JSON payload. `failed` preserves the CLI failure payload, diagnostics, stdout/stderr, and exit status.
- `indeterminate` means no reliable terminal result can be recovered. It does not claim failure, cancellation, or rollback.
- V1 provides no user-facing mutation Cancel. Killing a Store command can leave committed or partially removed durable state.
- The UI shows real lifecycle and CLI output without fabricated percentage progress.

## Settled reactive propagation

```text
CLI mutation or external filesystem change
                    |
                    v
       multi-root reactive kernel
       - effective OpenSpec data home
       - dynamically registered Store roots
       - connected project roots
                    |
                    v
      envUri-scoped invalidation push
                    |
                    v
       every subscribed client pulls
       Inventory / Inspector / Context
```

- The CLI and filesystem remain truth. Push events announce invalidation; they do not carry a second authoritative Store model.
- Mutation settlement requests immediate invalidation, while filesystem observers propagate the same change to other backend processes sharing the data home. Duplicate signals are coalesced or treated idempotently.
- Registry changes rebind the observed Store-root set. Store-root and project-root changes invalidate the affected Inspector and Context projections.
- The normal case is convergence before another endpoint acts. Only submissions that genuinely overlap before propagation reaches them rely on the upstream registry lock and conflict diagnostics.
- The current Store subscription's five-second polling exists only because the watcher pool is rooted at one launch project. The 1.6 adaptation replaces that primary path with multi-root observation; low-frequency polling remains only for watcher degradation or missing-path recovery.
- Every terminal or indeterminate operation outcome invalidates affected facets and forces a pull, because failure or interruption may still leave durable partial state.
