import { describe, expect, it } from 'vitest'
import {
  inferFileMime,
  inferFilePreviewKind,
  isPreviewableFile,
  isTextLikeFile,
} from './file-preview.js'

describe('file preview primitives', () => {
  it('infers common mimes and preview kinds', () => {
    expect(inferFileMime('notes.md')).toBe('text/markdown')
    expect(inferFilePreviewKind('notes.md')).toBe('markdown')
    expect(inferFilePreviewKind('index.html')).toBe('html')
    expect(inferFilePreviewKind('photo.png')).toBe('image')
    expect(inferFilePreviewKind('song.mp3')).toBe('audio')
    expect(inferFilePreviewKind('movie.mp4')).toBe('video')
    expect(inferFilePreviewKind('paper.pdf')).toBe('pdf')
  })

  it('distinguishes text-like files from preview-only binary files', () => {
    expect(isTextLikeFile('schema.yaml')).toBe(true)
    expect(isTextLikeFile('specs/auth/spec.md')).toBe(true)
    expect(isTextLikeFile('preview.svg')).toBe(true)
    expect(isTextLikeFile('preview.png')).toBe(false)
    expect(isTextLikeFile('demo.mp4')).toBe(false)
  })

  it('only marks supported files as previewable', () => {
    expect(isPreviewableFile('notes.md')).toBe(true)
    expect(isPreviewableFile('preview.png')).toBe(true)
    expect(isPreviewableFile('archive.zip')).toBe(false)
  })
})
