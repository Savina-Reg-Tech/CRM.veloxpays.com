import { MessageSquare, FileText, Link2, CalendarClock, CreditCard } from 'lucide-react'
import type { OnSubmitAction, OnSubmitOutcomeConfig } from '../../types'

interface OnSubmitActionPickerProps {
  config: OnSubmitOutcomeConfig
  onChange: (patch: Partial<OnSubmitOutcomeConfig>) => void
  /** Only the base (non-conditional) on-submit config manages step-wide CTA
   * buttons — a conditional outcome reuses whatever buttons are already
   * configured on the step, so this hint/link is omitted there. */
  ctaButtons?: { count: number; onOpen: () => void }
}

const OPTIONS: { value: OnSubmitAction; label: string; help: string; icon: typeof MessageSquare }[] = [
  {
    value: 'message',
    label: 'Show thank-you message',
    help: 'Display a message right on this page — optionally with CTA buttons like "Continue Application" or "Book a Call."',
    icon: MessageSquare,
  },
  {
    value: 'redirect_page',
    label: 'Redirect to a page',
    help: 'Send visitors to another page on your own site.',
    icon: FileText,
  },
  {
    value: 'redirect_url',
    label: 'Redirect to a URL',
    help: 'Send visitors to any external web address.',
    icon: Link2,
  },
  {
    value: 'redirect_meeting',
    label: 'Redirect to a Meeting link',
    help: 'Send visitors straight to your booking/scheduling page.',
    icon: CalendarClock,
  },
  {
    value: 'redirect_payment',
    label: 'Redirect to a Payment link',
    help: 'Send visitors straight to a checkout or payment page.',
    icon: CreditCard,
  },
]

// Which config field holds the URL for each redirect action — kept
// separate per action (rather than one shared field) so switching between
// options in the builder never overwrites a link already typed elsewhere.
const URL_FIELD: Partial<Record<OnSubmitAction, keyof OnSubmitOutcomeConfig>> = {
  redirect_page: 'pageUrl',
  redirect_url: 'externalUrl',
  redirect_meeting: 'meetingUrl',
  redirect_payment: 'paymentUrl',
}

const URL_PLACEHOLDER: Partial<Record<OnSubmitAction, string>> = {
  redirect_page: '/thank-you',
  redirect_url: 'https://example.com/thank-you',
  redirect_meeting: 'https://calendly.com/your-team/intro-call',
  redirect_payment: 'https://buy.stripe.com/your-payment-link',
}

const NEW_TAB_FIELD: Partial<Record<OnSubmitAction, keyof OnSubmitOutcomeConfig>> = {
  redirect_page: 'pageOpenInNewTab',
  redirect_url: 'externalOpenInNewTab',
  redirect_meeting: 'meetingOpenInNewTab',
  redirect_payment: 'paymentOpenInNewTab',
}

/** The "what happens on submit" picker — a list of radio-style cards (show
 * message / redirect to page / URL / meeting / payment link), each
 * expanding to its own message text or URL + "open in new tab" fields.
 * Shared by the base on-submit config (OnSubmitPanel) and each conditional
 * outcome's own resolved behavior (OutcomeEditorModal) so the two editing
 * surfaces can never drift apart. */
export default function OnSubmitActionPicker({ config, onChange, ctaButtons }: OnSubmitActionPickerProps) {
  const action = config.action

  return (
    <div className="space-y-2">
      {OPTIONS.map(({ value, label, help, icon: Icon }) => {
        const isSelected = action === value
        const urlKey = URL_FIELD[value]
        const newTabKey = NEW_TAB_FIELD[value]

        return (
          <div
            key={value}
            className={`rounded-xl border transition-colors ${
              isSelected ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onChange({ action: value })}
              className="w-full flex items-start gap-3 px-4 py-3 text-left"
            >
              <span
                className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  isSelected ? 'border-indigo-500' : 'border-gray-300'
                }`}
              >
                {isSelected && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
              </span>
              <Icon size={16} className={`mt-0.5 shrink-0 ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`} />
              <span className="flex-1">
                <span className="block text-sm font-medium text-gray-700">{label}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{help}</span>
              </span>
            </button>

            {isSelected && (
              <div className="px-4 pb-4 pl-[3.25rem] space-y-2.5">
                {value === 'message' && (
                  <>
                    <textarea
                      value={config.message ?? ''}
                      onChange={(e) => onChange({ message: e.target.value })}
                      rows={2}
                      placeholder="Thank you! Your submission has been received."
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                    />
                    <p className="text-xs text-gray-400">Leave blank to use the form's default success message.</p>
                    {ctaButtons && (
                      <button
                        type="button"
                        onClick={ctaButtons.onOpen}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {ctaButtons.count > 0
                          ? `${ctaButtons.count} CTA button${ctaButtons.count === 1 ? '' : 's'} configured — edit →`
                          : 'Add CTA buttons (e.g. "Continue Application") →'}
                      </button>
                    )}
                  </>
                )}

                {urlKey && (
                  <input
                    value={(config[urlKey] as string | undefined) ?? ''}
                    onChange={(e) => onChange({ [urlKey]: e.target.value } as Partial<OnSubmitOutcomeConfig>)}
                    placeholder={URL_PLACEHOLDER[value]}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  />
                )}

                {newTabKey && (
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!config[newTabKey]}
                      onChange={(e) => onChange({ [newTabKey]: e.target.checked } as Partial<OnSubmitOutcomeConfig>)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-300"
                    />
                    Open in new tab
                  </label>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
