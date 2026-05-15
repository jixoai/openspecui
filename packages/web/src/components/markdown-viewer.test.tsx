import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownViewer } from './markdown-viewer'
import { Toc } from './toc'

describe('MarkdownViewer ToC behavior', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
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
    expect(styles).toContain('.toc-narrow')
    expect(styles).toContain('max-height: min(20rem')
    expect(styles).toContain('.toc-narrow-scroll')
    expect(styles).toContain('max-height: min(18rem')
    expect(styles).toContain('.toc-wide')
    expect(styles).toContain('max-height: min(calc(100cqh - 3rem), calc(100svh - 3rem))')
    expect(styles).not.toContain('.toc-wide {\n    display: none;\n    max-height: min(32rem')
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
})
