import { useState } from 'react'
import { GitBranch, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { ConditionalOutcome, FormField, FormStep, OnSubmitConfig } from '../../types'
import { VALUELESS_OPERATORS } from '../../types'
import { buildFieldLabeler } from '../../utils/fieldLabels'
import { OPERATOR_LABELS } from './RuleEditorModal'
import OnSubmitActionPicker from './OnSubmitActionPicker'
import OutcomeEditorModal from './OutcomeEditorModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface OnSubmitPanelProps {
  step: FormStep
  fields: FormField[]
  steps: FormStep[]
  onChange: (config: OnSubmitConfig) => void
  buttonsCount: number
  onOpenButtonsModal: () => void
}

const ACTION_SUMMARY: Record<OnSubmitConfig['action'], string> = {
  message: 'show a thank-you message',
  redirect_page: 'redirect to a page',
  redirect_url: 'redirect to a URL',
  redirect_meeting: 'redirect to a meeting link',
  redirect_payment: 'redirect to a payment link',
}

export default function OnSubmitPanel({ step, fields, steps, onChange, buttonsCount, onOpenButtonsModal }: OnSubmitPanelProps) {
  const config: OnSubmitConfig = step.onSubmitConfig ?? { action: 'message' }
  const outcomes = config.conditionalOutcomes ?? []
  const fieldLabel = buildFieldLabeler(fields, steps)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingOutcome, setEditingOutcome] = useState<ConditionalOutcome | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConditionalOutcome | null>(null)

  const update = (patch: Partial<OnSubmitConfig>) => onChange({ ...config, ...patch })
  const setOutcomes = (next: ConditionalOutcome[]) => update({ conditionalOutcomes: next })

  const describeCondition = (c: ConditionalOutcome['group']['conditions'][number]): string => {
    const label = fieldLabel(c.fieldId)
    const op = OPERATOR_LABELS[c.operator]
    if (VALUELESS_OPERATORS.includes(c.operator)) return `${label} ${op}`
    return `${label} ${op} "${c.value ?? ''}"`
  }

  const openNew = () => { setEditingOutcome(null); setModalOpen(true) }
  const openEdit = (outcome: ConditionalOutcome) => { setEditingOutcome(outcome); setModalOpen(true) }

  const handleSaveOutcome = (outcome: ConditionalOutcome) => {
    const isNew = !outcomes.some((o) => o.id === outcome.id)
    setOutcomes(isNew ? [...outcomes, outcome] : outcomes.map((o) => (o.id === outcome.id ? outcome : o)))
    setModalOpen(false)
    setEditingOutcome(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setOutcomes(outcomes.filter((o) => o.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const moveOutcome = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= outcomes.length) return
    const next = [...outcomes]
    ;[next[index], next[target]] = [next[target], next[index]]
    setOutcomes(next)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Conditional outcomes — evaluated first, in order; the base
            picker below is the fallback when none match (or none exist). */}
        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <GitBranch size={15} className="text-gray-400" />
              <div>
                <p className="text-sm font-semibold text-gray-700">Conditional outcomes</p>
                <p className="text-xs text-gray-400 mt-0.5">Route different submissions to different outcomes — first match wins.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openNew}
              disabled={fields.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 shrink-0"
            >
              <Plus size={12} /> New outcome
            </button>
          </div>

          {outcomes.length > 0 && (
            <div className="p-3 space-y-2">
              {outcomes.map((outcome, i) => (
                <div key={outcome.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {outcome.name && <p className="text-xs font-semibold text-gray-700 mb-0.5">{outcome.name}</p>}
                      <p className="text-xs text-gray-500 leading-relaxed">
                        <span className="font-bold text-indigo-500">WHEN</span>{' '}
                        {outcome.group.conditions.map(describeCondition).join(outcome.group.logic === 'AND' ? ' AND ' : ' OR ')}
                        {'  '}
                        <span className="font-bold text-emerald-600">THEN</span>{' '}
                        {ACTION_SUMMARY[outcome.config.action]}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => moveOutcome(i, -1)} disabled={i === 0} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                        <ChevronUp size={13} />
                      </button>
                      <button type="button" onClick={() => moveOutcome(i, 1)} disabled={i === outcomes.length - 1} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                        <ChevronDown size={13} />
                      </button>
                      <button type="button" onClick={() => openEdit(outcome)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <Pencil size={12} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(outcome)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Default / fallback behavior */}
        <div>
          <p className="text-sm font-semibold text-gray-700">{outcomes.length > 0 ? 'Default outcome' : 'On submission'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {outcomes.length > 0
              ? 'Used when none of the conditional outcomes above match.'
              : "What should happen right after someone submits this form?"}
          </p>
        </div>

        <OnSubmitActionPicker
          config={config}
          onChange={update}
          ctaButtons={{ count: buttonsCount, onOpen: onOpenButtonsModal }}
        />
      </div>

      <OutcomeEditorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingOutcome(null) }}
        onSave={handleSaveOutcome}
        fields={fields}
        fieldLabel={fieldLabel}
        initialOutcome={editingOutcome}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete outcome"
        message={deleteTarget ? `Delete "${deleteTarget.name || 'this outcome'}"? This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
