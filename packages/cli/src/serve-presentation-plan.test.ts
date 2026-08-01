/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Cover the approved daemon-present and daemon-absent serve presentation matrix.
 * 2. Prove `--no-open` prevents every presentation side effect.
 * 3. Cover the global-mode preference fallback and the implicit-default warning flag.
 *
 * Original request (2026-07-29): "非交互环境默认 Direct Web，只有显式 --app 才允许自动启动 App daemon。"
 * Original request (2026-08-01): "全局偏好选中默认；非 tty 无偏好默认 web + 警告。"
 */
import {
  IMPLICIT_DEFAULT_WARNING,
  planServePresentation,
  resolveModePrompt,
} from './serve-presentation-plan.js'

describe('serve presentation planning', () => {
  it('short-circuits all presentation when open is disabled', () => {
    expect(
      planServePresentation({
        open: false,
        app: true,
        web: false,
        daemonRunning: false,
        interactive: true,
        preference: undefined,
      })
    ).toEqual({ kind: 'none' })
  })

  it('uses the running daemon by default regardless of preference', () => {
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: false,
        daemonRunning: true,
        interactive: false,
        preference: 'web',
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
        preference: undefined,
      })
    ).toEqual({ kind: 'prompt-for-mode' })
    // Even with a preference, an interactive session still asks (preference only sets the default highlight).
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: false,
        daemonRunning: false,
        interactive: true,
        preference: 'web',
      })
    ).toEqual({ kind: 'prompt-for-mode' })
  })

  it('resolves explicit app and web modes against daemon presence', () => {
    expect(
      planServePresentation({
        open: true,
        app: true,
        web: false,
        daemonRunning: false,
        interactive: false,
        preference: undefined,
      })
    ).toEqual({ kind: 'app', startDaemon: true })
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: true,
        daemonRunning: false,
        interactive: false,
        preference: undefined,
      })
    ).toEqual({ kind: 'direct-web' })
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: true,
        daemonRunning: true,
        interactive: false,
        preference: undefined,
      })
    ).toEqual({ kind: 'app-and-direct-web' })
  })

  it('applies the remembered preference for non-interactive daemon-less serves', () => {
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: false,
        daemonRunning: false,
        interactive: false,
        preference: 'app',
      })
    ).toEqual({ kind: 'app', startDaemon: true })
    expect(
      planServePresentation({
        open: true,
        app: false,
        web: false,
        daemonRunning: false,
        interactive: false,
        preference: 'web',
      })
    ).toEqual({ kind: 'direct-web' })
  })

  it('flags an implicit Direct Web default when non-interactive and no preference is set', () => {
    const plan = planServePresentation({
      open: true,
      app: false,
      web: false,
      daemonRunning: false,
      interactive: false,
      preference: undefined,
    })
    expect(plan).toEqual({ kind: 'direct-web', warnImplicitDefault: true })
    // The warning text is part of the plan module's public contract.
    expect(IMPLICIT_DEFAULT_WARNING).toContain('--app')
    expect(IMPLICIT_DEFAULT_WARNING).toContain('--web')
  })

  it('maps Radio mode selection to concrete effects', () => {
    expect(resolveModePrompt('app')).toEqual({ kind: 'app', startDaemon: true })
    expect(resolveModePrompt('web')).toEqual({ kind: 'direct-web' })
  })
})
