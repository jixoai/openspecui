import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MarkdownViewer,
  resolveMarkdownRenderProcessors,
  type MarkdownRenderProcessor,
} from './markdown-viewer'
import { Toc } from './toc'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

describe('MarkdownViewer ToC behavior', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
  })

  it('keeps ToC href and heading id aligned for duplicate nested headings', () => {
    render(
      <div className="viewer-scroll">
        <MarkdownViewer
          markdown={({ H1, Section }) => (
            <div>
              <H1 id="root">Root</H1>
              <Section>
                <MarkdownViewer markdown={'## Context'} />
              </Section>
              <Section>
                <MarkdownViewer markdown={'## Context'} />
              </Section>
            </div>
          )}
        />
      </div>
    )

    const contextLinks = screen.getAllByRole('link', { name: 'Context', hidden: true })
    expect(contextLinks.length).toBeGreaterThan(1)

    for (const link of contextLinks) {
      const href = link.getAttribute('href')
      expect(href).toBeTruthy()
      const headingId = href!.replace(/^#/, '')
      expect(document.getElementById(headingId)).toBeTruthy()
    }
  })

  it('binds section headings to section timelines instead of heading timelines', () => {
    render(
      <MarkdownViewer
        markdown={({ H1, Section }) => (
          <Section>
            <H1 id="overview">Overview</H1>
            <p>Details</p>
          </Section>
        )}
      />
    )

    const heading = screen.getByRole('heading', { name: 'Overview' })
    expect((heading as HTMLElement).style.getPropertyValue('view-timeline-name')).toBe('')

    const section = heading.closest('section')
    expect(section).toBeTruthy()
    expect((section as HTMLElement).style.getPropertyValue('view-timeline-name')).toBe('--toc-0')

    const tocLink = screen.getByRole('link', { name: 'Overview', hidden: true })
    expect(tocLink.getAttribute('href')).toBe('#overview')
  })

  it('does not include embedded markdown headings when collectToc is false', () => {
    const scrollToSpy = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollToSpy,
    })

    render(
      <div className="viewer-scroll">
        <MarkdownViewer
          markdown={({ H1, Section }) => (
            <div>
              <H1 id="root">Root</H1>
              <Section>
                <MarkdownViewer markdown={'## Hidden Heading'} collectToc={false} />
              </Section>
            </div>
          )}
        />
      </div>
    )

    expect(screen.queryByRole('link', { name: 'Hidden Heading', hidden: true })).toBeNull()

    const rootLink = screen.getAllByRole('link', { name: 'Root', hidden: true })[0]
    fireEvent.click(rootLink)
    expect(window.location.hash).toBe('#root')
    expect(scrollToSpy).toHaveBeenCalled()
  })

  it('keeps ToC scrolling inside responsive panels instead of the sticky root', () => {
    render(
      <Toc
        defaultCollapsed={false}
        items={[
          { id: 'root', label: 'Root', level: 1 },
          { id: 'child', label: 'Child', level: 2 },
        ]}
      />
    )

    const root = document.querySelector('.toc-root')
    expect(root).toBeTruthy()
    expect(root?.className).not.toContain('overflow-y-auto')
    expect(root?.className).not.toContain('top-0')
    expect(root?.classList.contains('h-10')).toBe(false)
    expect(root?.classList.contains('min-h-10')).toBe(true)

    const narrowScroll = document.querySelector('.toc-narrow-scroll')
    expect(narrowScroll).toBeTruthy()
    expect(narrowScroll?.className).toContain('overflow-y-auto')

    const wideScroll = document.querySelector('.toc-wide-scroll')
    expect(wideScroll).toBeTruthy()
    expect(wideScroll?.className).toContain('overflow-y-auto')
  })

  it('lets only the wide ToC use the available vertical space', () => {
    render(
      <Toc
        defaultCollapsed={false}
        items={[
          { id: 'root', label: 'Root', level: 1 },
          { id: 'child', label: 'Child', level: 2 },
        ]}
      />
    )

    const styles = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('\n')
    expect(styles).toContain('.toc-page-layout > .toc-page-content')
    expect(styles).toContain('padding-top: var(--toc-narrow-gap, 1rem)')
    expect(styles).toContain('top: var(--toc-sticky-top, 1rem)')
    expect(styles).toContain(
      '--toc-anchor-scroll-margin-top: calc(var(--toc-sticky-top, 1rem) + 3rem)'
    )
    expect(styles).toContain('scroll-margin-top: var(--toc-anchor-scroll-margin-top)')
    expect(styles).toContain('.toc-narrow')
    expect(styles).toContain('max-height: min(20rem')
    expect(styles).toContain('.toc-narrow-scroll')
    expect(styles).toContain('max-height: min(18rem')
    expect(styles).toContain('.toc-wide')
    expect(styles).toContain('max-height: min(calc(100cqh - 3rem), calc(100svh - 3rem))')
    expect(styles).toContain('padding-top: 0;')
    expect(styles).not.toContain('.toc-wide {\n    display: none;\n    max-height: min(32rem')
  })

  it('marks ToC anchor targets with shared scroll-margin hooks', () => {
    render(<MarkdownViewer markdown={'# Overview\n\n## Details'} />)

    expect(screen.getByRole('heading', { name: 'Overview' }).className).toContain(
      'toc-anchor-target'
    )
    expect(screen.getByRole('heading', { name: 'Details' }).className).toContain(
      'toc-anchor-target'
    )
  })

  it('collapses the narrow ToC when interaction leaves the component', () => {
    render(
      <div>
        <button type="button">Outside</button>
        <Toc
          defaultCollapsed={false}
          items={[
            { id: 'root', label: 'Root', level: 1 },
            { id: 'child', label: 'Child', level: 2 },
          ]}
        />
      </div>
    )

    expect(screen.getByRole('button', { name: 'Hide table of contents' })).toBeTruthy()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))

    expect(screen.getByRole('button', { name: 'Show table of contents' })).toBeTruthy()
  })

  it('collapses the narrow ToC on focus leave and Escape', () => {
    render(
      <div>
        <button type="button">Outside</button>
        <Toc
          items={[
            { id: 'root', label: 'Root', level: 1 },
            { id: 'child', label: 'Child', level: 2 },
          ]}
        />
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show table of contents' }))
    expect(screen.getByRole('button', { name: 'Hide table of contents' })).toBeTruthy()

    const toc = document.querySelector('aside.toc-root')
    const outside = screen.getByRole('button', { name: 'Outside' })
    expect(toc).toBeInstanceOf(HTMLElement)
    if (!(toc instanceof HTMLElement)) throw new Error('ToC root missing')

    fireEvent.blur(toc, { relatedTarget: outside })
    expect(screen.getByRole('button', { name: 'Show table of contents' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show table of contents' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Hide table of contents' }), {
      key: 'Escape',
    })
    expect(screen.getByRole('button', { name: 'Show table of contents' })).toBeTruthy()
  })

  it('collapses the narrow ToC after a link navigation', () => {
    const scrollIntoViewSpy = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewSpy,
    })

    render(
      <div>
        <h2 id="root">Root target</h2>
        <Toc
          defaultCollapsed={false}
          items={[
            { id: 'root', label: 'Root', level: 1 },
            { id: 'child', label: 'Child', level: 2 },
          ]}
        />
      </div>
    )

    expect(screen.getByRole('button', { name: 'Hide table of contents' })).toBeTruthy()

    fireEvent.click(screen.getAllByRole('link', { name: 'Root', hidden: true })[0])

    expect(scrollIntoViewSpy).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Show table of contents' })).toBeTruthy()
  })

  it('uses the shared fluid ToC page layout contract', () => {
    render(<MarkdownViewer markdown={'# Overview'} />)

    const layout = document.querySelector('.toc-page-layout')
    expect(layout).toBeTruthy()
    expect(layout?.className).toContain('viewer-layout')

    const content = document.querySelector('.toc-page-content')
    expect(content).toBeTruthy()
    expect(content?.className).toContain('viewer-content')

    const sidebar = document.querySelector('.toc-page-sidebar')
    expect(sidebar).toBeTruthy()
    expect(sidebar?.className).toContain('viewer-toc')
  })

  it('keeps ToC generic by collecting projected data-toc-label from heading processors', () => {
    render(
      <MarkdownViewer
        markdown={'# Source title'}
        processors={[
          {
            name: 'translation',
            order: 10,
            transformHeading() {
              return {
                tocDataLabel: 'Translated title',
                children: 'Translated title',
              }
            },
          },
        ]}
      />
    )

    const heading = screen.getByRole('heading', { name: 'Translated title' })
    expect(heading.getAttribute('data-toc-label')).toBe('Translated title')
    expect(screen.getByRole('link', { name: 'Translated title', hidden: true })).toBeTruthy()
  })

  it('registers nested MarkdownViewer header actions on the root ToC', () => {
    render(
      <MarkdownViewer
        markdown={({ H1, Section }) => (
          <Section>
            <H1>Spec Artifact</H1>
            <MarkdownViewer
              markdown={'# Delta\n\n### Requirement: Sign in'}
              path="specs/auth/spec.md"
              translationConfig={{
                enabled: false,
                targetLanguage: 'zh',
                displayMode: 'direct',
                cacheEnabled: false,
              }}
            />
          </Section>
        )}
      />
    )

    expect(document.querySelectorAll('aside.toc-root')).toHaveLength(1)
    expect(document.querySelectorAll('.viewer-scroll')).toHaveLength(1)
    const toc = document.querySelector('aside.toc-root')
    expect(toc).toBeTruthy()
    expect(
      within(toc as HTMLElement).getByRole('button', { name: 'Configure translation' })
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in', hidden: true })).toBeTruthy()
  })

  it('dedupes nested MarkdownViewer header actions by semantic slot', () => {
    render(
      <MarkdownViewer
        markdown={({ H1, Section }) => (
          <div>
            <H1>Combined Artifact</H1>
            <Section>
              <MarkdownViewer
                markdown={'# First file'}
                path="specs/auth/spec.md"
                translationConfig={{
                  enabled: false,
                  targetLanguage: 'zh',
                  displayMode: 'direct',
                  cacheEnabled: false,
                }}
              />
            </Section>
            <Section>
              <MarkdownViewer
                markdown={'# Second file'}
                path="specs/billing/spec.md"
                translationConfig={{
                  enabled: false,
                  targetLanguage: 'zh',
                  displayMode: 'direct',
                  cacheEnabled: false,
                }}
              />
            </Section>
          </div>
        )}
      />
    )

    const toc = document.querySelector('aside.toc-root')
    expect(toc).toBeTruthy()
    expect(
      within(toc as HTMLElement).getAllByRole('button', { name: 'Configure translation' })
    ).toHaveLength(1)
  })

  it('keeps distinct nested MarkdownViewer header actions when they have no shared slot', () => {
    render(
      <MarkdownViewer
        markdown={({ Section }) => (
          <Section>
            <MarkdownViewer
              markdown={'# First'}
              tocHeaderAction={<button type="button">First action</button>}
              tocHeaderActionKey="first"
            />
            <MarkdownViewer
              markdown={'# Second'}
              tocHeaderAction={<button type="button">Second action</button>}
              tocHeaderActionKey="second"
            />
          </Section>
        )}
      />
    )

    const toc = document.querySelector('aside.toc-root')
    expect(toc).toBeTruthy()
    expect(
      within(toc as HTMLElement).getAllByRole('button', { name: 'First action', hidden: true })
    ).toHaveLength(2)
    expect(
      within(toc as HTMLElement).getAllByRole('button', { name: 'Second action', hidden: true })
    ).toHaveLength(2)
  })

  it('refreshes nested MarkdownViewer header actions when the action node changes', () => {
    function TestDocument({ label }: { label?: string }) {
      return (
        <MarkdownViewer
          markdown={({ Section }) => (
            <Section>
              <MarkdownViewer
                markdown={'# Nested'}
                tocHeaderAction={label ? <button type="button">{label}</button> : undefined}
                tocHeaderActionKey={label}
              />
            </Section>
          )}
        />
      )
    }

    const { rerender } = render(<TestDocument label="First action" />)
    const toc = document.querySelector('aside.toc-root') as HTMLElement
    expect(within(toc).getAllByRole('button', { name: 'First action', hidden: true })).toHaveLength(
      2
    )

    rerender(<TestDocument label="Second action" />)
    expect(within(toc).queryByRole('button', { name: 'First action', hidden: true })).toBeNull()
    expect(
      within(toc).getAllByRole('button', { name: 'Second action', hidden: true })
    ).toHaveLength(2)

    rerender(<TestDocument />)
    expect(within(toc).queryByRole('button', { name: 'Second action', hidden: true })).toBeNull()
  })

  it('orders and replaces render processors by name', () => {
    const processors: MarkdownRenderProcessor[] = [
      { name: 'b', order: 1 },
      { name: 'a', order: 2 },
      { name: 'b', order: 0 },
    ]

    expect(resolveMarkdownRenderProcessors(undefined, processors).map((item) => item.name)).toEqual(
      ['b', 'a']
    )
  })
})
