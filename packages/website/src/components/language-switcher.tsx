import { ButtonGroup } from '@openspecui/web-src/components/button-group'

export type WebsiteLanguage = 'en' | 'zh'

interface LanguageSwitcherProps {
  label: string
  value: WebsiteLanguage
  onChange: (value: WebsiteLanguage) => void
}

export function LanguageSwitcher({ label, value, onChange }: LanguageSwitcherProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-terminal-foreground/72 text-xs">{label}</span>
      <ButtonGroup
        value={value}
        onChange={onChange}
        tone="terminal"
        className="shadow-none"
        options={[
          { value: 'en', label: 'EN' },
          { value: 'zh', label: '中文' },
        ]}
      />
    </div>
  )
}
