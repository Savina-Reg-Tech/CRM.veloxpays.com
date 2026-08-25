import type { FormTheme } from '../../types'
import { BORDER_RADIUS_PRESETS } from '../../types'
import {
  themeCardStyle, themeHeaderStyle, themeHeaderTextStyle,
  themeButtonStyle, themeLabelStyle, themeInputStyle,
} from '../../utils/theme'

/** A compact, live-rendered mockup of what a form looks like with a given
 * theme applied — a sample header + a few common fields (name/email/phone)
 * + a checkbox + a submit button. Shared by TemplateCard (one per saved
 * template, in the card grid) and DesignPanel's sticky "Live preview" panel
 * (this form's own in-progress theme) so both can never visually drift from
 * each other or from the real thing. */
export default function ThemePreviewCard({ theme, title }: { theme: Required<FormTheme>; title: string }) {
  const fieldBoxStyle = { borderRadius: `calc(${BORDER_RADIUS_PRESETS[theme.borderRadius]} * 0.5)`, ...themeInputStyle(theme) }
  return (
    <div className="overflow-hidden border border-gray-200 shadow-sm" style={themeCardStyle(theme)}>
      <div className="px-3 py-2" style={themeHeaderStyle(theme)}>
        <p className="text-[11px] font-semibold truncate" style={themeHeaderTextStyle(theme)}>{title || 'Untitled form'}</p>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {['First name', 'Last name'].map((label) => (
            <div key={label}>
              <p className="text-[8px] font-medium mb-0.5 truncate" style={themeLabelStyle(theme)}>{label}</p>
              <div className="h-3.5 border" style={fieldBoxStyle} />
            </div>
          ))}
        </div>
        {['Email address', 'Phone number'].map((label) => (
          <div key={label}>
            <p className="text-[8px] font-medium mb-0.5" style={themeLabelStyle(theme)}>{label}</p>
            <div className="h-3.5 border" style={fieldBoxStyle} />
          </div>
        ))}
        <label className="flex items-center gap-1.5 pt-0.5">
          <span
            className="h-2.5 w-2.5 border shrink-0"
            style={{ borderRadius: '2px', borderColor: `#${theme.inputBorderColor}`, backgroundColor: `#${theme.inputBgColor}` }}
          />
          <span className="text-[8px]" style={themeLabelStyle(theme)}>I agree to the terms</span>
        </label>
        <div
          className="mt-1.5 h-5 flex items-center justify-center text-[9px] font-semibold"
          style={themeButtonStyle(theme)}
        >
          Submit
        </div>
      </div>
    </div>
  )
}
