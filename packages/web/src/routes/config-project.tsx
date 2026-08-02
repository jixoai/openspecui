/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Give launch-project Store and Reference declarations a focused Config route.
 * 2. Preserve the existing Project Binding subscription and mutation owner unchanged.
 *
 * Owner Config-workbench decision (2026-08-01): move Project Binding to `/config/project`.
 * Original request (2026-08-01): "还是说我们应该把它迁移到 config 页面下，毕竟 config 页面下有做二级页面的一个前例。"
 */
import { ConfigOwnerHeader, ConfigWorkbenchPage } from '@/components/config/config-workbench'
import { ProjectBindingSection } from '@/components/config/project-binding-section'
import { Link2 } from 'lucide-react'

/** Live Config route for launch-project Store and Reference declarations. */
export function ConfigProject() {
  return (
    <ConfigWorkbenchPage
      current="project"
      header={
        <ConfigOwnerHeader
          title="Project Binding"
          description="Declare the Store and read-only References owned by this launch project."
          icon={<Link2 className="h-6 w-6 shrink-0" aria-hidden />}
        />
      }
    >
      <ProjectBindingSection isStatic={false} />
    </ConfigWorkbenchPage>
  )
}
