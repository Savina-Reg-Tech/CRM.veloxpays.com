import type { ConditionalRule, FormStep } from '../../types'
import { VALUELESS_OPERATORS, RANGE_OPERATORS, MULTI_VALUE_OPERATORS, NAVIGATION_ACTION_TYPES } from '../../types'
import { OPERATOR_LABELS } from './RuleEditorModal'

interface FlowViewProps {
  steps: FormStep[]
  rules: ConditionalRule[]
  fieldLabel: (fieldId: string) => string
}

const ROW_HEIGHT = 56
const ROW_GAP = 48
const ROW_PITCH = ROW_HEIGHT + ROW_GAP
const BOX_X = 24
const BOX_WIDTH = 200
const SVG_WIDTH = 620
const EDGE_COLORS = ['#7c3aed', '#d97706', '#0891b2', '#db2777', '#059669']

/** One short line describing a rule's condition — just the first condition
 * (with a "+N more" suffix if there are others) so an arrow label in the
 * diagram stays readable instead of turning into a paragraph. */
function shortCondition(rule: ConditionalRule, fieldLabel: (id: string) => string): string {
  const c = rule.group.conditions[0]
  if (!c) return rule.name || 'Rule'
  const label = fieldLabel(c.fieldId)
  const op = OPERATOR_LABELS[c.operator]
  let text: string
  if (VALUELESS_OPERATORS.includes(c.operator)) text = `${label} ${op}`
  else if (RANGE_OPERATORS.includes(c.operator)) text = `${label} ${op} ${c.value ?? ''}–${c.value2 ?? ''}`
  else if (MULTI_VALUE_OPERATORS.includes(c.operator)) text = `${label} ${op} ${(c.values ?? []).slice(0, 2).join('/')}`
  else text = `${label} ${op} ${c.value ?? ''}`
  const extra = rule.group.conditions.length > 1 ? ` +${rule.group.conditions.length - 1}` : ''
  return text + extra
}

interface Edge { from: number; to: number; rule: ConditionalRule }

/** A clean, hand-drawn (not library-generated) boxes-and-arrows overview of
 * how visitors move through a multi-step form: a light gray line shows the
 * default "just go to the next step" path, and colored labeled curves show
 * every explicit navigation rule's branch. Deliberately simple — plain SVG,
 * fixed row layout, no external graph-layout dependency — so it stays easy
 * to reason about even as the Rules list grows. */
