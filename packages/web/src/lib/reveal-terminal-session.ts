/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Reveal the newly active terminal session in whichever area owns the route.
 * 2. Expand a bottom-owned Terminal independently from its stored route identity.
 *
 * Owner-reported defect (2026-07-22): Creating Codex/Claude/Gemini must open Terminal when hidden.
 */
import { navController } from './nav-controller'
import { vtNavController } from './view-transitions/navigation'

/** Keep terminal tab activation and multi-area route visibility as one product operation. */
export function revealTerminalSession(localSessionId: string): void {
  if (!localSessionId) return
  const terminalArea = navController.getAreaForPath('/terminal')
  if (terminalArea === 'bottom') {
    void vtNavController.activateBottom('/terminal')
    return
  }
  if (navController.getLocation(terminalArea).pathname === '/terminal') return
  void vtNavController.push(terminalArea, '/terminal', null)
}
