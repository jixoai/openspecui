import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type {
  EventBus as PdfEventBus,
  PDFFindController as PdfFindControllerInstance,
  PDFLinkService as PdfLinkServiceInstance,
  PDFViewer as PdfViewerInstance,
} from 'pdfjs-dist/web/pdf_viewer.mjs'
import { createRootStyles, getPreviewRootElement, getRequestedFileUrl } from './common'

const { GlobalWorkerOptions, getDocument } = pdfjsLib
GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const DEFAULT_SCALE_VALUE = 'page-width'
const PHYSICAL_SCALE_BASELINE_MM = 100
const POINTS_PER_INCH = 72
const MM_PER_INCH = 25.4
const CSS_PIXELS_PER_INCH = 96
const PHYSICAL_SCALE_RATIO_BY_VALUE = {
  'physical-50': 0.5,
  'physical-75': 0.75,
  'physical-100': 1,
  'physical-125': 1.25,
  'physical-150': 1.5,
  'physical-200': 2,
} as const

type PhysicalScaleOptionValue = keyof typeof PHYSICAL_SCALE_RATIO_BY_VALUE

const SCALE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'page-width', label: 'Page Width' },
  { value: 'page-fit', label: 'Page Fit' },
  { value: 'physical-50', label: '50%' },
  { value: 'physical-75', label: '75%' },
  { value: 'physical-100', label: '100%' },
  { value: 'physical-125', label: '125%' },
  { value: 'physical-150', label: '150%' },
  { value: 'physical-200', label: '200%' },
] as const

type ScaleOptionValue = (typeof SCALE_OPTIONS)[number]['value']

type PdfViewerModule = {
  EventBus: new () => PdfEventBus
  PDFLinkService: new (options: { eventBus: PdfEventBus }) => PdfLinkServiceInstance
  PDFFindController: new (options: {
    eventBus: PdfEventBus
    linkService: PdfLinkServiceInstance
  }) => PdfFindControllerInstance
  PDFViewer: new (options: {
    container: HTMLDivElement
    viewer: HTMLDivElement
    eventBus: PdfEventBus
    linkService: PdfLinkServiceInstance
    findController: PdfFindControllerInstance
    enablePermissions?: boolean
    minDurationToUpdateCanvas?: number
    removePageBorders?: boolean
    supportsPinchToZoom?: boolean
  }) => PdfViewerInstance
}

interface PageChangingEvent {
  pageNumber: number
}

interface ScaleChangingEvent {
  scale: number
  presetValue?: string
}

interface PagesLoadedEvent {
  pagesCount: number
}

let viewerModulePromise: Promise<PdfViewerModule> | null = null

function isPhysicalScaleOptionValue(value: string): value is PhysicalScaleOptionValue {
  return value in PHYSICAL_SCALE_RATIO_BY_VALUE
}

function loadPdfViewerModule(): Promise<PdfViewerModule> {
  const globalScope = globalThis as typeof globalThis & { pdfjsLib?: typeof pdfjsLib }
  globalScope.pdfjsLib ??= pdfjsLib
  viewerModulePromise ??= import('pdfjs-dist/web/pdf_viewer.mjs').then((module) => ({
    EventBus: module.EventBus,
    PDFLinkService: module.PDFLinkService,
    PDFFindController: module.PDFFindController,
    PDFViewer: module.PDFViewer,
  }))
  return viewerModulePromise
}

function clampPageNumber(value: number, pageCount: number): number {
  if (pageCount <= 0) return 1
  return Math.min(pageCount, Math.max(1, value))
}

