/*
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Render three Store Manager information architectures from shared fixture state.
2. Simulate upstream Store operations entirely in memory.
3. Expose environment selection, Store selection, theme, and variant state.
4. Keep all rendered state visible for product-story evaluation.

Original request (2026-07-15): "Store Manager的存在才能使得整个产品故事形成闭环，所以我仍然需要看到一个初版的 Store Manager。"
*/

const variants = [
  { key: 'A', name: 'Registry table' },
  { key: 'B', name: 'Store inspector' },
  { key: 'C', name: 'Context matrix' },
]

const environments = [
  {
    uri: 'openspecui:environment:9fa2c7e8',
    name: 'Team A / local',
    host: 'Gaubee MacBook Pro',
    status: 'online',
    cliVersion: '1.6.0',
    serverVersion: '6.0.0-alpha.2',
    dataHome: '/Users/gaubee/.local/share/openspec',
    registryPath: '/Users/gaubee/.local/share/openspec/stores/registry.yaml',
    stores: [
      {
        id: 'team-plans',
        root: '/Users/gaubee/Planning/team-plans',
        remote: 'git@github.com:jixoai-labs/team-plans.git',
        health: 'healthy',
        healthLabel: 'Healthy',
        metadata: 'v1 / team-plans',
        git: 'main · clean',
        rootFor: ['checkout-web', 'mobile-app'],
        referencedBy: ['openspecui'],
        checks: [
          ['healthy', 'Registry entry', 'Canonical checkout path is registered.'],
          ['healthy', 'Store identity', '.openspec-store/store.yaml matches team-plans.'],
          [
            'healthy',
            'Planning root',
            'openspec/config.yaml and planning directories are readable.',
          ],
          ['healthy', 'Git checkout', 'Remote is configured; working tree is clean.'],
        ],
      },
      {
        id: 'design-system',
        root: '/Users/gaubee/Dev/GitHub/jixoai-labs/design-system',
        remote: 'git@github.com:jixoai-labs/design-system.git',
        health: 'healthy',
        healthLabel: 'Healthy',
        metadata: 'v1 / design-system',
        git: 'main · 2 commits behind',
        rootFor: [],
        referencedBy: ['checkout-web', 'openspecui', 'mobile-app'],
        checks: [
          ['healthy', 'Registry entry', 'Store id resolves to the canonical checkout path.'],
          ['healthy', 'Store identity', 'Committed Store identity is valid.'],
          ['healthy', 'Planning root', '12 specs are available as read-only context.'],
          ['warning', 'Git checkout', 'The checkout is 2 commits behind origin/main.'],
        ],
      },
      {
        id: 'platform-context',
        root: '/Users/gaubee/Planning/platform-context',
        remote: 'git@github.com:jixoai-labs/platform-context.git',
        health: 'warning',
        healthLabel: 'Needs attention',
        metadata: 'v1 / platform-context',
        git: 'main · 1 modified file',
        rootFor: [],
        referencedBy: ['checkout-web', 'mobile-app'],
        checks: [
          ['healthy', 'Registry entry', 'Store is registered for this runtime environment.'],
          ['healthy', 'Store identity', 'Store metadata id matches the registry.'],
          [
            'warning',
            'Planning root',
            'openspec/specs is absent; empty Store remains valid in 1.6.',
          ],
          ['warning', 'Git checkout', 'One uncommitted config change is present.'],
        ],
      },
      {
        id: 'legacy-specs',
        root: '/Volumes/Archive/legacy-specs',
        remote: 'git@github.com:jixoai-labs/legacy-specs.git',
        health: 'error',
        healthLabel: 'Unavailable',
        metadata: 'unknown',
        git: 'checkout missing',
        rootFor: [],
        referencedBy: ['migration-tools'],
        checks: [
          ['healthy', 'Registry entry', 'The registry still contains this Store id.'],
          ['error', 'Checkout path', 'The registered path is not currently mounted.'],
          [
            'error',
            'Store identity',
            'Metadata cannot be inspected while checkout is unavailable.',
          ],
          ['error', 'Planning root', 'Specs and changes cannot be resolved.'],
        ],
      },
    ],
    projects: [
      {
        name: 'checkout-web',
        path: '~/Dev/checkout-web',
        root: 'team-plans',
        references: ['design-system', 'platform-context'],
      },
      {
        name: 'openspecui',
        path: '~/Dev/openspecui',
        root: 'nearest local root',
        references: ['team-plans', 'design-system'],
      },
      {
        name: 'mobile-app',
        path: '~/Dev/mobile-app',
        root: 'team-plans',
        references: ['design-system', 'platform-context'],
      },
      {
        name: 'migration-tools',
        path: '~/Dev/migration-tools',
        root: 'nearest local root',
        references: ['legacy-specs'],
      },
    ],
  },
  {
    uri: 'openspecui:environment:4c31a920',
    name: 'Personal / isolated',
    host: 'Gaubee MacBook Pro',
    status: 'online',
    cliVersion: '1.6.0',
    serverVersion: '6.0.0-alpha.2',
    dataHome: '/Users/gaubee/.local/share/openspec-personal',
    registryPath: '/Users/gaubee/.local/share/openspec-personal/openspec/stores/registry.yaml',
    stores: [
      {
        id: 'personal-notes',
        root: '/Users/gaubee/Planning/personal-notes',
        remote: 'Not configured',
        health: 'healthy',
        healthLabel: 'Healthy',
        metadata: 'v1 / personal-notes',
        git: 'main · clean',
        rootFor: ['lab'],
        referencedBy: [],
        checks: [
          ['healthy', 'Registry entry', 'Canonical checkout path is registered.'],
          ['healthy', 'Store identity', 'Store identity is valid.'],
          ['healthy', 'Planning root', '3 specs are available.'],
          ['warning', 'Git remote', 'No remote is configured; sharing remains manual.'],
        ],
      },
      {
        id: 'empty-roadmap',
        root: '/Users/gaubee/Planning/empty-roadmap',
        remote: 'Not configured',
        health: 'healthy',
        healthLabel: 'Healthy empty Store',
        metadata: 'v1 / empty-roadmap',
        git: 'main · clean',
        rootFor: [],
        referencedBy: ['lab'],
        checks: [
          ['healthy', 'Registry entry', 'Store is registered.'],
          ['healthy', 'Store identity', 'Store identity is valid.'],
          [
            'healthy',
            'Planning root',
            'Optional specs and changes directories are not required in 1.6.',
          ],
          ['healthy', 'Git checkout', 'Working tree is clean.'],
        ],
      },
    ],
    projects: [
      {
        name: 'lab',
        path: '~/Dev/lab',
        root: 'personal-notes',
        references: ['empty-roadmap'],
      },
    ],
  },
  {
    uri: 'openspecui:environment:7d10be42',
    name: 'Build host / remote',
    host: 'build-04.internal',
    status: 'offline',
    cliVersion: 'Unknown',
    serverVersion: '6.0.0-alpha.1',
    dataHome: 'Unavailable while backend is offline',
    registryPath: 'Unavailable while backend is offline',
    stores: [],
    projects: [],
  },
]

