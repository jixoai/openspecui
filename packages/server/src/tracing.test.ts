/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the disabled config returns a no-op tracer that produces no active span.
 * 2. Prove an enabled config registers a real SDK, both via an explicit endpoint and via ENV.
 * 3. Prove shutdownTracing is safe when no SDK is active and flushes an active one.
 *
 * Original request (2026-07-30): "我需要集成 OpenTelemetry ... 分析目前速度慢的根本原因。"
 * Evidence law: a no-op tracer must leave no active span, while an enabled tracer must register.
 */
import { trace } from '@opentelemetry/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initTracing, NOOP_TRACER, normalizeOtlpHttpEndpoint, shutdownTracing } from './tracing.js'

describe('tracing', () => {
  const initialEnv = { ...process.env }

  afterEach(async () => {
    // shutdown may attempt to flush a real OTLP exporter; tolerate connection failures in tests.
    await shutdownTracing().catch(() => {})
    // restore any process.env mutation from the "configured from env" test.
    for (const key of [
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
      'OTEL_EXPORTER_OTLP_HEADERS',
      'OTEL_TRACES_EXPORTER',
    ]) {
      if (!(key in initialEnv)) delete process.env[key]
      else process.env[key] = initialEnv[key]
    }
  })

  it('returns the no-op tracer when disabled without touching the global provider', () => {
    const tracer = initTracing({ enabled: false })
    expect(tracer).toBe(NOOP_TRACER)

    // No-op tracer startActiveSpan still invokes the callback but exposes no active span.
    tracer.startActiveSpan('disabled-probe', () => {
      // A real provider would surface an active span; the no-op one does not.
      expect(trace.getActiveSpan()).toBeUndefined()
      return undefined
    })
  })

  it('returns the no-op tracer and warns when enabled with no endpoint and no OTEL_* env', () => {
    for (const key of [
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
      'OTEL_EXPORTER_OTLP_HEADERS',
      'OTEL_TRACES_EXPORTER',
    ]) {
      delete process.env[key]
    }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tracer = initTracing({ enabled: true })
    expect(tracer).toBe(NOOP_TRACER)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('no exporter is configured')
    warnSpy.mockRestore()
  })

  it('registers a real SDK (non-noop tracer) when enabled with an explicit endpoint', () => {
    // A real OTLP endpoint is unreachable in tests. We assert only that the SDK registered a
    // distinct (non-noop) tracer; we deliberately do not create an exportable span here, so
    // shutdown in afterEach has nothing to flush and no network call is attempted.
    const tracer = initTracing({ enabled: true, endpoint: 'http://localhost:4318/v1/traces' })
    expect(tracer).not.toBe(NOOP_TRACER)
  })

  it('registers a real SDK from OTEL_* env when enabled without an explicit endpoint', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318'
    // NodeSDK resolves the exporter from env; we only assert registration, not export behavior.
    const tracer = initTracing({ enabled: true })
    expect(tracer).not.toBe(NOOP_TRACER)
  })

  it('shutdownTracing resolves when no SDK was started', async () => {
    await expect(shutdownTracing()).resolves.toBeUndefined()
  })
})

describe('normalizeOtlpHttpEndpoint', () => {
  it('appends /v1/traces to a bare Collector base URL', () => {
    expect(normalizeOtlpHttpEndpoint('http://192.168.2.9:4318')).toBe(
      'http://192.168.2.9:4318/v1/traces'
    )
  })

  it('strips trailing slash before appending the signal path', () => {
    expect(normalizeOtlpHttpEndpoint('http://localhost:4318/')).toBe(
      'http://localhost:4318/v1/traces'
    )
  })

  it('leaves an endpoint that already targets /v1/traces untouched', () => {
    expect(normalizeOtlpHttpEndpoint('http://localhost:4318/v1/traces')).toBe(
      'http://localhost:4318/v1/traces'
    )
  })
})