function formatScalePercentage(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function measureCssPixelsPerMillimeter(): number {
  if (typeof document === 'undefined') {
    return CSS_PIXELS_PER_INCH / MM_PER_INCH
  }

  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.left = '-9999px'
  probe.style.top = '0'
  probe.style.width = `${PHYSICAL_SCALE_BASELINE_MM}mm`
  probe.style.height = '1px'
  probe.style.pointerEvents = 'none'
  probe.style.visibility = 'hidden'
  document.body.append(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  if (width <= 0) {
    return CSS_PIXELS_PER_INCH / MM_PER_INCH
  }
  return width / PHYSICAL_SCALE_BASELINE_MM
}

function resolveRotatedPageSizeInPoints(pdfPage: PDFPageProxy): { widthPoints: number; heightPoints: number } {
  const [left, top, right, bottom] = pdfPage.view
  const widthPoints = Math.abs(right - left)
  const heightPoints = Math.abs(bottom - top)
  const rotation = ((pdfPage.rotate % 360) + 360) % 360

  if (rotation === 90 || rotation === 270) {
    return {
      widthPoints: heightPoints,
      heightPoints: widthPoints,
    }
  }

  return {
    widthPoints,
    heightPoints,
  }
}

function resolvePhysicalScaleBase(pdfPage: PDFPageProxy): number {
  const pixelsPerMillimeter = measureCssPixelsPerMillimeter()
  const { widthPoints } = resolveRotatedPageSizeInPoints(pdfPage)
  const widthMillimeters = (widthPoints / POINTS_PER_INCH) * MM_PER_INCH
  const desiredCssWidth = widthMillimeters * pixelsPerMillimeter
  const cssWidthAtPdfScaleOne = (widthPoints / POINTS_PER_INCH) * CSS_PIXELS_PER_INCH

  if (desiredCssWidth <= 0 || cssWidthAtPdfScaleOne <= 0) {
    return 1
  }

  return desiredCssWidth / cssWidthAtPdfScaleOne
}

function matchPhysicalScaleValue(
  scale: number,
  physicalScaleBase: number | null
): PhysicalScaleOptionValue | null {
  if (physicalScaleBase == null) return null

  for (const [value, ratio] of Object.entries(
    PHYSICAL_SCALE_RATIO_BY_VALUE
  ) as Array<[PhysicalScaleOptionValue, number]>) {
    const expectedScale = physicalScaleBase * ratio
    const tolerance = Math.max(0.005, expectedScale * 0.015)
    if (Math.abs(scale - expectedScale) <= tolerance) {
      return value
    }
  }

  return null
}

function formatScaleLabel(
  scale: number,
  presetValue: string | undefined,
  physicalScaleBase: number | null
): string {
  if (!presetValue || isPhysicalScaleOptionValue(presetValue)) {
    const matchedValue = matchPhysicalScaleValue(scale, physicalScaleBase)
    if (matchedValue) {
      return formatScalePercentage(PHYSICAL_SCALE_RATIO_BY_VALUE[matchedValue])
    }
  }

  return `${Math.round(scale * 100)}%`
}

function normalizeScaleValue(
  scale: number,
  presetValue: string | undefined,
  physicalScaleBase: number | null
): ScaleOptionValue {
  if (presetValue && SCALE_OPTIONS.some((option) => option.value === presetValue)) {
    return presetValue as ScaleOptionValue
  }

  return matchPhysicalScaleValue(scale, physicalScaleBase) ?? 'auto'
}

function resolveAppliedScaleValue(
  nextValue: ScaleOptionValue,
  physicalScaleBase: number | null
): string | number {
  if (isPhysicalScaleOptionValue(nextValue)) {
    return (physicalScaleBase ?? 1) * PHYSICAL_SCALE_RATIO_BY_VALUE[nextValue]
  }

  return nextValue
}

function getRequestedFileName(fileUrl: string): string {
  try {
    return decodeURIComponent(fileUrl.split('/').pop() ?? 'preview.pdf')
  } catch {
    return fileUrl.split('/').pop() ?? 'preview.pdf'
  }
}

function createToolbarButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: '1px solid var(--preview-border)',
    borderRadius: '0px',
    background: disabled ? 'var(--preview-button-disabled)' : 'var(--preview-panel-secondary)',
    color: disabled ? 'var(--preview-muted-foreground)' : 'var(--preview-foreground)',
    padding: '8px 12px',
    font: '600 13px var(--preview-font-mono)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: disabled ? 'none' : 'var(--preview-shadow-sm)',
  }
}

