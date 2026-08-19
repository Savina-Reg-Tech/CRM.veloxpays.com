import { MessageSquare, FileText, Link2, CalendarClock, CreditCard } from 'lucide-react'
import type { FormStep, OnSubmitAction, OnSubmitConfig } from '../../types'

interface OnSubmitPanelProps {
  step: FormStep
  onChange: (config: OnSubmitConfig) => void
  buttonsCount: number
  onOpenButtonsModal: () => void
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

// Which OnSubmitConfig field holds the URL for each redirect action — kept
// separate per action (rather than one shared field) so switching between
// options in the builder never overwrites a link already typed elsewhere.
const URL_FIELD: Partial<Record<OnSubmitAction, keyof OnSubmitConfig>> = {
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

export default function OnSubmitPanel({ step, onChange, buttonsCount, onOpenButtonsModal }: OnSubmitPanelProps) {
  const config: OnSubmitConfig = step.onSubmitConfig ?? { action: 'message' }
  const action = config.action

  const update = (patch: Partial<OnSubmitConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-lg mx-auto space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700">On submission</p>
          <p className="text-xs text-gray-400 mt-0.5">What should happen right after someone submits this form?</p>
        </div>

        <div className="space-y-2">
          {OPTIONS.map(({ value, label, help, icon: Icon }) => {
            const isSelected = action === value
            const urlKey = URL_FIELD[value]

            return (
              <div
                key={value}
                className={`rounded-xl border transition-colors ${
                  isSelected ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => update({ action: value })}
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
                          onChange={(e) => update({ message: e.target.value })}
                          rows={2}
                          placeholder="Thank you! Your submission has been received."
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                        />
                        <p className="text-xs text-gray-400">Leave blank to use the form's default success message.</p>
                        <button
                          type="button"
                          onClick={onOpenButtonsModal}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          {buttonsCount > 0
                            ? `${buttonsCount} CTA button${buttonsCount === 1 ? '' : 's'} configured — edit →`
                            : 'Add CTA buttons (e.g. "Continue Application") →'}
                        </button>
                      </>
                    )}

                    {urlKey && (
                      <input
                        value={(config[urlKey] as string | undefined) ?? ''}
                        onChange={(e) => update({ [urlKey]: e.target.value } as Partial<OnSubmitConfig>)}
                        placeholder={URL_PLACEHOLDER[value]}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