const state = {
  variant: readVariant(),
  envUri: environments[0].uri,
  selectedStoreId: environments[0].stores[0].id,
  search: '',
  operation: null,
  activity: [
    { time: '10:42', text: 'Doctor completed for design-system' },
    { time: '09:18', text: 'platform-context registered from canonical checkout' },
    { time: 'Yesterday', text: 'team-plans root selected by checkout-web' },
  ],
}

const app = document.querySelector('#app')
const dialog = document.querySelector('#operation-dialog')
const operationForm = document.querySelector('#operation-form')
const operationFields = document.querySelector('#operation-fields')
const operationTitle = document.querySelector('#operation-title')
const operationSubmit = document.querySelector('#operation-submit')
const variantLabel = document.querySelector('#variant-label')
const toast = document.querySelector('#toast')
let toastTimer = null

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function readVariant() {
  const key = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  return variants.some((variant) => variant.key === key) ? key : 'A'
}

function getEnvironment() {
  return environments.find((environment) => environment.uri === state.envUri) ?? environments[0]
}

function getSelectedStore() {
  const environment = getEnvironment()
  return (
    environment.stores.find((store) => store.id === state.selectedStoreId) ??
    environment.stores[0] ??
    null
  )
}

function healthStatus(health, label) {
  return `<span class="status ${escapeHtml(health)}">${escapeHtml(label)}</span>`
}