export default function FlowView({ steps, rules, fieldLabel }: FlowViewProps) {
  const navigableSteps = steps.filter((s) => !s.isOnSubmit)

  if (navigableSteps.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">Add at least one step to see the flow.</p>
  }

  const indexOf = (id: string) => navigableSteps.findIndex((s) => s.id === id)
  const terminalRow = navigableSteps.length // the "Submitted" box sits one row past the last real step
  const totalRows = terminalRow + 1

  const edges: Edge[] = []
  for (const rule of rules) {
    if (!rule.enabled || !rule.fromStepId) continue
    const navAction = rule.actions.find((a) => NAVIGATION_ACTION_TYPES.includes(a.type))
    if (!navAction) continue
    const from = indexOf(rule.fromStepId)
    if (from === -1) continue

    if (navAction.type === 'goto_step') {
      const to = indexOf(navAction.stepId)
      edges.push({ from, to: to === -1 ? terminalRow : to, rule })
    } else if (navAction.type === 'skip_step') {
      const skipIdx = indexOf(navAction.stepId)
      const to = skipIdx === -1 ? terminalRow : (skipIdx + 1 < navigableSteps.length ? skipIdx + 1 : terminalRow)
      edges.push({ from, to, rule })
    } else if (navAction.type === 'previous_step') {
      if (from > 0) edges.push({ from, to: from - 1, rule })
    } else if (navAction.type === 'next_step') {
      edges.push({ from, to: from + 1 < navigableSteps.length ? from + 1 : terminalRow, rule })
    } else if (navAction.type === 'end_form') {
      edges.push({ from, to: terminalRow, rule })
    }
  }

  const svgHeight = totalRows * ROW_PITCH + 20
  const centerY = (row: number) => row * ROW_PITCH + 20 + ROW_HEIGHT / 2
  const boxRightX = BOX_X + BOX_WIDTH

  const edgesBySource = new Map<number, Edge[]>()
  for (const e of edges) {
    if (!edgesBySource.has(e.from)) edgesBySource.set(e.from, [])
    edgesBySource.get(e.from)!.push(e)
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <svg width={SVG_WIDTH} height={svgHeight} className="min-w-[560px]">
          <defs>
            <marker id="flow-arrow-default" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#d1d5db" />
            </marker>
            {EDGE_COLORS.map((c, i) => (
              <marker key={c} id={`flow-arrow-${i}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill={c} />
              </marker>
            ))}
          </defs>

          {/* Default sequential path: every row falls through to the next
              unless a rule below overrides it. */}
          {Array.from({ length: totalRows - 1 }).map((_, i) => {
            const y1 = i * ROW_PITCH + 20 + ROW_HEIGHT
            const y2 = (i + 1) * ROW_PITCH + 20
            return (
              <line
                key={`default-${i}`}
                x1={BOX_X + BOX_WIDTH / 2} y1={y1} x2={BOX_X + BOX_WIDTH / 2} y2={y2 - 2}
                stroke="#d1d5db" strokeWidth={1.5} markerEnd="url(#flow-arrow-default)"
              />
            )
          })}

          {/* Rule-driven branches — curved so they're visually distinct from
              the default straight-down path, fanned out when a step has
              more than one. */}
          {edges.map((e, i) => {
            const y1 = centerY(e.from)
            const y2 = centerY(e.to)
            const siblingIdx = edgesBySource.get(e.from)!.indexOf(e)
            const bow = 50 + siblingIdx * 34 + Math.min(Math.abs(e.to - e.from), 3) * 16
            const cx = boxRightX + bow
            const color = EDGE_COLORS[i % EDGE_COLORS.length]
            const path = `M ${boxRightX} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${boxRightX + 6} ${y2}`
            const labelY = (y1 + y2) / 2
            return (
              <g key={`${e.rule.id}-${i}`}>
                <path d={path} fill="none" stroke={color} strokeWidth={1.5} markerEnd={`url(#flow-arrow-${i % EDGE_COLORS.length})`} />
                <text x={cx + 6} y={labelY} fontSize={10} fontWeight={500} fill={color}>
                  {shortCondition(e.rule, fieldLabel)}
                </text>
              </g>
            )
          })}

          {/* Step boxes */}
          {navigableSteps.map((step, i) => (
            <g key={step.id}>
              <rect x={BOX_X} y={i * ROW_PITCH + 20} width={BOX_WIDTH} height={ROW_HEIGHT} rx={10} fill="#fff" stroke="#e5e7eb" strokeWidth={1.5} />
              <text x={BOX_X + BOX_WIDTH / 2} y={i * ROW_PITCH + 20 + ROW_HEIGHT / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#374151">
                {step.title}
              </text>
            </g>
          ))}

          {/* Terminal "Submitted" box */}
          <g>
            <rect x={BOX_X} y={terminalRow * ROW_PITCH + 20} width={BOX_WIDTH} height={ROW_HEIGHT} rx={10} fill="#ecfdf5" stroke="#a7f3d0" strokeWidth={1.5} />
            <text x={BOX_X + BOX_WIDTH / 2} y={terminalRow * ROW_PITCH + 20 + ROW_HEIGHT / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#059669">
              Submitted
            </text>
          </g>
        </svg>
      </div>
      {edges.length === 0 && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          No navigation rules yet — visitors just move through the steps in order. Add a rule with a "Then go to" action in the Rules tab to branch the flow.
        </p>
      )}
    </div>
  )
}
