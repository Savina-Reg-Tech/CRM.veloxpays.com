// Edit one email template: subject, body, required fields; live preview with sample values or a
// real booking; send a test to yourself; versions with restore. Save is explicit — templates are
// shared by every booking.
import { useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye, FlaskConical, History, PencilLine, RotateCcw, Save, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/app/providers/ToastProvider'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { AuditErrorState } from '../components/audit/AuditUI'
import { BottomSheet } from '../components/vv-audit/BottomSheet'
import { useIsDesktop, useIsTablet } from '../components/vv-audit/useMediaQuery'
import {
  useRestoreTemplate,
  useSaveTemplate,
  useTemplate,
  useTemplatePreview,
  useTemplateTest,
  useTemplateVersions,
  useTemplates,
} from '../hooks/useEmailTemplates'
import { closestPlaceholder, pdErrorText, placeholderLabel, problemsFromError, shortDateTime, unknownPlaceholdersIn } from '../pickdropEmails'
import type { EmailTemplateVersion } from '../types'
import EmailEditor from '../components/pickdrop-emails/EmailEditor'
import PlaceholderSubjectInput from '../components/pickdrop-emails/PlaceholderSubjectInput'
import { SafeHtmlFrame } from '../components/pickdrop-emails/SafeHtmlFrame'
import { ResponsiveDialog, fieldClass } from '../components/pickdrop-emails/PdUI'
import { TEMPLATES_BASE } from '../components/pickdrop-emails/paths'

function Problems({ problems, placeholders, onFix }: { problems: string[]; placeholders: { key: string }[]; onFix?: (from: string, to: string) => void }) {
  if (problems.length === 0) return null
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
      <ul className="list-disc space-y-0.5 pl-5">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {onFix &&
        unknownPlaceholdersIn(problems).map((u) => {
          const fix = closestPlaceholder(u, placeholders)
          return fix ? (
            <p key={u} className="mt-1.5">
              Did you mean{' '}
              <button type="button" onClick={() => onFix(u, fix)} className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-indigo-700 ring-1 ring-red-200 hover:underline">
                {`{{${fix}}}`}
              </button>
              ?
            </p>
          ) : null
        })}
    </div>
  )
}