function tag(text, tone = 'muted-tag') {
  return `<span class="tag ${tone}">${escapeHtml(text)}</span>`
}

function environmentOptions() {
  return environments
    .map(
      (environment) =>
        `<option value="${escapeHtml(environment.uri)}" ${
          environment.uri === state.envUri ? 'selected' : ''
        }>${escapeHtml(environment.name)} · ${escapeHtml(environment.status)}</option>`
    )
    .join('')
}

function appChrome(content, variantName) {
  const environment = getEnvironment()
  return `
    <div class="prototype-banner">
      THROWAWAY PROTOTYPE · All Store mutations are simulated in memory · Variant ${escapeHtml(
        state.variant
      )}: ${escapeHtml(variantName)}
    </div>
    <div class="app-shell">
      <aside class="app-sidebar">
        <div class="brand">
          <span class="brand-mark">OS</span>
          <span class="brand-label">OpenSpec UI</span>
        </div>
        <nav class="side-nav" aria-label="App navigation">
          <button type="button"><span class="nav-icon">▣</span><span class="nav-label">Projects</span></button>
          <button type="button"><span class="nav-icon">◎</span><span class="nav-label">Environments</span></button>
          <button type="button" aria-current="page"><span class="nav-icon">◇</span><span class="nav-label">Stores</span></button>
          <button type="button"><span class="nav-icon">⚙</span><span class="nav-label">App Settings</span></button>
        </nav>
        <div class="sidebar-meta">App mode · experimental<br />Shell 6.0.0-alpha.2</div>
      </aside>
      <main class="app-main">
        <header class="app-topbar">
          <div class="topbar-title">
            <strong>Store Manager</strong>
            <span>Environment-scoped CLI operations</span>
          </div>
          <div class="topbar-actions">
            <select class="environment-select" data-environment aria-label="OpenSpec runtime environment">
              ${environmentOptions()}
            </select>
            <button class="icon-button" type="button" data-theme-toggle aria-label="Toggle theme" title="Toggle theme">◐</button>
          </div>
        </header>
        ${content}
      </main>
    </div>
  `
}

function environmentStrip(environment) {
  return `
    <section class="environment-strip" aria-label="Runtime environment">
      <div class="environment-field">
        <span class="field-label">Runtime environment</span>
        <span class="field-value">${escapeHtml(environment.name)} · ${escapeHtml(environment.host)}</span>
      </div>
      <div class="environment-field">
        <span class="field-label">Connection / CLI</span>
        <span class="field-value">${healthStatus(
          environment.status === 'online' ? 'healthy' : 'offline',
          environment.status
        )} &nbsp; CLI ${escapeHtml(environment.cliVersion)}</span>
      </div>
      <div class="environment-field">
        <span class="field-label">OpenSpec data home</span>
        <span class="field-value" title="${escapeHtml(environment.dataHome)}">${escapeHtml(
          environment.dataHome
        )}</span>
      </div>
      <div class="environment-field">
        <span class="field-label">Environment URI</span>
        <span class="field-value">${escapeHtml(environment.uri)}</span>
      </div>
    </section>
  `
}

function operationButtons(storeId = null, compact = false) {
  const environment = getEnvironment()
  const disabled = environment.status !== 'online' ? 'disabled' : ''
  const small = compact ? 'small-action' : ''
  if (storeId) {
    return `
      <div class="row-actions">
        <button class="button secondary-button ${small}" type="button" data-action="doctor" data-store-id="${escapeHtml(
          storeId
        )}" ${disabled}>Doctor</button>
        <button class="button secondary-button ${small}" type="button" data-action="unregister" data-store-id="${escapeHtml(
          storeId
        )}" ${disabled}>Unregister</button>
        <button class="button danger-button ${small}" type="button" data-action="remove" data-store-id="${escapeHtml(
          storeId
        )}" ${disabled}>Remove</button>
      </div>
    `
  }
  return `
    <div class="action-row">
      <button class="button primary-button" type="button" data-action="setup" ${disabled}>＋ Setup Store</button>
      <button class="button secondary-button" type="button" data-action="register" ${disabled}>＋ Register checkout</button>
      <button class="button secondary-button" type="button" data-action="doctor" ${disabled}>↻ Doctor all</button>
    </div>
  `
}

