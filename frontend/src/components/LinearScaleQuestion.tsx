import React, { useId } from 'react'
import type { LinearScaleLabels } from '@/api/surveyAPI'

type Props = {
  labels: LinearScaleLabels
  value: number | null
  onChange: (value: number) => void
  required?: boolean
}

export default function LinearScaleQuestion({ labels, value, onChange, required }: Props) {
  const groupName = useId()
  const items: Array<{ n: 1 | 2 | 3 | 4 | 5; label: string }> = [
    { n: 1, label: labels[1] },
    { n: 2, label: labels[2] },
    { n: 3, label: labels[3] },
    { n: 4, label: labels[4] },
    { n: 5, label: labels[5] },
  ]

  const progressPercent = value == null ? 0 : ((value - 1) / 4) * 100

  return (
    <div className="mt-1">
      <div className="relative">
        {/* Track line (Google Forms-like). Only show on horizontal layout. */}
        <div className="hidden sm:block absolute left-4 right-4" style={{ top: 18 }}>
          <div className="h-[3px] rounded-full bg-[#DADCE0] dark:bg-slate-800">
            <div
              className="h-[3px] rounded-full"
              style={{ width: `${progressPercent}%`, backgroundColor: '#006400' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
        {items.map((it) => {
          const selected = value === it.n
          return (
            <label key={it.n} className="flex flex-col items-center text-center cursor-pointer select-none">
              <input
                type="radio"
                className="sr-only"
                name={groupName}
                value={it.n}
                checked={selected}
                onChange={() => onChange(it.n)}
                required={required}
              />
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                  selected ? 'bg-[#006400]' : 'bg-white dark:bg-slate-950'
                }`}
                style={{
                  borderColor: selected ? '#006400' : '#5F6368',
                }}
              >
                <span className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#202124] dark:text-slate-100'}`}>
                  {it.n}
                </span>
              </div>
              <div className="mt-2 text-[11px] leading-tight text-[#5F6368] dark:text-slate-400">
                {it.label}
              </div>
            </label>
          )
        })}
        </div>
      </div>

      {/* Mobile-friendly stacked labels if needed */}
      <div className="mt-2 hidden">
        {/* reserved for future */}
      </div>
    </div>
  )
}
