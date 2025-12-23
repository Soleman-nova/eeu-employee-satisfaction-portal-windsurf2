import React, { useId } from 'react'
import type { LinearScaleLabels } from '@/api/surveyAPI'

type DisplayStyle = 'stars' | 'emojis' | 'numbers'

type Props = {
  labels: LinearScaleLabels
  displayStyle: DisplayStyle
  value: number | null
  onChange: (value: number) => void
  required?: boolean
}

const emojiByValue: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '😞',
  2: '🙁',
  3: '😐',
  4: '🙂',
  5: '😊',
}

export default function RatingQuestion({ labels, displayStyle, value, onChange, required }: Props) {
  const groupName = useId()

  const items: Array<{ n: 1 | 2 | 3 | 4 | 5; label: string }> = [
    { n: 1, label: labels[1] },
    { n: 2, label: labels[2] },
    { n: 3, label: labels[3] },
    { n: 4, label: labels[4] },
    { n: 5, label: labels[5] },
  ]

  const renderIcon = (n: 1 | 2 | 3 | 4 | 5, selected: boolean) => {
    if (displayStyle === 'emojis') {
      return (
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
            selected ? 'bg-[#E8F5E9] dark:bg-slate-800' : 'bg-white dark:bg-slate-950'
          }`}
          style={{
            borderColor: selected ? '#006400' : '#5F6368',
          }}
        >
          <span className="text-2xl leading-none">{emojiByValue[n]}</span>
        </div>
      )
    }

    if (displayStyle === 'numbers') {
      return (
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
            selected ? 'bg-[#006400]' : 'bg-white dark:bg-slate-950'
          }`}
          style={{
            borderColor: selected ? '#006400' : '#5F6368',
          }}
        >
          <span className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#202124] dark:text-slate-100'}`}>
            {n}
          </span>
        </div>
      )
    }

    // stars
    return (
      <span
        className="text-3xl leading-none"
        style={{
          color: selected ? '#006400' : '#5F6368',
        }}
      >
        {selected ? '★' : '☆'}
      </span>
    )
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-start justify-center gap-3" role="radiogroup">
        {items.map((it) => {
          const selected = value === it.n
          return (
            <label
              key={it.n}
              className="group flex flex-col items-center text-center cursor-pointer select-none rounded-xl p-1"
              onClick={() => onChange(it.n)}
            >
              <input
                type="radio"
                className="sr-only"
                name={groupName}
                value={it.n}
                checked={selected}
                onChange={(e) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10)
                  if (Number.isFinite(v)) onChange(v)
                }}
                required={required}
                aria-label={`${it.n} - ${it.label}`}
              />

              <div
                className="transition-all rounded-xl group-hover:shadow-[0_0_0_4px_rgba(255,98,0,0.20)]"
                style={{
                  boxShadow: selected ? '0 0 0 4px rgba(0,100,0,0.15)' : 'none',
                }}
              >
                <div
                  className="rounded-xl px-2 py-1"
                  style={{
                    boxShadow: 'none',
                  }}
                >
                  {renderIcon(it.n, selected)}
                </div>
              </div>

              <div className="mt-2 text-[11px] leading-tight text-[#5F6368] dark:text-slate-400">
                {it.label}
              </div>

            </label>
          )
        })}
      </div>
    </div>
  )
}
