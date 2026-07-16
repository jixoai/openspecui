import type { StoreDoctorStore } from '@openspecui/core/store-types'
import { Dialog } from '@openspecui/web-src/components/dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Store Remove 确认对话框（9.9）。
 *
 * 破坏性操作门槛：必须命名 environment、host、Store、checkout path，并要求显式确认。
 * 复用 web 共享 Dialog（focus trap / ESC / backdrop / @starting-style 过渡动画）。
 *
 * 关键约束（AGENTS.md）：
 *  - remove 是 stores.mutate 能力的 backend-owned 操作；前端只发请求，不删文件。
 *  - 客户端断开只 detach 观察；不杀 CLI。丢失结果为 indeterminate，不伪造为失败/取消。
 *
 * TODO(kernel): remove 是 stores.mutate 能力。backend 落地后，此处发起变更请求并跟踪生命周期
 *               （accepted -> running -> succeeded | failed | indeterminate）。
 *               环境身份（envUri）由当前选中环境提供，不是前端构造。
 */
export function StoreRemoveDialog({
  store,
  onClose,
}: {
  store: StoreDoctorStore
  onClose: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const expected = store.id ?? ''
  const confirmRef = useRef<HTMLInputElement>(null)
  const canSubmit = confirmText === expected && expected.length > 0 && !submitting

  useEffect(() => {
    // Dialog 打开后聚焦确认输入，便于键盘操作。
    const timer = setTimeout(() => confirmRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [])

  const submit = () => {
    if (!canSubmit) return
    setSubmitting(true)
    // TODO(kernel): 发起 stores.mutate remove 变更（backend-owned）。当前骨架仅关闭对话框。
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      borderVariant="error"
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-destructive h-5 w-5 shrink-0" />
          <span className="text-lg font-semibold">Remove Store files</span>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="hover:bg-muted rounded-md px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Remove Store
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          This deletes the Store checkout on the backend host. The mutation is backend-owned and
          survives disconnects.
        </p>

        <dl className="bg-muted/40 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded-md p-3 text-xs">
          <dt className="text-muted-foreground">Environment</dt>
          {/* TODO(kernel): envUri 由当前选中环境提供。 */}
          <dd className="font-mono">selected environment</dd>
          <dt className="text-muted-foreground">Host</dt>
          {/* TODO(kernel): host identity 不通过 envUri 暴露原始值；展示 backend 实例定位符。 */}
          <dd className="font-mono">backend host</dd>
          <dt className="text-muted-foreground">Store</dt>
          <dd className="font-mono">{store.id ?? '—'}</dd>
          <dt className="text-muted-foreground">Checkout</dt>
          <dd className="font-mono">{store.root ?? '—'}</dd>
        </dl>

        <div className="space-y-1.5">
          <label htmlFor="remove-confirm" className="text-sm font-medium">
            Type the Store id to confirm
          </label>
          <input
            id="remove-confirm"
            ref={confirmRef}
            type="text"
            placeholder={expected}
            disabled={submitting}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className="border-border bg-background focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
    </Dialog>
  )
}
