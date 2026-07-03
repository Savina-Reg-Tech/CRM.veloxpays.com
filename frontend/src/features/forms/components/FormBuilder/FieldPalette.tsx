import {
  Type, Mail, Phone, AlignLeft, ChevronDown,
  CheckSquare, Circle, Calendar, Paperclip, EyeOff,
} from 'lucide-react'
import type { FieldType } from '../../types'

const PALETTE_FIELDS: { type: FieldType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'text',      label: 'Text Input',    icon: Type,        color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { type: 'email',     label: 'Email',         icon: Mail,        color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { type: 'phone',     label: 'Phone',         icon: Phone,       color: 'bg-green-50 text-green-600 border-green-200' },
  { type: 'textarea',  label: 'Textarea',      icon: AlignLeft,   color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { type: 'dropdown',  label: 'Dropdown',      icon: ChevronDown, color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  { type: 'checkbox',  label: 'Checkbox',      icon: CheckSquare, color: 'bg-teal-50 text-teal-600 border-teal-200' },
  { type: 'radio',     label: 'Radio Button',  icon: Circle,      color: 'bg-pink-50 text-pink-600 border-pink-200' },
  { type: 'date',      label: 'Date Picker',   icon: Calendar,    color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  { type: 'file',      label: 'File Upload',   icon: Paperclip,   color: 'bg-gray-50 text-gray-600 border-gray-200' },
  { type: 'hidden',    label: 'Hidden Field',  icon: EyeOff,      color: 'bg-gray-50 text-gray-400 border-gray-200' },
]

interface FieldPaletteProps {
  onDragStart: (type: FieldType) => void
}

export default function FieldPalette({ onDragStart }: FieldPaletteProps) {
  return (
    <div className="w-52 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Fields</p>
        <p className="text-xs text-gray-400 mt-0.5">Drag to add</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {PALETTE_FIELDS.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('fieldType', item.type)
                e.dataTransfer.effectAllowed = 'copy'
                onDragStart(item.type)
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-sm ${item.color}`}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
