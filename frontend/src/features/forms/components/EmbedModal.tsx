import { useState } from 'react'
import { Code2, ExternalLink, Copy, Check } from 'lucide-react'
import type { EmbedCodes } from '../types'

interface EmbedModalProps {
  open: boolean
  onClose: () => void
  embedCodes: EmbedCodes | null
  isLoading: boolean
}

export default function EmbedModal({ open, onClose, embedCodes, isLoading }: EmbedModalProps) {
  const [tab, setTab] = useState<'iframe' | 'js'>('iframe')
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const code = tab === 'iframe' ? embedCodes?.iframe : embedCodes?.javascript

  const handleCopy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-800">Embed Form</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6">
          {/* Public URL */}
          {embedCodes?.formUrl && (
            <div className="mb-5 p-3 bg-indigo-50 rounded-xl flex items-center gap-3">
              <ExternalLink size={16} className="text-indigo-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-indigo-600 font-medium mb-0.5">Public form URL</p>
                <a
                  href={embedCodes.formUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-indigo-700 truncate block hover:underline"
                >
                  {embedCodes.formUrl}
                </a>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(['iframe', 'js'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  tab === t ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {t === 'iframe' ? 'iFrame Embed' : 'JavaScript Embed'}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="relative">
            <pre className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono min-h-[120px]">
              {isLoading ? 'Loading...' : (code ?? '—')}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {tab === 'js' && (
            <p className="text-xs text-gray-400 mt-3">
              Add the <code className="bg-gray-100 px-1 rounded">&lt;div&gt;</code> and <code className="bg-gray-100 px-1 rounded">&lt;script&gt;</code> tags anywhere on your page.
              The form will render inside the target div automatically.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
