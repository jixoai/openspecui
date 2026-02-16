// Side-effect imports — registers all InputPanel custom elements
import './input-method-tab.js'
import './input-panel-settings.js'
import './input-panel.js'
import './shortcut-tab.js'
import './virtual-keyboard-tab.js'
import './virtual-trackpad-tab.js'

export type { InputPanelLayout, InputPanelTab } from './input-panel.js'
export { blendHex, cssColorToHex, onThemeChange, resolvePixiTheme } from './pixi-theme.js'
export type { PixiTheme } from './pixi-theme.js'
export {
  InputPanelAddon,
  type InputPanelHistoryItem,
  type InputPanelSettingsPayload,
} from './xterm-addon.js'
