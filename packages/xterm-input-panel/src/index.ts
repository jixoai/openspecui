// Side-effect imports — registers all InputPanel custom elements
import './input-panel.js'
import './input-method-tab.js'
import './virtual-keyboard-tab.js'
import './virtual-trackpad-tab.js'
import './input-panel-settings.js'

export type { InputPanelTab, InputPanelLayout } from './input-panel.js'
export type { PixiTheme } from './pixi-theme.js'
export { resolvePixiTheme, onThemeChange, cssColorToHex, blendHex } from './pixi-theme.js'
export { InputPanelAddon } from './xterm-addon.js'
