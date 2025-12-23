import React from 'react'

type TextQuestionProps = {
  type: 'short' | 'paragraph'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: boolean
}

export default function TextQuestion({ type, value, onChange, placeholder, error }: TextQuestionProps) {
  const limit = type === 'short' ? 300 : 500
  const rows = type === 'short' ? 3 : 6
  const reached = value.length >= limit

  return (
    <div className="mt-1">
      <textarea
        className={`w-full border rounded-md px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-1 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 ${
          error ? 'border-red-500 focus:ring-red-200' : 'border-[#DADCE0] dark:border-slate-700'
        }`}
        style={{ boxShadow: 'none' }}
        rows={rows}
        maxLength={limit}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1 flex flex-col items-end">
        <span className={`text-sm ${reached ? 'text-[#FF6200]' : 'text-gray-500 dark:text-slate-400'}`}>
          {value.length}/{limit}
        </span>
        {reached && (
          <span className="text-xs text-[#FF6200]">Maximum {limit} characters reached</span>
        )}
      </div>
    </div>
  )
}
