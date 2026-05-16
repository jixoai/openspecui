import { getHostedScopedStorageKey } from '@/lib/hosted-session'
import { getBasePath, isStaticMode } from '@/lib/static-mode'
import { useDarkMode } from '@/lib/use-dark-mode'
import { useNavLayout } from '@/lib/use-nav-controller'
import { VTLink, vtNavController } from '@/lib/view-transitions/navigation'
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Tooltip } from '../tooltip'
import { AreaNav } from './area-nav'
import { navItems, settingsItem } from './nav-items'
import { TopLayerEntryButton } from './top-layer-entry-button'

const DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY = 'openspecui:desktop-sidebar-collapsed'

function getDesktopSidebarCollapsedStorageKey(): string {
  if (typeof window === 'undefined') return DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY
  return getHostedScopedStorageKey(DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY, window.location)
}

function readDesktopSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return localStorage.getItem(getDesktopSidebarCollapsedStorageKey()) === 'true'
  } catch {
    return false
  }
}

/** Desktop sidebar navigation */
export function DesktopSidebar() {
  const isDark = useDarkMode()
  const navLayout = useNavLayout()
  const basePath = getBasePath()
  const isStatic = isStaticMode()
  const [collapsed, setCollapsed] = useState(readDesktopSidebarCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(getDesktopSidebarCollapsedStorageKey(), collapsed ? 'true' : 'false')
    } catch {
      // ignore persistence failures; the sidebar remains usable for this session
    }
  }, [collapsed])

  const collapseLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <nav
      data-collapsed={collapsed}
      className="desktop-sidebar border-border bg-muted/30 flex shrink-0 flex-col border-r transition-[width,padding]"
    >
      <div
        className={`mb-6 flex items-center gap-2 ${collapsed ? 'justify-center' : 'justify-between'}`}
      >
        {!collapsed ? (
          <img
            src={
              isDark ? `${basePath}openspec_pixel_dark.svg` : `${basePath}openspec_pixel_light.svg`
            }
            alt="OpenSpec"
            className="h-6 min-w-0"
          />
        ) : null}
        <Tooltip content={collapseLabel} sideOffset={12}>
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            aria-label={collapseLabel}
            title={collapseLabel}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </Tooltip>
      </div>

      <TopLayerEntryButton
        label="Search"
        text="Search"
        icon={<Search className="h-4 w-4 shrink-0" />}
        collapsed={collapsed}
        size="desktop"
        className="mb-4 flex"
        onClick={() => vtNavController.activatePop('/search')}
      />

      {isStatic ? (
        /* Static mode: simple nav list */
        <div className="flex flex-1 flex-col">
          <ul className="flex-1 space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <Tooltip content={collapsed ? item.label : undefined} sideOffset={12}>
                  <VTLink
                    to={item.to}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md py-2 ${
                      collapsed ? 'justify-center px-2' : 'px-3'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? (
                      <span className="font-nav text-base tracking-[0.04em]">{item.label}</span>
                    ) : null}
                  </VTLink>
                </Tooltip>
              </li>
            ))}
          </ul>
          <div className="border-border space-y-1 border-t pt-4">
            <Tooltip content={collapsed ? settingsItem.label : undefined} sideOffset={12}>
              <VTLink
                to={settingsItem.to}
                aria-label={collapsed ? settingsItem.label : undefined}
                title={collapsed ? settingsItem.label : undefined}
                className={`hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md py-2 ${
                  collapsed ? 'justify-center px-2' : 'px-3'
                }`}
              >
                <settingsItem.icon className="h-4 w-4 shrink-0" />
                {!collapsed ? (
                  <span className="font-nav text-base tracking-[0.04em]">{settingsItem.label}</span>
                ) : null}
              </VTLink>
            </Tooltip>
          </div>
        </div>
      ) : (
        /* IDE mode: split nav with drag-and-drop — all items draggable between areas */
        <div className="flex flex-1 flex-col gap-2">
          {/* Main area tabs (including Settings) */}
          <div className="flex-1">
            <AreaNav
              area="main"
              tabs={navLayout.mainTabs}
              className="h-full"
              collapsed={collapsed}
            />
          </div>

          {/* Bottom area tabs (always rendered as drop target) */}
          {!collapsed ? (
            <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
              Bottom
            </div>
          ) : null}
          <div className="border-border border-t pt-2">
            <AreaNav area="bottom" tabs={navLayout.bottomTabs} collapsed={collapsed} />
          </div>
        </div>
      )}
    </nav>
  )
}