function renderEmptyEnvironment(environment) {
  const message =
    environment.status === 'offline'
      ? 'Reconnect a project backend in this runtime environment before reading or mutating its Store registry.'
      : 'Create a standalone planning Store or register an existing healthy checkout in this environment.'
  return `
    <section class="empty-state">
      <div>
        <h2>${environment.status === 'offline' ? 'Environment unavailable' : 'No Stores registered'}</h2>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `
}

function renderChecks(store) {
  return store.checks
    .map(
      ([tone, title, detail]) => `
        <li class="check-row">
          <div class="check-copy">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(detail)}</span>
          </div>
          ${healthStatus(tone, tone === 'healthy' ? 'Pass' : tone === 'warning' ? 'Review' : 'Fail')}
        </li>
      `
    )
    .join('')
}

function renderRelationships(store) {
  const roots = store.rootFor.length
    ? store.rootFor.map((name) => tag(`Root · ${name}`, 'info')).join(' ')
    : tag('Not selected as a root')
  const references = store.referencedBy.length
    ? store.referencedBy.map((name) => tag(`Reference · ${name}`, 'info')).join(' ')
    : tag('No connected References')
  return `
    <ul class="relationship-list">
      <li class="relationship-row">
        <div class="relationship-copy"><strong>Writable planning root</strong><span>Projects currently resolving through this Store.</span></div>
        <div>${roots}</div>
      </li>
      <li class="relationship-row">
        <div class="relationship-copy"><strong>Read-only Reference</strong><span>Connected project contexts consuming specs.</span></div>
        <div>${references}</div>
      </li>
      <li class="relationship-row">
        <div class="relationship-copy"><strong>Git ownership</strong><span>Sharing remains an explicit Git workflow.</span></div>
        <div>${tag(store.git, store.git.includes('clean') ? 'healthy' : 'warning')}</div>
      </li>
    </ul>
  `
}

function renderVariantA() {
  const environment = getEnvironment()
  const selected = getSelectedStore()
  const warningCount = environment.stores.filter((store) => store.health !== 'healthy').length
  const references = environment.stores.reduce(
    (total, store) => total + store.referencedBy.length,
    0
  )
  const rows = environment.stores
    .map(
      (store) => `
        <tr data-select-store="${escapeHtml(store.id)}" data-selected="${store.id === selected?.id}">
          <td><span class="store-id">${escapeHtml(store.id)}</span><span class="path" title="${escapeHtml(
            store.root
          )}">${escapeHtml(store.root)}</span></td>
          <td>${healthStatus(store.health, store.healthLabel)}</td>
          <td>${escapeHtml(store.metadata)}</td>
          <td><span class="path" title="${escapeHtml(store.remote)}">${escapeHtml(store.remote)}</span></td>
          <td>${store.rootFor.length || 0} root · ${store.referencedBy.length || 0} ref</td>
          <td>${operationButtons(store.id, true)}</td>
        </tr>
      `
    )
    .join('')

  const content = `
    <section class="page">
      <header class="page-heading">
        <div>
          <div class="prototype-kicker">Variant A · Inventory first</div>
          <h1>Registered Stores</h1>
          <p>Scan the complete environment registry, then inspect health and project impact without leaving the table.</p>
        </div>
        ${operationButtons()}
      </header>
      ${environmentStrip(environment)}
      <div class="summary-line">
        <div class="summary-item"><strong>${environment.stores.length}</strong> registered</div>
        <div class="summary-item"><strong>${warningCount}</strong> need attention</div>
        <div class="summary-item"><strong>${environment.projects.length}</strong> connected projects</div>
        <div class="summary-item"><strong>${references}</strong> Reference links</div>
      </div>
      ${
        environment.stores.length
          ? `<div class="table-shell">
              <table class="registry-table">
                <thead><tr><th>Store / checkout</th><th>Health</th><th>Identity</th><th>Git remote</th><th>Context impact</th><th>Operations</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <div class="detail-band">
              <section class="detail-section">
                <div class="section-header"><h2>${escapeHtml(selected.id)} · Doctor</h2>${healthStatus(
                  selected.health,
                  selected.healthLabel
                )}</div>
                <ul class="check-list">${renderChecks(selected)}</ul>
              </section>
              <section class="detail-section">
                <div class="section-header"><h2>Project context impact</h2></div>
                ${renderRelationships(selected)}
              </section>
            </div>`
          : renderEmptyEnvironment(environment)
      }
    </section>
  `
  return appChrome(content, 'Registry table')
}

