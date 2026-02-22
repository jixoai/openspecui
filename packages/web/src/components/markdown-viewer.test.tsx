import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownViewer } from './markdown-viewer'

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
})
