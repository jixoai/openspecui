import {
  CheckCircle2,
  FileCode2,
  FileText,
  FolderTree,
  GitBranch,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Tabs } from './components/tabs'
import { TerminalTabs } from './components/terminal/terminal-tabs'
import { ThemeBootstrap } from './components/theme-bootstrap'
import './index.css'
import { resolveTerminalTheme } from './lib/terminal-theme'

const labStyles = String.raw`
  body {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at top, color-mix(in srgb, var(--primary) 16%, transparent), transparent 32%),
      linear-gradient(180deg, color-mix(in srgb, var(--background) 94%, black 6%), var(--background));
    color: var(--foreground);
  }

  .tabs-lab-page {
    min-height: 100vh;
    padding: 32px;
    display: grid;
    gap: 24px;
  }

  .tabs-lab-hero {
    display: grid;
    gap: 8px;
    max-width: 980px;
  }

  .tabs-lab-eyebrow {
    font: 600 12px/1.2 'JetBrains Mono', monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground) 52%, transparent);
  }

  .tabs-lab-title {
    margin: 0;
    font-size: clamp(2rem, 3vw, 3rem);
    line-height: 1;
  }

  .tabs-lab-copy {
    margin: 0;
    max-width: 76ch;
    color: color-mix(in srgb, var(--foreground) 72%, transparent);
  }

  .tabs-lab-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: 20px;
  }

  .lab-card {
    min-width: 0;
    min-height: 420px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    background: color-mix(in srgb, var(--card) 90%, transparent);
    box-shadow: 0 24px 80px color-mix(in srgb, black 12%, transparent);
    backdrop-filter: blur(18px);
  }

  .lab-card-head {
    display: grid;
    gap: 6px;
  }

  .lab-card-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1rem;
    font-weight: 600;
  }

  .lab-card-note {
    margin: 0;
    font-size: 0.92rem;
    color: color-mix(in srgb, currentColor 70%, transparent);
  }

  .lab-preview {
    min-width: 0;
    min-height: 0;
    flex: 1;
    display: flex;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
    background: linear-gradient(180deg, color-mix(in srgb, var(--card) 94%, white 6%), color-mix(in srgb, var(--background) 96%, black 4%));
  }

  .lab-canvas {
    min-width: 0;
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }

  .lab-canvas--terminal {
    background: var(--terminal);
    color: var(--terminal-foreground);
  }

  .scenario-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .scenario-header-block {
    min-width: 0;
    display: grid;
    gap: 6px;
  }

  .scenario-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.35rem;
    font-weight: 700;
  }

  .scenario-subtitle {
    color: color-mix(in srgb, var(--foreground) 68%, transparent);
    font-size: 0.94rem;
  }

  .scenario-command-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .scenario-command-bar--terminal .lab-pill {
    border-color: color-mix(in srgb, var(--terminal-foreground) 18%, transparent);
    background: color-mix(in srgb, var(--terminal-foreground) 8%, transparent);
    color: var(--terminal-foreground);
  }

  .lab-pill {
    height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    background: color-mix(in srgb, var(--background) 82%, transparent);
    padding-inline: 12px;
    font-size: 0.86rem;
    color: inherit;
  }

  .lab-pill--primary {
    border-color: color-mix(in srgb, var(--primary) 24%, transparent);
    background: color-mix(in srgb, var(--primary) 12%, transparent);
  }

  .lab-tab-body {
    min-height: 0;
    flex: 1;
    display: grid;
    gap: 14px;
    padding: 18px 18px 22px;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--background) 88%, transparent), color-mix(in srgb, var(--card) 96%, transparent));
  }

  .lab-tab-body--terminal {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--terminal) 96%, white 4%),
      color-mix(in srgb, var(--terminal) 100%, black 0%)
    );
    color: var(--terminal-foreground);
  }

  .lab-tab-kicker {
    font: 600 11px/1.2 'JetBrains Mono', monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: color-mix(in srgb, currentColor 58%, transparent);
  }

  .lab-tab-title {
    margin: 0;
    font-size: 1.08rem;
    font-weight: 600;
  }

  .lab-tab-copy {
    margin: 0;
    font-size: 0.94rem;
    line-height: 1.55;
    color: color-mix(in srgb, currentColor 72%, transparent);
  }

  .lab-tab-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .lab-chip {
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
    background: color-mix(in srgb, var(--muted) 70%, transparent);
    padding: 0.36rem 0.7rem;
    font-size: 0.76rem;
    color: color-mix(in srgb, var(--foreground) 76%, transparent);
  }

  .lab-action-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .lab-action-row--terminal .lab-tool-button {
    border-color: color-mix(in srgb, var(--terminal-foreground) 14%, transparent);
    background: color-mix(in srgb, var(--terminal-foreground) 8%, transparent);
    color: var(--terminal-foreground);
  }

  .lab-tool-button {
    height: 30px;
    width: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    background: color-mix(in srgb, var(--background) 78%, transparent);
    color: inherit;
  }

  @media (max-width: 760px) {
    .tabs-lab-page {
      padding: 20px;
    }
  }
`

