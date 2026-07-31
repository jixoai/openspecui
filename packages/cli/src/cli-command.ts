/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Define the checked command-plan union consumed by CLI execution.
 * 2. Parse the production yargs command registry without executing runtime side effects.
 * 3. Preserve bare serve aliases while isolating daemon lifecycle commands.
 *
 * Original request (2026-07-29): "openspecui 启动当前项目其实是 openspecui serve 的缩写；start/stop/restart 针对 daemon。"
 */
import yargs from 'yargs'
import type { ExportFormat } from './export.js'

export interface ServeCommandPlan {
  kind: 'serve'
  projectDir: string | undefined
  dir: string | undefined
  port: number
  open: boolean
  app: boolean
  web: boolean
  auth: boolean
  password: string | true | undefined
  /** Enable backend OpenTelemetry tracing (diagnostic only). */
  otel?: boolean
  /** OTLP/HTTP Collector base URL. Absent ⇒ console exporter fallback. */
  otelEndpoint?: string
}

export interface DaemonCommandPlan {
  kind: 'daemon'
  action: 'start' | 'stop' | 'restart'
  requestedHostMode: 'web' | undefined
}

export interface ExportCommandPlan {
  kind: 'export'
  output: string
  format: ExportFormat
  dir: string | undefined
  basePath: string | undefined
  clean: boolean | undefined
  open: boolean | undefined
  previewPort: number | undefined
  port: number | undefined
  previewHost: string | undefined
  references: 'include' | 'omit' | undefined
}

export interface MetaCommandPlan {
  kind: 'meta'
}

export type CliCommandPlan =
  | ServeCommandPlan
  | DaemonCommandPlan
  | ExportCommandPlan
  | MetaCommandPlan