function App() {
  const fileUrl = getRequestedFileUrl()
  const viewerContainerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const pdfViewerRef = useRef<PdfViewerInstance | null>(null)
  const physicalScaleBaseRef = useRef<number | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [scaleValue, setScaleValue] = useState<ScaleOptionValue>(DEFAULT_SCALE_VALUE)
  const [scaleLabel, setScaleLabel] = useState('100%')
  const [physicalScaleBase, setPhysicalScaleBase] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  useEffect(() => {
    physicalScaleBaseRef.current = physicalScaleBase
  }, [physicalScaleBase])

  useEffect(() => {
    if (!fileUrl) {
      setLoading(false)
      setError('Preview resource missing.')
      setPageCount(0)
      setCurrentPage(1)
      setPageInput('1')
      setPhysicalScaleBase(null)
      return
    }

    let cancelled = false
    let eventBus: PdfEventBus | null = null
    let pdfDocument: PDFDocumentProxy | null = null
    let loadingTask: PDFDocumentLoadingTask | null = null
    let detachListeners: Array<() => void> = []

    setLoading(true)
    setError(null)
    setPageCount(0)
    setCurrentPage(1)
    setPageInput('1')
    setScaleValue(DEFAULT_SCALE_VALUE)
    setScaleLabel('100%')
    setPhysicalScaleBase(null)

    void loadPdfViewerModule()
      .then(async ({ EventBus, PDFLinkService, PDFFindController, PDFViewer }) => {
        if (cancelled) return

        const viewerContainer = viewerContainerRef.current
        const viewer = viewerRef.current
        if (!viewerContainer || !viewer) {
          return
        }

        viewer.replaceChildren()

        eventBus = new EventBus()
        const linkService = new PDFLinkService({ eventBus })
        const findController = new PDFFindController({ eventBus, linkService })
        const pdfViewer = new PDFViewer({
          container: viewerContainer,
          viewer,
          eventBus,
          linkService,
          findController,
          enablePermissions: true,
          minDurationToUpdateCanvas: 0,
          removePageBorders: false,
          supportsPinchToZoom: true,
        })

        pdfViewerRef.current = pdfViewer
        linkService.setViewer(pdfViewer)

        const handlePageChanging = ({ pageNumber }: PageChangingEvent) => {
          if (!cancelled) {
            setCurrentPage(pageNumber)
          }
        }
        const handleScaleChanging = ({ scale, presetValue }: ScaleChangingEvent) => {
          if (!cancelled) {
            const nextPhysicalScaleBase = physicalScaleBaseRef.current
            setScaleLabel(formatScaleLabel(scale, presetValue, nextPhysicalScaleBase))
            setScaleValue(normalizeScaleValue(scale, presetValue, nextPhysicalScaleBase))
          }
        }
        const handlePagesInit = () => {
          if (cancelled) return
          pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE
          setLoading(false)
        }
        const handlePagesLoaded = ({ pagesCount: nextPageCount }: PagesLoadedEvent) => {
          if (!cancelled) {
            setPageCount(nextPageCount)
          }
        }

        eventBus.on('pagechanging', handlePageChanging)
        eventBus.on('scalechanging', handleScaleChanging)
        eventBus.on('pagesinit', handlePagesInit)
        eventBus.on('pagesloaded', handlePagesLoaded)
        detachListeners = [
          () => eventBus?.off('pagechanging', handlePageChanging),
          () => eventBus?.off('scalechanging', handleScaleChanging),
          () => eventBus?.off('pagesinit', handlePagesInit),
          () => eventBus?.off('pagesloaded', handlePagesLoaded),
        ]

        loadingTask = getDocument({
          enableXfa: true,
          url: fileUrl,
        })
        pdfDocument = await loadingTask.promise
        if (cancelled) return

        const firstPage = await pdfDocument.getPage(1)
        if (cancelled) return
        const nextPhysicalScaleBase = resolvePhysicalScaleBase(firstPage)
        physicalScaleBaseRef.current = nextPhysicalScaleBase
        setPhysicalScaleBase(nextPhysicalScaleBase)

        setPageCount(pdfDocument.numPages)
        linkService.setDocument(pdfDocument)
        findController.setDocument(pdfDocument)
        pdfViewer.setDocument(pdfDocument)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setLoading(false)
        setError(cause instanceof Error ? cause.message : String(cause))
      })

    return () => {
      cancelled = true
      detachListeners.forEach((detach) => detach())
      detachListeners = []
      pdfViewerRef.current?.cleanup()
      pdfViewerRef.current = null
      void loadingTask?.destroy()
      void pdfDocument?.destroy()
    }
  }, [fileUrl])

  const fileName = fileUrl ? getRequestedFileName(fileUrl) : 'preview.pdf'
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < pageCount
  const hasDocument = pageCount > 0 && !error

  const applyPageInput = () => {
    const nextPage = Number.parseInt(pageInput, 10)
    if (!Number.isFinite(nextPage)) {
      setPageInput(String(currentPage))
      return
    }
    pdfViewerRef.current?.scrollPageIntoView({
      pageNumber: clampPageNumber(nextPage, pageCount),
    })
  }

  return (
    <div
      style={{
        ...createRootStyles(),
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--preview-shell-background)',
        color: 'var(--preview-foreground)',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          padding: '12px',
          borderBottom: '1px solid var(--preview-divider)',
          background: 'var(--preview-toolbar-background)',
          backdropFilter: 'blur(12px)',
          boxShadow: 'var(--preview-shadow)',
        }}
      >
        <div
          style={{
            minWidth: '0',
            flex: '1 1 240px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <strong
            style={{
              font: '600 13px var(--preview-font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName}
          </strong>
          <span
            style={{
              color: 'var(--preview-muted-foreground)',
              font: '500 12px var(--preview-font-mono)',
            }}
          >
            {loading ? 'Loading PDF…' : `${pageCount} page${pageCount === 1 ? '' : 's'} · ${scaleLabel}`}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() => {
              pdfViewerRef.current!.currentPageNumber = 1
            }}
            style={createToolbarButtonStyle(!canGoPrevious)}
          >
            First
          </button>
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() => {
              pdfViewerRef.current?.previousPage()
            }}
            style={createToolbarButtonStyle(!canGoPrevious)}
          >
            Prev
          </button>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '0px',
              background: 'transparent',
              padding: '8px 10px',
              font: '600 13px var(--preview-font-mono)',
            }}
          >
            Page
            <input
              value={pageInput}
              disabled={!hasDocument}
              inputMode="numeric"
              pattern="[0-9]*"
              onBlur={applyPageInput}
              onChange={(event) => {
                setPageInput(event.target.value.replace(/[^\d]/g, ''))
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applyPageInput()
                }
              }}
              style={{
                width: '4.5rem',
                border: '1px solid var(--preview-border)',
                borderRadius: '0px',
                padding: '6px 8px',
                font: '600 13px var(--preview-font-mono)',
                background: 'var(--preview-background)',
                color: 'var(--preview-foreground)',
              }}
            />
            <span style={{ color: 'var(--preview-muted-foreground)' }}>/ {Math.max(pageCount, 1)}</span>
          </label>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => {
              pdfViewerRef.current?.nextPage()
            }}
            style={createToolbarButtonStyle(!canGoNext)}
          >
            Next
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => {
              pdfViewerRef.current!.currentPageNumber = pageCount
            }}
            style={createToolbarButtonStyle(!canGoNext)}
          >
            Last
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            disabled={!hasDocument}
            onClick={() => {
              pdfViewerRef.current?.decreaseScale()
            }}
            style={createToolbarButtonStyle(!hasDocument)}
          >
            Zoom Out
          </button>
          <select
            value={scaleValue}
            disabled={!hasDocument}
            onChange={(event) => {
              const nextValue = event.target.value as ScaleOptionValue
              setScaleValue(nextValue)
              if (pdfViewerRef.current) {
                const appliedScaleValue = resolveAppliedScaleValue(nextValue, physicalScaleBase)
                if (typeof appliedScaleValue === 'number') {
                  pdfViewerRef.current.currentScale = appliedScaleValue
                } else {
                  pdfViewerRef.current.currentScaleValue = appliedScaleValue
                }
              }
            }}
            style={{
              border: '1px solid var(--preview-border)',
              borderRadius: '0px',
              background: 'var(--preview-panel-secondary)',
              color: 'var(--preview-foreground)',
              padding: '8px 10px',
              font: '600 13px var(--preview-font-mono)',
              boxShadow: 'var(--preview-shadow-sm)',
            }}
          >
            {SCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!hasDocument}
            onClick={() => {
              pdfViewerRef.current?.increaseScale()
            }}
            style={createToolbarButtonStyle(!hasDocument)}
          >
            Zoom In
          </button>
          <button
            type="button"
            disabled={!fileUrl}
            onClick={() => {
              window.open(fileUrl, '_blank', 'noopener,noreferrer')
            }}
            style={createToolbarButtonStyle(!fileUrl)}
          >
            Open
          </button>
        </div>
      </header>

      {error ? (
        <div
          style={{
            margin: '16px',
            borderRadius: '0px',
            background: 'color-mix(in oklab, red 12%, var(--preview-panel-secondary))',
            color: 'var(--preview-foreground)',
            padding: '16px',
            font: '500 14px var(--preview-font-mono)',
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          ref={viewerContainerRef}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'auto',
            padding: '16px clamp(12px, 2vw, 24px) 24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={viewerRef}
            className="pdfViewer"
            style={{
              minHeight: '100%',
            }}
          />
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(getPreviewRootElement()).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