type ScenarioTab = {
  id: string
  label: string
  icon: ReactNode
  title: string
  copy: string
  chips: string[]
}

type LabTab = {
  id: string
  label: ReactNode
  icon?: ReactNode
  content: ReactNode
}

const changeScenarioTabs: ScenarioTab[] = [
  {
    id: 'proposal',
    label: 'proposal.md',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    title: 'Proposal Draft',
    copy: 'The change detail page wants the header to retreat and the content to dominate. This lets you judge whether the indicator feels calm or intrusive.',
    chips: ['Artifacts', 'Reader-first', 'Low chrome'],
  },
  {
    id: 'design',
    label: 'design.md',
    icon: <Sparkles className="h-4 w-4 text-sky-500" />,
    title: 'Design Notes',
    copy: 'Longer labels, icon rhythm, and content continuity matter here. The active tab must be obvious without becoming another card surface.',
    chips: ['Long-form', 'Spec review', 'Quiet active'],
  },
  {
    id: 'folder',
    label: 'Folder',
    icon: <FolderTree className="h-4 w-4" />,
    title: 'Change Folder',
    copy: 'Folder view is the utility stress case. The active signal still needs to hold together when one tab is much more tool-like than the others.',
    chips: ['Mixed mode', 'Browser + text', 'Utility tab'],
  },
]

const configScenarioTabs: ScenarioTab[] = [
  {
    id: 'project',
    label: 'Project Config',
    icon: <FileText className="h-4 w-4" />,
    title: 'Project Config',
    copy: 'Config wants denser spacing and better scanability. Tabs should feel like a navigation rail rather than like decorative cards.',
    chips: ['Dense', 'Operational', 'Frequent switching'],
  },
  {
    id: 'global',
    label: 'Global Config',
    icon: <SlidersHorizontal className="h-4 w-4" />,
    title: 'Global Config',
    copy: 'This page often has more tabs and longer labels. The active state should stay readable without increasing the header height too much.',
    chips: ['High tab count', 'Compact', 'Clear active'],
  },
  {
    id: 'schema-spec-driven',
    label: 'schema:spec-driven',
    icon: <FileCode2 className="h-4 w-4" />,
    title: 'Schema Details',
    copy: 'This is the long-label case. The underline treatment needs to hold up when labels become obviously developer-facing and verbose.',
    chips: ['Long labels', 'Horizontal overflow', 'Utility-first'],
  },
]

function buildTabs(prefix: string, tabs: ScenarioTab[]): LabTab[] {
  return tabs.map((item) => ({
    id: `${prefix}-${item.id}`,
    label: item.label,
    icon: item.icon,
    content: (
      <div className="lab-tab-body">
        <div className="lab-tab-kicker">{item.label}</div>
        <h3 className="lab-tab-title">{item.title}</h3>
        <p className="lab-tab-copy">{item.copy}</p>
        <div className="lab-tab-chips">
          {item.chips.map((chip) => (
            <span key={chip} className="lab-chip">
              {chip}
            </span>
          ))}
        </div>
      </div>
    ),
  }))
}