/** Parse argv through the production registry and return one side-effect-free execution plan. */
export async function parseCliCommand(
  args: readonly string[],
  options: { version?: string } = {}
): Promise<CliCommandPlan> {
  let plan: CliCommandPlan | null = null

  await yargs([...args])
    .scriptName('openspecui')
    .exitProcess(false)
    .command(
      ['$0 [project-dir]', 'serve [project-dir]'],
      'Serve one OpenSpec project',
      (parser) =>
        parser
          .positional('project-dir', {
            describe: 'Project directory containing openspec/',
            type: 'string',
          })
          .option('port', {
            alias: 'p',
            describe: 'Port to run the project server on',
            type: 'number',
            default: 3100,
          })
          .option('dir', {
            alias: 'd',
            describe: 'Project directory containing openspec/',
            type: 'string',
          })
          .option('open', {
            describe: 'Present the project after the server is ready',
            type: 'boolean',
            default: true,
          })
          .option('app', {
            describe: 'Ensure the App daemon is running and attach this project as a Workspace',
            type: 'boolean',
          })
          .option('web', {
            describe:
              'Open this backend in the system browser; also attach it when an App daemon is already running',
            type: 'boolean',
          })
          .conflicts('app', 'web')
          .option('auth', {
            describe:
              'Generate a high-entropy Bearer credential and protect the whole backend Access Gate. ' +
              'Mutually exclusive with --password.',
            type: 'boolean',
          })
          .option('password', {
            describe:
              'Normalize an operator secret into the same Bearer Access Gate (e.g. --password=secret). ' +
              'Can leak through shell history/process inspection. Mutually exclusive with --auth.',
            type: 'string',
            coerce: (value) => (value === '' ? true : value),
          })
          .conflicts('auth', 'password')
          .option('otel', {
            describe:
              'Enable backend OpenTelemetry tracing to diagnose slow loads. ' +
              'Without --otel-endpoint, spans are printed to the server console.',
            type: 'boolean',
          })
          .option('otel-endpoint', {
            describe:
              'OTLP/HTTP Collector base URL (e.g. http://localhost:4318/v1/traces). ' +
              'Implies --otel.',
            type: 'string',
          }),
      (argv) => {
        plan = {
          kind: 'serve',
          projectDir: argv['project-dir'],
          dir: argv.dir,
          port: argv.port,
          open: argv.open,
          app: argv.app === true,
          web: argv.web === true,
          auth: argv.auth === true,
          password: argv.password,
          otel: argv.otel === true || !!argv['otel-endpoint'],
          otelEndpoint: argv['otel-endpoint'],
        }
      }
    )
    .command(
      'start',
      'Start or activate the OpenSpecUI App daemon',
      (parser) =>
        parser.option('web', {
          describe: 'Use the Browser App host instead of the native OpenTray window',
          type: 'boolean',
        }),
      (argv) => {
        plan = {
          kind: 'daemon',
          action: 'start',
          requestedHostMode: argv.web === true ? 'web' : undefined,
        }
      }
    )
    .command(
      'stop',
      'Stop the OpenSpecUI App daemon',
      (parser) => parser,
      () => {
        plan = { kind: 'daemon', action: 'stop', requestedHostMode: undefined }
      }
    )
    .command(
      'restart',
      'Restart the OpenSpecUI App daemon',
      (parser) =>
        parser.option('web', {
          describe: 'Use the Browser App host instead of the native OpenTray window',
          type: 'boolean',
        }),
      (argv) => {
        plan = {
          kind: 'daemon',
          action: 'restart',
          requestedHostMode: argv.web === true ? 'web' : undefined,
        }
      }
    )
    .command(
      'export',
      'Export OpenSpec project as static website or JSON data',
      (parser) =>
        parser
          .option('output', {
            alias: 'o',
            describe: 'Output directory for export',
            type: 'string',
            demandOption: true,
          })
          .option('format', {
            alias: 'f',
            describe: 'Export format',
            type: 'string',
            choices: ['html', 'json'] as const,
            default: 'html',
          })
          .option('dir', {
            alias: 'd',
            describe: 'Project directory containing openspec/',
            type: 'string',
          })
          .option('base-path', {
            alias: 'b',
            describe: 'Base path for deployment (e.g., /docs/ or ./)',
            type: 'string',
          })
          .option('clean', {
            alias: 'c',
            describe: 'Clean output directory before export',
            type: 'boolean',
          })
          .option('open', {
            describe: 'Start preview server and open in browser after export',
            type: 'boolean',
          })
          .option('preview-port', {
            describe: 'Port for the preview server (used with --open)',
            type: 'number',
          })
          .option('port', {
            alias: 'p',
            describe: 'Alias of --open --preview-port <port>',
            type: 'number',
          })
          .option('preview-host', {
            describe: 'Host for the preview server (used with --open)',
            type: 'string',
          })
          .option('references', {
            describe:
              'Direct Reference export policy. Required when effective References exist: ' +
              "'include' materializes direct Reference Specs (complete-or-fail), 'omit' excludes them",
            type: 'string',
            choices: ['include', 'omit'] as const,
          }),
      (argv) => {
        plan = {
          kind: 'export',
          output: argv.output,
          format: argv.format === 'json' ? 'json' : 'html',
          dir: argv.dir,
          basePath: argv['base-path'],
          clean: argv.clean,
          open: argv.open,
          previewPort: argv['preview-port'],
          port: argv.port,
          previewHost: argv['preview-host'],
          references: argv.references,
        }
      }
    )
    .help()
    .alias('help', 'h')
    .version(options.version ?? '0.0.0')
    .alias('version', 'v')
    .check(() => {
      const retiredAppUrl = args.find((argument) => argument.startsWith('--app='))
      if (retiredAppUrl) {
        throw new Error(
          '`--app=<url>` is no longer supported. Use `--app` to attach this project to the local App daemon.'
        )
      }
      return true
    })
    .strict()
    .parseAsync()

  if (plan === null) {
    if (args.some((argument) => ['--help', '-h', '--version', '-v'].includes(argument))) {
      return { kind: 'meta' }
    }
    throw new Error('CLI command did not produce an execution plan.')
  }
  return plan
}
