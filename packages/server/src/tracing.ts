/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Bootstrap OpenTelemetry tracing for the backend (diagnostic only, gated by `--otel`).
 * 2. Expose a single Tracer value (real or noop) so instrumentation sites stay branch-free.
 * 3. Let the NodeSDK auto-configure from standard OTEL_* environment variables, with an optional
 *    explicit `--otel-endpoint` override; refuse to pollute the console on incomplete config.
 *
 * Original request (2026-07-30): "我需要集成 OpenTelemetry ... 通过 --otel --otel-endpoint 来开启。
 *   因为我要你分析目前速度慢的根本原因。"
 * Owner correction (2026-07-30): --otel is just the switch; concrete config (endpoint, headers,
 *   sampling) should come from standard OTel ENV (OTEL_EXPORTER_OTLP_ENDPOINT etc.).
 *
 * Design: `--otel` flips the switch. When on, a NodeSDK is started WITHOUT an explicit
 * traceExporter so it auto-resolves from OTEL_* env vars (the canonical OTel workflow). An explicit
 * `--otel-endpoint` provides one convenience override for the OTLP/HTTP endpoint. When `--otel` is
 * off, `initTracing` returns a noop tracer and never touches the OTel SDK, so every span operation
 * is a side-effect-free no-op and the manager/lease/invalidation correctness models are untouched.
 *
 * Supported ENV (read by NodeSDK, not by us):
 *   OTEL_EXPORTER_OTLP_ENDPOINT   Collector base URL
 *   OTEL_EXPORTER_OTLP_HEADERS    e.g. "Authorization=Basic <base64>"
 *   OTEL_TRACES_SAMPLER ...       standard sampling config
 */
import { diag, DiagConsoleLogger, DiagLogLevel, trace, type Tracer } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'

/** Resolved tracing configuration consumed by the server. */
export interface TracingConfig {
  /** True when `--otel` was supplied. When false, all tracing is a no-op. */
  enabled: boolean
  /** Optional OTLP/HTTP endpoint override; otherwise NodeSDK reads OTEL_* env. */
  endpoint?: string
}

/** No-op tracer returned when tracing is disabled: span methods are inert. */
export const NOOP_TRACER: Tracer = trace.getTracer('openspecui-noop')

let activeSdk: NodeSDK | null = null

/**
 * Initialize backend tracing and return the Tracer every instrumentation site should use.
 *
 * - `enabled` → start a NodeSDK that auto-configures from OTEL_* env vars. An explicit `endpoint`
 *   overrides the OTLP/HTTP export target; otherwise the SDK honors OTEL_EXPORTER_OTLP_ENDPOINT /
 *   OTEL_EXPORTER_OTLP_HEADERS etc. directly.
 * - `!enabled` → return NOOP_TRACER without constructing or starting any SDK.
 */
/** Whether any standard OTel exporter env var is set (so the SDK has something to export to). */
function hasOtelExporterEnv(): boolean {
  return Boolean(
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_HEADERS ||
      process.env.OTEL_TRACES_EXPORTER
  )
}

/**
 * Normalize a user-supplied OTLP/HTTP endpoint into the full traces export URL.
 *
 * `OTLPTraceExporter({ url })` uses the url verbatim — it does NOT append the OTLP signal path.
 * A bare Collector base like `http://host:4318` therefore POSTs to the root and gets 404. Users
 * naturally pass a base URL (the same value they'd put in OTEL_EXPORTER_OTLP_ENDPOINT, which the
 * SDK *does* append to). To keep `--otel-endpoint` ergonomic and consistent with ENV semantics,
 * append `/v1/traces` only when the URL has no OTLP signal path of its own.
 *
 * Exported for unit testing.
 */
export function normalizeOtlpHttpEndpoint(rawEndpoint: string): string {
  const endpoint = rawEndpoint.trim()
  if (!endpoint) return endpoint
  // Already targets a specific OTLP path — leave it untouched.
  if (/\/v1\/(traces|metrics|logs)$/i.test(endpoint)) return endpoint
  // Append the traces signal path; ensure exactly one separating slash.
  return `${endpoint.replace(/\/+$/, '')}/v1/traces`
}

export function initTracing(config: TracingConfig): Tracer {
  if (!config.enabled) {
    return NOOP_TRACER
  }

  const hasEndpoint = Boolean(config.endpoint && config.endpoint.length > 0)
  if (!hasEndpoint && !hasOtelExporterEnv()) {
    console.warn(
      '[openspecui] --otel is enabled but no exporter is configured. ' +
        'Set OTEL_EXPORTER_OTLP_ENDPOINT (and OTEL_EXPORTER_OTLP_HEADERS if needed), ' +
        'or pass --otel-endpoint, to export spans. Tracing stays a no-op until configured.'
    )
    return NOOP_TRACER
  }

  // Surface SDK/exporter diagnostics so export failures (network, encoding) are visible instead
  // of being silently dropped. OTEL_LOG_LEVEL env can raise/lower verbosity; default to info.
  const rawLogLevel = process.env.OTEL_LOG_LEVEL
  diag.setLogger(
    new DiagConsoleLogger(),
    rawLogLevel ? (Number(rawLogLevel) as DiagLogLevel) : DiagLogLevel.INFO
  )

  const resolvedEndpoint = hasEndpoint ? normalizeOtlpHttpEndpoint(config.endpoint!) : undefined
  activeSdk = new NodeSDK({
    serviceName: 'openspecui-server',
    // Explicit endpoint override; when absent the SDK resolves the exporter from OTEL_* env.
    traceExporter: resolvedEndpoint ? new OTLPTraceExporter({ url: resolvedEndpoint }) : undefined,
  })
  activeSdk.start()
  diag.info('[openspecui] OpenTelemetry tracing started -> %s', resolvedEndpoint ?? 'OTEL_* env')

  return trace.getTracer('openspecui-server')
}

/** Flush and dispose any active SDK started by `initTracing`. Safe to call when none is active. */
export async function shutdownTracing(): Promise<void> {
  const sdk = activeSdk
  activeSdk = null
  if (sdk) {
    await sdk.shutdown()
  }
}
