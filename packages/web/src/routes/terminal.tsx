import { TerminalPanel } from '@/components/terminal/terminal-panel'

/**
 * Terminal route — renders TerminalPanel in whatever area it's placed in
 * (main-area full page or bottom-area split pane).
 */
export function TerminalPage() {
  return <TerminalPanel className="h-full min-w-0 overflow-hidden" />
}
