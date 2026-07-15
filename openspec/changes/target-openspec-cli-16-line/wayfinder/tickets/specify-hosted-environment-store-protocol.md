<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Decide the minimum hosted environment and Store protocol required by the selected App information architecture.

Original request (2026-07-15): "Store Manager的存在才能使得整个产品故事形成闭环。"
Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
Original request (2026-07-15): "我们刻意开发了一个响应式内核，这是 openspecui 对 openspec 最大的增强。"
-->

# Specify the hosted environment and Store mutation protocol

Status: closed
Type: grilling

## Question

What is the minimum backend-owned protocol that lets the experimental App identify OpenSpec runtime environments, render Store Inspector/Context/Inventory projections, and execute CLI-backed Store operations without inferring registry or root semantics in the browser?

The decision must cover stable environment identity, capability discovery, Store list/detail/doctor projections, project Root/Reference relationships, setup/register/unregister/remove operations, loading and failure states, and the trust boundary for remote backends.

## Decisions so far

- Any connected backend that satisfies the hosted protocol is eligible; the Store Manager domain is not restricted to localhost.
- OpenSpec CLI and Store registry operations execute locally on the backend host under that backend process's inherited OpenSpec data scope.
- App does not infer trust from URL locality. A backend may optionally enable one shared-credential Backend Access Gate, but the hosted protocol does not introduce users, roles, ACLs, permissions, or multi-tenant authorization.
- A remote connection does not introduce the first mutation boundary: the hosted project workspace already exposes terminal, file, and project operations against its backend.
- Destructive Store removal must still identify the target environment, host, Store, and checkout path and require explicit confirmation.
- Runtime-environment identity is named `envUri`: a backend-issued, opaque, non-dereferenceable URI for the backend-host and effective-OpenSpec-data-home pair.
- Multiple project backends share one `envUri` across process restarts, ports, projects, and API URLs when that pair is unchanged. `apiBaseUrl` remains the backend-instance locator; App never constructs `envUri`.
- `--auth` generates a high-entropy Bearer credential and prints the complete Authorization header. `--password` normalizes an operator-supplied secret into the same canonical Bearer form; a valueless flag should use hidden input, while an inline value requires a leakage warning.
- Once enabled, the Backend Access Gate protects the entire backend, including `/api/*`, HTTP tRPC, tRPC subscriptions, PTY WebSocket, file, terminal, notification, and Store operations. HTTP uses the Authorization header, tRPC WebSocket uses connection parameters, and PTY WebSocket authenticates before accepting commands.
- Capability discovery describes implementation compatibility only and has no authorization meaning.
- Store discovery uses `stores.inspect`, Store mutations use `stores.mutate`, and project Root/Reference projection uses `contexts.inspect`. Individual CLI subcommands do not become separate capabilities.
- Protocol-version requirements decide whether App can connect to a backend; optional capabilities decide which product surfaces are available. Operation applicability and failures remain CLI facts carried through results and diagnostics.
- OpenSpecUI preserves upstream facts and uncertainty. It may visually summarize them but must not infer additional health, ownership, completeness, synchronization, or authorization conclusions.
- Inventory projects `openspec store list --json`, Inspector projects `openspec store doctor [id] --json`, and each project Context projects `openspec context --json`. A hosted envelope adds provenance without replacing upstream facts.
- Context Matrix joins currently observed online project contexts by `envUri` and Store id. It never claims machine-wide completeness, scans for projects, or creates a reverse registry. Offline project relationships are unknown unless displayed as explicitly stale, timestamped snapshots.
- Store mutations are backend-owned operations. Client disconnect detaches observation without killing the CLI; terminal result loss is `indeterminate`. V1 offers no Cancel and performs no automatic mutation retry.
- The reactive kernel observes the effective data home, registered Store roots, and connected project roots. CLI or external changes push `envUri`-scoped invalidations, then every client pulls fresh CLI projections. The current Store polling path must not remain the primary consistency mechanism.
- Auto-launched App handoff may carry the credential once in a URL fragment. App removes it immediately and never persists it in query parameters, tab state, or `localStorage`.
- Non-loopback use requires HTTPS/WSS because the Backend Access Gate does not encrypt transport.

## Working asset

[Hosted environment and Store mutation protocol](../research/hosted-environment-store-protocol.md) separates settled boundaries from the remaining protocol decisions.

## Resolution

The hosted environment identity, optional access gate, capability vocabulary, objective projection sources, observed-only Context Matrix, backend-owned mutation lifecycle, and multi-root reactive propagation contract are settled in the working asset above.