function renderVariantB() {
  const environment = getEnvironment()
  const selected = getSelectedStore()
  const normalizedSearch = state.search.trim().toLowerCase()
  const visibleStores = environment.stores.filter(
    (store) =>
      !normalizedSearch ||
      store.id.toLowerCase().includes(normalizedSearch) ||
      store.root.toLowerCase().includes(normalizedSearch)
  )

  const storeList = visibleStores
    .map(
      (store) => `
        <li>
          <button type="button" data-select-store="${escapeHtml(store.id)}" aria-current="${
            store.id === selected?.id
          }">
            <span><strong>${escapeHtml(store.id)}</strong><span class="store-list-path">${escapeHtml(
              store.root
            )}</span></span>
            ${healthStatus(store.health, store.health === 'healthy' ? 'OK' : 'Issue')}
          </button>
        </li>
      `
    )
    .join('')

  const inspector = selected
    ? `
      <article class="inspector">
        <header class="inspector-header">
          <div>
            <div class="prototype-kicker">Selected Store</div>
            <h1>${escapeHtml(selected.id)}</h1>
            <p class="path" title="${escapeHtml(selected.root)}">${escapeHtml(selected.root)}</p>
          </div>
          ${operationButtons(selected.id)}
        </header>
        <div class="inspector-grid">
          <section class="inspector-section">
            <div class="section-header"><h2>Identity and location</h2>${healthStatus(
              selected.health,
              selected.healthLabel
            )}</div>
            <dl class="definition-grid">
              <dt>Store id</dt><dd>${escapeHtml(selected.id)}</dd>
              <dt>Checkout root</dt><dd>${escapeHtml(selected.root)}</dd>
              <dt>Metadata</dt><dd>${escapeHtml(selected.metadata)}</dd>
              <dt>Git remote</dt><dd>${escapeHtml(selected.remote)}</dd>
              <dt>Git status</dt><dd>${escapeHtml(selected.git)}</dd>
              <dt>Registry</dt><dd>${escapeHtml(environment.registryPath)}</dd>
            </dl>
          </section>
          <section class="inspector-section">
            <div class="section-header"><h2>Context relationships</h2></div>
            ${renderRelationships(selected)}
          </section>
          <section class="inspector-section">
            <div class="section-header"><h2>Doctor checks</h2><button class="button small-action" type="button" data-action="doctor" data-store-id="${escapeHtml(
              selected.id
            )}">Run again</button></div>
            <ul class="check-list">${renderChecks(selected)}</ul>
          </section>
          <section class="inspector-section">
            <div class="section-header"><h2>Operation boundaries</h2></div>
            <ul class="operation-list">
              <li class="operation-row"><span>Unregister</span><span class="muted-tag">Forget registry entry; keep files</span></li>
              <li class="operation-row"><span>Remove</span><span class="error">Delete Store files</span></li>
              <li class="operation-row"><span>Git synchronization</span><span class="muted-tag">Manual, outside OpenSpecUI</span></li>
              <li class="operation-row"><span>Data scope</span><span class="muted-tag">Inherited; read-only</span></li>
            </ul>
          </section>
        </div>
      </article>
    `
    : renderEmptyEnvironment(environment)

  const content = `
    <section class="page">
      <header class="page-heading">
        <div>
          <div class="prototype-kicker">Variant B · Selection first</div>
          <h1>Store Inspector</h1>
          <p>Select one Store and keep identity, context impact, diagnostics, and destructive boundaries in a stable inspector.</p>
        </div>
        ${operationButtons()}
      </header>
      ${environmentStrip(environment)}
      <div class="inspector-layout">
        <aside class="store-index">
          <div class="store-index-header">
            <strong>${environment.stores.length} Stores</strong>
            <input class="text-input search-input" type="search" value="${escapeHtml(
              state.search
            )}" placeholder="Filter id or path" aria-label="Filter stores" data-store-search />
          </div>
          <ul class="store-list">${storeList}</ul>
        </aside>
        ${inspector}
      </div>
    </section>
  `
  return appChrome(content, 'Store inspector')
}

