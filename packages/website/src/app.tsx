import {
  ArrowUpRight,
  BookOpenText,
  FileOutput,
  Github,
  PanelsTopLeft,
  TerminalSquare,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher, type WebsiteLanguage } from './components/language-switcher'
import { SectionCard } from './components/section-card'

const APP_URL = 'https://app.openspecui.com'
const OPENSPEC_URL = 'https://openspec.dev'
const GITHUB_URL = 'https://github.com/jixoai/openspecui'
const RUNNER_STORAGE_KEY = 'openspecui-website:runner'
const SUPPORTING_COPY_CLASS_NAME =
  'text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6'
const META_COPY_CLASS_NAME = 'text-muted-foreground/80 text-[11px] leading-5 sm:text-[12px]'
const TACTILE_CLASS_NAME =
  'transition-[transform,background-color,color,opacity] duration-150 active:translate-y-px active:scale-[0.99]'

type RunnerId = 'npm' | 'pnpm' | 'bun'

function getInitialRunner(): RunnerId {
  if (typeof window === 'undefined') return 'npm'
  const stored = window.localStorage.getItem(RUNNER_STORAGE_KEY)
  return stored === 'pnpm' || stored === 'bun' || stored === 'npm' ? stored : 'npm'
}

function getRunnerCommandPrefix(runner: RunnerId): string {
  switch (runner) {
    case 'pnpm':
      return 'pnpx'
    case 'bun':
      return 'bunx'
    default:
      return 'npx'
  }
}

function ExternalLink(props: {
  href: string
  title: string
  body: string
  icon: ComponentType<{ className?: string }>
}) {
  const Icon = props.icon
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer"
      className={`group flex items-start justify-between gap-4 px-4 py-3.5 ${TACTILE_CLASS_NAME} hover:bg-muted/30`}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="text-primary h-4 w-4 shrink-0" />
          <span className="font-nav text-[16px] tracking-tight">{props.title}</span>
        </div>
        <p className={SUPPORTING_COPY_CLASS_NAME}>{props.body}</p>
      </div>
      <ArrowUpRight className="text-muted-foreground group-hover:text-foreground mt-0.5 h-4 w-4 shrink-0 transition-colors" />
    </a>
  )
}

