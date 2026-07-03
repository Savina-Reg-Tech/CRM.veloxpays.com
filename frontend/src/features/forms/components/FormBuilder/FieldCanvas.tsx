import { GripVertical, Trash2, LayoutTemplate } from 'lucide-react'
import type { FormField } from '../../types'

interface FieldCanvasProps {
  fields: FormField[]
  selectedId: string | null
  dropTargetIndex: number | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (e: React.DragEvent, index: number) => void
  onDropEmpty: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function FieldPreview({ field }: { field: FormField }) {
  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-400 pointer-events-none'

  switch (field.type) {
    case 'textarea':
      return <textarea className={inputClass} rows={3} placeholder={field.placeholder || 'Enter text...'} readOnly />
    case 'dropdown':
      return (
        <select className={inputClass} disabled>
          <option>{field.placeholder || 'Select...'}</option>
          {field.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      )
    case 'checkbox':
      return (
        <div className="space-y-1 pointer-events-none">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" disabled /> {o}
            </label>
          ))}
        </div>
      )
    case 'radio':
      return (
        <div className="space-y-1 pointer-events-none">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-400">
              <input type="radio" disabled /> {o}
            </label>
          ))}
        </div>
      )
    case 'date':
      return <input type="date" className={inputClass} readOnly />
    case 'file':
      return (
        <div className="w-full px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400 text-center pointer-events-none">
          Click to upload a file
        </div>
      )
    case 'hidden':
      return <div className="text-xs text-gray-400 italic px-1">Hidden — not visible to users</div>
    case 'section':
      return (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 pointer-events-none">
          <p className="text-sm font-semibold text-gray-800">{field.label}</p>
          {field.helpText && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{field.helpText}</p>}
        </div>
      )
    default:
      return (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
          className={inputClass}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
          readOnly
        />
      )
  }
}

export default function FieldCanvas({
  fields, selectedId, dropTargetIndex,
  onSelect, onRemove, onDragStart,
  onDragOver, onDrop, onDropEmpty, onDragEnd,
}: FieldCanvasProps) {
  return (
    <div
      className="flex-1 overflow-y-auto bg-gray-50 p-6"
      onDragOver={(e) => { if (fields.length === 0) { e.preventDefault() } }}
      onDrop={fields.length === 0 ? onDropEmpty : undefined}
    >
      {fields.length === 0 ? (
        <div
          className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl text-gray-400"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropEmpty}
        >
          <LayoutTemplate size={40} className="mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Drop fields here to build your form</p>
          <p className="text-sm text-gray-400 mt-1">Drag fields from the left panel</p>
        </div>
      ) : (
        <div className="space-y-0">
          {fields.map((field, index) => (
            <div key={field.id}>
              {/* Drop indicator above */}
              <div
                className={`h-1 rounded-full mx-2 transition-all ${dropTargetIndex === index ? 'bg-indigo-400' : 'bg-transparent'}`}
                onDragOver={(e) => onDragOver(e, index)}
                onDrop={(e) => onDrop(e, index)}
              />

              {/* Field card */}
              <div
                className={`group relative bg-white rounded-xl border-2 transition-all cursor-pointer mb-2 ${
                  selectedId === field.id
                    ? 'border-indigo-400 shadow-md shadow-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => onSelect(field.id)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('canvasIndex', String(index))
                  e.dataTransfer.effectAllowed = 'move'
                  onDragStart(index)
                }}
                onDragOver={(e) => onDragOver(e, index + 1)}
                onDrop={(e) => onDrop(e, index + 1)}
                onDragEnd={onDragEnd}
              >
                {/* Drag handle */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={16} />
                </div>

                <div className="px-8 py-4">
                  {/* Label row */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">{field.label}</span>
                    {field.required && <span className="text-red-500 text-xs font-bold">*</span>}
                    <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                      {field.type}
                    </span>
                    {field.width === 'half' && (
                      <span className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">½</span>
                    )}
                  </div>

                  {/* Field preview */}
                  <FieldPreview field={field} />

                  {field.helpText && (
                    <p className="text-xs text-gray-400 mt-1.5">{field.helpText}</p>
                  )}
                </div>

                {/* Delete button */}
                <button
                  className="absolute right-3 top-3 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onRemove(field.id) }}
                  type="button"
                  title="Remove field"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {/* Drop zone at bottom */}
          <div
            className={`h-2 rounded-full mx-2 transition-all ${dropTargetIndex === fields.length ? 'bg-indigo-400' : 'bg-transparent'}`}
            onDragOver={(e) => onDragOver(e, fields.length)}
            onDrop={(e) => onDrop(e, fields.length)}
          />

          {/* Explicit drop zone below all fields */}
          <div
            className="mt-2 h-12 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm"
            onDragOver={(e) => onDragOver(e, fields.length)}
            onDrop={(e) => onDrop(e, fields.length)}
          >
            Drop here to add at the end
          </div>
        </div>
      )}
    </div>
  )
}