function matrixCell(project, store) {
  if (project.root === store.id) return '<span class="matrix-cell matrix-root">Root</span>'
  if (project.references.includes(store.id)) {
    return `<span class="matrix-cell matrix-reference">Reference</span>`
  }
  return '<span class="matrix-cell matrix-none">—</span>'
}

function renderVariantC() {
  const environment = getEnvironment()
  const matrixHeader = environment.stores
    .map(
      (store) =>
        `<th>${escapeHtml(store.id)}<br />${healthStatus(
          store.health,
          store.health === 'healthy' ? 'OK' : 'Issue'
        )}</th>`
    )
    .join('')
  const matrixRows = environment.projects
    .map(
      (project) => `
        <tr>
          <td class="matrix-project"><strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(
            project.path
          )}</span></td>
          ${environment.stores.map((store) => `<td>${matrixCell(project, store)}</td>`).join('')}
        </tr>
      `
    )
    .join('')
  const registryLines = environment.stores
    .map(
      (store) => `
        <div class="registry-line">
          <div><span class="store-id">${escapeHtml(store.id)}</span><br />${healthStatus(
            store.health,
            store.healthLabel
          )}</div>
          <div><span class="path" title="${escapeHtml(store.root)}">${escapeHtml(
            store.root
          )}</span><span class="path" title="${escapeHtml(store.remote)}">${escapeHtml(
            store.remote
          )}</span></div>
          ${operationButtons(store.id, true)}
        </div>
      `
    )
    .join('')
  const activity = state.activity
    .map(
      (item) => `
        <li class="activity-row"><span>${escapeHtml(item.text)}</span><span class="activity-time">${escapeHtml(
          item.time
        )}</span></li>
      `
    )
    .join('')

  const content = `
    <section class="page">
      <header class="page-heading">
        <div>
          <div class="prototype-kicker">Variant C · Relationships first</div>
          <h1>Context Matrix</h1>
          <p>Understand which projects write to or reference each Store before changing the environment registry.</p>
        </div>
        ${operationButtons()}
      </header>
      ${environmentStrip(environment)}
      ${
        environment.stores.length
          ? `<div class="matrix-legend">
              ${tag('Root = writable planning root', 'info')}
              ${tag('Reference = read-only specs', 'info')}
              ${tag('Registry changes affect this environment only')}
            </div>
            <div class="matrix-shell">
              <table class="context-matrix">
                <thead><tr><th>Connected project</th>${matrixHeader}</tr></thead>
                <tbody>${matrixRows}</tbody>
              </table>
            </div>
            <div class="matrix-below">
              <section class="registry-lines">
                <div class="section-header"><h2>Registry inventory</h2><span class="muted-tag">${escapeHtml(
                  environment.registryPath
                )}</span></div>
                ${registryLines}
              </section>
              <aside class="operations-panel">
                <div class="section-header"><h2>Recent environment activity</h2></div>
                <ul class="activity-list">${activity}</ul>
                <div class="command-preview">OpenSpecUI calls the selected environment backend. The backend calls the OpenSpec CLI. The prototype never edits registry.yaml directly.</div>
              </aside>
            </div>`
          : renderEmptyEnvironment(environment)
      }
    </section>
  `
  return appChrome(content, 'Context matrix')
}