function VersionsPanel({
  templateKey,
  currentVersion,
  onRestored,
}: {
  templateKey: string
  currentVersion: number
  onRestored: (version: number) => void
}) {
  const { data, isLoading, error } = useTemplateVersions(templateKey)
  const [selected, setSelected] = useState<EmailTemplateVersion | null>(null)
  const [confirm, setConfirm] = useState(false)
  const restore = useRestoreTemplate()
  const { showToast } = useToast()
  const preview = useTemplatePreview(templateKey, { subject: selected?.subject, bodyHtml: selected?.bodyHtml }, { enabled: !!selected })

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (error) return <p className="text-sm text-red-700">{pdErrorText(error)}</p>
  if (selected) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setSelected(null)} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> All versions
        </button>
        <p className="text-sm font-semibold text-gray-900">
          Version {selected.version} · {selected.changedByUserId ?? 'default'} · {shortDateTime(selected.createdAt)}
        </p>
        {selected.changeNote && <p className="text-sm text-gray-600">“{selected.changeNote}”</p>}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</p>
          <p className="break-words font-mono text-xs text-gray-800">{selected.subject}</p>
        </div>
        {preview.data ? <SafeHtmlFrame html={preview.data.html} title={`Version ${selected.version}`} /> : <Skeleton className="h-64 w-full" />}
        {selected.version !== currentVersion && (
          <Button onClick={() => setConfirm(true)} className="min-h-11 w-full">
            <RotateCcw className="h-4 w-4" /> Restore this version
          </Button>
        )}
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            restore.mutate(
              { key: templateKey, version: selected.version },
              {
                onSuccess: (tpl) => {
                  setConfirm(false)
                  setSelected(null)
                  showToast({ type: 'success', title: `Version ${selected.version} restored`, message: `Saved as version ${tpl.version}.` })
                  onRestored(tpl.version)
                },
                onError: (err) => showToast({ type: 'error', title: 'Not restored', message: pdErrorText(err) }),
              },
            )
          }
          title={`Restore version ${selected.version}?`}
          message="It is saved as a new version. New drafts will use it."
          confirmLabel="Restore"
          loading={restore.isPending}
        />
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {data?.map((v) => (
        <li key={v.version}>
          <button
            type="button"
            onClick={() => setSelected(v)}
            className="flex w-full flex-col gap-0.5 rounded-xl border border-gray-200 px-3 py-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-900">
              Version {v.version}
              {v.version === currentVersion && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">current</span>}
            </span>
            <span className="text-xs text-gray-500">
              {v.changedByUserId ?? 'default'} · {shortDateTime(v.createdAt)}
              {!v.enabled && ' · switched off'}
            </span>
            {v.changeNote && <span className="text-xs text-gray-700">“{v.changeNote}”</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function VVEmailTemplateEditorPage() {
  const { key = '' } = useParams<{ key: string }>()
  const isDesktop = useIsDesktop()
  const isTablet = useIsTablet()
  const { showToast } = useToast()
  const { data: tpl, isLoading, error, refetch } = useTemplate(key)
  const { data: list } = useTemplates()
  const placeholders = useMemo(() => (list?.placeholders ?? []).map((p) => ({ key: p.key, label: p.label })), [list])
  const save = useSaveTemplate()
  const test = useTemplateTest()

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [required, setRequired] = useState<string[]>([])
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null)
  const [orderNo, setOrderNo] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [changeNote, setChangeNote] = useState('')
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')

  // Load (and reload after save / restore).
  useEffect(() => {
    if (!tpl || tpl.version === loadedVersion) return
    setSubject(tpl.subject)
    setBody(tpl.bodyHtml)
    setRequired(tpl.requiredFields)
    setLoadedVersion(tpl.version)
    setProblems([])
  }, [tpl, loadedVersion])

  const dirty = !!tpl && (subject !== tpl.subject || body !== tpl.bodyHtml || required.join() !== tpl.requiredFields.join())
  const previewOrder = useDebounce(orderNo.trim(), 400)
  const preview = useTemplatePreview(key, { orderNo: previewOrder || undefined, subject, bodyHtml: body }, { enabled: !!tpl })
  const previewProblems = preview.data?.problems ?? (preview.error ? problemsFromError(preview.error) : [])
  const missing = useMemo(() => new Set(preview.data?.missing ?? []), [preview.data?.missing])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const doSave = () =>
    save.mutate(
      { key, body: { subject, bodyHtml: body, requiredFields: required, changeNote: changeNote.trim() || undefined } },
      {
        onSuccess: (t) => {
          setSaveOpen(false)
          setChangeNote('')
          setProblems([])
          showToast({ type: 'success', title: `Saved as version ${t.version}` })
        },
        onError: (err) => {
          setSaveOpen(false)
          const p = problemsFromError(err)
          setProblems(p.length ? p : [pdErrorText(err)])
        },
      },
    )

  const fix = (from: string, to: string) => {
    const re = new RegExp(`\\{\\{\\s*${from}\\s*\\}\\}`, 'g')
    setBody((b) => b.replace(re, `{{${to}}}`))
    setSubject((s) => s.replace(re, `{{${to}}}`))
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }
  if (error || !tpl) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to={TEMPLATES_BASE} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Email templates
        </Link>
        <AuditErrorState error={error} onRetry={() => void refetch()} notFoundText="There is no template with this name." />
      </div>
    )
  }

  const editor = (
    <section className="min-w-0 space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-1.5">
        <label htmlFor="tpl-subject" className="text-sm font-semibold text-gray-800">
          Subject
        </label>
        <PlaceholderSubjectInput id="tpl-subject" value={subject} onChange={setSubject} placeholders={placeholders} missing={missing} invalid={problems.some((p) => /subject/i.test(p))} />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-semibold text-gray-800">Message</span>
        <EmailEditor value={body} onChange={setBody} placeholders={placeholders} missing={missing} invalid={problems.length > 0} minHeightClass="min-h-[320px]" />
      </div>
      <Problems problems={problems} placeholders={placeholders} onFix={fix} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-gray-800">Required fields</legend>
        <p className="text-xs text-gray-500">Send is blocked until these have a value.</p>
        <div className="flex flex-wrap gap-2">
          {placeholders.map((p) => {
            const on = required.includes(p.key)
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => setRequired((r) => (on ? r.filter((k) => k !== p.key) : [...r, p.key]))}
                title={`{{${p.key}}}`}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors',
                  on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                )}
              >
                {on && <Check className="h-3 w-3" />}
                {p.label}
              </button>
            )
          })}
        </div>
      </fieldset>
    </section>
  )

  const previewPane = (
    <section className="min-w-0 space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-1.5">
        <label htmlFor="tpl-order" className="text-sm font-semibold text-gray-800">
          Preview with booking
        </label>
        <input
          id="tpl-order"
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder="Order number (empty = sample values)"
          className={cn(fieldClass, 'h-11 font-mono')}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span className="min-w-0 break-words">
          Subject: <span className="font-medium text-gray-800">{preview.data?.subject ?? '…'}</span>
        </span>
        {preview.isFetching && <span className="text-indigo-600">Updating…</span>}
      </div>
      {preview.data ? <SafeHtmlFrame html={preview.data.html} title="Template preview" /> : preview.isLoading ? <Skeleton className="h-80 w-full" /> : null}
      {preview.error && previewProblems.length === 0 && <p className="text-sm text-red-700">{pdErrorText(preview.error)}</p>}
      {(preview.data?.missing?.length ?? 0) > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No value for: {preview.data!.missing.map((k) => placeholderLabel(k, placeholders)).join(', ')}
        </p>
      )}
      <Problems problems={previewProblems} placeholders={placeholders} onFix={fix} />
      <Button
        variant="outline"
        className="min-h-11 w-full"
        loading={test.isPending}
        onClick={() =>
          test.mutate(
            { key, body: { orderNo: previewOrder || undefined, subject, bodyHtml: body } },
            {
              onSuccess: (r) => showToast({ type: 'success', title: `Test sent to ${r.sentTo}`, message: r.subject }),
              onError: (err) => showToast({ type: 'error', title: 'Test not sent', message: pdErrorText(err) }),
            },
          )
        }
      >
        {!test.isPending && <FlaskConical className="h-4 w-4" />} Send test to me
      </Button>
    </section>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="space-y-2">
        <Link to={TEMPLATES_BASE} className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Email templates
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{tpl.name}</h1>
            <p className="text-sm text-gray-500">
              v{tpl.version} · {tpl.updatedByUserId ? `edited by ${tpl.updatedByUserId} ${shortDateTime(tpl.updatedAt)}` : 'default wording'}
              {!tpl.enabled && ' · switched off'}
              {dirty && <span className="ml-2 font-medium text-amber-700">Unsaved changes</span>}
            </p>
          </div>
          <div className="hidden gap-2 lg:flex">
            <Button variant="outline" onClick={() => setVersionsOpen(true)} className="min-h-10">
              <History className="h-4 w-4" /> Versions
            </Button>
            <Button onClick={() => setSaveOpen(true)} disabled={!dirty} className="min-h-10">
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      </div>

      {isDesktop ? (
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-4">
          {editor}
          {previewPane}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-white p-1 text-sm font-medium">
            {(
              [
                ['edit', 'Edit', PencilLine],
                ['preview', 'Preview', Eye],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMobileView(v)}
                className={cn('inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg', mobileView === v ? 'bg-indigo-600 text-white' : 'text-gray-600')}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div className={cn(mobileView !== 'edit' && 'hidden')}>{editor}</div>
          <div className={cn(mobileView !== 'preview' && 'hidden')}>{previewPane}</div>
          <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex gap-2 border-t border-gray-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
            <Button variant="outline" onClick={() => setVersionsOpen(true)} className="min-h-11 flex-1">
              <History className="h-4 w-4" /> Versions
            </Button>
            <Button onClick={() => setSaveOpen(true)} disabled={!dirty} className="min-h-11 flex-[2]">
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </>
      )}

      {/* Save dialog with the change note */}
      <ResponsiveDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save template"
        description="Saved as a new version. New drafts use it; drafts already made keep their text."
        footer={
          <>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={doSave} loading={save.isPending}>
              <Save className="h-4 w-4" /> Save as version {tpl.version + 1}
            </Button>
          </>
        }
      >
        <label htmlFor="tpl-note" className="mb-1.5 block text-sm font-medium text-gray-800">
          What changed? <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="tpl-note"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSave()}
          maxLength={200}
          placeholder="e.g. Clearer meeting-point wording"
          className={cn(fieldClass, 'h-11')}
          autoFocus
        />
      </ResponsiveDialog>

      {/* Versions: side drawer on tablet+, bottom sheet on phones */}
      {versionsOpen &&
        (isTablet ? (
          <div className="fixed inset-0 z-40">
            <button type="button" aria-label="Close" onClick={() => setVersionsOpen(false)} className="absolute inset-0 bg-gray-900/30" />
            <aside role="dialog" aria-label="Versions" className="absolute inset-y-0 right-0 flex w-[min(32rem,100vw)] flex-col bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
                <h2 className="text-base font-semibold text-gray-900">Versions</h2>
                <button type="button" onClick={() => setVersionsOpen(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <VersionsPanel templateKey={key} currentVersion={tpl.version} onRestored={() => setVersionsOpen(false)} />
              </div>
            </aside>
          </div>
        ) : (
          <BottomSheet open onClose={() => setVersionsOpen(false)} title="Versions">
            <VersionsPanel templateKey={key} currentVersion={tpl.version} onRestored={() => setVersionsOpen(false)} />
          </BottomSheet>
        ))}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave without saving?"
        message="Your changes to this template aren't saved."
        confirmLabel="Leave without saving"
        cancelLabel="Stay"
        danger
      />
    </div>
  )
}
