import { Settings } from 'lucide-react'

/**
 * App 设置（骨架）。
 *
 * TODO(kernel): 待 backend health/能力协议落地后填充：
 *  - 协议版本与 backend 兼容性信息
 *  - 可选 Backend Access Gate（--auth / --password）状态展示（非用户/权限系统）
 *  - 运行时环境与 data-scope 诊断
 * 当前为骨架占位。
 */
export function SettingsRoute() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <Settings className="h-6 w-6 shrink-0" />
        Settings
      </h1>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Backend Access Gate</h2>
        {/* TODO(kernel): --auth/--password 是后端 CLI 侧能力；App 仅展示状态，不实现凭据管理。
            凭据只在 session memory 中，绝不进 query params / persisted tabs / localStorage。 */}
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
