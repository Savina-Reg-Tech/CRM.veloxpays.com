import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff, ArrowUpRight } from 'lucide-react'
import FormBuilder from '../components/FormBuilder'
import { useForm, useCreateForm, useUpdateForm } from '../hooks/useForms'
import type { FormJson, FormStatus, FormField, FormStep } from '../types'
import { layoutFields } from '../utils/layoutFields'

function PreviewField({ field }: { field: FormField }) {
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg'
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea rows={3} placeholder={field.placeholder} className={`${inputCls} resize-none`} />
      ) : field.type === 'dropdown' ? (
        <select className={inputCls}>
          <option>Select…</option>
          {field.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : field.type === 'radio' ? (
        <div className="space-y-1">{field.options?.map((o) => <label key={o} className="flex items-center gap-2 text-sm"><input type="radio" readOnly /> {o}</label>)}</div>
      ) : field.type === 'checkbox' ? (
        <div className="space-y-1">{field.options?.map((o) => <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" readOnly /> {o}</label>)}</div>
      ) : field.type === 'date' ? (
        <input type="date" className={inputCls} readOnly />
      ) : field.type === 'file' ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-400">Click to upload</div>
      ) : (
        <input type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'} placeholder={field.placeholder} className={inputCls} readOnly />
      )}
      {field.helpText && <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>}
    </div>
  )
}

const STATUS_OPTIONS: { value: FormStatus; label: string; color: string }[] = [
  { value: 'draft',     label: 'Draft',     color: 'bg-amber-100 text-amber-700' },
  { value: 'published', label: 'Published', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'archived',  label: 'Archived',  color: 'bg-gray-100 text-gray-500' },
]

