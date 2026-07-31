/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Cover the approved daemon-present and daemon-absent serve presentation matrix.
 * 2. Prove `--no-open` prevents every presentation side effect.
 *
 * Original request (2026-07-29): "非交互环境默认 Direct Web，只有显式 --app 才允许自动启动 App daemon。"
 */
import { planServePresentation, resolveAppPrompt } from './serve-presentation-plan.js'

describe('serve presentation planning', () => {
  it('short-circuits all presentation when open is disabled', () => {
    expect(
      planServePresentation({
        open: false,
        app: true,
        web: false,
        daemonRunning: false,
        interactive: true,
      })
    ).toEqual({ kind: 'none' })
  })

  it('uses the running daemon by default', () => {
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: false,
        daemonRunning: true,
        interactive: false,
      })
    ).toEqual({ kind: 'app', startDaemon: false })
  })

  it('prompts only for an interactive unqualified serve without a daemon', () => {
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: false,
        daemonRunning: false,
        interactive: true,
      })
    ).toEqual({ kind: 'prompt-for-app' })
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: false,
        daemonRunning: false,
        interactive: false,
      })
    ).toEqual({ kind: 'direct-web' })
  })

  it('resolves explicit app and web modes against daemon presence', () => {
    expect(
      planServePresentation({
        open: true,
        app: true,
        web: false,
        daemonRunning: false,
        interactive: false,
      })
    ).toEqual({ kind: 'app', startDaemon: true })
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: true,
        daemonRunning: false,
        interactive: false,
      })
    ).toEqual({ kind: 'direct-web' })
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: true,
        daemonRunning: true,
        interactive: false,
      })
    ).toEqual({ kind: 'app-and-direct-web' })
  })

  it('maps prompt acceptance and rejection to concrete effects', () => {
    expect(resolveAppPrompt(true)).toEqual({ kind: 'app', startDaemon: true })
    expect(resolveAppPrompt(false)).toEqual({ kind: 'direct-web' })
  })
})