function ActionRow() {
  return (
    <div className="lab-action-row">
      <button type="button" className="lab-tool-button" aria-label="Search">
        <Search className="h-4 w-4" />
      </button>
      <button type="button" className="lab-tool-button" aria-label="Add tab">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

function TerminalActionRow() {
  return (
    <div className="lab-action-row lab-action-row--terminal">
      <button type="button" className="lab-tool-button" aria-label="Search">
        <Search className="h-4 w-4" />
      </button>
      <button type="button" className="lab-tool-button" aria-label="Add tab">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

function DemoCard(props: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="lab-card">
      <header className="lab-card-head">
        <div className="lab-card-title">{props.title}</div>
        <p className="lab-card-note">{props.note}</p>
      </header>
      <div className="lab-preview">{props.children}</div>
    </section>
  )
}

function buildTerminalThemeStyle() {
  const theme = resolveTerminalTheme({
    appDarkMode: true,
    systemDarkMode: true,
    useTheme: 'dark',
    darkTheme: 'default-dark',
    lightTheme: 'default-light',
  })

  return {
    '--terminal': theme.definition.palette.background,
    '--terminal-foreground': theme.definition.palette.foreground,
  } as CSSProperties
}

function DefaultTabsShowcase(props: { scenario: 'change' | 'config' }) {
  const scenarioTabs = props.scenario === 'change' ? changeScenarioTabs : configScenarioTabs
  const tabs = useMemo(
    () => buildTabs(`final-default-${props.scenario}`, scenarioTabs),
    [props.scenario, scenarioTabs]
  )
  const [selectedTab, setSelectedTab] = useState(tabs[0]?.id ?? '')

  return (
    <div className="lab-canvas">
      <header className="scenario-header">
        <div className="scenario-header-block">
          <div className="scenario-title">
            {props.scenario === 'change' ? (
              <GitBranch className="h-5 w-5" />
            ) : (
              <SlidersHorizontal className="h-5 w-5" />
            )}
            <span>{props.scenario === 'change' ? 'Change Detail' : 'Config'}</span>
          </div>
          <div className="scenario-subtitle">
            Default Tabs final surface. Shared component, built on the Scheme 3 dedicated-rail
            structure.
          </div>
        </div>
        {props.scenario === 'change' ? (
          <div className="scenario-command-bar">
            <button type="button" className="lab-pill">
              Refresh
            </button>
            <button type="button" className="lab-pill">
              Verify
            </button>
            <button type="button" className="lab-pill lab-pill--primary">
              Compose
            </button>
          </div>
        ) : null}
      </header>
      <Tabs
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        actions={<ActionRow />}
        className="min-h-0 flex-1"
      />
    </div>
  )
}

function FinalTerminalTabsShowcase() {
  const terminalThemeStyle = useMemo(() => buildTerminalThemeStyle(), [])
  const tabs = useMemo(
    () =>
      buildTabs('final-terminal', changeScenarioTabs).map((tab) => ({
        ...tab,
        content: <div className="lab-tab-body lab-tab-body--terminal">{tab.content}</div>,
      })),
    []
  )
  const [selectedTab, setSelectedTab] = useState(tabs[0]?.id ?? '')

  return (
    <div className="lab-canvas lab-canvas--terminal" style={terminalThemeStyle}>
      <header className="scenario-header">
        <div className="scenario-header-block">
          <div className="scenario-title">
            <Sparkles className="h-5 w-5" />
            <span>Final TerminalTabs</span>
          </div>
          <div className="scenario-subtitle">
            Independent motion language kept separate from default Tabs
          </div>
        </div>
        <div className="scenario-command-bar scenario-command-bar--terminal">
          <button type="button" className="lab-pill">
            Split
          </button>
          <button type="button" className="lab-pill">
            Theme
          </button>
        </div>
      </header>
      <TerminalTabs
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        actions={<TerminalActionRow />}
        className="min-h-0 flex-1"
      />
    </div>
  )
}

function TabsLabApp() {
  return (
    <>
      <ThemeBootstrap />
      <style>{labStyles}</style>
      <main className="tabs-lab-page">
        <section className="tabs-lab-hero">
          <div className="tabs-lab-eyebrow">Tabs Lab / Final Acceptance</div>
          <h1 className="tabs-lab-title">Final Tabs and TerminalTabs</h1>
          <p className="tabs-lab-copy">
            Scheme 3 won as the structural law for the shared default Tabs. The cards below show the
            final shipped surfaces: default Tabs in change detail and config, plus the independent
            TerminalTabs variant.
          </p>
        </section>

        <section className="tabs-lab-grid">
          <DemoCard
            title="Final / Default Tabs / Change Detail"
            note="The product-facing shared Tabs surface for the change detail page."
          >
            <DefaultTabsShowcase scenario="change" />
          </DemoCard>

          <DemoCard
            title="Final / Default Tabs / Config"
            note="The same shared Tabs component under the denser config page workload."
          >
            <DefaultTabsShowcase scenario="config" />
          </DemoCard>

          <DemoCard
            title="Final / TerminalTabs"
            note="Terminal-specific chrome remains isolated from the default Tabs language."
          >
            <FinalTerminalTabsShowcase />
          </DemoCard>
        </section>
      </main>
    </>
  )
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Tabs lab root element not found')
}

createRoot(root).render(<TabsLabApp />)