function render() {
  const renderer =
    state.variant === 'B' ? renderVariantB : state.variant === 'C' ? renderVariantC : renderVariantA
  app.innerHTML = renderer()
  const variant = variants.find((item) => item.key === state.variant) ?? variants[0]
  variantLabel.textContent = `${variant.key} - ${variant.name}`
  bindRenderedEvents()
}

function bindRenderedEvents() {
  document.querySelector('[data-environment]')?.addEventListener('change', (event) => {
    state.envUri = event.target.value
    state.selectedStoreId = getEnvironment().stores[0]?.id ?? null
    state.search = ''
    render()
  })

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const root = document.documentElement
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
  })

  document.querySelectorAll('[data-select-store]').forEach((element) => {
    element.addEventListener('click', (event) => {
      if (event.target.closest('[data-action]')) return
      state.selectedStoreId = element.dataset.selectStore
      render()
    })
  })

  document.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.stopPropagation()
      openOperation(element.dataset.action, element.dataset.storeId ?? null)
    })
  })

  document.querySelector('[data-store-search]')?.addEventListener('input', (event) => {
    state.search = event.target.value
    render()
    const input = document.querySelector('[data-store-search]')
    input?.focus()
    input?.setSelectionRange(state.search.length, state.search.length)
  })
}

function field(name, label, value, hint = '', required = true) {
  return `
    <div class="form-field">
      <label for="field-${escapeHtml(name)}">${escapeHtml(label)}</label>
      <input class="text-input" id="field-${escapeHtml(name)}" name="${escapeHtml(
        name
      )}" value="${escapeHtml(value)}" ${required ? 'required' : ''} />
      ${hint ? `<small>${escapeHtml(hint)}</small>` : ''}
    </div>
  `
}

function openOperation(action, storeId) {
  const environment = getEnvironment()
  if (environment.status !== 'online') {
    showToast('Reconnect this runtime environment before running Store operations.')
    return
  }
  const store = environment.stores.find((candidate) => candidate.id === storeId) ?? null
  state.operation = { action, storeId }

  if (action === 'setup') {
    operationTitle.textContent = 'Setup a new Store'
    operationFields.innerHTML = `
      ${field('id', 'Store id', 'mobile-experience', 'Committed to .openspec-store/store.yaml.')}
      ${field('path', 'Standalone checkout path', '/Users/gaubee/Planning/mobile-experience', 'Store setup rejects paths nested inside an existing Git repository.')}
      ${field('remote', 'Git remote', 'git@github.com:jixoai-labs/mobile-experience.git', 'Optional. Git synchronization remains manual.', false)}
      <div class="command-preview">openspec store setup &lt;id&gt; --path &lt;path&gt; --json</div>
    `
    operationSubmit.textContent = 'Run setup'
  } else if (action === 'register') {
    operationTitle.textContent = 'Register an existing checkout'
    operationFields.innerHTML = `
      ${field('path', 'Existing checkout path', '/Users/gaubee/Dev/GitHub/jixoai-labs/platform-guides', 'The CLI validates Store identity and planning-root health.')}
      ${field('id', 'Store id override', 'platform-guides', 'Optional when committed metadata already contains an id.', false)}
      <div class="command-preview">openspec store register &lt;path&gt; --id &lt;id&gt; --json</div>
    `
    operationSubmit.textContent = 'Run register'
  } else if (action === 'doctor') {
    operationTitle.textContent = store ? `Doctor ${store.id}` : 'Doctor all Stores'
    operationFields.innerHTML = `
      <div class="command-preview">openspec store doctor ${store ? escapeHtml(store.id) : ''} --json</div>
      <p>Checks registry entries, checkout paths, Store identity, planning-root shape, and Reference relationships through the selected environment.</p>
      ${store ? `<ul class="check-list">${renderChecks(store)}</ul>` : ''}
    `
    operationSubmit.textContent = 'Run doctor'
  } else if (action === 'unregister') {
    operationTitle.textContent = `Unregister ${store.id}`
    operationFields.innerHTML = `
      <p>Forget this environment's registry entry while keeping the checkout and every file on disk.</p>
      <div class="command-preview">openspec store unregister ${escapeHtml(store.id)} --json</div>
      <div class="warning-copy">Connected projects that name this Store will report an unknown Store until it is registered again.</div>
    `
    operationSubmit.textContent = 'Unregister only'
  } else if (action === 'remove') {
    operationTitle.textContent = `Remove ${store.id}`
    operationFields.innerHTML = `
      <div class="warning-copy">This is destructive. OpenSpec removes the Store checkout files, not only the registry entry.</div>
      ${field('confirm', `Type ${store.id} to confirm`, '', 'Use Unregister when the files must remain.')}
      <div class="command-preview">openspec store remove ${escapeHtml(store.id)} --yes --json</div>
    `
    operationSubmit.textContent = 'Delete Store files'
  }
  dialog.showModal()
}