export function App() {
  const { t, i18n } = useTranslation()
  const [runner, setRunner] = useState<RunnerId>(() => getInitialRunner())
  const [appModeEnabled, setAppModeEnabled] = useState(true)
  const copyrightYear = new Date().getFullYear()
  const language: WebsiteLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith(
    'zh'
  )
    ? 'zh'
    : 'en'

  useEffect(() => {
    document.title = t('meta.siteTitle')
  }, [t])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(RUNNER_STORAGE_KEY, runner)
  }, [runner])

  const runnerCommandPrefix = useMemo(() => getRunnerCommandPrefix(runner), [runner])
  const hostedAppCommand = `${runnerCommandPrefix} openspecui@latest --app`
  const runCommand = `${runnerCommandPrefix} openspecui@latest${appModeEnabled ? ' --app' : ''}`
  const RunCommandIcon = appModeEnabled ? PanelsTopLeft : TerminalSquare
  const currentRunSummary = appModeEnabled
    ? t('commands.appOnSummary')
    : t('commands.appOffSummary')

  const modeCards = [
    {
      title: t('modes.liveTitle'),
      body: t('modes.liveBody'),
    },
    {
      title: t('modes.hostedTitle'),
      body: t('modes.hostedBody'),
    },
    {
      title: t('modes.exportTitle'),
      body: t('modes.exportBody'),
    },
  ]

  const modesCard = (
    <SectionCard title={t('modes.title')} summary={t('modes.summary')}>
      <div className="border-border divide-border divide-y border">
        {modeCards.map((item, index) => (
          <article key={item.title} className="grid gap-3 p-4 sm:grid-cols-[3rem_minmax(0,1fr)]">
            <div className="font-nav text-primary/85 text-[11px] uppercase tracking-[0.24em]">
              {`0${index + 1}`}
            </div>
            <div className="space-y-1.5">
              <h3 className="font-nav text-[16px] tracking-tight">{item.title}</h3>
              <p className={`${SUPPORTING_COPY_CLASS_NAME} text-pretty`}>{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  )

  const linksCard = (
    <SectionCard title={t('links.title')} summary={t('links.summary')}>
      <div className="border-border divide-border divide-y border">
        <ExternalLink
          href={APP_URL}
          title={t('links.appTitle')}
          body={t('links.appBody')}
          icon={PanelsTopLeft}
        />
        <ExternalLink
          href={OPENSPEC_URL}
          title={t('links.openspecTitle')}
          body={t('links.openspecBody')}
          icon={BookOpenText}
        />
        <ExternalLink
          href={GITHUB_URL}
          title={t('links.githubTitle')}
          body={t('links.githubBody')}
          icon={Github}
        />
      </div>
    </SectionCard>
  )

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border bg-terminal text-terminal-foreground border-b">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">
              {t('meta.siteTitle')}
            </p>
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <h1 className="font-nav truncate text-sm tracking-tight sm:text-base">
                www.openspecui.com
              </h1>
              <p className="text-terminal-foreground/70 truncate text-xs">
                {t('meta.siteSubtitle')}
              </p>
            </div>
          </div>
          <LanguageSwitcher
            label={t('meta.languageLabel')}
            value={language}
            onChange={(nextLanguage) => {
              void i18n.changeLanguage(nextLanguage)
            }}
          />
        </div>
      </header>

      <main className="mx-auto flex max-w-[90rem] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard
            eyebrow={t('hero.eyebrow')}
            title={t('hero.title')}
            summary={t('hero.summary')}
            tone="hero"
            className="relative overflow-hidden"
            contentClassName="sm:pb-6 sm:pr-6"
          >
            <div className="pointer-events-none absolute right-0 top-0 hidden h-48 w-48 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-primary),transparent_76%),transparent_70%)] lg:block" />
            <div className="relative grid gap-5 lg:grid-cols-[minmax(16rem,0.72fr)_minmax(21rem,1.08fr)] lg:items-start xl:grid-cols-[minmax(17rem,0.66fr)_minmax(24rem,1.14fr)]">
              <div className="max-w-[32rem] space-y-4 lg:pr-0">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="border-border bg-background inline-flex items-center border px-2.5 py-1 font-medium">
                    {t('hero.badges.live')}
                  </span>
                  <span className="bg-primary text-primary-foreground inline-flex items-center px-2.5 py-1 font-medium">
                    {t('hero.badges.hosted')}
                  </span>
                  <span className="bg-muted text-muted-foreground inline-flex items-center px-2.5 py-1 font-medium">
                    {t('hero.badges.static')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <a
                    href={APP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={`bg-primary text-primary-foreground hover:opacity-92 inline-flex items-center gap-2 px-3 py-2 font-medium ${TACTILE_CLASS_NAME}`}
                  >
                    {t('hero.primaryCta')}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={`border-border bg-background hover:bg-muted inline-flex items-center gap-2 border px-3 py-2 font-medium ${TACTILE_CLASS_NAME}`}
                  >
                    {t('hero.secondaryCta')}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <aside className="border-border bg-background/70 p-4.5 space-y-4 border lg:mt-1">
                <div>
                  <p className="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">
                    Default path
                  </p>
                  <h3 className="font-nav mt-2 text-balance text-[17px] tracking-tight">
                    Hosted app first
                  </h3>
                </div>
                <p className={`${SUPPORTING_COPY_CLASS_NAME} max-w-none`}>
                  Start the local backend, then reuse the maintained frontend instead of serving
                  another local web bundle.
                </p>
                <code className="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent block overflow-x-auto px-3 py-2 text-sm">
                  {hostedAppCommand}
                </code>
                <p className={`${META_COPY_CLASS_NAME} text-pretty`}>
                  {t('commands.compatibility')}
                </p>
              </aside>
            </div>
          </SectionCard>

          {modesCard}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <SectionCard title={t('commands.title')} summary={t('commands.summary')}>
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                <div className="border-border flex items-center justify-between gap-3 border px-3 py-3">
                  <label htmlFor="website-runner-select" className={META_COPY_CLASS_NAME}>
                    {t('commands.runnerLabel')}
                  </label>
                  <select
                    id="website-runner-select"
                    value={runner}
                    onChange={(event) => {
                      setRunner(event.target.value as RunnerId)
                    }}
                    className="border-border bg-background min-w-28 border px-2 py-1 text-sm"
                  >
                    <option value="npm">npm / npx</option>
                    <option value="pnpm">pnpm / pnpx</option>
                    <option value="bun">bun / bunx</option>
                  </select>
                </div>
                <button
                  type="button"
                  aria-pressed={appModeEnabled}
                  aria-label={t('commands.appToggleLabel')}
                  onClick={() => {
                    setAppModeEnabled((current) => !current)
                  }}
                  className={`border-border hover:bg-muted/30 border px-3 py-3 text-left ${TACTILE_CLASS_NAME}`}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-nav min-w-0 text-[16px] tracking-tight">
                        {t('commands.appToggleLabel')}
                      </p>
                      <span
                        className={[
                          'inline-flex shrink-0 items-center px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em]',
                          appModeEnabled
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        ].join(' ')}
                      >
                        {appModeEnabled
                          ? t('commands.appToggleEnabled')
                          : t('commands.appToggleDisabled')}
                      </span>
                    </div>
                    <p className={`${SUPPORTING_COPY_CLASS_NAME} text-pretty`}>
                      {t('commands.appToggleSummary')}
                    </p>
                  </div>
                </button>
              </div>
              <div className="border-border divide-border divide-y border">
                <div className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                  <div className="bg-muted flex h-10 w-10 items-center justify-center">
                    <RunCommandIcon className="text-primary h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-2.5">
                    <div className="space-y-1.5">
                      <h3 className="font-nav text-[16px] tracking-tight">
                        {t('commands.runLabel')}
                      </h3>
                      <p className={`${SUPPORTING_COPY_CLASS_NAME} sm:min-h-[3rem]`}>
                        {currentRunSummary}
                      </p>
                    </div>
                    <code className="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent block overflow-x-auto px-3 py-2 text-sm">
                      {runCommand}
                    </code>
                  </div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                  <div className="bg-muted flex h-10 w-10 items-center justify-center">
                    <FileOutput className="text-primary h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-2.5">
                    <div className="space-y-1.5">
                      <h3 className="font-nav text-[16px] tracking-tight">
                        {t('commands.exportLabel')}
                      </h3>
                      <p className={`${SUPPORTING_COPY_CLASS_NAME} text-pretty`}>
                        {t('commands.exportSummary')}
                      </p>
                    </div>
                    <code className="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent block overflow-x-auto px-3 py-2 text-sm">
                      {`${runnerCommandPrefix} openspecui@latest export -o ./dist`}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {linksCard}
        </section>
      </main>

      <footer className="border-border border-t px-4 py-4 sm:px-6 lg:px-8">
        <div className={`${META_COPY_CLASS_NAME} mx-auto max-w-7xl`}>
          <p>{`Copyright © ${copyrightYear} OpenSpecUI`}</p>
        </div>
      </footer>
    </div>
  )
}
