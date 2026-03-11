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
      className="border-border hover:bg-muted/40 group flex items-start justify-between gap-3 border p-3 transition-colors"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="text-primary h-4 w-4 shrink-0" />
          <span className="font-nav text-sm">{props.title}</span>
        </div>
        <p className="text-muted-foreground text-sm leading-6">{props.body}</p>
      </div>
      <ArrowUpRight className="text-muted-foreground group-hover:text-foreground mt-0.5 h-4 w-4 shrink-0 transition-colors" />
    </a>
  )
}

export function App() {
  const { t, i18n } = useTranslation()
  const [runner, setRunner] = useState<RunnerId>(() => getInitialRunner())
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

  const commandCards = [
    {
      title: t('commands.liveLabel'),
      description: t('commands.liveSummary'),
      command: `${runnerCommandPrefix} openspecui@latest`,
      icon: TerminalSquare,
    },
    {
      title: t('commands.hostedLabel'),
      description: t('commands.hostedSummary'),
      command: `${runnerCommandPrefix} openspecui@latest --app`,
      icon: PanelsTopLeft,
    },
    {
      title: t('commands.exportLabel'),
      description: t('commands.exportSummary'),
      command: `${runnerCommandPrefix} openspecui@latest export -o ./dist`,
      icon: FileOutput,
    },
  ]

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

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border bg-terminal text-terminal-foreground border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">
              {t('meta.siteTitle')}
            </p>
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <h1 className="font-nav truncate text-sm sm:text-base">www.openspecui.com</h1>
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

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(21rem,0.7fr)]">
          <SectionCard
            eyebrow={t('hero.eyebrow')}
            title={t('hero.title')}
            summary={t('hero.summary')}
            className="relative overflow-hidden"
          >
            <div className="absolute inset-y-0 right-0 hidden w-48 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-primary),transparent_60%),transparent_70%)] lg:block" />
            <div className="relative flex flex-col gap-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-primary text-primary-foreground px-2 py-1 font-medium">
                  {t('hero.badges.live')}
                </span>
                <span className="bg-secondary text-secondary-foreground px-2 py-1 font-medium">
                  {t('hero.badges.hosted')}
                </span>
                <span className="bg-accent text-accent-foreground px-2 py-1 font-medium">
                  {t('hero.badges.static')}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href={APP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-primary text-primary-foreground inline-flex items-center gap-2 px-3 py-2 font-medium transition-opacity hover:opacity-90"
                >
                  {t('hero.primaryCta')}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border bg-background hover:bg-muted inline-flex items-center gap-2 border px-3 py-2 font-medium transition-colors"
                >
                  {t('hero.secondaryCta')}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('links.title')} summary={t('links.summary')}>
            <div className="space-y-3">
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
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <SectionCard title={t('commands.title')} summary={t('commands.summary')}>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 border px-3 py-2">
                <label htmlFor="website-runner-select" className="text-muted-foreground text-sm">
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
              {commandCards.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.command}
                    className="border-border grid gap-3 border p-3 sm:grid-cols-[auto_minmax(0,1fr)]"
                  >
                    <div className="bg-muted flex h-9 w-9 items-center justify-center">
                      <Icon className="text-primary h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div>
                        <h3 className="font-nav text-sm">{item.title}</h3>
                        <p className="text-muted-foreground text-sm leading-6">
                          {item.description}
                        </p>
                      </div>
                      <code className="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent block overflow-x-auto px-3 py-2 text-sm">
                        {item.command}
                      </code>
                    </div>
                  </div>
                )
              })}
              <p className="text-muted-foreground text-sm">{t('commands.compatibility')}</p>
            </div>
          </SectionCard>

          <SectionCard title={t('modes.title')} summary={t('modes.summary')}>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {modeCards.map((item, index) => (
                <article key={item.title} className="border-border bg-background border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-nav text-primary text-xs">0{index + 1}</span>
                    <h3 className="font-nav text-sm">{item.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">{item.body}</p>
                </article>
              ))}
            </div>
          </SectionCard>
        </section>
      </main>

      <footer className="border-border border-t px-4 py-4 sm:px-6 lg:px-8">
        <div className="text-muted-foreground mx-auto max-w-6xl text-sm leading-6">
          <p>{`Copyright © ${copyrightYear} OpenSpecUI`}</p>
        </div>
      </footer>
    </div>
  )
}
