/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Provide query input, highlighting, and source-specific Search results.
 * 2. Preserve Search query and source scope in the pop-route URL.
 * 3. Navigate compound Reference results without collapsing Store identity.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { navController } from '@/lib/nav-controller'
import { useSearch } from '@/lib/use-search'
import { vtNavController } from '@/lib/view-transitions/navigation'
import type { ProjectSearchScope } from '@openspecui/search'
import { useLocation } from '@tanstack/react-router'
import { Archive, FileText, GitBranch, Loader2, LockKeyhole, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

const INPUT_DEBOUNCE_MS = 150

function kindIcon(kind: string) {
  if (kind === 'spec') return FileText
  if (kind === 'change') return GitBranch
  if (kind === 'archive') return Archive
  return Archive
}

function readSearchScope(search: string): ProjectSearchScope {
  const params = new URLSearchParams(search)
  return params.get('scope') === 'referenced-specs' ? 'referenced-specs' : 'active-root'
}

function buildPopSearchHref(query: string, scope: ProjectSearchScope): string {
  const trimmed = query.trim()
  const params = new URLSearchParams()
  if (trimmed.length > 0) params.set('query', trimmed)
  if (scope === 'referenced-specs') params.set('scope', scope)
  const encoded = params.toString()
  return encoded.length > 0 ? `/search?${encoded}` : '/search'
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlightedText(text: string, terms: readonly string[]): ReactNode {
  if (!text || terms.length === 0) return text

  const pattern = terms.map((term) => escapeRegExp(term)).join('|')
  if (!pattern) return text

  const matcher = new RegExp(`(${pattern})`, 'gi')
  const parts = text.split(matcher)

  return parts.map((part, index) => {
    const matched = terms.some((term) => term.toLowerCase() === part.toLowerCase())
    if (!matched) return <span key={index}>{part}</span>
    return (
      <mark key={index} className="text-foreground rounded bg-amber-400/35 px-[1px]">
        {part}
      </mark>
    )
  })
}

export function SearchRoute() {
  const location = useLocation()
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const locationQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('query') ?? ''
  }, [location.search])
  const locationScope = useMemo(() => readSearchScope(location.search), [location.search])

  const [inputValue, setInputValue] = useState(locationQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(locationQuery)
  const [scope, setScope] = useState<ProjectSearchScope>(locationScope)

  useEffect(() => {
    setInputValue(locationQuery)
    setDebouncedQuery(locationQuery)
    setScope(locationScope)
  }, [locationQuery, locationScope])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(inputValue), INPUT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [inputValue])

  const { data, isLoading, error } = useSearch(debouncedQuery, scope)
  const highlightTerms = useMemo(() => {
    return inputValue
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => term.toLowerCase())
      .sort((a, b) => b.length - a.length)
  }, [inputValue])

  useEffect(() => {
    setConfig({
      layout: {
        alignY: 'start',
        width: 'wide',
        topGap: 'comfortable',
      },
      panelClassName: 'w-full',
      bodyClassName: 'p-0',
      maxHeight: 'min(88dvh,920px)',
      onDismissRequest: undefined,
    })
  }, [setConfig])

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 p-3 sm:p-4">
      <div
        role="tablist"
        aria-label="Search source"
        className="bg-muted border-border inline-grid min-h-9 w-fit shrink-0 grid-cols-2 rounded-md border p-0.5"
      >
        <ScopeButton
          scope="active-root"
          current={scope}
          label="Active root"
          onSelect={(nextScope) => {
            setScope(nextScope)
            navController.replace('pop', buildPopSearchHref(inputValue, nextScope), location.state)
          }}
        />
        <ScopeButton
          scope="referenced-specs"
          current={scope}
          label="Referenced Specs"
          onSelect={(nextScope) => {
            setScope(nextScope)
            navController.replace('pop', buildPopSearchHref(inputValue, nextScope), location.state)
          }}
        />
      </div>

      <div className="relative shrink-0">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          autoFocus
          value={inputValue}
          onChange={(event) => {
            const next = event.target.value
            setInputValue(next)
            navController.replace('pop', buildPopSearchHref(next, scope), location.state)
          }}
          placeholder={
            scope === 'active-root'
              ? 'Search Owned Specs, Changes, and Archives...'
              : 'Search Referenced Specs...'
          }
          className="border-input bg-background focus:ring-ring w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2"
        />
      </div>

      {isLoading && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-600">
          {error.message}
        </div>
      )}

      {!isLoading && !error && inputValue.trim().length > 0 && data.length === 0 && (
        <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
          {scope === 'active-root'
            ? `No matching results in the active Planning root for “${inputValue.trim()}”.`
            : `No matching Referenced Specs currently observed for “${inputValue.trim()}”.`}
        </div>
      )}

      {!isLoading && !error && data.length > 0 && (
        <ul className="border-border divide-border min-h-0 w-full min-w-0 flex-1 divide-y overflow-y-auto rounded-md border">
          {data.map((hit) => {
            const Icon = kindIcon(hit.kind)
            return (
              <li key={hit.documentId} className="min-w-0">
                <button
                  type="button"
                  className="hover:bg-muted/50 flex w-full min-w-0 flex-col items-start gap-2 p-3 text-left"
                  onClick={() => {
                    const targetArea = navController.getAreaForPath(hit.href)
                    void vtNavController.push(targetArea, hit.href, null)
                    requestClose()
                  }}
                >
                  <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="line-clamp-2 break-words text-sm font-medium">
                        {renderHighlightedText(hit.title, highlightTerms)}
                      </span>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-[11px] uppercase">
                      {hit.scope === 'referenced-specs' ? (
                        <span className="inline-flex items-center gap-1">
                          <LockKeyhole className="h-3 w-3" aria-hidden /> read-only {hit.kind}
                        </span>
                      ) : (
                        hit.kind
                      )}
                    </span>
                  </div>
                  <div className="text-muted-foreground w-full break-all text-xs">
                    {renderHighlightedText(hit.path, highlightTerms)}
                  </div>
                  <div className="text-muted-foreground line-clamp-3 w-full break-words text-xs">
                    {renderHighlightedText(hit.snippet, highlightTerms)}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ScopeButton({
  scope,
  current,
  label,
  onSelect,
}: {
  scope: ProjectSearchScope
  current: ProjectSearchScope
  label: string
  onSelect: (scope: ProjectSearchScope) => void
}) {
  const selected = current === scope
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(scope)}
      className={`min-w-28 rounded px-3 py-1 text-sm font-medium transition-colors ${
        selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
      }`}
    >
      {label}
    </button>
  )
}