export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const numericId = isNew ? null : parseInt(id!, 10)
  const navigate = useNavigate()

  // Form meta state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitLabel, setSubmitLabel] = useState('Submit')
  const [successMsg, setSuccessMsg] = useState('Thank you! Your submission has been received.')
  const [status, setStatus] = useState<FormStatus>('draft')
  const [formJson, setFormJson] = useState<FormJson>({ fields: [] })
  const [preview, setPreview] = useState(false)
  const [previewStep, setPreviewStep] = useState(0)
  const [previewSubmitFlash, setPreviewSubmitFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [settingsTab, setSettingsTab] = useState<'general' | 'notifications'>('general')
  // Notification settings
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(false)
  const [notifyEmails, setNotifyEmails] = useState('')
  const [autoRespond, setAutoRespond] = useState(false)
  const [autoRespondSubject, setAutoRespondSubject] = useState('Thanks for reaching out!')
  const [autoRespondBody, setAutoRespondBody] = useState('Hi {{name}},\n\nThank you for your submission. We will get back to you shortly.\n\nBest regards,\nThe Team')

  // Load existing form
  const { data: existingForm, isLoading } = useForm(numericId)
  const createMutation = useCreateForm()
  const updateMutation = useUpdateForm(numericId ?? 0)

  // The builder canvas (FormBuilder) seeds its internal drag-and-drop state
  // from `formJson` only once, on mount — it does not re-sync on later prop
  // changes (so it never clobbers in-progress edits mid-session). That means
  // we must not mount it until the fetched form has actually landed in
  // `formJson`; otherwise it mounts with empty fields and stays empty forever.
  // `hydrated` tracks that handoff explicitly instead of relying on `isLoading`
  // flipping in the same render the data arrives (state set via `useEffect`
  // is one render behind, which was the root cause of fields never appearing
  // when editing an existing form).
  const [hydrated, setHydrated] = useState(isNew)

  useEffect(() => {
    if (existingForm) {
      setName(existingForm.name)
      setDescription(existingForm.description ?? '')
      setSubmitLabel(existingForm.submit_button_label)
      setSuccessMsg(existingForm.success_message)
      setStatus(existingForm.status)
      setFormJson(existingForm.form_json)
      setNotifyOnSubmission(existingForm.notify_on_submission ?? false)
      setNotifyEmails((existingForm.notify_emails ?? []).join(', '))
      setAutoRespond(existingForm.auto_respond ?? false)
      setAutoRespondSubject(existingForm.auto_respond_subject ?? 'Thanks for reaching out!')
      setAutoRespondBody(existingForm.auto_respond_body ?? '')
      setHydrated(true)
    }
  }, [existingForm])

  const handleSave = async () => {
    setError('')
    if (!name.trim()) { setError('Form name is required'); return }

    setSaving(true)
    try {
      const emailList = notifyEmails.split(',').map((e) => e.trim()).filter(Boolean)
      const payload = {
        name: name.trim(),
        description: description || undefined,
        form_json: formJson,
        submit_button_label: submitLabel,
        success_message: successMsg,
        status,
        notify_on_submission: notifyOnSubmission,
        notify_emails: emailList,
        auto_respond: autoRespond,
        auto_respond_subject: autoRespondSubject,
        auto_respond_body: autoRespondBody,
      }
      if (isNew) {
        const form = await createMutation.mutateAsync(payload)
        navigate(`/dashboard/forms/builder/${form.id}`, { replace: true })
      } else {
        await updateMutation.mutateAsync(payload)
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save form')
    } finally {
      setSaving(false)
    }
  }

  if (!isNew && (isLoading || !hydrated)) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400 text-sm">
        Loading form…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] -m-4 sm:-m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={() => navigate('/dashboard/forms')}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Form name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Form name…"
          className="flex-1 max-w-xs text-base font-semibold bg-transparent border-0 focus:outline-none text-gray-900 placeholder-gray-400"
        />

        {/* Status selector */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FormStatus)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Preview toggle */}
        <button
          onClick={() => setPreview((p) => !p)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border transition-colors ${
            preview ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          {preview ? <EyeOff size={14} /> : <Eye size={14} />}
          {preview ? 'Exit Preview' : 'Preview'}
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-xl transition-colors"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-600">{error}</div>
      )}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {preview ? (
          /* Live preview pane */
          (() => {
            const previewSteps: FormStep[] = formJson.steps ?? []
            const isMultiPreview = previewSteps.length > 0
            const totalPreviewSteps = previewSteps.length
            const safeStep = Math.min(previewStep, Math.max(0, totalPreviewSteps - 1))
            const previewFields: FormField[] = isMultiPreview
              ? (() => {
                  const ids = new Set(previewSteps[safeStep]?.fieldIds ?? [])
                  return formJson.fields.filter((f) => ids.has(f.id))
                })()
              : formJson.fields
            const progressPct = isMultiPreview ? Math.round(((safeStep + 1) / totalPreviewSteps) * 100) : 100
            // Mirrors PublicFormPage: the reserved "On Form Submit" step is
            // always last, and the "final field step" (default action =
            // Submit) is the one immediately before it.
            const onSubmitStepIndex = isMultiPreview ? previewSteps.findIndex((s) => s.isOnSubmit) : -1
            const hasOnSubmitStep = onSubmitStepIndex !== -1
            const isPreviewOnSubmitStep = hasOnSubmitStep && safeStep === onSubmitStepIndex
            const isPreviewFinalStep = !isMultiPreview
              || (hasOnSubmitStep ? safeStep === onSubmitStepIndex - 1 : safeStep === totalPreviewSteps - 1)
            const onSubmitConfig = isPreviewOnSubmitStep ? previewSteps[safeStep]?.onSubmitConfig : undefined
            const onSubmitAction = onSubmitConfig?.action ?? 'message'
            const isPreviewRedirect = isPreviewOnSubmitStep && onSubmitAction !== 'message'
            const redirectUrl = !isPreviewRedirect ? undefined : onSubmitAction === 'redirect_page' ? onSubmitConfig?.pageUrl
              : onSubmitAction === 'redirect_url' ? onSubmitConfig?.externalUrl
              : onSubmitAction === 'redirect_meeting' ? onSubmitConfig?.meetingUrl
              : onSubmitConfig?.paymentUrl
            // Buttons/message only ever apply when the on-submit action is
            // "Show thank-you message" — a redirect leaves the page before
            // either could show.
            const stepButtons = isMultiPreview && !isPreviewRedirect ? previewSteps[safeStep]?.buttons : undefined
            const hasCustomButtons = !!stepButtons && stepButtons.length > 0
            // A custom-button step is a deliberate CTA/decision screen — skip
            // the "Back" nav and the empty-fields placeholder there.
            const showPreviewBack = isMultiPreview && safeStep > 0 && !hasCustomButtons && !isPreviewRedirect
            // With no custom buttons configured, the on-submit step previews
            // as the default thank-you screen rather than an empty field step.
            const showPreviewThankYou = isPreviewOnSubmitStep && !hasCustomButtons && !isPreviewRedirect

            return (
              <div className="flex-1 overflow-y-auto bg-gray-100 flex items-start justify-center p-10">
                <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-blue-500 px-8 py-6">
                    <h2 className="text-xl font-bold text-white">{name || 'Untitled Form'}</h2>
                    {description && <p className="text-indigo-100 text-sm mt-1">{description}</p>}
                    {isMultiPreview && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-indigo-100 text-xs font-medium">Step {safeStep + 1} of {totalPreviewSteps}</span>
                          <span className="text-indigo-100 text-xs">{previewSteps[safeStep]?.title}</span>
                        </div>
                        <div className="w-full h-1.5 bg-indigo-400/40 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          {previewSteps.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i < safeStep ? 'bg-white' : i === safeStep ? 'bg-white scale-125' : 'bg-indigo-400/40'}`} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-8 py-6 space-y-5">
                    {isPreviewRedirect ? (
                      /* A redirect action navigates the browser away
                         immediately on real submission — nothing to fill in
                         or click here, so preview it as a destination card. */
                      <div className="text-center py-8">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                          <ArrowUpRight size={18} className="text-indigo-500" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Visitors will be redirected</h3>
                        <p className="text-gray-400 text-xs break-all">
                          {redirectUrl?.trim() || 'No destination URL set yet'}
                        </p>
                      </div>
                    ) : showPreviewThankYou ? (
                      /* Default "On Form Submit" content when no custom CTA
                         buttons are configured — mirrors the live thank-you
                         screen visitors see after actually submitting. */
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3">✅</div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1.5">You're all set!</h3>
                        <p className="text-gray-500 text-sm">{onSubmitConfig?.message?.trim() || successMsg || 'Thank you! Your submission has been received.'}</p>
                      </div>
                    ) : previewFields.length === 0 ? (
                      hasCustomButtons ? null : (
                        <p className="text-gray-400 text-sm text-center py-8">No fields yet.</p>
                      )
                    ) : (
                      layoutFields(previewFields).map((row, i) =>
                        row.kind === 'full' ? (
                          row.field.type !== 'hidden' && <PreviewField key={row.field.id} field={row.field} />
                        ) : (
                          <div key={i} className="grid grid-cols-2 gap-4">
                            {row.fields.map((f) => <PreviewField key={f.id} field={f} />)}
                          </div>
                        )
                      )
                    )}

                    {!showPreviewThankYou && !isPreviewRedirect && (
                      <div className={`flex gap-3 pt-1 ${showPreviewBack ? 'justify-between' : 'justify-end'}`}>
                        {showPreviewBack && (
                          <button
                            type="button"
                            onClick={() => setPreviewStep((s) => s - 1)}
                            className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            ← Back
                          </button>
                        )}
                        {stepButtons && stepButtons.length > 0 ? (
                          <div className="flex-1 flex flex-col gap-2">
                            <div className="flex gap-2">
                              {stepButtons.map((b) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => {
                                    if (b.action === 'next') {
                                      setPreviewStep((s) => Math.min(s + 1, totalPreviewSteps - 1))
                                    } else if (b.action === 'submit') {
                                      setPreviewSubmitFlash(true)
                                      setTimeout(() => setPreviewSubmitFlash(false), 1500)
                                      if (onSubmitStepIndex !== -1) setPreviewStep(onSubmitStepIndex)
                                    } else if (b.action === 'external_link' && b.url) {
                                      window.open(b.url, '_blank', 'noopener,noreferrer')
                                    }
                                  }}
                                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium"
                                >
                                  {b.label}
                                </button>
                              ))}
                            </div>
                            {previewSubmitFlash && (
                              <p className="text-xs text-emerald-600 text-center">✓ This button submits the form.</p>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (isPreviewFinalStep) {
                                setPreviewSubmitFlash(true)
                                setTimeout(() => setPreviewSubmitFlash(false), 1500)
                                if (onSubmitStepIndex !== -1) setPreviewStep(onSubmitStepIndex)
                              } else if (isMultiPreview && safeStep < totalPreviewSteps - 1) {
                                setPreviewStep((s) => s + 1)
                              }
                            }}
                            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium"
                          >
                            {isPreviewFinalStep ? submitLabel : 'Next →'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()
        ) : (
          /* Builder */
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Settings tabs */}
            <div className="px-4 pt-2 bg-white border-b border-gray-100 flex gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setSettingsTab('general')}
                className={`pb-2 text-xs font-semibold border-b-2 transition-colors ${settingsTab === 'general' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('notifications')}
                className={`pb-2 text-xs font-semibold border-b-2 transition-colors ${settingsTab === 'notifications' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                Notifications {notifyOnSubmission || autoRespond ? '🔔' : ''}
              </button>
            </div>

            {/* General settings bar */}
            {settingsTab === 'general' && (
              <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">Submit Label</label>
                  <input
                    value={submitLabel}
                    onChange={(e) => setSubmitLabel(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Success Message</label>
                  <input
                    value={successMsg}
                    onChange={(e) => setSuccessMsg(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
              </div>
            )}

            {/* Notification settings panel */}
            {settingsTab === 'notifications' && (
              <div className="px-6 py-4 bg-white border-b border-gray-100 space-y-5 shrink-0 max-h-72 overflow-y-auto">
                {/* Admin notification */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      className={`relative w-9 h-5 rounded-full transition-colors ${notifyOnSubmission ? 'bg-indigo-500' : 'bg-gray-300'}`}
                      onClick={() => setNotifyOnSubmission((v) => !v)}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifyOnSubmission ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Notify me on each submission</span>
                  </label>
                  {notifyOnSubmission && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Notification email(s) <span className="text-gray-400">(comma-separated)</span></label>
                      <input
                        value={notifyEmails}
                        onChange={(e) => setNotifyEmails(e.target.value)}
                        placeholder="admin@example.com, team@example.com"
                        className="w-full max-w-lg text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  )}
                </div>

                {/* Auto-responder */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      className={`relative w-9 h-5 rounded-full transition-colors ${autoRespond ? 'bg-indigo-500' : 'bg-gray-300'}`}
                      onClick={() => setAutoRespond((v) => !v)}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoRespond ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Send confirmation email to submitter</span>
                  </label>
                  {autoRespond && (
                    <div className="space-y-2 pl-12">
                      <p className="text-xs text-gray-400">Use <code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{{email}}'}</code> as tokens.</p>
                      <input
                        value={autoRespondSubject}
                        onChange={(e) => setAutoRespondSubject(e.target.value)}
                        placeholder="Email subject"
                        className="w-full max-w-lg text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      <textarea
                        value={autoRespondBody}
                        onChange={(e) => setAutoRespondBody(e.target.value)}
                        rows={4}
                        placeholder="Email body…"
                        className="w-full max-w-lg text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* The builder canvas */}
            <div className="flex-1 overflow-hidden">
              <FormBuilder
                initialFormJson={formJson}
                onChange={setFormJson}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
