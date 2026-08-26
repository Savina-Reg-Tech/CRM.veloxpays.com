import { useState } from 'react'
import { List, GitBranch as FlowIcon } from 'lucide-react'
import type { ConditionalRule, FormField, FormStep } from '../../types'
import { buildFieldLabeler } from '../../utils/fieldLabels'
import RulesPanel from './RulesPanel'
import FlowView from './FlowView'

interface LogicPanelProps {
  fields: FormField[]
  steps: FormStep[]
  rules: ConditionalRule[]
  onChange: (rules: ConditionalRule[]) => void
}

/** The Logic tab's outer shell: Rules (detailed rule configuration — the
 * existing card list/editor) and Flow (a visual overview of how visitors
 * move between steps), so a complex multi-step form's routing can be
 * understood at a glance without reading every rule card individually. */
export default function LogicPanel({ fields, steps, rules, onChange }: LogicPanelProps) {
  const [tab, setTab] = useState<'rules' | 'flow'>('rules')
  const fieldLabel = buildFieldLabeler(fields, steps)
  const hasSteps = steps.filter((s) => !s.isOnSubmit).length > 0

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
      <div className="px-6 pt-4 bg-gray-50 flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setTab('rules')}
          className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-semibold transition-colors ${
            tab === 'rules' ? 'bg-white text-indigo-600 border border-b-0 border-gray-200' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <List size={13} /> Rules
        </button>
        {hasSteps && (
          <button
            type="button"
            onClick={() => setTab('flow')}
            className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === 'flow' ? 'bg-white text-indigo-600 border border-b-0 border-gray-200' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <FlowIcon size={13} /> Flow
          </button>
        )}
      </div>

      {tab === 'rules' || !hasSteps ? (
        <RulesPanel fields={fields} steps={steps} rules={rules} onChange={onChange} />
      ) : (
        <div className="flex-1 overflow-auto bg-white border-t border-gray-200 p-6">
          <FlowView steps={steps} rules={rules} fieldLabel={fieldLabel} />
        </div>
      )}
    </div>
  )
}
