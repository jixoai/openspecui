/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Render the complete Active Root YAML escape hatch without owning revision admission.
 *
 * Original request (2026-08-01): retain raw YAML writing for organization and team-specific configuration keys.
 */
import { CodeEditor } from '@/components/code-editor'

export interface ActiveRootRawEditorProps {
  value: string
  readOnly: boolean
  onChange(value: string): void
  onSaveShortcut(): void
}

/** Complete-document YAML presentation owner; revision admission remains outside this component. */
export function ActiveRootRawEditor({
  value,
  readOnly,
  onChange,
  onSaveShortcut,
}: ActiveRootRawEditorProps) {
  return (
    <CodeEditor
      value={value}
      onChange={onChange}
      onSaveShortcut={onSaveShortcut}
      readOnly={readOnly}
      filename="config.yaml"
      className="min-h-0 min-w-0 flex-1"
      editorMinHeight="0px"
    />
  )
}