function closeOperation() {
  dialog.close()
  state.operation = null
}

function submitOperation(event) {
  event.preventDefault()
  if (!state.operation) return
  const environment = getEnvironment()
  const data = new FormData(operationForm)
  const { action, storeId } = state.operation

  if (action === 'remove' && data.get('confirm') !== storeId) {
    showToast(`Type ${storeId} exactly to confirm the simulated removal.`)
    return
  }

  if (action === 'setup' || action === 'register') {
    const id = String(data.get('id') || 'registered-store')
    const path = String(data.get('path') || '/path/to/store')
    environment.stores.unshift({
      id,
      root: path,
      remote: String(data.get('remote') || 'Not configured'),
      health: 'healthy',
      healthLabel: action === 'setup' ? 'New Store' : 'Registered',
      metadata: `v1 / ${id}`,
      git: 'main · clean',
      rootFor: [],
      referencedBy: [],
      checks: [
        ['healthy', 'Registry entry', 'Canonical checkout path is registered.'],
        ['healthy', 'Store identity', `Store metadata id matches ${id}.`],
        ['healthy', 'Planning root', 'OpenSpec planning root is healthy.'],
        ['healthy', 'Git checkout', 'Sharing remains an explicit Git operation.'],
      ],
    })
    state.selectedStoreId = id
    state.activity.unshift({
      time: 'Now',
      text: `${id} ${action === 'setup' ? 'created' : 'registered'}`,
    })
    showToast(`${id}: simulated ${action} completed in ${environment.name}.`)
  } else if (action === 'doctor') {
    const label = storeId ?? 'all Stores'
    state.activity.unshift({ time: 'Now', text: `Doctor completed for ${label}` })
    showToast(`Doctor completed for ${label}; no filesystem access occurred.`)
  } else if (action === 'unregister' || action === 'remove') {
    const index = environment.stores.findIndex((store) => store.id === storeId)
    if (index >= 0) environment.stores.splice(index, 1)
    state.selectedStoreId = environment.stores[0]?.id ?? null
    state.activity.unshift({
      time: 'Now',
      text: `${storeId} ${action === 'remove' ? 'removed' : 'unregistered'}`,
    })
    showToast(
      action === 'remove'
        ? `${storeId}: simulated files removed. Reload to reset.`
        : `${storeId}: simulated registry entry removed; files preserved.`
    )
  }

  closeOperation()
  render()
}

function showToast(message) {
  toast.textContent = message
  toast.dataset.visible = 'true'
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.dataset.visible = 'false'
  }, 3600)
}

function changeVariant(direction) {
  const index = variants.findIndex((variant) => variant.key === state.variant)
  const nextIndex = (index + direction + variants.length) % variants.length
  state.variant = variants[nextIndex].key
  const url = new URL(window.location.href)
  url.searchParams.set('variant', state.variant)
  window.history.replaceState({}, '', url)
  render()
}

document.querySelectorAll('[data-variant-direction]').forEach((button) => {
  button.addEventListener('click', () => changeVariant(Number(button.dataset.variantDirection)))
})

document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', closeOperation)
})

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeOperation()
})

operationForm.addEventListener('submit', submitOperation)

window.addEventListener('keydown', (event) => {
  if (dialog.open) return
  const target = event.target
  if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable]'))
    return
  if (event.key === 'ArrowLeft') changeVariant(-1)
  if (event.key === 'ArrowRight') changeVariant(1)
})

window.addEventListener('popstate', () => {
  state.variant = readVariant()
  render()
})

render()
