// Single-line subject with fields: a plain input (so typing is predictable), an "Insert field"
// menu, and a line underneath that shows each {{key}} as its labelled chip.
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { subjectParts } from '../../pickdropEmails'
import { InsertFieldMenu, PlaceholderChip } from './EmailEditor'
import { fieldClass } from './PdUI'

export interface PlaceholderSubjectInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholders: { key: string; label: string }[]
  missing?: ReadonlySet<string>
  filled?: ReadonlySet<string>
  disabled?: boolean
  invalid?: boolean
}

const PlaceholderSubjectInput = forwardRef<HTMLInputElement, PlaceholderSubjectInputProps>(function PlaceholderSubjectInput(
  { id, value, onChange, onBlur, placeholders, missing = new Set(), filled, disabled, invalid },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)
  const [menuOpen, setMenuOpen] = useState(false)
  const caret = useRef<{ start: number; end: number } | null>(null)
  const parts = subjectParts(value)
  const hasFields = parts.some((p) => 'key' in p)
  const meta = { placeholders, missing, filled }

  const insert = (key: string) => {
    const el = inputRef.current
    const token = `{{${key}}}`
    const start = caret.current?.start ?? el?.selectionStart ?? value.length
    const end = caret.current?.end ?? el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el?.focus()
      const pos = start + token.length
      el?.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <input
          id={id}
          ref={inputRef}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const el = inputRef.current
            if (el) caret.current = { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length }
            onBlur?.()
          }}
          onKeyDown={(e) => {
            // Typing "{{" opens the field menu, as in the body.
            const el = e.currentTarget
            if (e.key === '{' && el.selectionStart && value[el.selectionStart - 1] === '{') {
              e.preventDefault()
              const at = el.selectionStart - 1
              onChange(value.slice(0, at) + value.slice(el.selectionEnd ?? at + 1))
              caret.current = { start: at, end: at }
              setMenuOpen(true)
            }
          }}
          maxLength={300}
          aria-invalid={invalid || undefined}
          className={cn(fieldClass, 'h-11 min-w-0 flex-1', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-100')}
        />
        {!disabled && (
          <InsertFieldMenu
            placeholders={placeholders}
            open={menuOpen}
            onOpenChange={(o) => {
              if (o) {
                const el = inputRef.current
                caret.current = { start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length }
              }
              setMenuOpen(o)
            }}
            onPick={insert}
            meta={meta}
            align="right"
            buttonClassName="h-11"
          />
        )}
      </div>
      {hasFields && (
        <p className="flex flex-wrap items-center gap-y-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs leading-6 text-gray-600" aria-label="Subject with fields">
          {parts.map((p, i) =>
            'key' in p ? <PlaceholderChip key={i} placeholderKey={p.key} meta={meta} /> : <span key={i} className="whitespace-pre-wrap">{p.text}</span>,
          )}
        </p>
      )}
    </div>
  )
})

export default PlaceholderSubjectInput
