/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Reserve the App settings surface for hosted protocol and environment diagnostics.
 * 2. Keep the optional Access Gate distinct from users or permissions.
 * 3. Own the App-scoped Appearance preference (light/dark/system).
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Original request (2026-08-02): "app settings 中要新增 theme 的开关"
 */
import { Settings } from 'lucide-react'
import type { HostedShellTheme } from '../lib/app-theme'
import { useHostedShellThemeState } from '../lib/use-hosted-shell-theme'

const THEME_OPTIONS: ReadonlyArray<{ readonly value: HostedShellTheme; readonly label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

/**
 * App 设置（骨架 + Appearance）。
 *
 * TODO(kernel): 待 backend health/能力协议落地后填充：
 *  - 协议版本与 backend 兼容性信息
 *  - 可选 Backend Access Gate（--auth / --password）状态展示（非用户/权限系统）
 *  - 运行时环境与 data-scope 诊断
 */
export function SettingsRoute() {
  const { theme, setTheme } = useHostedShellThemeState()

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <Settings className="h-6 w-6 shrink-0" />
        Settings
      </h1>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Appearance</h2>
        {/* App 自有偏好（localStorage），与 favicon 的 OS 媒体查询解耦；setTheme 即时生效并跨标签页同步。 */}
        <div className="flex gap-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              aria-pressed={theme === option.value}
              className="rounded-md border px-3 py-1.5 text-sm transition-colors"
              data-active={theme === option.value ? 'true' : 'false'}
              onClick={() => setTheme(option.value)}
              style={{
                borderColor: theme === option.value ? 'var(--primary)' : 'var(--border)',
                background:
                  theme === option.value
                    ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
                    : 'transparent',
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Backend Access Gate</h2>
        {/* TODO(kernel): --auth/--password 是后端 CLI 侧能力；App 仅展示状态，不实现凭据管理。
            凭据只在运行时内存中，绝不进 query params / persisted tabs / localStorage。 */}
        <p className="text-muted-foreground text-sm">
          No backend access gate configured. The optional shared Bearer credential is a backend
          responsibility (<code className="bg-muted rounded px-1">--auth</code> /{' '}
          <code className="bg-muted rounded px-1">--password</code>).
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Runtime Environments</h2>
        {/* TODO(kernel): 待 envUri 协议落地后，展示分组的环境与 data-scope 诊断。 */}
        <p className="text-muted-foreground text-sm">
          Environment identity (<code className="bg-muted rounded px-1">envUri</code>) is issued by
          each connected backend. Connect a backend to observe its environment.
        </p>
      </section>
    </div>
  )
}
